# Environment variables

Copy `.env.example` → `.env` (local) or set in Vercel. Validated at startup by
`src/lib/env.ts`. Missing optional credentials degrade gracefully.

| Variable | Required? | Purpose |
| --- | --- | --- |
| `APP_URL` | yes (prod) | Public base URL (Stripe redirects, cron). |
| `APP_ENV` | yes | `development` \| `staging` \| `production`. Controls cookie security. |
| `DATABASE_URL` | **yes** | Postgres connection string. **No live app without it.** |
| `AUTH_SECRET` | **yes** | Session signing secret. `openssl rand -base64 32`. |
| `AI_PROVIDER` | yes | `openai` \| `anthropic` \| `mock`. `mock` = no-key fallback. |
| `AI_API_KEY` | for live AI | API key. Without it, AI runs in safe fallback mode. |
| `AI_MODEL_FAST` | yes | Low-cost default model (e.g. `gpt-4o-mini`). |
| `AI_MODEL_SMART` | yes | Higher-capability model used sparingly. |
| `AI_BASE_URL` | yes | OpenAI-compatible base URL. |
| `AI_DAILY_REQUESTS_PER_CUSTOMER` | yes | Cost cap per customer/day. |
| `AI_MONTHLY_REQUESTS_PER_CUSTOMER` | yes | Cost cap per customer/month. |
| `AI_GLOBAL_DAILY_REQUESTS` | yes | Global daily AI cap. |
| `AI_KILL_SWITCH` | yes | `true` disables all AI immediately. |
| `AI_BUDGET_ENABLED` | yes | `true` caps AI cost at a % of price (per-customer + pooled). |
| `AI_BUDGET_PCT` | yes | Budget as a % of the subscription price (default 20). Live-overridable in admin. |
| `STRIPE_SECRET_KEY` | for billing | Stripe secret key. |
| `STRIPE_WEBHOOK_SECRET` | for billing | Webhook signing secret. |
| `STRIPE_PRICE_ID` | for billing | The $35/mo recurring price id. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | optional | Client-side Stripe key (future Stripe.js). |
| `EMAIL_PROVIDER` | yes | `console` (dev) \| `resend` (prod). |
| `EMAIL_API_KEY` | for email | Resend API key. |
| `EMAIL_FROM` | yes | From address. |
| `CRON_SECRET` | yes | Bearer token the cron scheduler must send. |
| `ADMIN_EMAILS` | yes | Comma-separated admin emails for `/admin`. |

## Credentials still required to go fully live

1. **`DATABASE_URL`** — a hosted Postgres (Neon/Vercel/Supabase).
2. **`AI_API_KEY`** (+ `AI_PROVIDER=openai`) — for real AI responses.
3. **`STRIPE_SECRET_KEY` + `STRIPE_WEBHOOK_SECRET` + `STRIPE_PRICE_ID`** — for paid conversion.
4. *(optional)* **`EMAIL_API_KEY`** — to actually send email (else logged).

Everything else is built and works today.
