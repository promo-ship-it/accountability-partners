import { z } from 'zod';
import { ok, handleError } from '@/lib/api';
import { requireUser } from '@/lib/auth';
import { completeOnboarding } from '@/modules/customer/service';

const schema = z.object({
  displayName: z.string().max(80).optional(),
  goalStatement: z.string().min(3, 'Describe your goal.').max(300),
  whyItMatters: z.string().max(500).optional(),
  category: z.string().optional(),
  baseline: z.string().max(120).optional(),
  target: z.string().max(120).optional(),
  targetDate: z.string().optional(),
  accountabilityStyle: z.string().optional(),
  motivations: z.string().max(500).optional(),
  availabilityNotes: z.string().max(300).optional(),
});

export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = schema.parse(await req.json());
    await completeOnboarding(user.id, body);
    return ok({ next: '/app' });
  } catch (e) {
    return handleError(e);
  }
}
