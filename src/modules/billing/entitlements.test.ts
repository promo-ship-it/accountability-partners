import { describe, it, expect } from 'vitest';
import { entitlementsFor, hasAccess } from './entitlements';
import { trialEnd, daysLeftInTrial, trialExpired, TRIAL_DAYS } from './trial';

describe('entitlements', () => {
  it('grants base features during trial and active', () => {
    expect(entitlementsFor('trialing').ai_accountability).toBe(true);
    expect(entitlementsFor('active').progress).toBe(true);
  });
  it('revokes features when canceled', () => {
    expect(entitlementsFor('canceled').ai_accountability).toBe(false);
  });
  it('never grants human coaching in base plan', () => {
    expect(entitlementsFor('active').human_coaching).toBe(false);
    expect(entitlementsFor('trialing').human_coaching).toBe(false);
  });
  it('hasAccess reflects billing', () => {
    expect(hasAccess('trialing')).toBe(true);
    expect(hasAccess('none')).toBe(false);
  });
});

describe('trial', () => {
  const start = new Date('2026-10-01T00:00:00Z');
  it('ends 7 days after start', () => {
    expect(trialEnd(start).toISOString().slice(0, 10)).toBe('2026-10-08');
    expect(TRIAL_DAYS).toBe(7);
  });
  it('computes days left', () => {
    expect(daysLeftInTrial(trialEnd(start), new Date('2026-10-03T00:00:00Z'))).toBe(5);
  });
  it('detects expiry', () => {
    expect(trialExpired(trialEnd(start), new Date('2026-10-09T00:00:00Z'))).toBe(true);
    expect(trialExpired(trialEnd(start), new Date('2026-10-05T00:00:00Z'))).toBe(false);
  });
});
