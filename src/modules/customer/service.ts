/**
 * Customer module (spec §34, §41). Signup, onboarding, account lifecycle.
 */

import { prisma } from '@/lib/db';
import { hashPassword, isAdminEmail } from '@/lib/auth';
import { trialEnd } from '@/modules/billing/trial';
import { entitlementsFor } from '@/modules/billing/entitlements';
import { emitEvent, Analytics } from '@/modules/events';

export interface SignupInput {
  email: string;
  password: string;
  timezone?: string;
}

export async function signup(input: SignupInput) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) throw new Error('An account with that email already exists.');

  const passwordHash = await hashPassword(input.password);
  const now = new Date();
  const trialEndsAt = trialEnd(now);

  const user = await prisma.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        email,
        passwordHash,
        role: isAdminEmail(email) ? 'admin' : 'customer',
        state: 'trial',
        timezone: input.timezone ?? 'UTC',
      },
    });
    await tx.profile.create({ data: { userId: u.id } });
    await tx.notificationPreference.create({ data: { userId: u.id, consentedAt: now } });
    await tx.subscription.create({
      data: { userId: u.id, status: 'trialing', trialEndsAt },
    });
    const ent = entitlementsFor('trialing');
    await tx.entitlement.createMany({
      data: Object.entries(ent).map(([feature, enabled]) => ({ userId: u.id, feature, enabled })),
    });
    return u;
  });

  await emitEvent({ class: 'domain', type: 'account.registered', userId: user.id, actor: 'customer' });
  await emitEvent({ class: 'domain', type: 'trial.started', userId: user.id, actor: 'system' });
  await Analytics.track('signup', user.id);
  await Analytics.track('trial_start', user.id);
  return user;
}

export interface OnboardingInput {
  displayName?: string;
  goalStatement: string;
  whyItMatters?: string;
  category?: string;
  baseline?: string;
  target?: string;
  targetDate?: string;
  accountabilityStyle?: string;
  motivations?: string;
  availabilityNotes?: string;
}

const VALID_STYLES = [
  'supportive',
  'encouraging',
  'direct',
  'challenging',
  'structured',
  'reflective',
  'motivational',
  'firm',
] as const;

const VALID_CATEGORIES = [
  'fitness',
  'weight',
  'strength',
  'activity',
  'nutrition',
  'wellness',
  'habit',
] as const;

export async function completeOnboarding(userId: string, input: OnboardingInput) {
  const style = (VALID_STYLES as readonly string[]).includes(input.accountabilityStyle ?? '')
    ? (input.accountabilityStyle as (typeof VALID_STYLES)[number])
    : 'supportive';
  const category = (VALID_CATEGORIES as readonly string[]).includes(input.category ?? '')
    ? (input.category as (typeof VALID_CATEGORIES)[number])
    : 'fitness';

  await prisma.$transaction(async (tx) => {
    await tx.profile.update({
      where: { userId },
      data: {
        displayName: input.displayName,
        accountabilityStyle: style,
        motivations: input.motivations,
        availabilityNotes: input.availabilityNotes,
        onboardingCompleted: true,
      },
    });
    await tx.goal.create({
      data: {
        userId,
        statement: input.goalStatement,
        whyItMatters: input.whyItMatters,
        category,
        baseline: input.baseline,
        target: input.target,
        targetDate: input.targetDate ? new Date(input.targetDate) : null,
      },
    });
    await tx.user.update({ where: { id: userId }, data: { state: 'active' } });
  });

  await emitEvent({ class: 'domain', type: 'onboarding.completed', userId, actor: 'customer' });
  await emitEvent({ class: 'domain', type: 'goal.created', userId, actor: 'customer' });
  await Analytics.track('onboarding_complete', userId);
  await Analytics.track('first_goal', userId);
}

/** GDPR-style export (spec §46). */
export async function exportCustomerData(userId: string) {
  const [user, profile, goals, commitments, checkIns, progress, observations, notifications] =
    await Promise.all([
      prisma.user.findUnique({ where: { id: userId }, select: { email: true, createdAt: true, state: true } }),
      prisma.profile.findUnique({ where: { userId } }),
      prisma.goal.findMany({ where: { userId } }),
      prisma.commitment.findMany({ where: { userId } }),
      prisma.checkIn.findMany({ where: { userId } }),
      prisma.progressRecord.findMany({ where: { userId } }),
      prisma.behavioralObservation.findMany({ where: { userId } }),
      prisma.notification.findMany({ where: { userId } }),
    ]);
  return { user, profile, goals, commitments, checkIns, progress, observations, notifications };
}

/** Account deletion (spec §46). Cascades remove owned rows. */
export async function deleteCustomer(userId: string) {
  await emitEvent({ class: 'domain', type: 'account.deletion_requested', userId, actor: 'customer' });
  await prisma.user.update({ where: { id: userId }, data: { state: 'deleted', deletedAt: new Date() } });
  await prisma.user.delete({ where: { id: userId } });
}
