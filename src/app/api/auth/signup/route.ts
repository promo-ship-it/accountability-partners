import { z } from 'zod';
import { ok, fail, handleError } from '@/lib/api';
import { signup } from '@/modules/customer/service';
import { createSession } from '@/lib/auth';

const schema = z.object({
  email: z.string().email('Enter a valid email.'),
  password: z.string().min(8, 'Password must be at least 8 characters.'),
  timezone: z.string().optional(),
});

export async function POST(req: Request) {
  try {
    const body = schema.parse(await req.json());
    const user = await signup(body);
    await createSession(user.id);
    return ok({ userId: user.id, next: '/onboarding' }, 201);
  } catch (e) {
    return handleError(e);
  }
}
