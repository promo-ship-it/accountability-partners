/**
 * Background job queue (spec §36, §37). DB-backed, idempotent via dedupeKey,
 * with retries and failure handling. Driven by a cron-triggered runner so no
 * always-on worker is needed (zero extra infra cost on Vercel).
 */

import { prisma } from '@/lib/db';

export type JobType =
  | 'send_notification'
  | 'commitment_reminder'
  | 'commitment_due_check'
  | 'weekly_report'
  | 'disengagement_scan'
  | 'trial_expiry_check';

export interface EnqueueInput {
  type: JobType;
  payload?: Record<string, unknown>;
  runAt?: Date;
  dedupeKey?: string;
  maxAttempts?: number;
}

/** Enqueue a job. If dedupeKey already exists, this is a no-op (idempotent). */
export async function enqueue(input: EnqueueInput): Promise<void> {
  try {
    await prisma.job.create({
      data: {
        type: input.type,
        payload: input.payload ? JSON.stringify(input.payload) : null,
        runAt: input.runAt ?? new Date(),
        dedupeKey: input.dedupeKey,
        maxAttempts: input.maxAttempts ?? 5,
      },
    });
  } catch (e: unknown) {
    // Unique violation on dedupeKey => already enqueued. Swallow.
    if (isUniqueViolation(e)) return;
    throw e;
  }
}

function isUniqueViolation(e: unknown): boolean {
  return (
    typeof e === 'object' &&
    e !== null &&
    'code' in e &&
    (e as { code?: string }).code === 'P2002'
  );
}
