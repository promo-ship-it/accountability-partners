/**
 * Migration validation against a REAL Postgres engine (pglite, in-process WASM).
 *
 * This proves the generated Prisma migration SQL actually executes on Postgres
 * and that the resulting schema has the expected core tables — closing the gap
 * that we cannot run a networked Postgres in this sandbox.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { PGlite } from '@electric-sql/pglite';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('Prisma migration executes on Postgres', () => {
  let db: PGlite;

  beforeAll(async () => {
    db = new PGlite();
    const sql = readFileSync(
      resolve(__dirname, '../prisma/migrations/0001_init/migration.sql'),
      'utf8',
    );
    await db.exec(sql);
  });

  it('creates all core tables', async () => {
    const res = await db.query<{ table_name: string }>(
      `SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`,
    );
    const tables = res.rows.map((r) => r.table_name);
    for (const expected of [
      'User',
      'Goal',
      'Commitment',
      'CheckIn',
      'ProgressRecord',
      'BehavioralObservation',
      'AiInteraction',
      'AiUsage',
      'Subscription',
      'Entitlement',
      'Notification',
      'Event',
      'Job',
      'FeatureFlag',
      'AuditLog',
    ]) {
      expect(tables, `missing table ${expected}`).toContain(expected);
    }
  });

  it('enforces the User.email unique constraint', async () => {
    await db.exec(
      `INSERT INTO "User" (id, email, "passwordHash", "updatedAt") VALUES ('u1', 'a@b.com', 'x', now())`,
    );
    await expect(
      db.exec(`INSERT INTO "User" (id, email, "passwordHash", "updatedAt") VALUES ('u2', 'a@b.com', 'x', now())`),
    ).rejects.toBeTruthy();
  });

  it('round-trips a goal owned by a user (ownership column present)', async () => {
    await db.exec(
      `INSERT INTO "Goal" (id, "userId", statement, "updatedAt") VALUES ('g1', 'u1', 'Run a 5K', now())`,
    );
    const res = await db.query<{ userId: string; statement: string }>(
      `SELECT "userId", statement FROM "Goal" WHERE id = 'g1'`,
    );
    expect(res.rows[0]).toMatchObject({ userId: 'u1', statement: 'Run a 5K' });
  });
});
