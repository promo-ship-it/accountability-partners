'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AccountClient({ email, status, supportEmail }: { email: string; status: string; supportEmail: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function manage() {
    setBusy(true);
    const res = await fetch('/api/billing/portal', { method: 'POST' });
    const json = await res.json();
    setBusy(false);
    if (json.ok && json.data.url) window.location.href = json.data.url;
    else setMsg(json.error ?? 'Billing portal unavailable.');
  }

  async function exportData() {
    const res = await fetch('/api/account/export');
    const json = await res.json();
    if (json.ok) {
      const blob = new Blob([JSON.stringify(json.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'accountability-partners-data.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  async function del() {
    if (!window.confirm('Permanently delete your account and all data? This cannot be undone.')) return;
    setBusy(true);
    const res = await fetch('/api/account/delete', { method: 'POST' });
    const json = await res.json();
    setBusy(false);
    if (json.ok) router.push('/');
  }

  return (
    <main className="mx-auto max-w-xl px-5 py-10">
      <a href="/app" className="text-sm text-brand-600">← Back</a>
      <h1 className="mt-3 text-2xl font-bold">Account</h1>
      <div className="card mt-6 space-y-2">
        <p className="text-sm"><span className="text-slate-500">Email:</span> {email}</p>
        <p className="text-sm"><span className="text-slate-500">Subscription:</span> {status}</p>
      </div>

      <div className="card mt-4 space-y-3">
        <h2 className="font-semibold">Subscription</h2>
        <button className="btn-primary" disabled={busy} onClick={manage}>Manage / cancel subscription</button>
        {msg && <p className="text-sm text-slate-500">{msg}</p>}
      </div>

      <div className="card mt-4 space-y-3">
        <h2 className="font-semibold">Your data &amp; privacy</h2>
        <button className="btn-ghost" onClick={exportData}>Export my data</button>
        <button className="btn-ghost text-bad" disabled={busy} onClick={del}>Delete my account</button>
      </div>

      <div className="card mt-4">
        <h2 className="font-semibold">Need help?</h2>
        <p className="mt-2 text-sm text-slate-600">
          Email <a className="text-brand-600" href={`mailto:${supportEmail}`}>{supportEmail}</a> to report a problem,
          request help, or flag inappropriate AI behavior.
        </p>
      </div>
    </main>
  );
}
