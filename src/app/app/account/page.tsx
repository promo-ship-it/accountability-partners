import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { brand } from '@/lib/brand';
import AccountClient from './AccountClient';

export const dynamic = 'force-dynamic';

export default async function AccountPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const sub = await prisma.subscription.findUnique({ where: { userId: user.id } });
  return (
    <AccountClient
      email={user.email}
      status={sub?.status ?? 'none'}
      supportEmail={brand.supportEmail}
    />
  );
}
