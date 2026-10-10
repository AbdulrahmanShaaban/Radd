import { z } from "zod";
import { guardSession } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { enqueueJob } from "@/lib/queue/runner";

const MAX_DOC_CHARS = 200_000;

const UploadSchema = z
  .object({
    title: z.string().min(1).max(200),
    text: z.string().min(1).max(MAX_DOC_CHARS),
  })
  .strict();

export async function GET() {
  const guard = await guardSession();
  if (!guard.ok) return guard.response;

  const documents = await db.kbDocument.findMany({
    where: { clinicId: guard.session.clinicId },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      error: true,
      chunkCount: true,
      source: true,
      createdAt: true,
    },
  });

  return Response.json({ documents });
}

export async function POST(request: Request) {
  const guard = await guardSession();
  if (!guard.ok) return guard.response;

  const raw = await request.json().catch(() => null);
  const parsed = UploadSchema.safeParse(raw);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid request body: title and text are required." },
      { status: 400 },
    );
  }

  const document = await db.kbDocument.create({
    data: {
      clinicId: guard.session.clinicId,
      title: parsed.data.title,
      source: "upload",
      status: "PROCESSING",
    },
    select: { id: true, title: true, status: true, createdAt: true },
  });

  await enqueueJob(
    "kb.ingest",
    {
      clinicId: guard.session.clinicId,
      documentId: document.id,
      title: parsed.data.title,
      text: parsed.data.text,
    },
    { clinicId: guard.session.clinicId },
  );

  return Response.json({ document }, { status: 201 });
}

export async function DELETE(request: Request) {
  const guard = await guardSession();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");
  if (!id) {
    return Response.json({ error: "id query param required." }, { status: 400 });
  }

  const existing = await db.kbDocument.findFirst({
    where: { id, clinicId: guard.session.clinicId },
    select: { id: true },
  });
  if (!existing) {
    return Response.json({ error: "Not found." }, { status: 404 });
  }

  await db.kbDocument.delete({ where: { id } });
  return Response.json({ ok: true });
}
