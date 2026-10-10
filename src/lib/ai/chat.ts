import "server-only";

import { z } from "zod";
import { db } from "@/lib/db";
import { isSlotFree, listAppointments } from "@/lib/booking/calendar";
import { isValidSlot, parseIsoDate, slotToUtc } from "@/lib/booking/scheduler";
import { retrieveChunks, type RetrievedChunk } from "@/lib/rag/retrieve";

export type SourceChunk = { title: string; content: string };

export type AnswerResult =
  | { ok: true; answer: string; sources: SourceChunk[] }
  | { ok: false; error: string };

const ToolCallSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("check_availability"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  }),
  z.object({
    type: z.literal("book_appointment"),
    patientName: z.string().min(1).max(120),
    phone: z.string().min(6).max(30),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    slot: z.string().refine(isValidSlot, "invalid slot"),
    kind: z.string().min(1).max(80).default("visit"),
  }),
  z.object({
    type: z.literal("cancel_appointment"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    slot: z.string().refine(isValidSlot, "invalid slot"),
    phone: z.string().min(6).max(30).optional(),
  }),
]);

type ToolCall = z.infer<typeof ToolCallSchema>;
type ToolKind = ToolCall["type"];

const ALLOWED_TOOLS: readonly ToolKind[] = [
  "check_availability",
  "book_appointment",
  "cancel_appointment",
] as const;

function toolSchemaHint(): string {
  return [
    "You may call tools. Allowed tools ONLY:",
    '1. {"type":"check_availability","date":"YYYY-MM-DD"}',
    '2. {"type":"book_appointment","patientName":"...","phone":"...","date":"YYYY-MM-DD","slot":"HH:MM","kind":"..."}',
    '3. {"type":"cancel_appointment","date":"YYYY-MM-DD","slot":"HH:MM","phone":"..."}',
    "When you need real data, emit a single tool call as the whole reply.",
  ].join("\n");
}

function buildSystemPrompt(clinicName: string, locale: string): string {
  const lang = locale.startsWith("ar") ? "Arabic" : "English";
  return [
    `You are the front-desk assistant for ${clinicName}.`,
    `Reply in ${lang} only. Be concise and polite.`,
    "Answer ONLY from the provided clinic knowledge. If the answer is not in the knowledge, say you will connect a human receptionist — never invent prices, hours, or policies.",
    "If the patient wants to book, cancel, or check appointments, you MUST use a tool call (the whole reply is one JSON tool call object).",
    toolSchemaHint(),
  ].join("\n");
}

function extractJson<T>(text: string, schema: z.ZodType<T>): T | null {
  const trimmed = text.trim();
  const candidates: string[] = [trimmed];
  const firstBrace = trimmed.indexOf("{");
  const lastBrace = trimmed.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(trimmed.slice(firstBrace, lastBrace + 1));
  }
  for (const candidate of candidates) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(candidate);
    } catch {
      continue;
    }
    const result = schema.safeParse(parsed);
    if (result.success) return result.data;
  }
  return null;
}

function tryParseToolCall(text: string): ToolCall | null {
  const parsed = extractJson(text, ToolCallSchema);
  if (!parsed) return null;
  if (!(ALLOWED_TOOLS as readonly string[]).includes(parsed.type)) return null;
  return parsed;
}

function formatSources(chunks: RetrievedChunk[]): SourceChunk[] {
  return chunks.map((c) => ({ title: c.title, content: c.content }));
}

function contextBlock(chunks: RetrievedChunk[]): string {
  if (chunks.length === 0) return "(no matching clinic documents)";
  return chunks
    .map((c, i) => `[${i + 1}] ${c.title}\n${c.content}`)
    .join("\n\n");
}

