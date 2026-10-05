/**
 * AI cost control (spec §23). Pure limit logic so it can be unit-tested;
 * the DB-backed counts are passed in by the caller.
 */

export interface UsageCounts {
  customerToday: number;
  customerMonth: number;
  globalToday: number;
}

export interface Limits {
  dailyPerCustomer: number;
  monthlyPerCustomer: number;
  globalDaily: number;
}

export type GateResult =
  | { allowed: true }
  | { allowed: false; reason: string; code: 'kill_switch' | 'customer_daily' | 'customer_monthly' | 'global_daily' };

export function gateAiRequest(
  killSwitch: boolean,
  counts: UsageCounts,
  limits: Limits,
): GateResult {
  if (killSwitch) {
    return { allowed: false, reason: 'AI is temporarily disabled.', code: 'kill_switch' };
  }
  if (counts.globalToday >= limits.globalDaily) {
    return { allowed: false, reason: 'Global AI capacity reached for today.', code: 'global_daily' };
  }
  if (counts.customerMonth >= limits.monthlyPerCustomer) {
    return { allowed: false, reason: 'Monthly AI limit reached.', code: 'customer_monthly' };
  }
  if (counts.customerToday >= limits.dailyPerCustomer) {
    return { allowed: false, reason: 'Daily AI limit reached.', code: 'customer_daily' };
  }
  return { allowed: true };
}
