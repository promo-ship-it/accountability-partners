import type { AiProvider, GenerateParams, GenerateResult } from '../provider';
import { estimateTokens } from '../provider';

/**
 * Deterministic mock provider used when no API key is configured and in tests.
 * It produces plausible, SAFE, non-fabricating output grounded only in the
 * prompt it is given — it never invents history. This is the AI_DISABLED /
 * no-credential fallback that keeps the product usable (spec §55).
 */
export class MockProvider implements AiProvider {
  readonly name = 'mock';

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const start = Date.now();
    const text = params.json
      ? JSON.stringify(this.structured(params))
      : this.message(params);
    return {
      text,
      model: params.model,
      promptTokens: estimateTokens(params.system + params.user),
      completionTokens: estimateTokens(text),
      latencyMs: Date.now() - start,
      usedFallback: true,
    };
  }

  private message(params: GenerateParams): string {
    const u = params.user.toLowerCase();
    if (u.includes('missed')) {
      return "I noticed today's commitment didn't happen. That's okay — what got in the way? Understanding it helps us adjust.";
    }
    if (u.includes('completed') || u.includes('done')) {
      return 'Nice work following through today. Consistency like this is exactly how the discipline gets built.';
    }
    if (u.includes('goal')) {
      return "Let's make this goal concrete. What would success look like, and why does it matter to you right now?";
    }
    return "I'm here as your accountability partner. What's the one action you want to commit to today?";
  }

  private structured(params: GenerateParams): unknown {
    // Return a minimal, schema-friendly object for structured capabilities.
    if (params.user.toLowerCase().includes('decompose')) {
      return {
        milestones: ['Define a clear starting point', 'Build a weekly routine', 'Reach the target'],
        firstCommitment: 'Complete one small action in the next 24 hours.',
      };
    }
    return { message: this.message(params) };
  }
}
