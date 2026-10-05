import type { AiProvider, GenerateParams, GenerateResult } from '../provider';
import { estimateTokens } from '../provider';

/**
 * OpenAI-compatible provider (works with OpenAI and any OpenAI-compatible
 * endpoint via AI_BASE_URL). Uses fetch directly — no SDK dependency, keeping
 * the dependency surface and cost low. Anthropic can be added as a sibling.
 */
export class OpenAiProvider implements AiProvider {
  readonly name = 'openai';
  constructor(
    private apiKey: string,
    private baseUrl: string,
  ) {}

  async generate(params: GenerateParams): Promise<GenerateResult> {
    const start = Date.now();
    const res = await fetch(`${this.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: params.model,
        temperature: params.temperature ?? 0.6,
        max_tokens: params.maxTokens ?? 500,
        ...(params.json ? { response_format: { type: 'json_object' } } : {}),
        messages: [
          { role: 'system', content: params.system },
          { role: 'user', content: params.user },
        ],
      }),
    });

    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`OpenAI error ${res.status}: ${body.slice(0, 200)}`);
    }

    const data = (await res.json()) as {
      choices: { message: { content: string } }[];
      usage?: { prompt_tokens: number; completion_tokens: number };
    };
    const text = data.choices?.[0]?.message?.content ?? '';
    return {
      text,
      model: params.model,
      promptTokens: data.usage?.prompt_tokens ?? estimateTokens(params.system + params.user),
      completionTokens: data.usage?.completion_tokens ?? estimateTokens(text),
      latencyMs: Date.now() - start,
      usedFallback: false,
    };
  }
}
