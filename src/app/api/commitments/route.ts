import { z } from 'zod';
import { ok, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { listCommitments, createCommitment } from '@/modules/goals/service';

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await listCommitments(user.id));
  } catch (e) {
    return handleError(e);
  }
}

const schema = z.object({
  description: z.string().min(3).max(300),
  dueAt: z.string(),
  goalId: z.string().optional(),
  proposedByAi: z.boolean().optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = schema.parse(await req.json());
    return ok(await createCommitment(user.id, body), 201);
  } catch (e) {
    return handleError(e);
  }
}
