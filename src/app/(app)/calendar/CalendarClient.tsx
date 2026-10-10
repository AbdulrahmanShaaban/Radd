"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

type Appt = {
  id: string;
  patientName: string;
  startsAt: string;
  endsAt: string;
  kind: string;
  status: string;
};

const SLOTS = [
  "09:00",
  "10:00",
  "11:00",
  "12:00",
  "13:00",
  "14:00",
  "15:00",
  "16:00",
  "17:00",
] as const;

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function shiftDate(iso: string, days: number): string {
  const d = new Date(`${iso}T12:00:00`);
  d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function slotLabel(iso: string, slot: string): string {
  const d = new Date(`${iso}T${slot}:00`);
  return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

export function CalendarClient() {
  const [date, setDate] = useState(todayIso());
  const [appts, setAppts] = useState<Appt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/calendar?date=${encodeURIComponent(date)}`);
        const data = (await res.json().catch(() => ({}))) as {
          appointments?: Appt[];
          error?: string;
        };
        if (cancelled) return;
        if (res.ok && data.appointments) setAppts(data.appointments);
        else if (data.error) setError(data.error);
      } catch {
        if (!cancelled) setError("Failed to load appointments.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [date]);

  const bySlot = new Map<string, Appt[]>();
  for (const a of appts) {
    const h = new Date(a.startsAt).getHours();
    const key = `${String(h).padStart(2, "0")}:00`;
    const list = bySlot.get(key) ?? [];
    list.push(a);
    bySlot.set(key, list);
  }

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-3xl w-full mx-auto flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold text-on-surface">
            Calendar
          </h1>
          <p className="text-sm text-on-surface-variant mt-1">
            Daily appointment slots for your clinic
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDate(shiftDate(date, -1))}
            className="p-2 rounded-lg border border-border bg-white text-on-surface-variant hover:bg-surface-container-low"
            aria-label="Previous day"
          >
            <ChevronLeft className="w-5 h-5" strokeWidth={2} />
          </button>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value || todayIso())}
            className="rounded-xl border border-border bg-white px-3 py-1.5 text-sm text-on-surface focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <button
            type="button"
            onClick={() => setDate(shiftDate(date, 1))}
            className="p-2 rounded-lg border border-border bg-white text-on-surface-variant hover:bg-surface-container-low"
            aria-label="Next day"
          >
            <ChevronRight className="w-5 h-5" strokeWidth={2} />
          </button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-error-container/40 border border-error/30 px-3 py-2 text-sm text-on-error-container">
          {error}
        </div>
      )}

      {loading ? (
        <div className="p-10 text-center text-on-surface-variant text-sm">
          Loading…
        </div>
      ) : (
        <div className="rounded-2xl bg-white border border-border shadow-sm overflow-hidden divide-y divide-border">
          {SLOTS.map((slot) => {
            const list = bySlot.get(slot) ?? [];
            return (
              <div key={slot} className="flex items-stretch">
                <div className="w-20 flex-shrink-0 px-3 py-3 text-xs font-semibold text-on-surface-variant bg-surface-container-low border-r border-border">
                  {slotLabel(date, slot)}
                </div>
                <div className="flex-1 p-2 flex flex-wrap gap-2">
                  {list.length === 0 ? (
                    <span className="text-xs text-outline py-1">Free</span>
                  ) : (
                    list.map((a) => (
                      <div
                        key={a.id}
                        className="px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/20 text-sm text-on-surface"
                      >
                        <span className="font-semibold">{a.patientName}</span>
                        <span className="ml-2 text-xs text-on-surface-variant">
                          {a.kind} • {a.status}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
