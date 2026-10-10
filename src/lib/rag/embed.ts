import { createHash } from "node:crypto";

export const EMBEDDING_DIMENSIONS = 1536;

const OPENAI_MODEL = "text-embedding-3-small";
const OPENAI_URL = "https://api.openai.com/v1/embeddings";
const BATCH_SIZE = 100;

export class EmbeddingProviderError extends Error {
  readonly transient: boolean;

  constructor(message: string, options: { transient?: boolean } = {}) {
    super(message);
    this.name = "EmbeddingProviderError";
    this.transient = options.transient ?? false;
  }
}

export type EmbedProvider = "openai" | "mock";

function resolveProvider(): EmbedProvider {
  const explicit = process.env.EMBED_PROVIDER;
  if (explicit === "openai" || explicit === "mock") return explicit;
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.NODE_ENV !== "production") return "mock";
  throw new EmbeddingProviderError(
    "No embedding provider configured: set OPENAI_API_KEY or EMBED_PROVIDER.",
  );
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  if (texts.length === 0) return [];
  if (resolveProvider() === "mock") return texts.map(mockEmbed);
  return openAiEmbed(texts);
}

async function openAiEmbed(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new EmbeddingProviderError("OPENAI_API_KEY is not set.");
  }

  const results: number[][] = [];
  for (let offset = 0; offset < texts.length; offset += BATCH_SIZE) {
    const batch = texts.slice(offset, offset + BATCH_SIZE);
    const response = await fetch(OPENAI_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ model: OPENAI_MODEL, input: batch }),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const transient = response.status === 429 || response.status >= 500;
      throw new EmbeddingProviderError(
        `OpenAI embeddings failed (${response.status}): ${body.slice(0, 300)}`,
        { transient },
      );
    }

    const json = (await response.json()) as { data: { embedding: number[] }[] };
    for (const item of json.data) results.push(item.embedding);
  }
  return results;
}

function mockEmbed(text: string): number[] {
  const vector = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
  const tokens = text.toLowerCase().split(/\s+/).filter(Boolean);

  for (const token of tokens) {
    const digest = createHash("sha256").update(token).digest();
    for (let i = 0; i < 16; i++) {
      const index = digest[i] % EMBEDDING_DIMENSIONS;
      const sign = digest[i + 16] % 2 === 0 ? 1 : -1;
      vector[index] += sign;
    }
  }

  const norm = Math.sqrt(vector.reduce((sum, v) => sum + v * v, 0)) || 1;
  return vector.map((v) => v / norm);
}
