import { z } from 'zod';

/**
 * Centralized, validated environment access.
 * Missing optional credentials degrade gracefully (see feature detection below)
 * rather than crashing the app — per the "configure for missing creds, keep
 * building" principle.
 */
const schema = z.object({
  NODE_ENV: z.string().default('development'),
  APP_URL: z.string().default('http://localhost:3000'),
  APP_ENV: z.enum(['development', 'staging', 'production']).default('development'),
  DATABASE_URL: z.string().optional(),
  AUTH_SECRET: z.string().min(16).default('dev-only-secret-dev-only-secret-32chars'),

  AI_PROVIDER: z.enum(['openai', 'anthropic', 'mock']).default('mock'),
  AI_API_KEY: z.string().optional(),
  AI_MODEL_FAST: z.string().default('gpt-4o-mini'),
  AI_MODEL_SMART: z.string().default('gpt-4o'),
  AI_BASE_URL: z.string().default('https://api.openai.com/v1'),
  AI_DAILY_REQUESTS_PER_CUSTOMER: z.coerce.number().default(40),
  AI_MONTHLY_REQUESTS_PER_CUSTOMER: z.coerce.number().default(600),
  AI_GLOBAL_DAILY_REQUESTS: z.coerce.number().default(5000),
  AI_KILL_SWITCH: z
    .string()
    .default('false')
    .transform((v) => v === 'true'),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_ID: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),

  EMAIL_PROVIDER: z.enum(['console', 'resend']).default('console'),
  EMAIL_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Accountability Partners <hello@example.com>'),

  CRON_SECRET: z.string().default('dev-cron-secret'),
  ADMIN_EMAILS: z.string().default(''),
});

export const env = schema.parse(process.env);

/** Feature detection — which integrations are live vs. fallback. */
export const features = {
  aiLive: env.AI_PROVIDER !== 'mock' && !!env.AI_API_KEY && !env.AI_KILL_SWITCH,
  stripeLive: !!env.STRIPE_SECRET_KEY && !!env.STRIPE_PRICE_ID,
  emailLive: env.EMAIL_PROVIDER !== 'console' && !!env.EMAIL_API_KEY,
};

export const adminEmails = env.ADMIN_EMAILS.split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);
