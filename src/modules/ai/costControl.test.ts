import { describe, it, expect } from 'vitest';
import { gateAiRequest } from './costControl';

const limits = { dailyPerCustomer: 40, monthlyPerCustomer: 600, globalDaily: 5000 };

describe('gateAiRequest', () => {
  it('allows under all limits', () => {
    expect(gateAiRequest(false, { customerToday: 1, customerMonth: 10, globalToday: 100 }, limits).allowed).toBe(true);
  });
  it('blocks on kill switch first', () => {
    const r = gateAiRequest(true, { customerToday: 0, customerMonth: 0, globalToday: 0 }, limits);
    expect(r.allowed).toBe(false);
    expect(r).toMatchObject({ code: 'kill_switch' });
  });
  it('blocks on global daily cap', () => {
    const r = gateAiRequest(false, { customerToday: 0, customerMonth: 0, globalToday: 5000 }, limits);
    expect(r).toMatchObject({ allowed: false, code: 'global_daily' });
  });
  it('blocks on monthly before daily', () => {
    const r = gateAiRequest(false, { customerToday: 40, customerMonth: 600, globalToday: 0 }, limits);
    expect(r).toMatchObject({ allowed: false, code: 'customer_monthly' });
  });
  it('blocks on daily cap', () => {
    const r = gateAiRequest(false, { customerToday: 40, customerMonth: 10, globalToday: 0 }, limits);
    expect(r).toMatchObject({ allowed: false, code: 'customer_daily' });
  });
});
