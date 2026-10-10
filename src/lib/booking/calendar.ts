import "server-only";

import { db } from "@/lib/db";
import { slotToUtc, type Slot } from "@/lib/booking/scheduler";

export type AppointmentSlot = {
  id: string;
  patientId: string;
  patientName: string;
  startsAt: string;
  endsAt: string;
  kind: string;
  status: string;
  note: string | null;
  slot: Slot;
};

export async function listAppointments(params: {
  clinicId: string;
  dateIso: string;
  date: Date;
}): Promise<AppointmentSlot[]> {
  const dayStart = new Date(params.date);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const rows = await db.appointment.findMany({
    where: {
      clinicId: params.clinicId,
      startsAt: { gte: dayStart, lt: dayEnd },
    },
    include: { patient: true },
    orderBy: { startsAt: "asc" },
  });

  return rows.map((row) => {
    const h = row.startsAt.getHours();
    const m = row.startsAt.getMinutes();
    const slot = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}` as Slot;
    return {
      id: row.id,
      patientId: row.patientId,
      patientName: row.patient.name,
      startsAt: row.startsAt.toISOString(),
      endsAt: row.endsAt.toISOString(),
      kind: row.kind,
      status: row.status,
      note: row.note,
      slot,
    };
  });
}

export async function isSlotFree(params: {
  clinicId: string;
  date: Date;
  slot: Slot;
}): Promise<boolean> {
  const startsAt = slotToUtc(params.date, params.slot);
  const endsAt = new Date(startsAt);
  endsAt.setHours(endsAt.getHours() + 1);

  const overlap = await db.appointment.findFirst({
    where: {
      clinicId: params.clinicId,
      status: { in: ["BOOKED", "RESCHEDULED"] },
      startsAt: { lt: endsAt },
      endsAt: { gt: startsAt },
    },
    select: { id: true },
  });
  return overlap === null;
}
