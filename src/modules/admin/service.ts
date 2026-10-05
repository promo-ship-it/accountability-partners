/**
 * Admin service (spec §47, §48, §65). Owner-facing operational data +
 * emergency controls. All reads/writes assume the caller already passed
 * requireAdmin().
 */

import { prisma } from '@/lib/db';
import { PRICE_USD } from '@/modules/billing/trial';

export async function overview() {
  const today = new Date().toISOString().slice(0, 10);
  const month = new Date().toISOString().slice(0, 7);

  const [
    totalUsers,
    trialing,
    active,
    pastDue,
    canceled,
    aiCostAgg,
    aiCostMonthAgg,
    failedJobs,
    pendingJobs,
  ] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.subscription.count({ where: { status: 'trialing' } }),
    prisma.subscription.count({ where: { status: 'active' } }),
    prisma.subscription.count({ where: { status: 'past_due' } }),
    prisma.subscription.count({ where: { status: 'canceled' } }),
    prisma.aiUsage.aggregate({ where: { day: today }, _sum: { estimatedCostUsd: true } }),
    prisma.aiUsage.aggregate({ where: { month }, _sum: { estimatedCostUsd: true } }),
    prisma.job.count({ where: { status: 'failed' } }),
    prisma.job.count({ where: { status: 'pending' } }),
  ]);

  const mrr = active * PRICE_USD;
  const aiCostToday = aiCostAgg._sum.estimatedCostUsd ?? 0;
  const aiCostMonth = aiCostMonthAgg._sum.estimatedCostUsd ?? 0;

  // Unit economics (spec §65): per active customer.
  const aiCostPerCustomer = active > 0 ? aiCostMonth / active : 0;
  const paymentFeePerCustomer = PRICE_USD * 0.029 + 0.3; // Stripe standard est.
  const grossMarginPerCustomer = PRICE_USD - aiCostPerCustomer - paymentFeePerCustomer;

  return {
    customers: { total: totalUsers, trialing, active, pastDue, canceled },
    revenue: { mrr, pricePerCustomer: PRICE_USD },
    ai: { costToday: round(aiCostToday), costMonth: round(aiCostMonth) },
    jobs: { failed: failedJobs, pending: pendingJobs },
    unitEconomics: {
      revenuePerCustomer: PRICE_USD,
      aiCostPerCustomer: round(aiCostPerCustomer),
      paymentFeePerCustomer: round(paymentFeePerCustomer),
      grossMarginPerCustomer: round(grossMarginPerCustomer),
    },
  };
}

export async function listCustomers(limit = 100) {
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: { subscription: true, _count: { select: { goals: true, commitments: true } } },
  });
  return users.map((u) => ({
    id: u.id,
    email: u.email,
    state: u.state,
    role: u.role,
    subscriptionStatus: u.subscription?.status ?? 'none',
    goals: u._count.goals,
    commitments: u._count.commitments,
    createdAt: u.createdAt,
  }));
}

export async function setFeatureFlag(key: string, enabled: boolean, actorId: string, description?: string) {
  await prisma.featureFlag.upsert({
    where: { key },
    update: { enabled, description },
    create: { key, enabled, description },
  });
  await prisma.auditLog.create({
    data: { actorId, action: 'feature_flag.set', target: key, metadata: JSON.stringify({ enabled }) },
  });
}

export async function listFeatureFlags() {
  return prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
}

export async function suspendUser(userId: string, actorId: string, suspend: boolean) {
  await prisma.user.update({ where: { id: userId }, data: { state: suspend ? 'suspended' : 'active' } });
  await prisma.auditLog.create({
    data: { actorId, action: suspend ? 'user.suspended' : 'user.unsuspended', target: userId },
  });
}

export async function auditTrail(limit = 100) {
  return prisma.auditLog.findMany({ orderBy: { createdAt: 'desc' }, take: limit });
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
