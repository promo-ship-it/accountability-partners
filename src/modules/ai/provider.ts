/**
 * AI provider abstraction (spec §22, §59).
 *
 * Core business logic depends ONLY on this interface, never on a vendor SDK.
 * Swapping OpenAI -> Anthropic -> local is a config change, not a refactor.
 */

export interface GenerateParams {
  model: string;
  system: string;
  user: string;
  /** request a JSON object back */
  json?: boolean;
  maxTokens?: number;
  temperature?: number;
}

export interface GenerateResult {
  text: string;
  model: string;
  promptTokens: number;
  completionTokens: number;
  latencyMs: number;
  /** true if a fallback path produced this (e.g. mock or degraded model) */
  usedFallback: boolean;
}

export interface AiProvider {
  readonly name: string;
  generate(params: GenerateParams): Promise<GenerateResult>;
}

/** Rough per-1K-token USD pricing for cost estimation (editable, not billing). */
const PRICING: Record<string, { in: number; out: number }> = {
  'gpt-4o-mini': { in: 0.00015, out: 0.0006 },
  'gpt-4o': { in: 0.0025, out: 0.01 },
  'claude-3-5-haiku': { in: 0.0008, out: 0.004 },
  'claude-3-5-sonnet': { in: 0.003, out: 0.015 },
};

export function estimateCostUsd(model: string, promptTokens: number, completionTokens: number): number {
  const p = PRICING[model] ?? { in: 0.001, out: 0.002 };
  return (promptTokens / 1000) * p.in + (completionTokens / 1000) * p.out;
}

/** Crude token estimate (~4 chars/token) used when a provider omits usage. */
export function estimateTokens(text: string): number {
  return Math.ceil(text.length / 4);
}
