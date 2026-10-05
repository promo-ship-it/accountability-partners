import { z } from 'zod';
import { ok, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { recordProgress } from '@/modules/goals/service';

const schema = z.object({
  metric: z.string().min(1).max(60),
  value: z.number(),
  unit: z.string().max(20).optional(),
  goalId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = schema.parse(await req.json());
    return ok(await recordProgress(user.id, body), 201);
  } catch (e) {
    return handleError(e);
  }
}
