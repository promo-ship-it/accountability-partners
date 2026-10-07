/**
 * AI budget caps (spec §23, §65) — percentage-of-revenue cost ceilings.
 *
 * Two independent caps, both expressed as a % of the subscription price:
 *   - PER-CUSTOMER: each active customer may consume up to `pct%` of their own
 *     monthly price in estimated AI cost. Protects gross margin per customer.
 *   - POOLED: all customers combined may consume up to `pct%` of total MRR
 *     (pct% × activeCustomers × price). The absolute system spend ceiling.
 *
 * Enforcement is on ACCUMULATED ESTIMATED DOLLAR COST (AiUsage.estimatedCostUsd),
 * not request counts — more accurate and auto-scales if the price changes.
 * Pure functions: the caller supplies the live spend figures from the DB.
 */

export interface BudgetConfig {
  /** budget as a percent of price, e.g. 20 => 20% */
  pct: number;
  /** monthly subscription price in USD (billing source of truth) */
  priceUsd: number;
  /** number of active/trialing customers contributing to the pool */
  activeCustomers: number;
  /** master enable flag (admin / env). When false, no budget capping. */
  enabled: boolean;
}

export interface BudgetSpend {
  /** this customer's accumulated estimated AI cost this month (USD) */
  customerMonthUsd: number;
  /** all customers' accumulated estimated AI cost this month (USD) */
  poolMonthUsd: number;
}

export type BudgetResult =
  | { allowed: true }
  | { allowed: false; reason: string; code: 'budget_customer' | 'budget_pool' };

export function perCustomerCapUsd(cfg: BudgetConfig): number {
  return (cfg.pct / 100) * cfg.priceUsd;
}

export function poolCapUsd(cfg: BudgetConfig): number {
  return (cfg.pct / 100) * cfg.priceUsd * Math.max(0, cfg.activeCustomers);
}

/**
 * Decide whether an AI request is within budget. Checks the pooled ceiling
 * first (system-wide protection), then the per-customer cap.
 */
export function gateBudget(cfg: BudgetConfig, spend: BudgetSpend): BudgetResult {
  if (!cfg.enabled || cfg.pct <= 0) return { allowed: true };

  const poolCap = poolCapUsd(cfg);
  if (poolCap > 0 && spend.poolMonthUsd >= poolCap) {
    return {
      allowed: false,
      reason: 'The monthly AI budget for the service has been reached.',
      code: 'budget_pool',
    };
  }

  const custCap = perCustomerCapUsd(cfg);
  if (custCap > 0 && spend.customerMonthUsd >= custCap) {
    return {
      allowed: false,
      reason: 'Your monthly AI budget has been reached; using simpler responses until it resets.',
      code: 'budget_customer',
    };
  }

  return { allowed: true };
}

/** A 0-100 "budget used" figure for the admin meter. */
export function budgetUsedPct(spendUsd: number, capUsd: number): number {
  if (capUsd <= 0) return 0;
  return Math.min(100, Math.round((spendUsd / capUsd) * 100));
}
