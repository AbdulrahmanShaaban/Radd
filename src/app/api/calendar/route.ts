import { z } from "zod";
import { guardSession } from "@/lib/auth/guards";
import { listAppointments } from "@/lib/booking/calendar";
import { parseIsoDate } from "@/lib/booking/scheduler";

const QuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});

export async function GET(request: Request) {
  const guard = await guardSession();
  if (!guard.ok) return guard.response;

  const { searchParams } = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    date: searchParams.get("date") ?? "",
  });
  if (!parsed.success) {
    return Response.json(
      { error: "date=YYYY-MM-DD query param required." },
      { status: 400 },
    );
  }

  const date = parseIsoDate(parsed.data.date);
  if (!date) {
    return Response.json({ error: "Invalid date." }, { status: 400 });
  }

  const appointments = await listAppointments({
    clinicId: guard.session.clinicId,
    dateIso: parsed.data.date,
    date,
  });

  return Response.json({ date: parsed.data.date, appointments });
}
