/**
 * Job runner (spec §36). Claims due jobs, runs them with retry/backoff, and
 * records outcome. Invoked by the cron endpoint or `npm run jobs:run`.
 */

import { prisma } from '@/lib/db';
import { handleJob } from './handlers';

const BATCH = 25;

export async function runDueJobs(now = new Date()): Promise<{ ran: number; failed: number }> {
  let ran = 0;
  let failed = 0;

  const due = await prisma.job.findMany({
    where: { status: 'pending', runAt: { lte: now } },
    orderBy: { runAt: 'asc' },
    take: BATCH,
  });

  for (const job of due) {
    // claim
    const claimed = await prisma.job.updateMany({
      where: { id: job.id, status: 'pending' },
      data: { status: 'running', attempts: { increment: 1 } },
    });
    if (claimed.count === 0) continue; // someone else claimed it

    try {
      const payload = job.payload ? (JSON.parse(job.payload) as Record<string, unknown>) : {};
      await handleJob(job.type, payload);
      await prisma.job.update({ where: { id: job.id }, data: { status: 'succeeded' } });
      ran++;
    } catch (e: unknown) {
      const attempts = job.attempts + 1;
      const message = e instanceof Error ? e.message : String(e);
      if (attempts >= job.maxAttempts) {
        await prisma.job.update({ where: { id: job.id }, data: { status: 'failed', lastError: message } });
      } else {
        // exponential backoff
        const delayMs = Math.min(60_000 * 2 ** attempts, 3_600_000);
        await prisma.job.update({
          where: { id: job.id },
          data: { status: 'pending', runAt: new Date(now.getTime() + delayMs), lastError: message },
        });
      }
      failed++;
    }
  }

  return { ran, failed };
}

// Allow `tsx src/modules/jobs/runner.ts` for local/manual runs.
if (process.argv[1] && process.argv[1].endsWith('runner.ts')) {
  runDueJobs()
    .then((r) => {
      // eslint-disable-next-line no-console
      console.log(`jobs: ran=${r.ran} failed=${r.failed}`);
      process.exit(0);
    })
    .catch((e) => {
      // eslint-disable-next-line no-console
      console.error(e);
      process.exit(1);
    });
}
