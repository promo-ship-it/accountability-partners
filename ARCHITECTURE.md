# Architecture

## Shape: modular monolith

One deployable Next.js app with clear internal module boundaries. No
microservices in V1 (spec §58). Future features are added as **new modules**
behind the **existing interfaces + events + customer model** — not rewrites
(spec §75).

```
src/
  lib/            env, db (Prisma singleton), auth, api helpers
  modules/
    customer/     signup, onboarding, lifecycle, export/delete
    goals/        goals, commitments, check-ins, progress, pure progress math
    accountability/ escalation model, adaptive style (pure logic)
    behavioral/   evidence engine, disengagement, source-of-truth tiers (pure)
    ai/           provider abstraction, engine (decision pipeline), prompts,
                  cost control, safety
    notifications/ channel-abstracted sender (in-app, email; sms/push ready)
    billing/      stripe client, entitlement engine, trial, sync (pure + io)
    events/       domain/analytics/integration event emitter
    jobs/         DB-backed queue, handlers, cron runner (idempotent, retries)
    admin/        owner dashboard data + emergency controls
    home/         personalized home assembly
  app/            Next.js routes (pages + /api route handlers)
  middleware.ts   edge gate for /app and /admin
```

## Provider abstractions (spec §59)

Core logic depends on interfaces, never vendor SDKs directly:

- **AI** — `AiProvider` (`mock`, `openai`-compatible). Swap = config change.
- **Payments** — Stripe isolated in `billing/stripe.ts` + `sync.ts`.
- **Email/SMS/Push** — `notifications/service.ts` channel switch.
- **Auth** — `lib/auth.ts` surface (`createSession`/`getCurrentUser`).

## The behavioral loop (spec §6)

`UNDERSTAND → PLAN → COMMIT → ACT → CHECK → LEARN → ADAPT → REPEAT`

Reinforced by: onboarding (understand), goal engine (plan), commitments
(commit), check-ins (act/check), evidence engine (learn), escalation + adaptive
style (adapt).

## AI decision pipeline (spec §19)

```
event/action
  → cost gate (kill switch, per-customer + global limits)
  → per-capability kill switch
  → build context  → select capability + model (fast vs smart)
  → generate (provider)  → validate (JSON)  → safety check
  → execute/return  → log usage + interaction (no raw private content)
```

Implemented in `modules/ai/engine.ts#runCapability`. Any failure degrades to a
deterministic, non-fabricating static fallback so the product keeps working
(spec §55).

## Source-of-truth hierarchy (spec §15)

Every behavioral record carries a `TruthTier`:
`customer_confirmed > app_recorded > observed > ai_inference > ai_hypothesis`.
`evidence.ts#canAsserted` prevents deriving a fact from a weaker tier. The UI
labels insights by tier so a hypothesis is never shown as a fact.

## Events (spec §44)

`emitEvent({ class, type, version, entity, actor, metadata, correlationId })`
with three classes: **domain** (state changed), **analytics** (funnel), and
**integration** (external). Analytics funnel events power the metrics in the
admin dashboard.

## Background work (spec §36)

A DB-backed `Job` table with `dedupeKey` (idempotency), `attempts`/`maxAttempts`
(retries + exponential backoff), and status. Drained by `/api/cron` (Vercel
Cron hourly). No always-on worker needed.

## Reliability & errors

- Idempotency on Stripe webhooks (event id), notifications (dedupeKey), jobs.
- API errors never leak internals — mapped to safe messages + a support ref
  (`lib/api.ts#handleError`).
- Health endpoint at `/api/health`.
