# Testing

```bash
npm test          # vitest run — 64 tests
npm run typecheck # tsc --noEmit
npm run lint      # next lint
```

## Layers (spec §66)

- **Unit** — pure domain logic: escalation model, evidence engine, adaptive
  style, goal progress, cost control, safety filter, entitlements/trial.
- **Integration (real Postgres)** — `tests/migration.test.ts` runs the
  committed migration SQL on an in-process Postgres engine (pglite) and asserts
  tables, unique constraints, and ownership columns.
- **End-to-end (real Postgres)** — `tests/e2e-journey.test.ts` walks the
  critical customer journey (spec §67) against pglite using the SAME engine
  decision functions the API routes use.
- **AI evaluation** — `tests/ai-eval.test.ts` asserts correct engine behavior
  for the seven synthetic personas (spec §68) — usefulness, not prose.
- **Security/ownership** — covered by service-layer ownership helpers +
  constraint tests; see `modules/goals/service.ts`.

## Why pglite

A networked Postgres container is not reliably available in every CI/sandbox.
pglite is a real Postgres engine compiled to WASM that runs in-process, so the
migration and e2e tests validate against actual Postgres semantics with zero
external infrastructure. Production uses a managed Postgres via `DATABASE_URL`.

## Synthetic personas (spec §68)

Seeded by `prisma/seed.ts`: A consistent, B inconsistent, C disengaging,
D rejects recommendations, E changes goals, F needs stronger accountability
(evening-fatigue pattern), G needs gentler accountability.

## Not auto-added

No tests are added to feature code paths the owner didn't ask for; the suite
targets the spec's required journeys and behaviors.
