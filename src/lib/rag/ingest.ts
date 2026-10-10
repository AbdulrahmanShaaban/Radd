import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";
import { chunkText } from "@/lib/rag/chunk";
import { embedTexts } from "@/lib/rag/embed";

export type IngestResult = {
  documentId: string;
  chunkCount: number;
};

function toVectorLiteral(vector: number[]): string {
  return `[${vector.map((v) => v.toFixed(7)).join(",")}]`;
}

export async function ingestDocument(params: {
  clinicId: string;
  title: string;
  text: string;
  source?: string;
  maxChars?: number;
}): Promise<IngestResult> {
  const document = await db.kbDocument.create({
    data: {
      clinicId: params.clinicId,
      title: params.title,
      source: params.source ?? "upload",
      status: "PROCESSING",
    },
  });

  try {
    const chunks = chunkText(params.text, { maxChars: params.maxChars });
    if (chunks.length === 0) {
      throw new Error("Document has no indexable content.");
    }

    const vectors = await embedTexts(chunks.map((chunk) => chunk.content));
    const rows = chunks.map((chunk, index) =>
      Prisma.sql`(${randomUUID()}, ${params.clinicId}, ${document.id}, ${chunk.idx}, ${chunk.content}, ${toVectorLiteral(vectors[index])}::vector)`,
    );

    await db.$executeRaw`
      INSERT INTO kb_chunks (id, "clinicId", "documentId", idx, content, embedding)
      VALUES ${Prisma.join(rows)}
    `;

    await db.kbDocument.update({
      where: { id: document.id },
      data: { status: "READY", chunkCount: chunks.length, error: null },
    });

    return { documentId: document.id, chunkCount: chunks.length };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await db.kbDocument.update({
      where: { id: document.id },
      data: { status: "FAILED", error: message.slice(0, 500) },
    });
    throw error;
  }
}
