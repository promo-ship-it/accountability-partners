import { ok, fail, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { stripe, stripeConfigured } from '@/modules/billing/stripe';
import { env } from '@/lib/env';

/** Stripe billing portal — customer manages/cancels subscription. */
export async function POST() {
  try {
    const user = await requireUser();
    if (!stripeConfigured()) return fail('Billing is not configured yet.', 503);
    const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
    if (!sub?.stripeCustomerId) return fail('No billing account found.', 404);
    const portal = await stripe().billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${env.APP_URL}/app`,
    });
    return ok({ url: portal.url });
  } catch (e) {
    return handleError(e);
  }
}
