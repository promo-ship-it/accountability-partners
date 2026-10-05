import { z } from 'zod';
import { ok, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { runCapability } from '@/modules/ai/engine';
import { prisma } from '@/lib/db';

const schema = z.object({ message: z.string().min(1).max(1000) });

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { message } = schema.parse(await req.json());

    // Entitlement check (spec §40): coaching requires an enabled entitlement.
    const ent = await prisma.entitlement.findUnique({
      where: { userId_feature: { userId: user.id, feature: 'ai_coaching' } },
    });
    if (!ent?.enabled) {
      return ok({
        message:
          'Your AI coaching is paused because your trial or subscription is not active. Reactivate to continue.',
        locked: true,
      });
    }

    const goal = await prisma.goal.findFirst({ where: { userId: user.id }, orderBy: { createdAt: 'desc' } });
    const ai = await runCapability(user.id, 'coaching', {
      message,
      context: goal ? `Current goal: ${goal.statement}` : 'No active goal yet.',
    });
    return ok({ message: ai.text, usedFallback: ai.usedFallback });
  } catch (e) {
    return handleError(e);
  }
}
