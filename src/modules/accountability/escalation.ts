/**
 * Accountability escalation model (spec §12).
 *
 * Pure, deterministic decision logic — no DB, no AI, fully unit-testable.
 * Given a customer's recent commitment history, decide the appropriate
 * accountability LEVEL. The AI capability layer renders the actual message;
 * this module decides *how hard* to lean in, and crucially does NOT escalate
 * after a single miss.
 */

export type CommitmentOutcome = 'completed' | 'missed' | 'skipped' | 'scheduled';

export interface RecentCommitment {
  status: CommitmentOutcome;
  dueAt: Date;
  /** local hour 0-23 the commitment was due, used for pattern detection */
  dueHour: number;
  missReason?: string | null;
}

export enum AccountabilityLevel {
  SUPPORT = 1, // "What happened today?"
  INVESTIGATE = 2, // "Let's understand what's getting in the way."
  CHALLENGE = 3, // respectfully challenge, requires evidence
  REDESIGN = 4, // change commitment/timing/strategy
  ESCALATE = 5, // consider additional (future human) support
}

export interface EscalationDecision {
  level: AccountabilityLevel;
  reason: string;
  /** number of consecutive recent misses considered */
  consecutiveMisses: number;
  missRate: number;
}

/**
 * Decide the accountability level from recent history.
 * Ordered most-recent-first is NOT required; we sort defensively.
 */
export function decideEscalation(recent: RecentCommitment[]): EscalationDecision {
  const resolved = recent.filter((c) => c.status !== 'scheduled');
  const considered = [...resolved].sort((a, b) => b.dueAt.getTime() - a.dueAt.getTime());

  const total = considered.length;
  const misses = considered.filter((c) => c.status === 'missed').length;
  const missRate = total === 0 ? 0 : misses / total;

  // consecutive misses from the most recent backwards
  let consecutiveMisses = 0;
  for (const c of considered) {
    if (c.status === 'missed') consecutiveMisses++;
    else break;
  }

  if (total === 0) {
    return {
      level: AccountabilityLevel.SUPPORT,
      reason: 'No resolved commitments yet; default to supportive check-in.',
      consecutiveMisses,
      missRate,
    };
  }

  // Never escalate on a single miss (spec §12).
  if (consecutiveMisses <= 1 && missRate < 0.4) {
    return {
      level: AccountabilityLevel.SUPPORT,
      reason: 'Mostly on track; supportive check-in is appropriate.',
      consecutiveMisses,
      missRate,
    };
  }

  if (consecutiveMisses === 2 || (missRate >= 0.4 && missRate < 0.6)) {
    return {
      level: AccountabilityLevel.INVESTIGATE,
      reason: 'A pattern of misses is forming; investigate the cause.',
      consecutiveMisses,
      missRate,
    };
  }

  // Challenge only with sufficient evidence of a repeated, explained pattern.
  if (consecutiveMisses >= 3 && hasRepeatedExcuse(considered)) {
    return {
      level: AccountabilityLevel.CHALLENGE,
      reason: 'Repeated misses with a recurring stated reason; respectful challenge warranted.',
      consecutiveMisses,
      missRate,
    };
  }

  if (consecutiveMisses >= 3 || missRate >= 0.6) {
    return {
      level: AccountabilityLevel.REDESIGN,
      reason: 'Sustained difficulty; the plan or timing likely needs to change.',
      consecutiveMisses,
      missRate,
    };
  }

  if (missRate >= 0.8 && total >= 6) {
    return {
      level: AccountabilityLevel.ESCALATE,
      reason: 'Persistent failure across many commitments; consider additional support.',
      consecutiveMisses,
      missRate,
    };
  }

  return {
    level: AccountabilityLevel.INVESTIGATE,
    reason: 'Default to investigation.',
    consecutiveMisses,
    missRate,
  };
}

function hasRepeatedExcuse(commitments: RecentCommitment[]): boolean {
  const reasons = commitments
    .filter((c) => c.status === 'missed' && c.missReason)
    .map((c) => normalizeReason(c.missReason!));
  if (reasons.length < 2) return false;
  const counts = new Map<string, number>();
  for (const r of reasons) counts.set(r, (counts.get(r) ?? 0) + 1);
  return [...counts.values()].some((n) => n >= 2);
}

function normalizeReason(reason: string): string {
  const r = reason.toLowerCase();
  if (/(time|busy|no time|schedule)/.test(r)) return 'time';
  if (/(tired|fatigue|exhaust|sleep)/.test(r)) return 'fatigue';
  if (/(forgot|forget)/.test(r)) return 'forgot';
  if (/(sick|ill|injur|pain)/.test(r)) return 'health';
  if (/(motivat|lazy|mood|don't feel)/.test(r)) return 'motivation';
  return r.slice(0, 20);
}
