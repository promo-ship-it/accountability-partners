/**
 * Versioned prompt registry (spec §25). Prompts are application assets with
 * versions. The active version per capability can be overridden by a feature
 * flag / env without redeploy where practical.
 *
 * SAFETY: the shared system preamble encodes the non-negotiable AI safety
 * rules (spec §27, §28) so every capability inherits them.
 */

export type Capability =
  | 'encouragement'
  | 'daily_accountability'
  | 'goal_decomposition'
  | 'commitment_recommendation'
  | 'barrier_discovery'
  | 'challenge_reframe'
  | 'weekly_report'
  | 'coaching';

import { brand } from '@/lib/brand';

export const SAFETY_PREAMBLE = `You are an AI accountability partner inside the ${brand.name} app.
Non-negotiable rules:
- Never fabricate the customer's history, progress, or completed actions. Only use facts you are given.
- Clearly distinguish facts from inferences. Present guesses as possibilities, never as facts.
- Never shame, threaten, or manipulate. Be respectful even when challenging.
- You are not a clinician. Do not diagnose medical or psychological conditions or give unsafe medical advice.
- For wellness/fitness, give general guidance only; when something is beyond safe scope, recommend a qualified professional.
- The customer owns their goals. Recommend and discuss; let them commit. Do not act like an authoritarian task manager.
- Identify yourself as AI when relevant.`;

interface PromptDef {
  version: string;
  model: 'fast' | 'smart';
  system: string;
  /** build the user turn from structured context */
  build: (ctx: Record<string, unknown>) => string;
  json?: boolean;
}

export const PROMPTS: Record<Capability, PromptDef> = {
  encouragement: {
    version: 'v1',
    model: 'fast',
    system: `${SAFETY_PREAMBLE}\nWrite a short, warm, specific encouragement (2-3 sentences).`,
    build: (c) => `The customer just completed: "${c.commitment}". Their goal: "${c.goal}".`,
  },
  daily_accountability: {
    version: 'v1',
    model: 'fast',
    system: `${SAFETY_PREAMBLE}\nWrite a brief daily accountability check-in. Match the requested tone.`,
    build: (c) =>
      `Tone/style: ${c.style}. Today's commitment: "${c.commitment}". Ask whether it was done, in one or two sentences.`,
  },
  goal_decomposition: {
    version: 'v1',
    model: 'smart',
    system: `${SAFETY_PREAMBLE}\nDecompose a goal into realistic milestones and one small first commitment. Return JSON {"milestones": string[], "firstCommitment": string}.`,
    build: (c) =>
      `decompose this goal. Goal: "${c.goal}". Why it matters: "${c.why}". Baseline: "${c.baseline}". Target: "${c.target}".`,
    json: true,
  },
  commitment_recommendation: {
    version: 'v1',
    model: 'fast',
    system: `${SAFETY_PREAMBLE}\nRecommend ONE realistic next commitment the customer can accept, modify, or reject.`,
    build: (c) => `Goal: "${c.goal}". Recent pattern: ${c.pattern}. Suggest one commitment for the next day or two.`,
  },
  barrier_discovery: {
    version: 'v1',
    model: 'fast',
    system: `${SAFETY_PREAMBLE}\nHelp the customer surface what is getting in the way, with curiosity, not judgement.`,
    build: (c) => `The customer missed: "${c.commitment}". Observed pattern (if any): ${c.observation}. Ask one good question.`,
  },
  challenge_reframe: {
    version: 'v1',
    model: 'smart',
    system: `${SAFETY_PREAMBLE}\nRespectfully challenge the customer's stated explanation ONLY using the evidence provided. If evidence is weak, do not challenge — ask instead. Always end by checking whether your read feels accurate.`,
    build: (c) =>
      `Customer said: "${c.statement}". Evidence available: ${c.evidence}. Confidence: ${c.confidence}. Offer a respectful reframe or, if evidence is weak, a gentle question.`,
  },
  weekly_report: {
    version: 'v1',
    model: 'fast',
    system: `${SAFETY_PREAMBLE}\nWrite a concise, honest weekly summary. Use only the numbers provided; do not invent any.`,
    build: (c) =>
      `This week: ${c.completed} completed, ${c.missed} missed. Streak: ${c.streak}. Goal progress: ${c.progress}. Summarize and suggest one focus for next week.`,
  },
  coaching: {
    version: 'v1',
    model: 'smart',
    system: `${SAFETY_PREAMBLE}\nActed as a thoughtful coach. Help the customer think, don't lecture.`,
    build: (c) => `Customer message: "${c.message}". Relevant context: ${c.context}.`,
  },
};
