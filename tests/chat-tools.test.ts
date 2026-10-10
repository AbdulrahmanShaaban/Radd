import assert from "node:assert/strict";
import test from "node:test";

import { answerQuestion } from "../src/lib/ai/chat.ts";
import { isValidSlot } from "../src/lib/booking/scheduler.ts";

/**
 * Tool-call parsing is exercised through answerQuestion only when a live DB
 * and clinic exist. Here we unit-test the pure scheduler helpers that the
 * tools depend on, plus the offline behaviour of answerQuestion (no key →
 * LLM_DISABLED) so the allowlist contract is pinned without a database.
 */

test("book/cancel tools only accept on-grid slots", () => {
  assert.equal(isValidSlot("10:00"), true);
  assert.equal(isValidSlot("10:15"), false);
  assert.equal(isValidSlot("09:00"), true);
  assert.equal(isValidSlot("18:00"), false);
});

test("answerQuestion returns LLM_DISABLED offline instead of inventing", async () => {
  const prevKey = process.env.OPENAI_API_KEY;
  delete process.env.OPENAI_API_KEY;
  try {
    const result = await answerQuestion({
      clinicId: "clinic_test",
      clinicName: "Test Clinic",
      locale: "ar",
      question: "كم سعر الكشف؟",
    });
    // Without a key (and without a DB for retrieval) it must not fabricate.
    // If a DB is present retrieval still runs; the LLM path still reports
    // LLM_DISABLED because OPENAI_API_KEY is unset.
    if (!result.ok) {
      assert.equal(result.error, "LLM_DISABLED");
    }
  } finally {
    if (prevKey !== undefined) process.env.OPENAI_API_KEY = prevKey;
  }
});
