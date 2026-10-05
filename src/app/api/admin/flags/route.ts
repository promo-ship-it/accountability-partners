import { z } from 'zod';
import { ok, handleError } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { setFeatureFlag, listFeatureFlags } from '@/modules/admin/service';

export async function GET() {
  try {
    await requireAdmin();
    return ok(await listFeatureFlags());
  } catch (e) {
    return handleError(e);
  }
}

const schema = z.object({
  key: z.string().min(1),
  enabled: z.boolean(),
  description: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const { key, enabled, description } = schema.parse(await req.json());
    await setFeatureFlag(key, enabled, admin.id, description);
    return ok({ key, enabled });
  } catch (e) {
    return handleError(e);
  }
}
