import { describe, it, expect } from 'vitest';
import { detectDisengagement } from './disengagement';

const now = new Date('2026-10-05T12:00:00Z');
function daysAgo(n: number) {
  const d = new Date(now);
  d.setDate(d.getDate() - n);
  return d;
}

describe('detectDisengagement', () => {
  it('engaged when recently active', () => {
    const r = detectDisengagement(
      {
        lastCheckInAt: daysAgo(0),
        lastAppOpenAt: daysAgo(0),
        scheduledCommitmentsLast7d: 5,
        completedCommitmentsLast7d: 4,
      },
      now,
    );
    expect(r.state).toBe('engaged');
  });

  it('cooling after 3 days', () => {
    const r = detectDisengagement(
      {
        lastCheckInAt: daysAgo(3),
        lastAppOpenAt: daysAgo(3),
        scheduledCommitmentsLast7d: 3,
        completedCommitmentsLast7d: 2,
      },
      now,
    );
    expect(r.state).toBe('cooling');
  });

  it('disengaging after 5 days', () => {
    const r = detectDisengagement(
      {
        lastCheckInAt: daysAgo(6),
        lastAppOpenAt: daysAgo(6),
        scheduledCommitmentsLast7d: 0,
        completedCommitmentsLast7d: 0,
      },
      now,
    );
    expect(r.state).toBe('disengaging');
  });

  it('disengaged after 10+ days', () => {
    const r = detectDisengagement(
      {
        lastCheckInAt: daysAgo(12),
        lastAppOpenAt: daysAgo(12),
        scheduledCommitmentsLast7d: 0,
        completedCommitmentsLast7d: 0,
      },
      now,
    );
    expect(r.state).toBe('disengaged');
  });

  it('handles no activity at all', () => {
    const r = detectDisengagement(
      {
        lastCheckInAt: null,
        lastAppOpenAt: null,
        scheduledCommitmentsLast7d: 0,
        completedCommitmentsLast7d: 0,
      },
      now,
    );
    expect(r.state).toBe('disengaging');
  });
});
