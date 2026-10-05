import { NextResponse } from 'next/server';
import { env } from '@/lib/env';
import { enqueue } from '@/modules/jobs/queue';
import { runDueJobs } from '@/modules/jobs/runner';

export const dynamic = 'force-dynamic';

/**
 * Cron endpoint (spec §36). Vercel Cron (or any scheduler) calls this with the
 * CRON_SECRET. It enqueues periodic scans, then drains the job queue.
 */
export async function POST(req: Request) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }

  const day = new Date().toISOString().slice(0, 10);
  // Idempotent per-day scans.
  await enqueue({ type: 'commitment_due_check', dedupeKey: `due:${day}:${new Date().getHours()}` });
  await enqueue({ type: 'disengagement_scan', dedupeKey: `disengage:${day}` });
  await enqueue({ type: 'trial_expiry_check', dedupeKey: `trial:${day}` });

  const result = await runDueJobs();
  return NextResponse.json({ ok: true, ...result });
}

// GET allowed too (Vercel Cron uses GET by default).
export async function GET(req: Request) {
  return POST(req);
}
