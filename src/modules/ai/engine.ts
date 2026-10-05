/**
 * Accountability Intelligence Engine (spec §19, §21).
 *
 * ONE coherent engine with modular capabilities — not seven bots. Implements
 * the AI decision pipeline:
 *   gate (cost/kill switch) -> build context -> select capability+model
 *   -> generate -> validate -> safety check -> execute/log usage.
 */

import { randomUUID } from 'node:crypto';
import { prisma } from '@/lib/db';
import { env, features } from '@/lib/env';
import type { AiProvider } from './provider';
import { estimateCostUsd } from './provider';
import { MockProvider } from './providers/mock';
import { OpenAiProvider } from './providers/openai';
import { gateAiRequest } from './costControl';
import { PROMPTS, type Capability } from './prompts';
import { checkSafety, validateJson } from './safety';

function makeProvider(): AiProvider {
  if (features.aiLive && env.AI_PROVIDER === 'openai') {
    return new OpenAiProvider(env.AI_API_KEY!, env.AI_BASE_URL);
  }
  return new MockProvider();
}

function todayKey(d = new Date()): string {
  return d.toISOString().slice(0, 10);
}
function monthKey(d = new Date()): string {
  return d.toISOString().slice(0, 7);
}

export interface RunResult {
  ok: boolean;
  text: string;
  value?: unknown;
  usedFallback: boolean;
  blocked?: string;
  correlationId: string;
}

/**
 * Run an AI capability end-to-end for a customer, enforcing cost controls,
 * safety, and usage logging. Never throws for operational failures — returns
 * a safe fallback so the product keeps working (spec §55, §57).
 */
export async function runCapability(
  userId: string,
  capability: Capability,
  context: Record<string, unknown>,
): Promise<RunResult> {
  const correlationId = randomUUID();
  const def = PROMPTS[capability];

  // --- cost gate -------------------------------------------------------
  const [customerToday, customerMonth, globalToday] = await Promise.all([
    prisma.aiUsage.count({ where: { userId, day: todayKey() } }),
    prisma.aiUsage.count({ where: { userId, month: monthKey() } }),
    prisma.aiUsage.count({ where: { day: todayKey() } }),
  ]);

  // Kill switch can come from env OR a runtime feature flag (no-redeploy).
  const killFlag = await prisma.featureFlag.findUnique({ where: { key: 'ai_kill_switch' } });
  const killSwitch = env.AI_KILL_SWITCH || killFlag?.enabled === true;
  // Per-capability kill switch (spec §48).
  const capFlag = await prisma.featureFlag.findUnique({ where: { key: `ai_disable_${capability}` } });
  if (capFlag?.enabled) {
    return { ok: true, text: staticFallback(capability, context), usedFallback: true, blocked: 'capability_disabled', correlationId };
  }

  const gate = gateAiRequest(killSwitch, { customerToday, customerMonth, globalToday }, {
    dailyPerCustomer: env.AI_DAILY_REQUESTS_PER_CUSTOMER,
    monthlyPerCustomer: env.AI_MONTHLY_REQUESTS_PER_CUSTOMER,
    globalDaily: env.AI_GLOBAL_DAILY_REQUESTS,
  });

  if (!gate.allowed) {
    const fallback = staticFallback(capability, context);
    return { ok: true, text: fallback, usedFallback: true, blocked: gate.code, correlationId };
  }

  // --- build + generate -------------------------------------------------
  const provider = makeProvider();
  const model = def.model === 'smart' ? env.AI_MODEL_SMART : env.AI_MODEL_FAST;
  let result;
  try {
    result = await provider.generate({
      model,
      system: def.system,
      user: def.build(context),
      json: def.json,
    });
  } catch {
    // provider failed -> degrade to safe static fallback
    const fallback = staticFallback(capability, context);
    await logUsage(userId, capability, model, 0, 0, 0, correlationId, true);
    return { ok: true, text: fallback, usedFallback: true, correlationId };
  }

  // --- validate ---------------------------------------------------------
  let value: unknown;
  let validationOk = true;
  if (def.json) {
    const v = validateJson(result.text);
    validationOk = v.ok;
    value = v.value;
    if (!v.ok) {
      const fallback = staticFallback(capability, context);
      await logUsage(userId, capability, model, result.promptTokens, result.completionTokens, result.latencyMs, correlationId, true);
      return { ok: true, text: fallback, usedFallback: true, correlationId };
    }
  }

  // --- safety -----------------------------------------------------------
  const safety = checkSafety(result.text);

  // --- log usage + interaction (no raw private content) -----------------
  await Promise.all([
    logUsage(userId, capability, model, result.promptTokens, result.completionTokens, result.latencyMs, correlationId, result.usedFallback),
    prisma.aiInteraction.create({
      data: {
        userId,
        capability,
        model,
        promptVersion: def.version,
        summary: capability,
        validationOk,
        safetyOk: safety.ok,
        usedFallback: result.usedFallback,
        correlationId,
      },
    }),
  ]);

  if (!safety.ok) {
    const fallback = staticFallback(capability, context);
    return { ok: true, text: fallback, usedFallback: true, blocked: 'safety', correlationId };
  }

  return { ok: true, text: result.text, value, usedFallback: result.usedFallback, correlationId };
}

async function logUsage(
  userId: string,
  capability: string,
  model: string,
  promptTokens: number,
  completionTokens: number,
  latencyMs: number,
  _correlationId: string,
  _fallback: boolean,
): Promise<void> {
  await prisma.aiUsage.create({
    data: {
      userId,
      capability,
      model,
      promptTokens,
      completionTokens,
      estimatedCostUsd: estimateCostUsd(model, promptTokens, completionTokens),
      latencyMs,
      day: todayKey(),
      month: monthKey(),
    },
  });
}

/** Deterministic, safe, non-fabricating text used whenever AI is unavailable. */
export function staticFallback(capability: Capability, ctx: Record<string, unknown>): string {
  switch (capability) {
    case 'encouragement':
      return 'Great job following through today — that consistency is how discipline gets built.';
    case 'daily_accountability':
      return `Checking in: did you complete "${ctx.commitment ?? 'your commitment'}" today?`;
    case 'barrier_discovery':
      return "That commitment didn't happen today. What got in the way? Naming it helps us adjust the plan.";
    case 'weekly_report':
      return `This week: ${ctx.completed ?? 0} completed, ${ctx.missed ?? 0} missed. Pick one focus for next week.`;
    case 'commitment_recommendation':
      return 'Consider committing to one small, specific action in the next 24 hours.';
    case 'challenge_reframe':
      return "Let's look at this together — does the explanation feel like the whole picture, or might something else be at play?";
    case 'goal_decomposition':
      return JSON.stringify({
        milestones: ['Define a clear starting point', 'Build a weekly routine', 'Reach the target'],
        firstCommitment: 'Complete one small action in the next 24 hours.',
      });
    case 'coaching':
    default:
      return "I'm here as your accountability partner. What's the one thing you want to focus on today?";
  }
}
