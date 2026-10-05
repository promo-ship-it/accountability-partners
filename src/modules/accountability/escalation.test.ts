import { describe, it, expect } from 'vitest';
import { decideEscalation, AccountabilityLevel, type RecentCommitment } from './escalation';

function c(
  status: RecentCommitment['status'],
  daysAgo: number,
  hour = 18,
  missReason?: string,
): RecentCommitment {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return { status, dueAt: d, dueHour: hour, missReason };
}

describe('decideEscalation', () => {
  it('defaults to SUPPORT with no history', () => {
    expect(decideEscalation([]).level).toBe(AccountabilityLevel.SUPPORT);
  });

  it('does NOT escalate after a single miss (spec §12)', () => {
    const history = [c('missed', 0), c('completed', 1), c('completed', 2), c('completed', 3)];
    expect(decideEscalation(history).level).toBe(AccountabilityLevel.SUPPORT);
  });

  it('moves to INVESTIGATE on two consecutive misses', () => {
    const history = [c('missed', 0), c('missed', 1), c('completed', 2), c('completed', 3)];
    expect(decideEscalation(history).level).toBe(AccountabilityLevel.INVESTIGATE);
  });

  it('CHALLENGEs on 3+ misses with a repeated stated reason', () => {
    const history = [
      c('missed', 0, 18, 'no time'),
      c('missed', 1, 18, 'too busy'),
      c('missed', 2, 18, 'completed something else'),
    ];
    const d = decideEscalation(history);
    expect(d.level).toBe(AccountabilityLevel.CHALLENGE);
  });

  it('REDESIGNs on 3+ misses without a repeated clear reason', () => {
    const history = [c('missed', 0), c('missed', 1), c('missed', 2)];
    expect(decideEscalation(history).level).toBe(AccountabilityLevel.REDESIGN);
  });

  it('reports consecutive misses and miss rate', () => {
    const history = [c('missed', 0), c('missed', 1), c('completed', 2), c('missed', 3)];
    const d = decideEscalation(history);
    expect(d.consecutiveMisses).toBe(2);
    expect(d.missRate).toBeCloseTo(3 / 4);
  });
});
