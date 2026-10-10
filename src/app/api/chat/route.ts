import { z } from "zod";
import { guardSession } from "@/lib/auth/guards";
import { answerQuestion } from "@/lib/ai/chat";
import { db } from "@/lib/db";
import { hitRateLimit } from "@/lib/ratelimit";
import { kickQueueAfterResponse } from "@/lib/queue/runner";

const ChatSchema = z
  .object({
    conversationId: z.string().min(1).max(64),
    message: z.string().min(1).max(4000),
    phone: z.string().min(6).max(30).optional(),
  })
  .strict();

export async function POST(request: Request) {
  const guard = await guardSession();
  if (!guard.ok) return guard.response;

  const raw = await request.json().catch(() => null);
  const parsed = ChatSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const limit = await hitRateLimit(
    `chat:${guard.session.userId}`,
    30,
    60_000,
  );
  if (!limit.ok) {
    return Response.json(
      { error: "Too many messages. Slow down." },
      { status: 429 },
    );
  }

  const conversation = await db.conversation.findFirst({
    where: {
      id: parsed.data.conversationId,
      clinicId: guard.session.clinicId,
    },
    include: { patient: true, clinic: true },
  });
  if (!conversation) {
    return Response.json({ error: "Conversation not found." }, { status: 404 });
  }

  await db.message.create({
    data: {
      clinicId: guard.session.clinicId,
      conversationId: conversation.id,
      author: "USER",
      content: parsed.data.message,
    },
  });

  await db.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  });

  if (conversation.state !== "AI" || !conversation.aiEnabled) {
    return Response.json({
      reply: null,
      state: conversation.state,
      note: "Conversation is with a human. Message saved.",
    });
  }

  const outcome = await answerQuestion({
    clinicId: guard.session.clinicId,
    clinicName: conversation.clinic.name,
    locale: conversation.patient.locale,
    question: parsed.data.message,
    phone: parsed.data.phone ?? conversation.patient.phone,
  });

  if (!outcome.ok) {
    if (outcome.error === "LLM_DISABLED") {
      kickQueueAfterResponse();
      return Response.json({
        reply: null,
        state: conversation.state,
        note: "AI is not configured. A receptionist will reply shortly.",
      });
    }
    kickQueueAfterResponse();
    return Response.json({
      reply: null,
      state: conversation.state,
      note: "Something went wrong. A receptionist will reply shortly.",
      error: outcome.error,
    });
  }

  await db.message.create({
    data: {
      clinicId: guard.session.clinicId,
      conversationId: conversation.id,
      author: "AI",
      content: outcome.answer,
      meta: {
        sources: outcome.sources.map((s) => ({ title: s.title })),
      },
    },
  });

  await db.conversation.update({
    where: { id: conversation.id },
    data: { lastMessageAt: new Date() },
  });

  return Response.json({
    reply: outcome.answer,
    sources: outcome.sources,
    state: conversation.state,
  });
}
