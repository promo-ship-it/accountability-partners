import { ok, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { exportCustomerData } from '@/modules/customer/service';

export async function GET() {
  try {
    const user = await requireUser();
    return ok(await exportCustomerData(user.id));
  } catch (e) {
    return handleError(e);
  }
}
