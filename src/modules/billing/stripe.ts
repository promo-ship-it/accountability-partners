/**
 * Stripe integration (spec §39). Stripe is the billing source of truth.
 * Guarded by feature detection: without keys, checkout returns a clear
 * "billing not configured" signal and the rest of the app keeps working.
 */

import Stripe from 'stripe';
import { env, features } from '@/lib/env';

let client: Stripe | null = null;

export function stripe(): Stripe {
  if (!features.stripeLive) {
    throw new Error('STRIPE_NOT_CONFIGURED');
  }
  if (!client) {
    // Let the SDK use its pinned API version to avoid version drift.
    client = new Stripe(env.STRIPE_SECRET_KEY!);
  }
  return client;
}

export function stripeConfigured(): boolean {
  return features.stripeLive;
}

/** Map a Stripe subscription status to our internal enum. */
export function mapStripeStatus(s: string): 'trialing' | 'active' | 'past_due' | 'canceled' | 'incomplete' | 'none' {
  switch (s) {
    case 'trialing':
      return 'trialing';
    case 'active':
      return 'active';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
      return 'canceled';
    case 'incomplete':
    case 'incomplete_expired':
      return 'incomplete';
    default:
      return 'none';
  }
}
