import { ok, fail, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { stripe, stripeConfigured } from '@/modules/billing/stripe';
import { env } from '@/lib/env';

/** Create a Stripe Checkout session to convert trial -> $35/mo. */
export async function POST() {
  try {
    const user = await requireUser();
    if (!stripeConfigured()) {
      return fail('Billing is not configured yet. Please contact support.', 503);
    }

    const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
    let customerId = sub?.stripeCustomerId ?? undefined;
    if (!customerId) {
      const customer = await stripe().customers.create({ email: user.email, metadata: { userId: user.id } });
      customerId = customer.id;
      await prisma.subscription.update({ where: { userId: user.id }, data: { stripeCustomerId: customerId } });
    }

    const session = await stripe().checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      line_items: [{ price: env.STRIPE_PRICE_ID!, quantity: 1 }],
      success_url: `${env.APP_URL}/app?checkout=success`,
      cancel_url: `${env.APP_URL}/app?checkout=cancel`,
      metadata: { userId: user.id },
    });
    return ok({ url: session.url });
  } catch (e) {
    return handleError(e);
  }
}
