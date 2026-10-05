import { z } from 'zod';
import { ok, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { listGoals, createGoal } from '@/modules/goals/service';

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await listGoals(user.id));
  } catch (e) {
    return handleError(e);
  }
}

const schema = z.object({
  statement: z.string().min(3).max(300),
  whyItMatters: z.string().max(500).optional(),
  category: z.string().optional(),
  baseline: z.string().max(120).optional(),
  target: z.string().max(120).optional(),
  targetDate: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = schema.parse(await req.json());
    return ok(await createGoal(user.id, body), 201);
  } catch (e) {
    return handleError(e);
  }
}
