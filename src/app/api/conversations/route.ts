import { NextResponse } from "next/server";
import { guardSession } from "@/lib/auth/guards";
import { db } from "@/lib/db";

export async function GET() {
  const guard = await guardSession();
  if (!guard.ok) {
    return NextResponse.json(
      { error: "Authentication required." },
      { status: 401 },
    );
  }

  const conversations = await db.conversation.findMany({
    where: { clinicId: guard.session.clinicId },
    orderBy: { lastMessageAt: "desc" },
    include: {
      patient: { select: { name: true, phone: true, locale: true } },
      messages: {
        orderBy: { createdAt: "asc" },
        select: {
          id: true,
          author: true,
          content: true,
          createdAt: true,
        },
      },
    },
  });

  const shaped = conversations.map((c) => ({
    id: c.id,
    patientName: c.patient.name,
    phone: c.patient.phone,
    state: c.state,
    aiEnabled: c.aiEnabled,
    channel: c.channel,
    lastMessageAt: c.lastMessageAt.toISOString(),
    lastPreview: c.messages.at(-1)?.content ?? "",
    messages: c.messages.map((m) => ({
      id: m.id,
      author: m.author,
      content: m.content,
      createdAt: m.createdAt.toISOString(),
    })),
  }));

  return NextResponse.json({ conversations: shaped });
}
