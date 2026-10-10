import "server-only";

import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

export type JobType =
  | "kb.ingest"
  | "chat.fallback"
  | "eval.run"
  | "notify.followup";

export type EnqueueOptions = {
  clinicId?: string | null;
  runAt?: Date;
  maxAttempts?: number;
};

export async function enqueueJob(
  type: JobType,
  payload: Record<string, unknown>,
  options: EnqueueOptions = {},
): Promise<string> {
  const job = await db.job.create({
    data: {
      type,
      payload: payload as Prisma.InputJsonObject,
      clinicId: options.clinicId ?? null,
      runAt: options.runAt ?? new Date(),
      maxAttempts: options.maxAttempts ?? 3,
      status: "PENDING",
    },
  });
  return job.id;
}

export type ClaimedJob = {
  id: string;
  type: string;
  clinicId: string | null;
  payload: Record<string, unknown>;
  attempts: number;
};

/**
 * Claim the next runnable job with FOR UPDATE SKIP LOCKED so multiple
 * invocations (cron + after()) never process the same row twice.
 */
export async function claimNextJob(): Promise<ClaimedJob | null> {
  return db.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<
      {
        id: string;
        type: string;
        clinicId: string | null;
        payload: unknown;
        attempts: number;
      }[]
    >`
      SELECT id, type, "clinicId", payload, attempts
      FROM jobs
      WHERE status = 'PENDING'
        AND "runAt" <= now()
      ORDER BY "runAt" ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `;

    const row = rows[0];
    if (!row) return null;

    await tx.$executeRaw`
      UPDATE jobs
      SET status = 'RUNNING',
          attempts = attempts + 1,
          "lockedAt" = now(),
          "updatedAt" = now()
      WHERE id = ${row.id}::uuid
    `;

    return {
      id: row.id,
      type: row.type,
      clinicId: row.clinicId,
      payload: (row.payload ?? {}) as Record<string, unknown>,
      attempts: row.attempts,
    };
  });
}

export async function completeJob(id: string): Promise<void> {
  await db.job.update({
    where: { id },
    data: { status: "SUCCEEDED", lockedAt: null, lastError: null },
  });
}

export async function failJob(
  id: string,
  error: string,
  opts: { retryable: boolean; maxAttempts: number; attempts: number },
): Promise<void> {
  const message = error.slice(0, 500);
  if (!opts.retryable || opts.attempts >= opts.maxAttempts) {
    await db.job.update({
      where: { id },
      data: { status: "DEAD", lastError: message, lockedAt: null },
    });
    return;
  }
  // Exponential backoff: 30s * 2^(attempts-1)
  const delayMs = 30_000 * 2 ** Math.max(0, opts.attempts - 1);
  await db.job.update({
    where: { id },
    data: {
      status: "PENDING",
      lastError: message,
      lockedAt: null,
      runAt: new Date(Date.now() + delayMs),
    },
  });
}

export type JobHandler = (job: ClaimedJob) => Promise<void>;

const handlers = new Map<string, JobHandler>();

export function registerJobHandler(type: string, handler: JobHandler): void {
  handlers.set(type, handler);
}

export type ProcessResult =
  | { processed: false }
  | { processed: true; ok: true; type: string }
  | { processed: true; ok: false; type: string; error: string };

export async function processOneJob(): Promise<ProcessResult> {
  const job = await claimNextJob();
  if (!job) return { processed: false };

  const handler = handlers.get(job.type);
  if (!handler) {
    await failJob(job.id, `No handler for job type "${job.type}"`, {
      retryable: false,
      maxAttempts: job.attempts,
      attempts: job.attempts,
    });
    return { processed: true, ok: false, type: job.type, error: "no_handler" };
  }

  try {
    await handler(job);
    await completeJob(job.id);
    return { processed: true, ok: true, type: job.type };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const retryable = !(err instanceof NonRetryableJobError);
    await failJob(job.id, message, {
      retryable,
      maxAttempts: 3,
      attempts: job.attempts,
    });
    return { processed: true, ok: false, type: job.type, error: message };
  }
}

export class NonRetryableJobError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonRetryableJobError";
  }
}

/** Drain up to `max` jobs. Used by the cron route and tests. */
export async function processJobs(max = 10): Promise<ProcessResult[]> {
  const results: ProcessResult[] = [];
  for (let i = 0; i < max; i++) {
    const result = await processOneJob();
    results.push(result);
    if (!result.processed) break;
  }
  return results;
}
