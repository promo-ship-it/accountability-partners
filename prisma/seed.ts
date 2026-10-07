/**
 * Seed script: feature flags + synthetic test personas (spec §26, §68, §49).
 * Idempotent — safe to run repeatedly.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const FLAGS = [
  { key: 'ai_kill_switch', enabled: false, description: 'Master switch to disable ALL AI immediately.' },
  { key: 'ai_disable_coaching', enabled: false, description: 'Disable the AI coaching capability.' },
  { key: 'ai_disable_challenge_reframe', enabled: false, description: 'Disable the AI challenge capability.' },
  { key: 'notifications_kill_switch', enabled: false, description: 'Disable all outbound notifications.' },
  { key: 'human_coaching', enabled: false, description: 'Architected future capability — not in base plan.' },
  { key: 'ai_budget_disabled', enabled: false, description: 'Turn OFF the AI budget cap entirely (live, no redeploy).' },
  { key: 'ai_budget_pct_20', enabled: false, description: 'Override AI budget to 20% of price. Only one ai_budget_pct_* should be on.' },
];

/** Seven synthetic personas (spec §68). Used by the AI eval harness. */
export const PERSONAS = [
  { key: 'A', email: 'persona.consistent@example.com', label: 'Highly consistent' },
  { key: 'B', email: 'persona.inconsistent@example.com', label: 'Frequently inconsistent' },
  { key: 'C', email: 'persona.disengaging@example.com', label: 'Disengaging' },
  { key: 'D', email: 'persona.rejects@example.com', label: 'Rejects recommendations' },
  { key: 'E', email: 'persona.changesgoals@example.com', label: 'Changes goals' },
  { key: 'F', email: 'persona.needsstronger@example.com', label: 'Needs stronger accountability' },
  { key: 'G', email: 'persona.needsgentler@example.com', label: 'Needs gentler accountability' },
];

async function main() {
  for (const f of FLAGS) {
    await prisma.featureFlag.upsert({ where: { key: f.key }, update: { description: f.description }, create: f });
  }

  const pw = await bcrypt.hash('persona-pw-123', 10);
  for (const p of PERSONAS) {
    const existing = await prisma.user.findUnique({ where: { email: p.email } });
    if (existing) continue;
    const trialEndsAt = new Date(Date.now() + 7 * 86_400_000);
    const u = await prisma.user.create({
      data: { email: p.email, passwordHash: pw, state: 'trial', timezone: 'UTC' },
    });
    await prisma.profile.create({
      data: { userId: u.id, displayName: p.label, onboardingCompleted: true, accountabilityStyle: 'supportive' },
    });
    await prisma.subscription.create({ data: { userId: u.id, status: 'trialing', trialEndsAt } });
    await prisma.notificationPreference.create({ data: { userId: u.id } });
    const goal = await prisma.goal.create({
      data: { userId: u.id, statement: `${p.label}'s fitness goal`, category: 'fitness', baseline: '0', target: '100' },
    });

    // Seed commitment history matching each persona's pattern.
    const history = patternFor(p.key);
    for (const h of history) {
      await prisma.commitment.create({
        data: {
          userId: u.id,
          goalId: goal.id,
          description: 'Daily action',
          dueAt: h.dueAt,
          status: h.status as never,
          missReason: h.missReason,
        },
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log(`Seeded ${FLAGS.length} flags and ${PERSONAS.length} personas.`);
}

function patternFor(key: string): { dueAt: Date; status: string; missReason?: string }[] {
  const day = (n: number, hour = 18) => {
    const d = new Date();
    d.setDate(d.getDate() - n);
    d.setHours(hour, 0, 0, 0);
    return d;
  };
  switch (key) {
    case 'A': // consistent
      return [0, 1, 2, 3, 4].map((n) => ({ dueAt: day(n), status: 'completed' }));
    case 'B': // inconsistent
      return [
        { dueAt: day(0), status: 'missed', missReason: 'no time' },
        { dueAt: day(1), status: 'completed' },
        { dueAt: day(2), status: 'missed', missReason: 'tired' },
        { dueAt: day(3), status: 'completed' },
        { dueAt: day(4), status: 'missed', missReason: 'busy' },
      ];
    case 'F': // needs stronger — evening fatigue pattern
      return [
        { dueAt: day(0, 20), status: 'missed', missReason: 'too tired after work' },
        { dueAt: day(1, 21), status: 'missed', missReason: 'exhausted' },
        { dueAt: day(2, 19), status: 'missed', missReason: 'no energy' },
        { dueAt: day(3, 8), status: 'completed' },
        { dueAt: day(4, 8), status: 'completed' },
      ];
    case 'C': // disengaging — old activity only
      return [{ dueAt: day(12), status: 'completed' }];
    default:
      return [
        { dueAt: day(0), status: 'completed' },
        { dueAt: day(1), status: 'missed', missReason: 'forgot' },
        { dueAt: day(2), status: 'completed' },
      ];
  }
}

main()
  .catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
