# Database

PostgreSQL via Prisma. Schema: [`prisma/schema.prisma`](./prisma/schema.prisma).

## Customer data ownership (spec §43)

Every customer-owned table has a `userId` and all service queries are scoped by
it (e.g. `findFirst({ where: { id, userId } })`). The app never trusts a
client-supplied id alone — see `modules/goals/service.ts` ownership helpers.
Cascading deletes remove owned rows when a user is deleted.

> For defense-in-depth you can additionally enable Postgres Row-Level Security
> on the hosted DB; the app already enforces ownership at the service layer.

## Core entities

Identity/lifecycle: `User` (with `AccountState` enum — explicit lifecycle, no
scattered booleans), `Session`, `Profile`.
Goal engine: `Goal`, `Milestone`, `Action`, `Commitment`, `Habit`.
Progress/behavior: `CheckIn`, `ProgressRecord`, `BehavioralObservation`,
`Barrier`, `Strategy` (all tier-tagged where relevant).
AI: `AiInteraction`, `AiMemory` (typed by `MemoryKind` with `expiresAt`
lifecycle), `AiUsage` (per-day/month cost rollup keys).
Notifications: `Notification` (unique `dedupeKey`), `NotificationPreference`.
Billing: `Subscription` (Stripe mirror), `Entitlement` (decoupled).
Platform: `Event`, `Job`, `FeatureFlag`, `Challenge`, `Achievement`,
`AuditLog`.

## AI memory segmentation (spec §17)

`AiMemory.kind` separates identity / goal / behavioral / preference /
interaction / ephemeral / system memory — not one blob. `expiresAt` gives
ephemeral memory a lifecycle; a cleanup job can purge expired rows.

## Migrations (spec §70)

Version-controlled under `prisma/migrations/`. Never hand-edit production.

```bash
npm run db:migrate          # dev: create + apply a migration
npm run db:deploy           # prod/CI: apply committed migrations
```

The committed `0001_init` migration is validated by an automated test that runs
it on a real Postgres engine (pglite) — see `tests/migration.test.ts`.

## Backups & recovery (spec §71)

Use the managed provider's backups:

- **Neon**: point-in-time restore (branching). Enable PITR on the project.
- **Vercel Postgres / Supabase**: daily automated backups.

Recovery: restore the branch/snapshot, point `DATABASE_URL` at it, redeploy.
Because Stripe is the billing source of truth, billing state re-syncs from
Stripe webhooks/portal if ever divergent.
