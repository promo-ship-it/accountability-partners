/**
 * Goal progress computation (spec §30, §32). Pure functions.
 */

export interface ProgressPoint {
  value: number;
  recordedAt: Date;
}

export interface GoalProgressInput {
  baseline?: number | null;
  target?: number | null;
  points: ProgressPoint[];
}

export interface GoalProgress {
  /** 0-100, clamped. null when not computable (no numeric target/baseline). */
  percent: number | null;
  latest: number | null;
  trend: 'up' | 'down' | 'flat' | 'unknown';
  direction: 'increase' | 'decrease' | 'unknown';
}

export function computeGoalProgress(input: GoalProgressInput): GoalProgress {
  const points = [...input.points].sort(
    (a, b) => a.recordedAt.getTime() - b.recordedAt.getTime(),
  );
  const latest = points.length ? points[points.length - 1].value : null;

  let trend: GoalProgress['trend'] = 'unknown';
  if (points.length >= 2) {
    const prev = points[points.length - 2].value;
    const cur = points[points.length - 1].value;
    trend = cur > prev ? 'up' : cur < prev ? 'down' : 'flat';
  }

  const { baseline, target } = input;
  if (baseline == null || target == null || latest == null || baseline === target) {
    return { percent: null, latest, trend, direction: 'unknown' };
  }

  const direction: GoalProgress['direction'] = target > baseline ? 'increase' : 'decrease';
  const total = target - baseline;
  const done = latest - baseline;
  const percent = clamp((done / total) * 100, 0, 100);

  return { percent: Math.round(percent), latest, trend, direction };
}

/** Streak computation from a set of daily check-in dates (local date strings). */
export function computeStreak(checkInDates: string[], todayIso: string): number {
  const set = new Set(checkInDates);
  let streak = 0;
  const d = new Date(todayIso + 'T00:00:00Z');
  // Count today only if present; otherwise start from yesterday so an
  // in-progress day doesn't break a streak before the day ends.
  if (!set.has(iso(d))) d.setUTCDate(d.getUTCDate() - 1);
  while (set.has(iso(d))) {
    streak++;
    d.setUTCDate(d.getUTCDate() - 1);
  }
  return streak;
}

function iso(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}
