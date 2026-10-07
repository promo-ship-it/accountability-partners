# AI

## One engine, modular capabilities (spec §21)

A single **Accountability Intelligence Engine** (`modules/ai/engine.ts`) with
capabilities, not seven independent bots. Capabilities (spec §20):
`encouragement`, `daily_accountability`, `goal_decomposition`,
`commitment_recommendation`, `barrier_discovery`, `challenge_reframe`,
`weekly_report`, `coaching`.

## Decision pipeline (spec §19)

`runCapability(userId, capability, context)` runs:

1. **Cost gate** — kill switch (env OR `ai_kill_switch` flag), per-customer
   daily/monthly limits, global daily limit (`costControl.ts`).
2. **Per-capability kill switch** — `ai_disable_<capability>` feature flag.
3. **Build context + select model** — `fast` (cheap, default) vs `smart`
   (reasoning, used sparingly) per capability.
4. **Generate** via the active `AiProvider`.
5. **Validate** JSON capabilities.
6. **Safety check** (`safety.ts`) — blocks medical claims, shaming, unsafe advice.
7. **Log** usage + interaction (summaries only; no raw private content, spec §24).

Any failure → deterministic non-fabricating **static fallback** (spec §55).

## Provider abstraction (spec §22, §59)

`AiProvider` interface. Implementations: `MockProvider` (no-key / tests, safe
and grounded) and `OpenAiProvider` (OpenAI-compatible via `fetch`, no SDK).
Add Anthropic as a sibling without touching business logic. `AI_PROVIDER` +
`AI_API_KEY` select at runtime.

## Cost control (spec §23)

Env-configurable limits: `AI_DAILY_REQUESTS_PER_CUSTOMER`,
`AI_MONTHLY_REQUESTS_PER_CUSTOMER`, `AI_GLOBAL_DAILY_REQUESTS`, plus
`AI_KILL_SWITCH` and runtime feature-flag switches. Per-request cost is
estimated (`estimateCostUsd`) and stored in `AiUsage` for the admin dashboard.
Lowest-capable model is the default; no uncontrolled loops.

### Budget mode (percentage-of-revenue caps)

On top of the request-count limits, `modules/ai/budget.ts` caps **estimated
dollar cost** as a percentage of the subscription price — two independent caps:

- **Per-customer:** each customer may spend up to `pct% × price` (default 20%
  of $35 = **$7/mo**). Protects gross margin per customer and ensures one
  heavy user can only exhaust their **own** share, never the pool.
- **Pooled:** all active customers combined may spend up to
  `pct% × price × activeCustomers` (the absolute system ceiling).

At either cap, AI degrades to the free static fallback (app stays fully
functional); caps reset monthly. Config:

- `AI_BUDGET_ENABLED` (default `true`) and `AI_BUDGET_PCT` (default `20`) in env.
- Live overrides via feature flags (no redeploy): `ai_budget_disabled` turns
  capping off; `ai_budget_pct_<n>` (e.g. `ai_budget_pct_25`) sets the percent.
- The admin dashboard exposes an on/off toggle, a `10/15/20/25%` dropdown, the
  resulting per-customer and pool caps, and a live "pool used this month" meter.

## Prompt versioning (spec §25)

Prompts are versioned assets in `modules/ai/prompts.ts` (`version`, `model`,
`system`, `build`). A shared `SAFETY_PREAMBLE` injects the non-negotiable
safety rules into every capability. Changing a prompt is a code edit, not a
schema change; a capability can be disabled live via its feature flag.

## Safety (spec §27, §28)

The engine never fabricates history/progress; it only uses provided facts.
The `safety.ts` filter blocks the clearest violations (diagnosis language,
shaming, unsafe advice). Wellness guidance is explicitly non-clinical and the
UI tells the customer they're talking to an AI. Behavioral conclusions are
evidence-based and tier-tagged (never a hypothesis stored as a fact).

## Evaluation (spec §26, §68)

Seven synthetic personas (A–G) are seeded and exercised by
`tests/ai-eval.test.ts`, which asserts the engine's **decisions** (escalation
level, observations, adaptive signal) are correct per persona — testing
usefulness, not just that prose sounds good.
