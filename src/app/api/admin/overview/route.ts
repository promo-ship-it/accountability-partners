import { ok, handleError } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { overview, listCustomers } from '@/modules/admin/service';

export async function GET() {
  try {
    await requireAdmin();
    const [stats, customers] = await Promise.all([overview(), listCustomers(50)]);
    return ok({ stats, customers });
  } catch (e) {
    return handleError(e);
  }
}
