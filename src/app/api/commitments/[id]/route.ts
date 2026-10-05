import { z } from 'zod';
import { ok, fail, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { completeCommitment, missCommitment } from '@/modules/goals/service';
import { runCapability } from '@/modules/ai/engine';
import { prisma } from '@/lib/db';
import { decideEscalation } from '@/modules/accountability/escalation';
import { detectTimeOfDayPattern } from '@/modules/behavioral/evidence';

const schema = z.object({
  action: z.enum(['complete', 'miss']),
  reason: z.string().max(300).optional(),
});

/** Update a commitment and trigger the right AI accountability response. */
export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const user = await requireUser();
    const { action, reason } = schema.parse(await req.json());

    if (action === 'complete') {
      await completeCommitment(user.id, params.id);
      const goal = await prisma.goal.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
      const ai = await runCapability(user.id, 'encouragement', {
        commitment: 'their commitment',
        goal: goal?.statement ?? 'their goal',
      });
      return ok({ status: 'completed', message: ai.text, usedFallback: ai.usedFallback });
    }

    // miss -> investigate / challenge based on evidence & escalation level
    await missCommitment(user.id, params.id, reason);
    const recent = await prisma.commitment.findMany({
      where: { userId: user.id, status: { in: ['completed', 'missed', 'skipped'] } },
      orderBy: { dueAt: 'desc' },
      take: 10,
    });
    const mapped = recent.map((c) => ({
      status: c.status,
      dueAt: c.dueAt,
      dueHour: c.dueAt.getUTCHours(),
      missReason: c.missReason,
    }));
    const escalation = decideEscalation(mapped);
    const observation = detectTimeOfDayPattern(mapped);

    let ai;
    if (escalation.level >= 3 && observation) {
      ai = await runCapability(user.id, 'challenge_reframe', {
        statement: reason ?? 'I just couldn’t get to it',
        evidence: observation.evidence,
        confidence: observation.confidence,
      });
    } else {
      ai = await runCapability(user.id, 'barrier_discovery', {
        commitment: 'the commitment',
        observation: observation?.summary ?? 'none yet',
      });
    }

    return ok({
      status: 'missed',
      level: escalation.level,
      message: ai.text,
      usedFallback: ai.usedFallback,
    });
  } catch (e) {
    return handleError(e);
  }
}
