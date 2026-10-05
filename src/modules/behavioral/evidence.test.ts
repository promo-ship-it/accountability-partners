import { describe, it, expect } from 'vitest';
import {
  detectTimeOfDayPattern,
  detectRecurringBarrier,
  canAsserted,
} from './evidence';
import type { RecentCommitment } from '../accountability/escalation';

function c(status: RecentCommitment['status'], hour: number, reason?: string): RecentCommitment {
  return { status, dueAt: new Date(), dueHour: hour, missReason: reason };
}

describe('evidence engine — source-of-truth hierarchy', () => {
  it('allows asserting a lower-authority tier from a higher one', () => {
    expect(canAsserted('observed', 'app_recorded')).toBe(true);
    expect(canAsserted('observed', 'customer_confirmed')).toBe(true);
  });
  it('forbids asserting a fact from a mere hypothesis', () => {
    expect(canAsserted('customer_confirmed', 'ai_hypothesis')).toBe(false);
    expect(canAsserted('app_recorded', 'ai_inference')).toBe(false);
  });
});

describe('detectTimeOfDayPattern', () => {
  it('returns null without enough data', () => {
    expect(detectTimeOfDayPattern([c('missed', 20)])).toBeNull();
  });

  it('flags evening misses as observed, with fatigue inference and a hypothesis', () => {
    const history = [
      c('missed', 20),
      c('missed', 21),
      c('missed', 19),
      c('completed', 7),
      c('completed', 8),
    ];
    const obs = detectTimeOfDayPattern(history);
    expect(obs).not.toBeNull();
    expect(obs!.summary.toLowerCase()).toContain('evening');
    expect(obs!.tier).toBe('observed');
    expect(obs!.possibleExplanation).toMatch(/fatigue/i);
    expect(obs!.hypothesis).toMatch(/earlier/i);
    expect(obs!.evidence).toMatch(/\d+ of the last \d+/);
  });

  it('does not flag when misses are evenly distributed', () => {
    const history = [
      c('completed', 8),
      c('missed', 9),
      c('completed', 13),
      c('completed', 20),
      c('completed', 21),
    ];
    expect(detectTimeOfDayPattern(history)).toBeNull();
  });
});

describe('detectRecurringBarrier', () => {
  it('surfaces a repeated time barrier', () => {
    const history = [
      c('missed', 18, 'no time today'),
      c('missed', 18, 'too busy at work'),
      c('missed', 18, 'schedule packed'),
    ];
    const obs = detectRecurringBarrier(history);
    expect(obs).not.toBeNull();
    expect(obs!.summary.toLowerCase()).toContain('time');
  });

  it('returns null when reasons are too sparse', () => {
    expect(detectRecurringBarrier([c('missed', 18, 'no time')])).toBeNull();
  });
});
