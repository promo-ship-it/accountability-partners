/**
 * Event architecture (spec §44). Domain / analytics / integration events with
 * version, actor, metadata, correlation id. Thin DB-backed emitter.
 */

import { prisma } from '@/lib/db';

export type EventClass = 'domain' | 'analytics' | 'integration';

export interface EmitInput {
  userId?: string | null;
  class: EventClass;
  type: string;
  version?: number;
  entity?: string;
  actor?: 'customer' | 'system' | 'ai';
  metadata?: Record<string, unknown>;
  correlationId?: string;
}

export async function emitEvent(input: EmitInput): Promise<void> {
  await prisma.event.create({
    data: {
      userId: input.userId ?? null,
      class: input.class,
      type: input.type,
      version: input.version ?? 1,
      entity: input.entity,
      actor: input.actor,
      metadata: input.metadata ? JSON.stringify(input.metadata) : null,
      correlationId: input.correlationId,
    },
  });
}

/** Convenience for analytics funnel events (spec §50). */
export const Analytics = {
  track: (type: string, userId?: string | null, metadata?: Record<string, unknown>) =>
    emitEvent({ class: 'analytics', type, userId, metadata }),
};
