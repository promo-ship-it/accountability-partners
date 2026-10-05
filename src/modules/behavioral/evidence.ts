/**
 * Behavioral evidence engine (spec §15, §16).
 *
 * Produces evidence-based observations and keeps the source-of-truth tiers
 * distinguishable. Pure functions — no DB, no AI. The AI layer may *consume*
 * these observations but must never upgrade a hypothesis to a fact.
 */

import type { RecentCommitment } from '../accountability/escalation';

export type TruthTier =
  | 'customer_confirmed'
  | 'app_recorded'
  | 'observed'
  | 'ai_inference'
  | 'ai_hypothesis';

export type Confidence = 'low' | 'medium' | 'high';

export interface Observation {
  summary: string;
  evidence: string;
  tier: TruthTier;
  confidence: Confidence;
  /** optional non-authoritative explanation (inference) */
  possibleExplanation?: string;
  /** optional actionable idea (hypothesis) */
  hypothesis?: string;
}

/** Rank tiers so callers can enforce the hierarchy. Lower = more authoritative. */
export const TIER_RANK: Record<TruthTier, number> = {
  customer_confirmed: 1,
  app_recorded: 2,
  observed: 3,
  ai_inference: 4,
  ai_hypothesis: 5,
};

/** A fact may never be derived from something less authoritative than itself. */
export function canAsserted(as: TruthTier, from: TruthTier): boolean {
  return TIER_RANK[from] <= TIER_RANK[as];
}

function confidenceFromRatio(hits: number, total: number): Confidence {
  if (total < 4) return 'low';
  const ratio = hits / total;
  if (ratio >= 0.7) return 'high';
  if (ratio >= 0.5) return 'medium';
  return 'low';
}

/**
 * Detect a time-of-day miss pattern (the canonical "evening fatigue" example).
 * Only emits an observation when there is enough evidence.
 */
export function detectTimeOfDayPattern(recent: RecentCommitment[]): Observation | null {
  const resolved = recent.filter((c) => c.status === 'missed' || c.status === 'completed');
  if (resolved.length < 4) return null;

  const buckets = {
    morning: { miss: 0, total: 0 }, // 5-11
    afternoon: { miss: 0, total: 0 }, // 12-16
    evening: { miss: 0, total: 0 }, // 17-23 + 0-4
  };
  const bucketOf = (h: number): keyof typeof buckets =>
    h >= 5 && h <= 11 ? 'morning' : h >= 12 && h <= 16 ? 'afternoon' : 'evening';

  for (const c of resolved) {
    const b = buckets[bucketOf(c.dueHour)];
    b.total++;
    if (c.status === 'missed') b.miss++;
  }

  // find worst bucket with meaningful volume
  let worst: { name: string; miss: number; total: number } | null = null;
  for (const [name, v] of Object.entries(buckets)) {
    if (v.total >= 3 && (!worst || v.miss / v.total > worst.miss / worst.total)) {
      worst = { name, miss: v.miss, total: v.total };
    }
  }
  if (!worst || worst.miss / worst.total < 0.6) return null;

  const confidence = confidenceFromRatio(worst.miss, worst.total);
  const explanation =
    worst.name === 'evening' ? 'Post-work fatigue may be contributing.' : undefined;

  return {
    summary: `${capitalize(worst.name)} commitments are frequently missed.`,
    evidence: `${worst.miss} of the last ${worst.total} ${worst.name} commitments were missed.`,
    tier: 'observed',
    confidence,
    possibleExplanation: explanation,
    hypothesis:
      worst.name === 'evening'
        ? 'The customer may be more successful committing earlier in the day.'
        : undefined,
  };
}

/** Detect a recurring stated reason across misses. */
export function detectRecurringBarrier(recent: RecentCommitment[]): Observation | null {
  const reasons = recent
    .filter((c) => c.status === 'missed' && c.missReason)
    .map((c) => c.missReason!.toLowerCase());
  if (reasons.length < 3) return null;

  const groups: Record<string, number> = {};
  for (const r of reasons) {
    const key = /(time|busy|schedule)/.test(r)
      ? 'time'
      : /(tired|fatigue|exhaust|sleep)/.test(r)
        ? 'fatigue'
        : /(forgot|forget)/.test(r)
          ? 'forgetting'
          : 'other';
    groups[key] = (groups[key] ?? 0) + 1;
  }
  const top = Object.entries(groups).sort((a, b) => b[1] - a[1])[0];
  if (!top || top[1] < 2 || top[0] === 'other') return null;

  return {
    summary: `A recurring barrier is emerging: ${top[0]}.`,
    evidence: `"${top[0]}" cited in ${top[1]} of ${reasons.length} recent misses.`,
    tier: 'observed',
    confidence: confidenceFromRatio(top[1], reasons.length),
  };
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
