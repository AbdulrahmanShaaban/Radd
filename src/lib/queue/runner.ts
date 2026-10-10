import "server-only";

import {
  enqueueJob,
  processJobs,
  registerJobHandler,
  NonRetryableJobError,
} from "@/lib/queue/jobs";
import { ingestDocument } from "@/lib/rag/ingest";
import { db } from "@/lib/db";

let registered = false;

function ensureHandlers(): void {
  if (registered) return;
  registered = true;

  registerJobHandler("kb.ingest", async (job) => {
    const payload = job.payload as {
      clinicId?: string;
      documentId?: string;
      title?: string;
      text?: string;
    };
    if (!payload.clinicId || !payload.documentId || !payload.text) {
      throw new NonRetryableJobError("kb.ingest payload missing required fields");
    }

    const chunks = await ingestDocument({
      clinicId: payload.clinicId,
      title: payload.title ?? "Untitled",
      text: payload.text,
      source: "upload",
    });

    await db.kbDocument.update({
      where: { id: payload.documentId },
      data: { status: "READY", chunkCount: chunks.chunkCount, error: null },
    });
  });

  registerJobHandler("eval.run", async () => {
    const { runAllEvals } = await import("@/lib/ai/eval");
    await runAllEvals();
  });

  registerJobHandler("chat.fallback", async (job) => {
    // Placeholder: enqueue a human handoff notification.
    // Real notification delivery (email/SMS) is out of portfolio scope.
    const payload = job.payload as { conversationId?: string };
    if (!payload.conversationId) {
      throw new NonRetryableJobError("chat.fallback missing conversationId");
    }
  });

  registerJobHandler("notify.followup", async () => {
    // No-op placeholder for follow-up reminders.
  });
}

/** Process the queue after a request finishes (fire-and-forget). */
export function kickQueueAfterResponse(max = 5): void {
  ensureHandlers();
  void processJobs(max).catch((err) => {
    console.error("[queue] background process failed", err);
  });
}

/** Synchronously drain the queue (cron + tests). */
export async function drainQueue(max = 20): Promise<void> {
  ensureHandlers();
  await processJobs(max);
}

export { enqueueJob };
