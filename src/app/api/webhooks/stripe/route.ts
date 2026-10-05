import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { stripe, stripeConfigured } from '@/modules/billing/stripe';
import { syncSubscription } from '@/modules/billing/sync';
import { env } from '@/lib/env';
import type Stripe from 'stripe';

export const dynamic = 'force-dynamic';

/**
 * Stripe webhook (spec §37, §39). Verifies signature, then processes events
 * IDEMPOTENTLY: each Stripe event id is recorded once; replays are no-ops.
 */
export async function POST(req: Request) {
  if (!stripeConfigured() || !env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ received: false, reason: 'billing not configured' }, { status: 503 });
  }

  const sig = req.headers.get('stripe-signature');
  const raw = await req.text();
  if (!sig) return NextResponse.json({ error: 'missing signature' }, { status: 400 });

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, sig, env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: 'invalid signature' }, { status: 400 });
  }

  // Idempotency: dedupe on Stripe event id via the Job table's unique key.
  try {
    await prisma.job.create({
      data: { type: 'stripe_event', status: 'succeeded', dedupeKey: `stripe:${event.id}` },
    });
  } catch (e: unknown) {
    if (typeof e === 'object' && e && 'code' in e && (e as { code?: string }).code === 'P2002') {
      return NextResponse.json({ received: true, duplicate: true });
    }
    throw e;
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      const customerId = typeof session.customer === 'string' ? session.customer : session.customer?.id;
      const subId = typeof session.subscription === 'string' ? session.subscription : undefined;
      if (customerId) {
        await syncSubscription({
          stripeCustomerId: customerId,
          stripeSubscriptionId: subId,
          status: 'active',
        });
      }
      break;
    }
    case 'customer.subscription.created':
    case 'customer.subscription.updated':
    case 'customer.subscription.deleted': {
      const s = event.data.object as Stripe.Subscription;
      const customerId = typeof s.customer === 'string' ? s.customer : s.customer?.id;
      if (customerId) {
        await syncSubscription({
          stripeCustomerId: customerId,
          stripeSubscriptionId: s.id,
          status: event.type === 'customer.subscription.deleted' ? 'canceled' : s.status,
          priceId: s.items?.data?.[0]?.price?.id,
          currentPeriodEnd: s.current_period_end ?? null,
          cancelAtPeriodEnd: s.cancel_at_period_end,
          trialEnd: s.trial_end ?? null,
        });
      }
      break;
    }
    case 'invoice.payment_failed': {
      const inv = event.data.object as Stripe.Invoice;
      const customerId = typeof inv.customer === 'string' ? inv.customer : inv.customer?.id;
      if (customerId) {
        await syncSubscription({ stripeCustomerId: customerId, status: 'past_due' });
      }
      break;
    }
    default:
      break;
  }

  return NextResponse.json({ received: true });
}
