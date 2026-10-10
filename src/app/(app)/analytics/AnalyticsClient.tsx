"use client";

import { useEffect, useState } from "react";
import { Play } from "lucide-react";

type EvalSummary = {
  total: number;
  passed: number;
  failed: number;
  avgLatencyMs?: number;
};

type SpendCap = {
  ok: boolean;
  costUsd: number;
  capUsd: number;
};

export function AnalyticsClient() {
  const [summary, setSummary] = useState<EvalSummary | null>(null);
  const [spend, setSpend] = useState<SpendCap | null>(null);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/evals");
        const data = (await res.json().catch(() => ({}))) as {
          spendCap?: SpendCap;
        };
        if (!cancelled && res.ok && data.spendCap) setSpend(data.spendCap);
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  async function runEvals() {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch("/api/evals", { method: "POST" });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        total?: number;
        passed?: number;
        failed?: number;
        avgLatencyMs?: number;
      };
      if (!res.ok) {
        setError(data.error ?? "Eval run failed.");
        return;
      }
      setSummary({
        total: data.total ?? 0,
        passed: data.passed ?? 0,
        failed: data.failed ?? 0,
        avgLatencyMs: data.avgLatencyMs,
      });
      try {
        const sres = await fetch("/api/evals");
        const sdata = (await sres.json().catch(() => ({}))) as {
          spendCap?: SpendCap;
        };
        if (sres.ok && sdata.spendCap) setSpend(sdata.spendCap);
      } catch {
        /* ignore */
      }
    } catch {
      setError("Network error.");
    } finally {
      setRunning(false);
    }
  }

  const passRate =
    summary && summary.total > 0
      ? Math.round((summary.passed / summary.total) * 100)
      : null;

  return (
    <div className="flex-1 overflow-y-auto p-6 max-w-3xl w-full mx-auto flex flex-col gap-5">
      <div>
        <h1 className="font-display text-2xl font-bold text-on-surface">
          Analytics
        </h1>
        <p className="text-sm text-on-surface-variant mt-1">
          Eval suite results and AI spend guardrail
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="rounded-2xl bg-white border border-border p-4 shadow-sm">
          <p className="text-xs text-on-surface-variant uppercase tracking-wide">
            Evals passed
          </p>
          <p className="font-display text-3xl font-bold text-on-surface mt-1">
            {summary ? `${summary.passed}/${summary.total}` : "—"}
          </p>
          {passRate !== null && (
            <p className="text-xs text-primary mt-1 font-medium">
              {passRate}% pass rate
            </p>
          )}
        </div>
        <div className="rounded-2xl bg-white border border-border p-4 shadow-sm">
          <p className="text-xs text-on-surface-variant uppercase tracking-wide">
            Avg latency
          </p>
          <p className="font-display text-3xl font-bold text-on-surface mt-1">
            {summary?.avgLatencyMs != null
              ? `${Math.round(summary.avgLatencyMs)}ms`
              : "—"}
          </p>
        </div>
        <div className="rounded-2xl bg-white border border-border p-4 shadow-sm">
          <p className="text-xs text-on-surface-variant uppercase tracking-wide">
            Daily spend
          </p>
          <p className="font-display text-3xl font-bold text-on-surface mt-1">
            {spend ? `$${spend.costUsd.toFixed(2)}` : "—"}
          </p>
          {spend && (
            <p className="text-xs text-on-surface-variant mt-1">
              of ${spend.capUsd.toFixed(2)} cap
            </p>
          )}
        </div>
      </div>

      <div className="rounded-2xl bg-white border border-border p-5 shadow-sm flex flex-col gap-3">
        <h2 className="font-display font-semibold text-on-surface">
          Run eval suite
        </h2>
        <p className="text-sm text-on-surface-variant">
          Executes all active eval cases against the retrieval + answer pipeline
          and records pass/fail + latency.
        </p>
        {error && (
          <div className="rounded-lg bg-error-container/40 border border-error/30 px-3 py-2 text-sm text-on-error-container">
            {error}
          </div>
        )}
        <button
          type="button"
          onClick={() => void runEvals()}
          disabled={running}
          className="self-start rounded-xl bg-primary text-white px-4 py-2 text-sm font-semibold hover:bg-primary-strong disabled:opacity-50 transition-colors shadow-xs flex items-center gap-2"
        >
          {running ? (
            <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
          ) : (
            <Play className="w-4 h-4" strokeWidth={2} />
          )}
          Run evals
        </button>
        {summary && (
          <div className="mt-1 text-sm text-on-surface-variant">
            {summary.failed === 0
              ? "All eval cases passed."
              : `${summary.failed} case(s) failed. Review retrieval sources.`}
          </div>
        )}
      </div>
    </div>
  );
}
