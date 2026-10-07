/**
 * Brand config — single source of truth for all CUSTOMER-FACING naming.
 *
 * Every customer-facing surface (checkout product, success/cancel pages,
 * emails, page titles, landing + app headers, support email) reads from here.
 * To rename the project later: change the env vars below in your deployment and
 * redeploy — no code edits, nothing scattered to hunt down. Keeping multiple
 * projects divided is just a matter of each deployment setting its own values.
 *
 * NOTE: Stripe-side branding (checkout logo/colors, business name on receipts,
 * the account statement descriptor) is configured in the Stripe Dashboard, not
 * here — see BILLING.md. `statementDescriptor` below is passed on charges where
 * supported, but the account-level descriptor still lives in Stripe.
 */

import { env } from './env';

export const brand = {
  /** Display name used everywhere customer-facing. */
  name: env.BRAND_NAME,
  /** Shown on card statements (<= 22 chars, Stripe limit). */
  statementDescriptor: env.BRAND_STATEMENT_DESCRIPTOR,
  /** Customer support contact. */
  supportEmail: env.BRAND_SUPPORT_EMAIL,
  /** Short tagline for the landing hero / metadata. */
  tagline: 'Build the discipline to reach your goals',
};

/** Convenience: the product label used on Stripe line items / metadata. */
export function productLabel(): string {
  return `${brand.name} — Membership`;
}
