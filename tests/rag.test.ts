import assert from "node:assert/strict";
import test from "node:test";
import { chunkText } from "../src/lib/rag/chunk.ts";
import { reciprocalRankFusion } from "../src/lib/rag/fusion.ts";

test("chunkText returns empty for blank input", () => {
  assert.deepEqual(chunkText("   \n  "), []);
});

test("chunkText keeps short text in one chunk", () => {
  const chunks = chunkText("الكشف الأولي: 300 جنيه.");
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].idx, 0);
  assert.match(chunks[0].content, /300/);
});

test("chunkText splits long text and keeps order", () => {
  const sentence = "هذه جملة اختبارية تحتوي على معلومة مفيدة. ";
  const text = sentence.repeat(80);
  const chunks = chunkText(text, { maxChars: 200 });
  assert.ok(chunks.length > 1);
  chunks.forEach((chunk, index) => {
    assert.equal(chunk.idx, index);
    assert.ok(chunk.content.length <= 200);
  });
  assert.equal(
    chunks.map((c) => c.content).join(" ").replace(/\s+/g, " "),
    text.trim().replace(/\s+/g, " "),
  );
});

test("chunkText hard-splits a single oversized piece", () => {
  const chunks = chunkText("x".repeat(50), { maxChars: 20 });
  assert.equal(chunks.length, 3);
  assert.equal(chunks[2].content.length, 10);
});

test("reciprocalRankFusion rewards items ranked high on many lists", () => {
  const scores = reciprocalRankFusion(
    [
      ["a", "b", "c"],
      ["b", "d"],
    ],
    60,
  );
  const ranked = [...scores.entries()].sort(([, x], [, y]) => y - x);
  assert.deepEqual(
    ranked.map(([id]) => id),
    ["b", "a", "d", "c"],
  );
  assert.equal(scores.get("e"), undefined);
});
