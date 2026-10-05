import { ok, handleError } from '@/lib/api';
import { destroySession } from '@/lib/auth';

export async function POST() {
  try {
    await destroySession();
    return ok({ next: '/' });
  } catch (e) {
    return handleError(e);
  }
}
