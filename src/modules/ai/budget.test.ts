import { describe, it, expect } from 'vitest';
import { gateBudget, perCustomerCapUsd, poolCapUsd, budgetUsedPct } from './budget';

const cfg = { pct: 20, priceUsd: 35, activeCustomers: 40, enabled: true };

describe('budget caps — amounts', () => {
  it('per-customer cap is pct% of price', () => {
    expect(perCustomerCapUsd(cfg)).toBeCloseTo(7); // 20% of $35
  });
  it('pool cap is pct% of total MRR', () => {
    expect(poolCapUsd(cfg)).toBeCloseTo(280); // 20% * 35 * 40
  });
  it('scales with a different price', () => {
    expect(perCustomerCapUsd({ ...cfg, priceUsd: 49 })).toBeCloseTo(9.8);
  });
});

describe('gateBudget', () => {
  it('allows when disabled', () => {
    expect(gateBudget({ ...cfg, enabled: false }, { customerMonthUsd: 999, poolMonthUsd: 999 }).allowed).toBe(true);
  });
  it('allows when under both caps', () => {
    expect(gateBudget(cfg, { customerMonthUsd: 1, poolMonthUsd: 50 }).allowed).toBe(true);
  });
  it('blocks on pool cap first (system ceiling)', () => {
    const r = gateBudget(cfg, { customerMonthUsd: 0, poolMonthUsd: 280 });
    expect(r).toMatchObject({ allowed: false, code: 'budget_pool' });
  });
  it('blocks a single heavy customer at their per-customer cap', () => {
    const r = gateBudget(cfg, { customerMonthUsd: 7, poolMonthUsd: 10 });
    expect(r).toMatchObject({ allowed: false, code: 'budget_customer' });
  });
  it('one customer cannot exceed their own share even if pool has room', () => {
    // pool nearly empty, customer at cap -> still blocked (cannot drain pool)
    const r = gateBudget(cfg, { customerMonthUsd: 7.5, poolMonthUsd: 20 });
    expect(r.allowed).toBe(false);
  });
  it('treats pct<=0 as no cap', () => {
    expect(gateBudget({ ...cfg, pct: 0 }, { customerMonthUsd: 999, poolMonthUsd: 999 }).allowed).toBe(true);
  });
});

describe('budgetUsedPct', () => {
  it('computes a clamped percentage', () => {
    expect(budgetUsedPct(140, 280)).toBe(50);
    expect(budgetUsedPct(400, 280)).toBe(100);
    expect(budgetUsedPct(5, 0)).toBe(0);
  });
});
