# Roadmap

## Built in V1 (spec §60)

Auth, onboarding, goals, commitments, check-ins, progress, behavioral profile
foundation, AI accountability + coaching, barrier discovery, behavioral
observations, adaptive accountability, personalized home, notifications
foundation, Stripe subscription/trial, admin dashboard, analytics events, AI
cost controls, security, privacy (export/delete), automated tests, deploy
config, documentation.

## Architected now, activated later (spec §61)

These have extension points (enums, interfaces, events, flags) but are **not**
built as features:

- **Human coaching** — `human_coaching` entitlement + escalation level 5 exist;
  no coach UI/workflow. Customer never has to migrate products (spec §29).
- **SMS / push / voice** — `NotificationChannel` enum + channel switch ready.
- **Additional goal domains** — `GoalCategory` includes career/education/
  finance/etc.; the goal engine is domain-neutral.
- **Meal/workout planning, personalized videos** — capability slots reserved
  in the AI capability list; not prioritized.
- **Multiple pricing tiers** — entitlement engine is decoupled from billing
  status, so new plans don't touch billing code.
- **Advanced gamification / referrals / community** — `Challenge`/`Achievement`
  tables exist; no elaborate systems.
- **Wearable integrations, white-label, native mobile, multi-agent AI** — out.

## Explicitly NOT built (spec §62)

Social networking, marketplace, complex community, native mobile apps, video
infrastructure, enterprise white-labeling, independent multi-agent AI,
referral systems, coaching marketplace, broad wearable/fitness integrations,
every goal category.

## Recommended next features (in order)

1. **Wire Stripe + AI keys** and run a live end-to-end conversion (owner creds).
2. **Weekly report delivery** — the job + capability exist; schedule + email it.
3. **AiMemory population** — persist identity/behavioral memory from interactions
   to deepen personalization over time.
4. **Email reminders live** (Resend) — flip `EMAIL_PROVIDER=resend`.
5. **Human-coach escalation MVP** — surface level-5 escalations to the admin.
6. **Second goal domain** (e.g. finance) to prove the domain-neutral core.
