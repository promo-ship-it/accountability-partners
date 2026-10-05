import { z } from 'zod';
import { ok, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { recordCheckIn } from '@/modules/goals/service';

const schema = z.object({
  completed: z.boolean(),
  mood: z.number().int().min(1).max(5).optional(),
  note: z.string().max(500).optional(),
  commitmentId: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = schema.parse(await req.json());
    return ok(await recordCheckIn(user.id, body), 201);
  } catch (e) {
    return handleError(e);
  }
}
