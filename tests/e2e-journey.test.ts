/**
 * Critical end-to-end customer journey (spec §67) against a REAL Postgres
 * engine (pglite). Exercises the full data flow + the behavioral engine
 * decisions that drive AI accountability:
 *
 *   signup/trial -> onboarding+goal -> commitment -> check-in
 *   -> completed (encouragement) -> repeated misses (investigate/challenge)
 *   -> behavioral observation -> adaptive signal -> progress -> conversion
 *
 * The engine decision functions are the SAME ones the API routes call, so
 * this validates real product behavior, not mocks.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { decideEscalation, AccountabilityLevel } from '@/modules/accountability/escalation';
import { detectTimeOfDayPattern } from '@/modules/behavioral/evidence';
import { entitlementsFor } from '@/modules/billing/entitlements';
import { trialEnd, daysLeftInTrial } from '@/modules/billing/trial';
import { computeGoalProgress } from '@/modules/goals/progress';

let db: PGlite;
const uid = 'cust_1';
const gid = 'goal_1';

beforeAll(async () => {
  db = new PGlite();
  const sql = readFileSync(resolve(__dirname, '../prisma/migrations/0001_init/migration.sql'), 'utf8');
  await db.exec(sql);
});

describe('E2E — new customer journey', () => {
  it('1. signs up and starts a 7-day trial with base entitlements', async () => {
    const trialEndsAt = trialEnd(new Date());
    await db.exec(
      `INSERT INTO "User" (id, email, "passwordHash", state, "updatedAt") VALUES ('${uid}', 'c@x.com', 'hash', 'trial', now())`,
    );
    await db.exec(
      `INSERT INTO "Subscription" (id, "userId", status, "trialEndsAt", "updatedAt")
       VALUES ('sub_1', '${uid}', 'trialing', '${trialEndsAt.toISOString()}', now())`,
    );
    const ent = entitlementsFor('trialing');
    for (const [feature, enabled] of Object.entries(ent)) {
      await db.exec(
        `INSERT INTO "Entitlement" (id, "userId", feature, enabled, "updatedAt")
         VALUES ('ent_${feature}', '${uid}', '${feature}', ${enabled}, now())`,
      );
    }
    const left = daysLeftInTrial(trialEndsAt, new Date());
    expect(left).toBeGreaterThanOrEqual(6);

    const ai = await db.query<{ enabled: boolean }>(
      `SELECT enabled FROM "Entitlement" WHERE "userId"='${uid}' AND feature='ai_accountability'`,
    );
    expect(ai.rows[0].enabled).toBe(true);
    const human = await db.query<{ enabled: boolean }>(
      `SELECT enabled FROM "Entitlement" WHERE "userId"='${uid}' AND feature='human_coaching'`,
    );
    expect(human.rows[0].enabled).toBe(false); // never in base plan
  });

  it('2. completes onboarding and creates a goal', async () => {
    await db.exec(
      `INSERT INTO "Profile" (id, "userId", "onboardingCompleted", "accountabilityStyle", "updatedAt")
       VALUES ('p1', '${uid}', true, 'supportive', now())`,
    );
    await db.exec(
      `INSERT INTO "Goal" (id, "userId", statement, category, baseline, target, "updatedAt")
       VALUES ('${gid}', '${uid}', 'Run a 5K', 'fitness', '0', '100', now())`,
    );
    const g = await db.query(`SELECT * FROM "Goal" WHERE id='${gid}'`);
    expect(g.rows).toHaveLength(1);
  });

  it('3. creates a commitment and completes it -> encouragement path', async () => {
    await db.exec(
      `INSERT INTO "Commitment" (id, "userId", "goalId", description, "dueAt", status, "updatedAt")
       VALUES ('c1', '${uid}', '${gid}', 'Walk 20 min', now(), 'completed', now())`,
    );
    await db.exec(
      `INSERT INTO "CheckIn" (id, "userId", "commitmentId", completed) VALUES ('ci1', '${uid}', 'c1', true)`,
    );
    const recent = await loadRecent();
    expect(decideEscalation(recent).level).toBe(AccountabilityLevel.SUPPORT);
  });

  it('4. repeated evening misses escalate and surface a behavioral observation', async () => {
    const insertMiss = (id: string, daysAgo: number, hour: number, reason: string) => {
      const d = new Date();
      d.setDate(d.getDate() - daysAgo);
      d.setHours(hour, 0, 0, 0);
      return db.exec(
        `INSERT INTO "Commitment" (id, "userId", "goalId", description, "dueAt", status, "missReason", "updatedAt")
         VALUES ('${id}', '${uid}', '${gid}', 'Evening run', '${d.toISOString()}', 'missed', '${reason}', now())`,
      );
    };
    await insertMiss('m1', 0, 20, 'too tired after work');
    await insertMiss('m2', 1, 21, 'exhausted');
    await insertMiss('m3', 2, 19, 'no energy');

    const recent = await loadRecent();
    const decision = decideEscalation(recent);
    expect(decision.level).toBeGreaterThanOrEqual(AccountabilityLevel.CHALLENGE);

    const obs = detectTimeOfDayPattern(recent);
    expect(obs).not.toBeNull();
    expect(obs!.summary.toLowerCase()).toContain('evening');

    // persist the observation as OBSERVED tier with evidence (not a fact)
    await db.exec(
      `INSERT INTO "BehavioralObservation" (id, "userId", summary, evidence, tier, confidence, "updatedAt")
       VALUES ('o1', '${uid}', '${obs!.summary.replace(/'/g, "''")}', '${obs!.evidence.replace(/'/g, "''")}', 'observed', '${obs!.confidence}', now())`,
    );
    const stored = await db.query<{ tier: string }>(`SELECT tier FROM "BehavioralObservation" WHERE id='o1'`);
    expect(stored.rows[0].tier).toBe('observed'); // never stored as a customer fact
  });

  it('5. records progress and computes percent toward the goal', async () => {
    await db.exec(`INSERT INTO "ProgressRecord" (id, "userId", "goalId", metric, value) VALUES ('pr1', '${uid}', '${gid}', 'distance', 50)`);
    const points = await db.query<{ value: number; recordedAt: string }>(
      `SELECT value, "recordedAt" FROM "ProgressRecord" WHERE "goalId"='${gid}' ORDER BY "recordedAt"`,
    );
    const prog = computeGoalProgress({
      baseline: 0,
      target: 100,
      points: points.rows.map((p) => ({ value: p.value, recordedAt: new Date(p.recordedAt) })),
    });
    expect(prog.percent).toBe(50);
  });

  it('6. converts the trial to active and keeps base entitlements', async () => {
    await db.exec(`UPDATE "Subscription" SET status='active' WHERE "userId"='${uid}'`);
    await db.exec(`UPDATE "User" SET state='active' WHERE id='${uid}'`);
    const ent = entitlementsFor('active');
    expect(ent.ai_accountability).toBe(true);
    expect(ent.human_coaching).toBe(false);
    const u = await db.query<{ state: string }>(`SELECT state FROM "User" WHERE id='${uid}'`);
    expect(u.rows[0].state).toBe('active');
  });
});

async function loadRecent() {
  const res = await db.query<{ status: string; dueAt: string; missReason: string | null }>(
    `SELECT status, "dueAt", "missReason" FROM "Commitment"
     WHERE "userId"='${uid}' AND status IN ('completed','missed','skipped')
     ORDER BY "dueAt" DESC LIMIT 10`,
  );
  return res.rows.map((r) => ({
    status: r.status as 'completed' | 'missed' | 'skipped',
    dueAt: new Date(r.dueAt),
    dueHour: new Date(r.dueAt).getHours(),
    missReason: r.missReason,
  }));
}
