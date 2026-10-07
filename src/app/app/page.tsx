import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { homeData } from '@/modules/home/service';
import { brand } from '@/lib/brand';
import HomeClient from './HomeClient';

export const dynamic = 'force-dynamic';

export default async function AppHome() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');

  const profile = await prisma.profile.findUnique({ where: { userId: user.id } });
  if (!profile?.onboardingCompleted) redirect('/onboarding');

  const data = await homeData(user.id);
  return (
    <HomeClient data={JSON.parse(JSON.stringify(data))} brandName={brand.name} />
  );
}
