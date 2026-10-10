import "server-only";

export const SLOTS = ["09:00", "10:00", "11:00", "12:00", "13:00", "14:00", "15:00", "16:00", "17:00"] as const;
export type Slot = (typeof SLOTS)[number];

const SLOT_RE = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function isValidSlot(value: string): value is Slot {
  return (SLOTS as readonly string[]).includes(value);
}

/** Parse "YYYY-MM-DD" as a local calendar date (no TZ shift). */
export function parseIsoDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  const date = new Date(year, month - 1, day, 0, 0, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }
  return date;
}

export function slotToUtc(date: Date, slot: Slot): Date {
  const [h, m] = slot.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}

export function utcToSlot(date: Date): Slot | null {
  const h = String(date.getHours()).padStart(2, "0");
  const m = String(date.getMinutes()).padStart(2, "0");
  const candidate = `${h}:${m}`;
  return isValidSlot(candidate) ? candidate : null;
}

export function isSlotShape(value: string): boolean {
  return SLOT_RE.test(value);
}
