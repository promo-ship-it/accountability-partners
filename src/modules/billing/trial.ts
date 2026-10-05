/**
 * Trial logic (spec §38). Pure helpers for 7-day trial state.
 */

export const TRIAL_DAYS = 7;
export const PRICE_USD = 35;

export function trialEnd(start: Date): Date {
  const d = new Date(start);
  d.setDate(d.getDate() + TRIAL_DAYS);
  return d;
}

export function daysLeftInTrial(trialEndsAt: Date | null, now: Date): number | null {
  if (!trialEndsAt) return null;
  const ms = trialEndsAt.getTime() - now.getTime();
  return Math.max(0, Math.ceil(ms / 86_400_000));
}

export function trialExpired(trialEndsAt: Date | null, now: Date): boolean {
  return !!trialEndsAt && trialEndsAt.getTime() <= now.getTime();
}
