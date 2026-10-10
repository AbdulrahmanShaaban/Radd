import { guardSession } from "@/lib/auth/guards";
import { runAllEvals, checkSpendCap } from "@/lib/ai/eval";

export async function POST() {
  const guard = await guardSession();
  if (!guard.ok) return guard.response;

  const cap = await checkSpendCap();
  if (!cap.ok) {
    return Response.json(
      {
        error: "Daily spend cap reached. Try again tomorrow.",
        costUsd: cap.costUsd,
        capUsd: cap.capUsd,
      },
      { status: 429 },
    );
  }

  const summary = await runAllEvals(guard.session.clinicId);
  return Response.json(summary);
}

export async function GET() {
  const guard = await guardSession();
  if (!guard.ok) return guard.response;

  const cap = await checkSpendCap();
  return Response.json({ spendCap: cap });
}
