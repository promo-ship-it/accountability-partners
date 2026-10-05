# Deployment

Target: **Vercel** + managed **Postgres** (Neon recommended for the free/low tier).

## 1. Database

Create a Postgres database (Neon / Vercel Postgres / Supabase) and copy its
connection string to `DATABASE_URL`. Then apply migrations:

```bash
DATABASE_URL=... npm run db:deploy
DATABASE_URL=... npm run db:seed      # feature flags (+ optional personas)
```

## 2. Vercel project

1. Import the GitHub repo into Vercel.
2. Set the environment variables from [ENVIRONMENT.md](./ENVIRONMENT.md) in the
   Vercel project (Production + Preview).
3. Deploy. Build command is `prisma generate && next build` (from package.json).

## 3. Cron (background jobs)

`vercel.json` registers an hourly cron hitting `/api/cron`. Set `CRON_SECRET`
in Vercel; Vercel Cron automatically sends it as a Bearer token. The endpoint
enqueues periodic scans (due commitments, disengagement, trial expiry) and
drains the job queue.

## 4. Stripe

See [BILLING.md](./BILLING.md). Add the webhook endpoint
`https://<domain>/api/webhooks/stripe` and set `STRIPE_WEBHOOK_SECRET`.

## 5. Verify production

- `GET /api/health` → `{ status: "ok", db: true, integrations: {...} }`.
- Sign up → onboard → create a commitment → complete/miss → observe AI response.
- Admin: log in with an `ADMIN_EMAILS` account → visit `/admin`.

## Environments (spec §69)

- **development** — local, `APP_ENV=development` (cookies non-secure, mock AI).
- **staging** — a separate Vercel environment + separate DB; never test on
  production customer data.
- **production** — `APP_ENV=production`.

## Cost estimate (spec §2)

| Item                     | ~Cost at 25–50 customers      |
| ------------------------ | ----------------------------- |
| Vercel (Hobby/Pro)       | $0–$20/mo                     |
| Postgres (Neon free/paid)| $0–$19/mo                     |
| AI (gpt-4o-mini default) | ~$0.50–$2 / customer / mo\*   |
| Email (Resend free tier) | $0 (3k emails/mo free)        |
| Stripe fees              | 2.9% + $0.30 per charge       |

\* Controlled by per-customer request limits. The admin dashboard shows live
AI cost + gross margin per customer. Target: well within $100–$250/mo at 50
customers.
