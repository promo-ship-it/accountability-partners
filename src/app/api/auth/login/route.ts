import { z } from 'zod';
import { ok, fail, handleError } from '@/lib/api';
import { prisma } from '@/lib/db';
import { verifyPassword, createSession } from '@/lib/auth';
import { Analytics } from '@/modules/events';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const { email, password } = schema.parse(await req.json());
    const user = await prisma.user.findUnique({ where: { email: email.trim().toLowerCase() } });
    // Constant-ish response to avoid user enumeration.
    if (!user || user.deletedAt || !(await verifyPassword(password, user.passwordHash))) {
      return fail('Invalid email or password.', 401);
    }
    await createSession(user.id);
    await Analytics.track('login', user.id);
    const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
    return ok({ next: profile?.onboardingCompleted ? '/app' : '/onboarding' });
  } catch (e) {
    return handleError(e);
  }
}
