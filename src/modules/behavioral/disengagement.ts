/**
 * Disengagement detection (spec §18 event source). Pure.
 */

export interface EngagementSignals {
  lastCheckInAt: Date | null;
  lastAppOpenAt: Date | null;
  scheduledCommitmentsLast7d: number;
  completedCommitmentsLast7d: number;
}

export type EngagementState = 'engaged' | 'cooling' | 'disengaging' | 'disengaged';

export interface DisengagementResult {
  state: EngagementState;
  daysSinceActivity: number;
  reason: string;
}

export function detectDisengagement(
  signals: EngagementSignals,
  now: Date,
): DisengagementResult {
  const last = mostRecent(signals.lastCheckInAt, signals.lastAppOpenAt);
  const days = last ? Math.floor((now.getTime() - last.getTime()) / 86_400_000) : Infinity;

  if (days === Infinity) {
    return { state: 'disengaging', daysSinceActivity: days, reason: 'No recorded activity yet.' };
  }

  const completionRate =
    signals.scheduledCommitmentsLast7d === 0
      ? null
      : signals.completedCommitmentsLast7d / signals.scheduledCommitmentsLast7d;

  if (days >= 10) {
    return { state: 'disengaged', daysSinceActivity: days, reason: `No activity for ${days} days.` };
  }
  if (days >= 5) {
    return {
      state: 'disengaging',
      daysSinceActivity: days,
      reason: `No activity for ${days} days.`,
    };
  }
  if (days >= 3 || (completionRate !== null && completionRate < 0.3)) {
    return {
      state: 'cooling',
      daysSinceActivity: days,
      reason:
        days >= 3
          ? `Activity slowing (${days} days since last).`
          : 'Low completion rate this week.',
    };
  }
  return { state: 'engaged', daysSinceActivity: days, reason: 'Recently active.' };
}

function mostRecent(a: Date | null, b: Date | null): Date | null {
  if (!a) return b;
  if (!b) return a;
  return a.getTime() > b.getTime() ? a : b;
}
