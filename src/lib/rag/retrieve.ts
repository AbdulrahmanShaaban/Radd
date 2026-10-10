import { db } from "@/lib/db";
import { embedTexts } from "@/lib/rag/embed";
import { reciprocalRankFusion } from "@/lib/rag/fusion";

export type RetrievedChunk = {
  id: string;
  documentId: string;
  title: string;
  content: string;
  score: number;
  ftsRank: number | null;
  similarity: number | null;
};

type ChunkRow = {
  id: string;
  documentId: string;
  title: string;
  content: string;
  ftsRank: number | null;
  similarity: number | null;
};

const CANDIDATES_PER_SIGNAL = 20;

export async function retrieveChunks(params: {
  clinicId: string;
  query: string;
  limit?: number;
}): Promise<RetrievedChunk[]> {
  const limit = params.limit ?? 6;
  const query = params.query.trim();
  if (!query) return [];

  const [ftsRows, embedded] = await Promise.all([
    ftsSearch(params.clinicId, query),
    embedTexts([query]),
  ]);
  const vectorRows = await vectorSearch(params.clinicId, embedded[0]);

  const byId = new Map<string, ChunkRow>();
  for (const row of ftsRows) byId.set(row.id, row);
  for (const row of vectorRows) {
    const existing = byId.get(row.id);
    if (existing) {
      existing.similarity = row.similarity;
    } else {
      byId.set(row.id, row);
    }
  }

  const scores = reciprocalRankFusion([
    ftsRows.map((row) => row.id),
    vectorRows.map((row) => row.id),
  ]);

  return [...scores.entries()]
    .sort(([, a], [, b]) => b - a)
    .slice(0, limit)
    .map(([id, score]) => ({ ...byId.get(id)!, score }));
}

async function ftsSearch(clinicId: string, query: string): Promise<ChunkRow[]> {
  return db.$queryRaw<ChunkRow[]>`
    SELECT
      c.id,
      c."documentId",
      d.title,
      c.content,
      ts_rank(
        to_tsvector('simple', c.content),
        websearch_to_tsquery('simple', ${query})
      )::float8 AS "ftsRank",
      NULL::float8 AS similarity
    FROM kb_chunks c
    JOIN kb_documents d ON d.id = c."documentId"
    WHERE c."clinicId" = ${clinicId}
      AND d.status = 'READY'
      AND to_tsvector('simple', c.content) @@ websearch_to_tsquery('simple', ${query})
    ORDER BY "ftsRank" DESC
    LIMIT ${CANDIDATES_PER_SIGNAL}
  `;
}

async function vectorSearch(
  clinicId: string,
  embedding: number[],
): Promise<ChunkRow[]> {
  const literal = `[${embedding.map((v) => v.toFixed(7)).join(",")}]`;
  return db.$queryRaw<ChunkRow[]>`
    SELECT
      c.id,
      c."documentId",
      d.title,
      c.content,
      NULL::float8 AS "ftsRank",
      (1 - (c.embedding <=> ${literal}::vector))::float8 AS similarity
    FROM kb_chunks c
    JOIN kb_documents d ON d.id = c."documentId"
    WHERE c."clinicId" = ${clinicId}
      AND d.status = 'READY'
      AND c.embedding IS NOT NULL
    ORDER BY c.embedding <=> ${literal}::vector
    LIMIT ${CANDIDATES_PER_SIGNAL}
  `;
}
