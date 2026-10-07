import { ok, handleError } from '@/lib/api';
import { requireAdmin } from '@/lib/auth';
import { overview, listCustomers, budgetStatus } from '@/modules/admin/service';

export async function GET() {
  try {
    await requireAdmin();
    const [stats, customers, budget] = await Promise.all([
      overview(),
      listCustomers(50),
      budgetStatus(),
    ]);
    return ok({ stats, customers, budget });
  } catch (e) {
    return handleError(e);
  }
}
