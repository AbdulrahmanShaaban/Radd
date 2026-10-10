import assert from "node:assert/strict";
import test from "node:test";

import {
  isSlotShape,
  isValidSlot,
  parseIsoDate,
  slotToUtc,
  utcToSlot,
} from "../src/lib/booking/scheduler.ts";

test("isValidSlot accepts HH:MM on the hour within 09:00–17:00", () => {
  assert.equal(isValidSlot("09:00"), true);
  assert.equal(isValidSlot("17:00"), true);
  assert.equal(isValidSlot("12:00"), true);
});

test("isValidSlot rejects off-grid and out-of-range times", () => {
  assert.equal(isValidSlot("08:00"), false);
  assert.equal(isValidSlot("18:00"), false);
  assert.equal(isValidSlot("10:30"), false);
  assert.equal(isValidSlot("24:00"), false);
  assert.equal(isValidSlot("9:00"), false);
});

test("isSlotShape validates strict HH:MM 24h form", () => {
  assert.equal(isSlotShape("00:00"), true);
  assert.equal(isSlotShape("23:59"), true);
  assert.equal(isSlotShape("24:00"), false);
  assert.equal(isSlotShape("9:00"), false);
  assert.equal(isSlotShape("10:60"), false);
});

test("parseIsoDate parses a valid calendar date", () => {
  const d = parseIsoDate("2026-10-15");
  assert.ok(d);
  assert.equal(d.getFullYear(), 2026);
  assert.equal(d.getMonth(), 9);
  assert.equal(d.getDate(), 15);
});

test("parseIsoDate rejects malformed and impossible dates", () => {
  assert.equal(parseIsoDate("2026-13-01"), null);
  assert.equal(parseIsoDate("2026-02-30"), null);
  assert.equal(parseIsoDate("2026-10-15T00:00:00Z"), null);
  assert.equal(parseIsoDate("not-a-date"), null);
});

test("slotToUtc maps a slot onto the given date at the hour", () => {
  const date = parseIsoDate("2026-10-15")!;
  const startsAt = slotToUtc(date, "11:00");
  assert.equal(startsAt.getHours(), 11);
  assert.equal(startsAt.getMinutes(), 0);
  assert.equal(startsAt.getDate(), 15);
});

test("utcToSlot round-trips a slot time back to its label", () => {
  const date = parseIsoDate("2026-10-15")!;
  const startsAt = slotToUtc(date, "14:00");
  assert.equal(utcToSlot(startsAt), "14:00");
});
