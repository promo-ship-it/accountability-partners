/**
 * AI output validation + safety check (spec §19, §27, §28). Pure.
 *
 * This is a defense-in-depth filter applied to generated text before it is
 * ever shown or acted upon. It cannot catch everything, but it blocks the
 * clearest violations and flags fabrication risk.
 */

export interface SafetyResult {
  ok: boolean;
  flags: string[];
  /** sanitized text (may be unchanged) */
  text: string;
}

const MEDICAL_CLAIMS =
  /\b(you have|you are suffering from|diagnos(e|is|ed)|prescri(be|ption)|this is (depression|anxiety|an eating disorder))\b/i;

const SHAMING =
  /\b(you'?re (lazy|pathetic|worthless|a failure|hopeless)|you always fail|you never)\b/i;

const UNSAFE_ADVICE =
  /\b(stop taking your medication|starve yourself|extreme fast|lose \d+ ?lbs? in \d+ days)\b/i;

export function checkSafety(text: string): SafetyResult {
  const flags: string[] = [];
  if (MEDICAL_CLAIMS.test(text)) flags.push('medical_claim');
  if (SHAMING.test(text)) flags.push('shaming');
  if (UNSAFE_ADVICE.test(text)) flags.push('unsafe_advice');

  return { ok: flags.length === 0, flags, text };
}

export interface ValidationResult {
  ok: boolean;
  value?: unknown;
  error?: string;
}

/** Validate that a JSON capability returned parseable JSON. */
export function validateJson(text: string): ValidationResult {
  try {
    return { ok: true, value: JSON.parse(text) };
  } catch {
    return { ok: false, error: 'Model did not return valid JSON.' };
  }
}
