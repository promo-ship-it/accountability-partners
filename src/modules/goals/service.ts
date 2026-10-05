/**
 * Goal & commitment service (spec §30, §43). Every query is scoped by userId —
 * backend-enforced ownership, never trusting client-supplied ids alone.
 */

import { prisma } from '@/lib/db';
import { emitEvent, Analytics } from '@/modules/events';
import { enqueue } from '@/modules/jobs/queue';

// ---- ownership helpers ----
async function ownedGoal(userId: string, goalId: string) {
  const g = await prisma.goal.findFirst({ where: { id: goalId, userId } });
  if (!g) throw new OwnershipError('Goal not found');
  return g;
}
async function ownedCommitment(userId: string, commitmentId: string) {
  const c = await prisma.commitment.findFirst({ where: { id: commitmentId, userId } });
  if (!c) throw new OwnershipError('Commitment not found');
  return c;
}

export class OwnershipError extends Error {
  status = 404;
}

// ---- goals ----
export function listGoals(userId: string) {
  return prisma.goal.findMany({ where: { userId }, orderBy: { createdAt: 'desc' } });
}

export async function createGoal(
  userId: string,
  data: { statement: string; whyItMatters?: string; category?: string; baseline?: string; target?: string; targetDate?: string },
) {
  const goal = await prisma.goal.create({
    data: {
      userId,
      statement: data.statement,
      whyItMatters: data.whyItMatters,
      category: (data.category as never) ?? 'fitness',
      baseline: data.baseline,
      target: data.target,
      targetDate: data.targetDate ? new Date(data.targetDate) : null,
    },
  });
  await emitEvent({ class: 'domain', type: 'goal.created', userId, entity: goal.id, actor: 'customer' });
  return goal;
}

// ---- commitments ----
export async function createCommitment(
  userId: string,
  data: { description: string; dueAt: string; goalId?: string; proposedByAi?: boolean },
) {
  if (data.goalId) await ownedGoal(userId, data.goalId);
  const commitment = await prisma.commitment.create({
    data: {
      userId,
      goalId: data.goalId ?? null,
      description: data.description,
      dueAt: new Date(data.dueAt),
      proposedByAi: data.proposedByAi ?? false,
    },
  });
  await emitEvent({ class: 'domain', type: 'commitment.created', userId, entity: commitment.id, actor: 'customer' });
  await Analytics.track('first_commitment', userId);

  // Schedule a reminder shortly before due (idempotent).
  const remindAt = new Date(new Date(data.dueAt).getTime() - 60 * 60 * 1000);
  await enqueue({
    type: 'commitment_reminder',
    payload: { commitmentId: commitment.id, userId },
    runAt: remindAt,
    dedupeKey: `reminder:${commitment.id}`,
  });
  return commitment;
}

export function listCommitments(userId: string, opts?: { status?: string; limit?: number }) {
  return prisma.commitment.findMany({
    where: { userId, ...(opts?.status ? { status: opts.status as never } : {}) },
    orderBy: { dueAt: 'asc' },
    take: opts?.limit ?? 50,
  });
}

export async function completeCommitment(userId: string, commitmentId: string) {
  await ownedCommitment(userId, commitmentId);
  const c = await prisma.commitment.update({
    where: { id: commitmentId },
    data: { status: 'completed', completedAt: new Date() },
  });
  await prisma.checkIn.create({ data: { userId, commitmentId, completed: true } });
  await emitEvent({ class: 'domain', type: 'commitment.completed', userId, entity: c.id, actor: 'customer' });
  await Analytics.track('first_completed_commitment', userId);
  return c;
}

export async function missCommitment(userId: string, commitmentId: string, reason?: string) {
  await ownedCommitment(userId, commitmentId);
  const c = await prisma.commitment.update({
    where: { id: commitmentId },
    data: { status: 'missed', missReason: reason },
  });
  await prisma.checkIn.create({ data: { userId, commitmentId, completed: false, note: reason } });
  await emitEvent({
    class: 'domain',
    type: 'commitment.missed',
    userId,
    entity: c.id,
    actor: 'customer',
    metadata: { reason },
  });
  return c;
}

// ---- check-ins & progress ----
export async function recordCheckIn(userId: string, data: { completed: boolean; mood?: number; note?: string; commitmentId?: string }) {
  if (data.commitmentId) await ownedCommitment(userId, data.commitmentId);
  const ci = await prisma.checkIn.create({
    data: { userId, completed: data.completed, mood: data.mood, note: data.note, commitmentId: data.commitmentId },
  });
  await emitEvent({ class: 'domain', type: 'checkin.completed', userId, entity: ci.id, actor: 'customer' });
  await Analytics.track('first_check_in', userId);
  return ci;
}

export async function recordProgress(userId: string, data: { metric: string; value: number; unit?: string; goalId?: string }) {
  if (data.goalId) await ownedGoal(userId, data.goalId);
  return prisma.progressRecord.create({
    data: { userId, metric: data.metric, value: data.value, unit: data.unit, goalId: data.goalId },
  });
}
