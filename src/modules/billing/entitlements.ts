/**
 * Entitlement engine (spec §40). Maps billing/subscription status to
 * application entitlements, decoupled so pricing can change without touching
 * billing code. Pure.
 */

export type SubscriptionStatus =
  | 'trialing'
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'none';

export type Feature =
  | 'ai_accountability'
  | 'progress'
  | 'ai_coaching'
  | 'goal_management'
  | 'commitments'
  | 'behavioral_learning'
  | 'human_coaching'; // architected, never enabled in base plan

export const BASE_PLAN_FEATURES: Feature[] = [
  'ai_accountability',
  'progress',
  'ai_coaching',
  'goal_management',
  'commitments',
  'behavioral_learning',
];

/** Which features are enabled for a given subscription status. */
export function entitlementsFor(status: SubscriptionStatus): Record<Feature, boolean> {
  const grant = status === 'trialing' || status === 'active' || status === 'past_due';
  const base = Object.fromEntries(
    BASE_PLAN_FEATURES.map((f) => [f, grant]),
  ) as Record<Feature, boolean>;
  return { ...base, human_coaching: false }; // never in base plan (spec §38)
}

export function hasAccess(status: SubscriptionStatus): boolean {
  return status === 'trialing' || status === 'active' || status === 'past_due';
}
