import "server-only";

import { db } from "@/lib/db";
import { answerQuestion } from "@/lib/ai/chat";

export type EvalCaseResult = {
  id: string;
  question: string;
  passed: boolean;
  hit: boolean;
  latencyMs: number;
  answerPreview: string;
};

export type EvalSummary = {
  total: number;
  passed: number;
  failed: number;
  avgLatencyMs: number;
  results: EvalCaseResult[];
};

/** Spend guard: refuse to run if today's tracked cost exceeds the cap. */
export async function checkSpendCap(): Promise<{
  ok: boolean;
  reason?: string;
  costUsd: number;
  capUsd: number;
}> {
  const capUsd = Number(process.env.DAILY_SPEND_CAP_USD ?? "1.00");
  const today = new Date().toISOString().slice(0, 10);
  const usage = await db.usageDaily.findUnique({ where: { day: today } });
  const spent = Number(usage?.costUsd ?? 0);
  if (spent >= capUsd) {
    return {
      ok: false,
      reason: "daily_spend_cap_reached",
      costUsd: spent,
      capUsd,
    };
  }
  return { ok: true, costUsd: spent, capUsd };
}

export async function recordUsage(params: {
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
}): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  await db.usageDaily.upsert({
    where: { day: today },
    create: {
      day: today,
      tokensIn: params.tokensIn,
      tokensOut: params.tokensOut,
      costUsd: params.costUsd,
    },
    update: {
      tokensIn: { increment: params.tokensIn },
      tokensOut: { increment: params.tokensOut },
      costUsd: { increment: params.costUsd },
    },
  });
}

export async function runAllEvals(clinicId?: string): Promise<EvalSummary> {
  const cap = await checkSpendCap();
  if (!cap.ok) {
    return {
      total: 0,
      passed: 0,
      failed: 0,
      avgLatencyMs: 0,
      results: [],
    };
  }

  const cases = await db.evalCase.findMany({
    where: { active: true },
    orderBy: { id: "asc" },
  });

  // Resolve clinic: explicit, else first clinic with a ready document.
  let resolvedClinicId = clinicId;
  let clinicName = "the clinic";
  let locale = "ar";
  if (!resolvedClinicId) {
    const clinic = await db.clinic.findFirst({
      orderBy: { createdAt: "asc" },
    });
    if (clinic) {
      resolvedClinicId = clinic.id;
      clinicName = clinic.name;
      locale = clinic.locale;
    }
  } else {
    const clinic = await db.clinic.findUnique({
      where: { id: resolvedClinicId },
    });
    if (clinic) {
      clinicName = clinic.name;
      locale = clinic.locale;
    }
  }

  if (!resolvedClinicId) {
    return { total: 0, passed: 0, failed: 0, avgLatencyMs: 0, results: [] };
  }

  const results: EvalCaseResult[] = [];
  let totalLatency = 0;

  for (const evalCase of cases) {
    const started = Date.now();
    const outcome = await answerQuestion({
      clinicId: resolvedClinicId,
      clinicName,
      locale,
      question: evalCase.question,
    });
    const latencyMs = Date.now() - started;
    totalLatency += latencyMs;

    const answer = outcome.ok ? outcome.answer : "";
    const hit = evalCase.mustContain.every((needle) =>
      answer.toLowerCase().includes(needle.toLowerCase()),
    );
    const passed = outcome.ok && hit;

    await db.evalRun.create({
      data: {
        caseId: evalCase.id,
        passed,
        hit,
        latencyMs,
      },
    });

    results.push({
      id: evalCase.id,
      question: evalCase.question,
      passed,
      hit,
      latencyMs,
      answerPreview: answer.slice(0, 200),
    });
  }

  // Rough cost estimate: ~$0.0002 per small chat call. Track for the cap.
  const approxCost = results.length * 0.0002;
  await recordUsage({
    tokensIn: results.length * 400,
    tokensOut: results.length * 150,
    costUsd: approxCost,
  });

  const passed = results.filter((r) => r.passed).length;
  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    avgLatencyMs: results.length ? Math.round(totalLatency / results.length) : 0,
    results,
  };
}
