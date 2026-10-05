/**
 * AI behavioral evaluation (spec §26, §68).
 *
 * Validates that the ENGINE'S DECISIONS are useful for each synthetic persona —
 * i.e. the right escalation level and the right behavioral observations are
 * produced. This tests behavior, not prose, and needs no API keys.
 */

import { describe, it, expect } from 'vitest';
import {
  decideEscalation,
  AccountabilityLevel,
  type RecentCommitment,
} from '@/modules/accountability/escalation';
import { detectTimeOfDayPattern, detectRecurringBarrier } from '@/modules/behavioral/evidence';
import { detectDisengagement } from '@/modules/behavioral/disengagement';
import { recommendStyle } from '@/modules/accountability/adaptive';

function c(status: RecentCommitment['status'], daysAgo: number, hour = 18, reason?: string): RecentCommitment {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return { status, dueAt: d, dueHour: hour, missReason: reason };
}

describe('Persona A — highly consistent', () => {
  const history = [0, 1, 2, 3, 4].map((n) => c('completed', n));
  it('stays at SUPPORT level (no unnecessary escalation)', () => {
    expect(decideEscalation(history).level).toBe(AccountabilityLevel.SUPPORT);
  });
  it('produces no negative behavioral observation', () => {
    expect(detectTimeOfDayPattern(history)).toBeNull();
    expect(detectRecurringBarrier(history)).toBeNull();
  });
});

describe('Persona B — frequently inconsistent', () => {
  const history = [
    c('missed', 0, 18, 'no time'),
    c('completed', 1),
    c('missed', 2, 18, 'tired'),
    c('completed', 3),
    c('missed', 4, 18, 'busy'),
  ];
  it('investigates rather than ignoring', () => {
    expect(decideEscalation(history).level).toBeGreaterThanOrEqual(AccountabilityLevel.INVESTIGATE);
  });
});

describe('Persona C — disengaging', () => {
  it('is detected as disengaged after long inactivity', () => {
    const now = new Date();
    const last = new Date(now.getTime() - 12 * 86_400_000);
    const r = detectDisengagement(
      { lastCheckInAt: last, lastAppOpenAt: last, scheduledCommitmentsLast7d: 0, completedCommitmentsLast7d: 0 },
      now,
    );
    expect(['disengaging', 'disengaged']).toContain(r.state);
  });
});

describe('Persona F — needs stronger accountability (evening fatigue)', () => {
  const history = [
    c('missed', 0, 20, 'too tired after work'),
    c('missed', 1, 21, 'exhausted'),
    c('missed', 2, 19, 'no energy'),
    c('completed', 3, 8),
    c('completed', 4, 8),
  ];
  it('escalates to REDESIGN or CHALLENGE', () => {
    expect(decideEscalation(history).level).toBeGreaterThanOrEqual(AccountabilityLevel.CHALLENGE);
  });
  it('surfaces the evening pattern with evidence and a morning hypothesis', () => {
    const obs = detectTimeOfDayPattern(history);
    expect(obs).not.toBeNull();
    expect(obs!.summary.toLowerCase()).toContain('evening');
    expect(obs!.hypothesis).toMatch(/earlier|morning/i);
  });
  it('adaptive engine would prefer the higher-completion morning style over time', () => {
    const rec = recommendStyle(
      [
        { style: 'supportive', completed: 2, missed: 6 },
        { style: 'challenging', completed: 7, missed: 1 },
      ],
      'supportive',
    );
    expect(rec.recommendedStyle).toBe('challenging');
  });
});

describe('Persona G — needs gentler accountability', () => {
  it('does not escalate on a single miss', () => {
    const history = [c('missed', 0), c('completed', 1), c('completed', 2), c('completed', 3)];
    expect(decideEscalation(history).level).toBe(AccountabilityLevel.SUPPORT);
  });
});
