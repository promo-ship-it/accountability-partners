import { describe, it, expect } from 'vitest';
import { computeGoalProgress, computeStreak } from './progress';

function pt(value: number, daysAgo: number) {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return { value, recordedAt: d };
}

describe('computeGoalProgress', () => {
  it('returns null percent without numeric baseline/target', () => {
    const r = computeGoalProgress({ points: [pt(10, 0)] });
    expect(r.percent).toBeNull();
    expect(r.latest).toBe(10);
  });

  it('computes percent for an increasing goal', () => {
    const r = computeGoalProgress({ baseline: 0, target: 100, points: [pt(0, 3), pt(50, 0)] });
    expect(r.percent).toBe(50);
    expect(r.direction).toBe('increase');
    expect(r.trend).toBe('up');
  });

  it('computes percent for a decreasing goal (e.g. weight loss)', () => {
    const r = computeGoalProgress({ baseline: 200, target: 180, points: [pt(200, 5), pt(190, 0)] });
    expect(r.percent).toBe(50);
    expect(r.direction).toBe('decrease');
    expect(r.trend).toBe('down');
  });

  it('clamps percent to 0..100', () => {
    const over = computeGoalProgress({ baseline: 0, target: 100, points: [pt(150, 0)] });
    expect(over.percent).toBe(100);
    const under = computeGoalProgress({ baseline: 0, target: 100, points: [pt(-20, 0)] });
    expect(under.percent).toBe(0);
  });
});

describe('computeStreak', () => {
  it('counts consecutive days ending today', () => {
    expect(computeStreak(['2026-10-05', '2026-10-04', '2026-10-03'], '2026-10-05')).toBe(3);
  });
  it('does not break an in-progress streak when today is missing', () => {
    expect(computeStreak(['2026-10-04', '2026-10-03'], '2026-10-05')).toBe(2);
  });
  it('returns 0 when there is a gap', () => {
    expect(computeStreak(['2026-10-01'], '2026-10-05')).toBe(0);
  });
});
