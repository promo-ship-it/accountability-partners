/**
 * Personalized home data (spec §33). Assembles today's most important action,
 * current commitment, accountability prompt, progress, and one insight.
 */

import { prisma } from '@/lib/db';
import { computeGoalProgress } from '@/modules/goals/progress';
import { daysLeftInTrial } from '@/modules/billing/trial';

export async function homeData(userId: string) {
  const now = new Date();
  const startOfDay = new Date(now);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(now);
  endOfDay.setHours(23, 59, 59, 999);

  const [profile, goal, todays, upcoming, lastObservation, subscription, unreadNotifs] =
    await Promise.all([
      prisma.profile.findUnique({ where: { userId } }),
      prisma.goal.findFirst({ where: { userId, status: 'active' }, orderBy: { createdAt: 'desc' } }),
      prisma.commitment.findMany({
        where: { userId, status: 'scheduled', dueAt: { gte: startOfDay, lte: endOfDay } },
        orderBy: { dueAt: 'asc' },
      }),
      prisma.commitment.findFirst({
        where: { userId, status: 'scheduled', dueAt: { gt: endOfDay } },
        orderBy: { dueAt: 'asc' },
      }),
      prisma.behavioralObservation.findFirst({
        where: { userId, active: true },
        orderBy: { updatedAt: 'desc' },
      }),
      prisma.subscription.findUnique({ where: { userId } }),
      prisma.notification.count({ where: { userId, status: 'pending', channel: 'in_app' } }),
    ]);

  let progress = null;
  if (goal) {
    const points = await prisma.progressRecord.findMany({
      where: { userId, goalId: goal.id },
      orderBy: { recordedAt: 'asc' },
    });
    const baseline = toNum(goal.baseline);
    const target = toNum(goal.target);
    progress = computeGoalProgress({
      baseline,
      target,
      points: points.map((p) => ({ value: p.value, recordedAt: p.recordedAt })),
    });
  }

  const trialDaysLeft =
    subscription?.status === 'trialing'
      ? daysLeftInTrial(subscription.trialEndsAt, now)
      : null;

  return {
    displayName: profile?.displayName ?? null,
    goal,
    todaysCommitments: todays,
    nextCommitment: upcoming,
    insight: lastObservation
      ? { summary: lastObservation.summary, evidence: lastObservation.evidence, confidence: lastObservation.confidence, tier: lastObservation.tier }
      : null,
    progress,
    subscriptionStatus: subscription?.status ?? 'none',
    trialDaysLeft,
    unreadNotifs,
  };
}

function toNum(s: string | null): number | null {
  if (!s) return null;
  const m = s.match(/-?\d+(\.\d+)?/);
  return m ? parseFloat(m[0]) : null;
}
