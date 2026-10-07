/**
 * Job handlers (spec §36). Each handler is idempotent. Notification sends use
 * a dedupeKey so a retried job never double-sends.
 */

import { prisma } from '@/lib/db';
import { sendNotification } from '@/modules/notifications/service';
import { detectDisengagement } from '@/modules/behavioral/disengagement';
import { trialExpired } from '@/modules/billing/trial';
import { emitEvent } from '@/modules/events';
import { brand } from '@/lib/brand';

type Payload = Record<string, unknown>;

export async function handleJob(type: string, payload: Payload): Promise<void> {
  switch (type) {
    case 'send_notification':
      await sendNotification({
        userId: String(payload.userId),
        channel: (payload.channel as 'in_app' | 'email') ?? 'in_app',
        template: String(payload.template ?? 'generic'),
        title: String(payload.title ?? brand.name),
        body: String(payload.body ?? ''),
        dedupeKey: payload.dedupeKey ? String(payload.dedupeKey) : undefined,
      });
      break;

    case 'commitment_due_check':
      await commitmentDueCheck();
      break;

    case 'disengagement_scan':
      await disengagementScan();
      break;

    case 'trial_expiry_check':
      await trialExpiryCheck();
      break;

    case 'weekly_report':
      // Weekly report generation is enqueued per-user; here it just emits.
      await emitEvent({ class: 'domain', type: 'weekly_report.generated', userId: String(payload.userId), actor: 'system' });
      break;

    default:
      // Unknown job type — no-op rather than crash the runner.
      break;
  }
}

/** Mark overdue scheduled commitments as missed and notify. */
async function commitmentDueCheck(): Promise<void> {
  const overdue = await prisma.commitment.findMany({
    where: { status: 'scheduled', dueAt: { lt: new Date() } },
    take: 500,
  });
  for (const c of overdue) {
    await prisma.commitment.update({ where: { id: c.id }, data: { status: 'missed' } });
    await emitEvent({
      class: 'domain',
      type: 'commitment.missed',
      userId: c.userId,
      entity: c.id,
      actor: 'system',
    });
    await sendNotification({
      userId: c.userId,
      channel: 'in_app',
      template: 'commitment_missed',
      title: 'A commitment came due',
      body: `"${c.description}" is marked missed. Check in to tell your partner what happened.`,
      dedupeKey: `missed:${c.id}`,
    });
  }
}

async function disengagementScan(): Promise<void> {
  const now = new Date();
  const users = await prisma.user.findMany({
    where: { state: { in: ['trial', 'active'] } },
    take: 1000,
    select: { id: true },
  });
  for (const u of users) {
    const [lastCheckIn, lastCommitments] = await Promise.all([
      prisma.checkIn.findFirst({ where: { userId: u.id }, orderBy: { createdAt: 'desc' } }),
      prisma.commitment.findMany({
        where: { userId: u.id, dueAt: { gte: new Date(now.getTime() - 7 * 86_400_000) } },
      }),
    ]);
    const result = detectDisengagement(
      {
        lastCheckInAt: lastCheckIn?.createdAt ?? null,
        lastAppOpenAt: lastCheckIn?.createdAt ?? null,
        scheduledCommitmentsLast7d: lastCommitments.length,
        completedCommitmentsLast7d: lastCommitments.filter((c) => c.status === 'completed').length,
      },
      now,
    );
    if (result.state === 'disengaging' || result.state === 'disengaged') {
      await sendNotification({
        userId: u.id,
        channel: 'in_app',
        template: 'reengage',
        title: 'Still with you',
        body: "It's been a little while. Even one small action today keeps the momentum alive — want to set a quick commitment?",
        dedupeKey: `reengage:${u.id}:${now.toISOString().slice(0, 10)}`,
      });
      await emitEvent({ class: 'domain', type: 'disengagement.detected', userId: u.id, actor: 'system', metadata: { state: result.state } });
    }
  }
}

async function trialExpiryCheck(): Promise<void> {
  const now = new Date();
  const subs = await prisma.subscription.findMany({
    where: { status: 'trialing' },
    include: { user: true },
    take: 1000,
  });
  for (const s of subs) {
    if (trialExpired(s.trialEndsAt, now)) {
      // No payment method attached -> expire access; keep data (spec §41, §55).
      await prisma.subscription.update({ where: { id: s.id }, data: { status: 'none' } });
      await prisma.user.update({ where: { id: s.userId }, data: { state: 'expired' } });
      await emitEvent({ class: 'domain', type: 'trial.expired', userId: s.userId, actor: 'system' });
    }
  }
}
