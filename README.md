# Accountability Partners

An AI-powered **goal achievement platform**. Fitness & wellness is the first
market; the core is domain-neutral so new goal domains (career, finance, etc.)
can be added later without a rewrite.

> Accountability Partners helps people understand their barriers, build the
> discipline to take consistent action, and achieve the goals that matter to them.

## What it does

- **AI accountability** — adaptive daily check-ins that match the customer's style.
- **Progress tracking** — goal, next action, and real momentum without a wall of charts.
- **AI coaching** — when a commitment is missed, the partner investigates the real
  barrier (evidence-based), may respectfully challenge, and adapts the plan.

Three capabilities, one coherent **Accountability Intelligence Engine** — not seven bots.

## Tech stack (low-cost, Vercel-native)

| Concern        | Choice                                             |
| -------------- | -------------------------------------------------- |
| Framework      | Next.js 14 (App Router) + TypeScript               |
| Database       | PostgreSQL via Prisma (Neon / Vercel / Supabase)   |
| Auth           | Built-in signed-cookie sessions + bcrypt (no SaaS) |
| AI             | Provider-abstracted; OpenAI-compatible by default  |
| Billing        | Stripe (subscription + 7-day trial, $35/mo)        |
| Email          | Console (dev) or Resend (prod)                     |
| Background jobs | DB-backed queue drained by Vercel Cron            |
| Hosting        | Vercel                                             |

No always-on workers, no extra paid infra. See [DEPLOYMENT.md](./DEPLOYMENT.md)
for cost estimates.

## Quick start

```bash
cp .env.example .env            # fill in DATABASE_URL (+ optional keys)
npm install
npm run db:migrate              # apply schema to your Postgres
npm run db:seed                 # feature flags + synthetic personas
npm run dev                     # http://localhost:3000
```

Run the tests:

```bash
npm test        # 64 tests: domain logic, AI eval, migration + e2e on real Postgres (pglite)
npm run typecheck
npm run lint
```

## Documentation

- [ARCHITECTURE.md](./ARCHITECTURE.md) — modular monolith, modules, event flow
- [DATABASE.md](./DATABASE.md) — schema, ownership, migrations, backups
- [AI.md](./AI.md) — engine, pipeline, provider abstraction, cost controls, safety
- [BILLING.md](./BILLING.md) — Stripe, trial, entitlement engine
- [DEPLOYMENT.md](./DEPLOYMENT.md) — Vercel deploy, env, cron, costs
- [ENVIRONMENT.md](./ENVIRONMENT.md) — every environment variable
- [TESTING.md](./TESTING.md) — test strategy and personas
- [PRODUCT.md](./PRODUCT.md) — product definition and behavioral loop
- [ROADMAP.md](./ROADMAP.md) — architected-but-not-built, next features

## Status

V1 is built, typechecks, lints, builds, and passes 64 automated tests. Going
live requires owner-supplied credentials (Postgres, Stripe, AI key) — the app
runs in graceful fallback mode without them. See DEPLOYMENT.md.
