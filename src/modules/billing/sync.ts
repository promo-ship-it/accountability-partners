/**
 * Stripe -> app subscription sync (spec §39, §40). Stripe is source of truth;
 * we mirror status into our Subscription + recompute entitlements + lifecycle.
 */

import { prisma } from '@/lib/db';
import { mapStripeStatus } from './stripe';
import { entitlementsFor, type SubscriptionStatus } from './entitlements';
import { emitEvent, Analytics } from '@/modules/events';
import type { AccountState } from '@prisma/client';

function stateFor(status: SubscriptionStatus): AccountState {
  switch (status) {
    case 'trialing':
      return 'trial';
    case 'active':
      return 'active';
    case 'past_due':
      return 'payment_failed';
    case 'canceled':
      return 'canceled';
    default:
      return 'expired';
  }
}

export async function syncSubscription(params: {
  stripeCustomerId: string;
  stripeSubscriptionId?: string;
  status: string;
  priceId?: string;
  currentPeriodEnd?: number | null;
  cancelAtPeriodEnd?: boolean;
  trialEnd?: number | null;
}): Promise<void> {
  const sub = await prisma.subscription.findUnique({
    where: { stripeCustomerId: params.stripeCustomerId },
  });
  if (!sub) return; // customer not known locally; ignore

  const status = mapStripeStatus(params.status);
  await prisma.subscription.update({
    where: { id: sub.id },
    data: {
      stripeSubscriptionId: params.stripeSubscriptionId ?? sub.stripeSubscriptionId,
      status,
      priceId: params.priceId ?? sub.priceId,
      currentPeriodEnd: params.currentPeriodEnd ? new Date(params.currentPeriodEnd * 1000) : sub.currentPeriodEnd,
      cancelAtPeriodEnd: params.cancelAtPeriodEnd ?? sub.cancelAtPeriodEnd,
      trialEndsAt: params.trialEnd ? new Date(params.trialEnd * 1000) : sub.trialEndsAt,
    },
  });

  // Recompute entitlements from status (decoupled engine).
  const ent = entitlementsFor(status);
  for (const [feature, enabled] of Object.entries(ent)) {
    await prisma.entitlement.upsert({
      where: { userId_feature: { userId: sub.userId, feature } },
      update: { enabled },
      create: { userId: sub.userId, feature, enabled },
    });
  }

  await prisma.user.update({ where: { id: sub.userId }, data: { state: stateFor(status) } });

  await emitEvent({
    class: 'domain',
    type: `subscription.${status}`,
    userId: sub.userId,
    actor: 'system',
  });
  if (status === 'active') await Analytics.track('trial_conversion', sub.userId);
  if (status === 'canceled') await Analytics.track('churn', sub.userId);
}
