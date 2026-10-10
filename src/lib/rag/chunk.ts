export type TextChunk = {
  idx: number;
  content: string;
};

export type ChunkOptions = {
  maxChars?: number;
};

const DEFAULT_MAX_CHARS = 1200;

export function chunkText(text: string, options: ChunkOptions = {}): TextChunk[] {
  const maxChars = options.maxChars ?? DEFAULT_MAX_CHARS;
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];

  const pieces = normalized
    .split(/(?<=[.!?:؟])\s+|\n+/)
    .map((piece) => piece.trim())
    .filter(Boolean);

  const packed: string[] = [];
  let buffer = "";

  for (const piece of pieces) {
    if (piece.length > maxChars) {
      if (buffer) {
        packed.push(buffer);
        buffer = "";
      }
      for (let offset = 0; offset < piece.length; offset += maxChars) {
        packed.push(piece.slice(offset, offset + maxChars));
      }
      continue;
    }

    const candidate = buffer ? `${buffer} ${piece}` : piece;
    if (candidate.length <= maxChars) {
      buffer = candidate;
    } else {
      packed.push(buffer);
      buffer = piece;
    }
  }

  if (buffer) packed.push(buffer);

  return packed.map((content, idx) => ({ idx, content }));
}
