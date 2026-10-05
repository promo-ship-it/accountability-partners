import { z } from 'zod';
import { ok, handleError } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { suspendUser } from '@/modules/admin/service';

const schema = z.object({ action: z.enum(['suspend', 'unsuspend']) });

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  try {
    const admin = await requireAdmin();
    const { action } = schema.parse(await req.json());
    await suspendUser(params.id, admin.id, action === 'suspend');
    return ok({ id: params.id, action });
  } catch (e) {
    return handleError(e);
  }
}
