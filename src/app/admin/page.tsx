import { redirect } from 'next/navigation';
import { getCurrentUser, isAdminEmail } from '@/lib/auth';
import { overview, listCustomers, listFeatureFlags, auditTrail, budgetStatus } from '@/modules/admin/service';
import AdminClient from './AdminClient';

export const dynamic = 'force-dynamic';

export default async function AdminPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  if (user.role !== 'admin' && !isAdminEmail(user.email)) {
    return (
      <main className="mx-auto max-w-md px-5 py-20 text-center">
        <h1 className="text-xl font-bold">Admin access required</h1>
        <p className="mt-2 text-sm text-slate-600">Your account is not an administrator.</p>
        <a href="/app" className="btn-primary mt-5 inline-flex">Back to app</a>
      </main>
    );
  }

  const [stats, customers, flags, audit, budget] = await Promise.all([
    overview(),
    listCustomers(50),
    listFeatureFlags(),
    auditTrail(30),
    budgetStatus(),
  ]);

  return (
    <AdminClient
      initial={JSON.parse(JSON.stringify({ stats, customers, flags, audit, budget }))}
    />
  );
}