async function runTool(
  clinicId: string,
  call: ToolCall,
): Promise<string> {
  if (call.type === "check_availability") {
    const date = parseIsoDate(call.date);
    if (!date) return JSON.stringify({ error: "invalid date" });
    const appts = await listAppointments({
      clinicId,
      dateIso: call.date,
      date,
    });
    return JSON.stringify({
      date: call.date,
      booked: appts.map((a) => ({ slot: a.slot, kind: a.kind })),
    });
  }

  if (call.type === "book_appointment") {
    const date = parseIsoDate(call.date);
    if (!date) return JSON.stringify({ error: "invalid date" });
    if (!isValidSlot(call.slot)) return JSON.stringify({ error: "invalid slot" });

    const free = await isSlotFree({ clinicId, date, slot: call.slot });
    if (!free) return JSON.stringify({ error: "slot_taken", slot: call.slot });

    const startsAt = slotToUtc(date, call.slot);
    const endsAt = new Date(startsAt);
    endsAt.setHours(endsAt.getHours() + 1);

    const patient = await db.patient.upsert({
      where: { clinicId_phone: { clinicId, phone: call.phone } },
      create: { clinicId, name: call.patientName, phone: call.phone },
      update: { name: call.patientName },
    });

    const appt = await db.appointment.create({
      data: {
        clinicId,
        patientId: patient.id,
        startsAt,
        endsAt,
        kind: call.kind,
        status: "BOOKED",
      },
    });

    return JSON.stringify({
      ok: true,
      appointmentId: appt.id,
      slot: call.slot,
      date: call.date,
    });
  }

  // cancel_appointment
  const date = parseIsoDate(call.date);
  if (!date) return JSON.stringify({ error: "invalid date" });
  if (!isValidSlot(call.slot)) return JSON.stringify({ error: "invalid slot" });
  const startsAt = slotToUtc(date, call.slot);
  const endsAt = new Date(startsAt);
  endsAt.setHours(endsAt.getHours() + 1);

  const where: Record<string, unknown> = {
    clinicId,
    startsAt,
    endsAt,
    status: { in: ["BOOKED", "RESCHEDULED"] },
  };
  if (call.phone) {
    const patient = await db.patient.findUnique({
      where: { clinicId_phone: { clinicId, phone: call.phone } },
    });
    if (!patient) return JSON.stringify({ error: "no_such_patient" });
    where.patientId = patient.id;
  }

  const existing = await db.appointment.findFirst({ where });
  if (!existing) return JSON.stringify({ error: "not_found" });

  await db.appointment.update({
    where: { id: existing.id },
    data: { status: "CANCELLED" },
  });
  return JSON.stringify({ ok: true, cancelled: existing.id });
}

async function callChatComplete(params: {
  system: string;
  user: string;
}): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    // Deterministic local pipeline: no OpenAI key. Never invent an answer.
    throw new Error("LLM_DISABLED");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_CHAT_MODEL ?? "gpt-4o-mini",
      messages: [
        { role: "system", content: params.system },
        { role: "user", content: params.user },
      ],
      temperature: 0.2,
      max_tokens: 500,
    }),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`chat_failed_${response.status}:${body.slice(0, 200)}`);
  }

  const json = (await response.json()) as {
    choices?: { message?: { content?: string } }[];
  };
  return json.choices?.[0]?.message?.content ?? "";
}

export async function answerQuestion(params: {
  clinicId: string;
  clinicName: string;
  locale: string;
  question: string;
  phone?: string;
}): Promise<AnswerResult> {
  const chunks = await retrieveChunks({
    clinicId: params.clinicId,
    query: params.question,
    limit: 6,
  });

  const system = buildSystemPrompt(params.clinicName, params.locale);
  const user = [
    `Clinic knowledge:`,
    contextBlock(chunks),
    "",
    `Patient message: ${params.question}`,
    params.phone ? `Patient phone (for tools): ${params.phone}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  let raw: string;
  try {
    raw = await callChatComplete({ system, user });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (msg === "LLM_DISABLED") {
      return {
        ok: false,
        error: "LLM_DISABLED",
      };
    }
    return { ok: false, error: msg.slice(0, 300) };
  }

  const toolCall = tryParseToolCall(raw);
  if (toolCall) {
    const toolResult = await runTool(params.clinicId, toolCall);
    const followSystem = buildSystemPrompt(params.clinicName, params.locale);
    const followUser = [
      `A tool was executed. Tool result: ${toolResult}`,
      `Original patient message: ${params.question}`,
      "Write a short, natural reply to the patient in the clinic language based on this result. Do not call tools again.",
    ].join("\n\n");

    let follow: string;
    try {
      follow = await callChatComplete({ system: followSystem, user: followUser });
    } catch {
      follow = followUser;
    }
    return { ok: true, answer: follow.trim(), sources: formatSources(chunks) };
  }

  return { ok: true, answer: raw.trim(), sources: formatSources(chunks) };
}
