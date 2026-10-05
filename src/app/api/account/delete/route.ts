import { ok, handleError } from '@/lib/api';
import { requireUser, destroySession } from '@/lib/auth';
import { deleteCustomer } from '@/modules/customer/service';

export async function POST() {
  try {
    const user = await requireUser();
    await deleteCustomer(user.id);
    await destroySession();
    return ok({ next: '/' });
  } catch (e) {
    return handleError(e);
  }
}
