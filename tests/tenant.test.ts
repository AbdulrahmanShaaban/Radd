import assert from "node:assert/strict";
import test from "node:test";

import { isValidSlot, SLOTS } from "../src/lib/booking/scheduler.ts";
import { isSlotFree, listAppointments } from "../src/lib/booking/calendar.ts";

/**
 * These tests require a live DATABASE_URL. They are skipped automatically
 * when no database is configured so `pnpm test` stays green in CI/sandboxes.
 */
const hasDb = Boolean(process.env.DATABASE_URL);
const opts = hasDb ? {} : { skip: "DATABASE_URL not set" };

test(
  "listAppointments returns only the clinic's appointments for the day",
  opts,
  async () => {
    const { db } = await import("../src/lib/db.ts");
    const clinics = await db.clinic.findMany({ take: 2 });
    if (clinics.length < 2) return;
    const [a, b] = clinics;

    const date = new Date();
    date.setDate(date.getDate() + 1);
    date.setHours(0, 0, 0, 0);

    // Seed a row in clinic B only.
    const patient = await db.patient.findFirst({
      where: { clinicId: b.id },
    });
    if (!patient) return;

    const startsAt = new Date(date);
    startsAt.setHours(11, 0, 0, 0);
    const endsAt = new Date(startsAt);
    endsAt.setHours(12, 0, 0, 0);

    const created = await db.appointment.create({
      data: {
        clinicId: b.id,
        patientId: patient.id,
        startsAt,
        endsAt,
        kind: "test",
        status: "BOOKED",
      },
    });

    try {
      const forA = await listAppointments({
        clinicId: a.id,
        dateIso: "x",
        date,
      });
      assert.equal(
        forA.some((x) => x.id === created.id),
        false,
        "clinic A must not see clinic B's appointment",
      );

      const forB = await listAppointments({
        clinicId: b.id,
        dateIso: "x",
        date,
      });
      assert.equal(
        forB.some((x) => x.id === created.id),
        true,
        "clinic B must see its own appointment",
      );
    } finally {
      await db.appointment.delete({ where: { id: created.id } });
    }
  },
);

test(
  "isSlotFree is false when another clinic holds the slot, true for own free slot",
  opts,
  async () => {
    const { db } = await import("../src/lib/db.ts");
    const clinics = await db.clinic.findMany({ take: 2 });
    if (clinics.length < 2) return;
    const [a, b] = clinics;

    const date = new Date();
    date.setDate(date.getDate() + 2);
    date.setHours(0, 0, 0, 0);

    const patientB = await db.patient.findFirst({ where: { clinicId: b.id } });
    if (!patientB) return;

    const startsAt = new Date(date);
    startsAt.setHours(13, 0, 0, 0);
    const endsAt = new Date(startsAt);
    endsAt.setHours(14, 0, 0, 0);

    const created = await db.appointment.create({
      data: {
        clinicId: b.id,
        patientId: patientB.id,
        startsAt,
        endsAt,
        kind: "test",
        status: "BOOKED",
      },
    });

    try {
      // Clinic B: slot taken.
      assert.equal(
        await isSlotFree({ clinicId: b.id, date, slot: "13:00" }),
        false,
      );
      // Clinic A: same wall-clock slot is free (tenant isolation).
      assert.equal(
        await isSlotFree({ clinicId: a.id, date, slot: "13:00" }),
        true,
      );
    } finally {
      await db.appointment.delete({ where: { id: created.id } });
    }
  },
);

test("SLOTS all pass isValidSlot", () => {
  for (const slot of SLOTS) {
    assert.equal(isValidSlot(slot), true, slot);
  }
});
