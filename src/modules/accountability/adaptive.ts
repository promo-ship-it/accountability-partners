/**
 * Adaptive accountability (spec §11).
 *
 * Learns which accountability style produces better outcomes for a customer
 * and recommends adjustments. Pure logic; the result is persisted as an
 * ai_inference-tier learnedStyle that the customer can override.
 */

export type AccountabilityStyle =
  | 'supportive'
  | 'encouraging'
  | 'direct'
  | 'challenging'
  | 'structured'
  | 'reflective'
  | 'motivational'
  | 'firm';

export interface StyleOutcome {
  style: AccountabilityStyle;
  /** commitments completed under this style */
  completed: number;
  /** commitments missed under this style */
  missed: number;
}

export interface AdaptiveRecommendation {
  recommendedStyle: AccountabilityStyle | null;
  reason: string;
  confident: boolean;
}

/**
 * Recommend the style with the best completion rate, requiring a minimum
 * sample so we don't thrash on noise.
 */
export function recommendStyle(
  outcomes: StyleOutcome[],
  current: AccountabilityStyle,
): AdaptiveRecommendation {
  const scored = outcomes
    .map((o) => ({
      style: o.style,
      total: o.completed + o.missed,
      rate: o.completed + o.missed === 0 ? 0 : o.completed / (o.completed + o.missed),
    }))
    .filter((o) => o.total >= 4); // minimum evidence per style

  if (scored.length === 0) {
    return {
      recommendedStyle: null,
      reason: 'Not enough outcome data yet to adapt style.',
      confident: false,
    };
  }

  scored.sort((a, b) => b.rate - a.rate);
  const best = scored[0];
  const currentScore = scored.find((s) => s.style === current);

  // Only switch if the best is meaningfully better than current.
  if (best.style === current) {
    return {
      recommendedStyle: current,
      reason: `Current style "${current}" has the best completion rate (${pct(best.rate)}).`,
      confident: best.total >= 8,
    };
  }

  const improvement = currentScore ? best.rate - currentScore.rate : best.rate;
  if (improvement < 0.15) {
    return {
      recommendedStyle: current,
      reason: 'No style clearly outperforms the current one; keep current.',
      confident: false,
    };
  }

  return {
    recommendedStyle: best.style,
    reason: `"${best.style}" shows a higher completion rate (${pct(best.rate)}) than current "${current}".`,
    confident: best.total >= 8,
  };
}

function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}
