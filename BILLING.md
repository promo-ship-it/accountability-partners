# Billing

## Plan

- **Price:** $35/month (`STRIPE_PRICE_ID` — a recurring monthly price).
- **Trial:** 7 days, no card required to start (trial is managed in-app;
  conversion creates the Stripe subscription).
- **Base plan includes:** AI accountability, progress tracking, AI coaching,
  goal management, commitments, behavioral learning.
- **Not included:** human coaching (architected, never granted in base plan).

## Stripe is the source of truth (spec §39)

Billing status is never derived from frontend state. We mirror Stripe into the
`Subscription` table via webhooks and recompute entitlements.

### Flow

1. Customer clicks **Subscribe** → `/api/billing/checkout` creates a Stripe
   Customer (if needed) and a Checkout Session.
2. Stripe fires webhooks → `/api/webhooks/stripe` (signature-verified).
3. `syncSubscription()` maps Stripe status → internal status → recomputes
   entitlements → sets account lifecycle state.
4. Customer manages/cancels via `/api/billing/portal` (Stripe Billing Portal).

### Webhook idempotency (spec §37)

Each Stripe `event.id` is recorded once (unique `dedupeKey`); replays are
no-ops. Handled events: `checkout.session.completed`,
`customer.subscription.{created,updated,deleted}`, `invoice.payment_failed`.

## Entitlement engine (spec §40)

Entitlements are **decoupled** from billing status so pricing can change
without touching billing code. `entitlementsFor(status)` returns the feature
map; `syncSubscription` upserts `Entitlement` rows. API routes check
entitlements (e.g. `/api/ai/coach` requires `ai_coaching`).

## Trial expiry

The hourly cron enqueues `trial_expiry_check`; expired trials with no active
subscription move to `expired` state and lose access — **data is retained**
(spec §41, §55) so the customer can resume by subscribing.

## Customer-facing naming (brand) & multiple projects

All **app-side** customer-facing naming comes from one place — `src/lib/brand.ts`,
driven by env vars `BRAND_NAME`, `BRAND_STATEMENT_DESCRIPTOR`,
`BRAND_SUPPORT_EMAIL`. Checkout product label/metadata, success/cancel pages,
emails, page titles, headers, and the support link all read from it. **To
rename the project later: change these env vars and redeploy — no code edits.**
Each separate project/deployment sets its own values, so they stay divided.

### Stripe-side branding (set in the Stripe Dashboard, not code)

Some customer-facing branding is **account-level** in Stripe and must be set in
the dashboard for the account this project uses:

- Business name + logo + colors on the Checkout page.
- Statement descriptor (what shows on card statements).
- Business name + support email on receipts/invoices.
- Product name on the invoice line (name the Stripe **Product**
  "Accountability Partners — Membership"; the app also sends this as the
  subscription description + metadata).

### One account vs. multiple projects

If you run several projects on **one** Stripe account, the account-level items
above (checkout branding, statement descriptor, receipt business name) are
**shared** — only the Product name and the per-charge description differ. For
truly per-project customer-facing identity (distinct checkout branding,
statement descriptor, payouts, dashboards), use a **separate Stripe account per
project** and point that project's `STRIPE_*` env vars at it. The app tags every
Stripe customer + subscription with `brand` metadata so this project's records
are identifiable even inside a shared account.

## Required Stripe setup

1. Create a Product + a $35/month recurring Price → `STRIPE_PRICE_ID`.
2. `STRIPE_SECRET_KEY` from API keys.
3. Add a webhook endpoint `https://<domain>/api/webhooks/stripe` for the events
   above → `STRIPE_WEBHOOK_SECRET`.
4. Set `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (used client-side if you add
   Stripe.js later).

Without these, the app runs: trials work, and conversion returns a clear
"billing not configured" message instead of crashing.
