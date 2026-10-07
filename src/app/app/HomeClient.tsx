'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Commitment {
  id: string;
  description: string;
  dueAt: string;
  status: string;
}
interface HomeData {
  displayName: string | null;
  goal: { id: string; statement: string; whyItMatters: string | null } | null;
  todaysCommitments: Commitment[];
  nextCommitment: Commitment | null;
  insight: { summary: string; evidence: string | null; confidence: string; tier: string } | null;
  progress: { percent: number | null; latest: number | null; trend: string } | null;
  subscriptionStatus: string;
  trialDaysLeft: number | null;
  unreadNotifs: number;
}

export default function HomeClient({ data, brandName }: { data: HomeData; brandName: string }) {
  const router = useRouter();
  const [partnerMsg, setPartnerMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // new commitment form
  const [newText, setNewText] = useState('');
  const [newTime, setNewTime] = useState('18:00');

  async function addCommitment() {
    if (newText.length < 3) return;
    setBusy(true);
    const due = new Date();
    const [h, m] = newTime.split(':').map(Number);
    due.setHours(h, m, 0, 0);
    const res = await fetch('/api/commitments', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: newText, dueAt: due.toISOString(), goalId: data.goal?.id }),
    });
    setBusy(false);
    if ((await res.json()).ok) {
      setNewText('');
      router.refresh();
    }
  }

  async function resolve(id: string, action: 'complete' | 'miss', reason?: string) {
    setBusy(true);
    const res = await fetch(`/api/commitments/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, reason }),
    });
    const json = await res.json();
    setBusy(false);
    if (json.ok) {
      setPartnerMsg(json.data.message);
      router.refresh();
    }
  }

  async function startCheckout() {
    setBusy(true);
    const res = await fetch('/api/billing/checkout', { method: 'POST' });
    const json = await res.json();
    setBusy(false);
    if (json.ok && json.data.url) window.location.href = json.data.url;
    else setPartnerMsg(json.error ?? 'Billing is not available yet.');
  }

  async function logout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.push('/');
  }

  const greet = data.displayName ? `Hi ${data.displayName}` : 'Welcome back';

  return (
    <main className="mx-auto max-w-2xl px-5 pb-20">
      <header className="flex items-center justify-between py-5">
        <span className="font-bold text-brand-700">{brandName}</span>
        <div className="flex items-center gap-3 text-sm">
          <a href="/app/account" className="text-slate-600 hover:text-ink">Account</a>
          <button onClick={logout} className="text-slate-600 hover:text-ink">Log out</button>
        </div>
      </header>

      {data.trialDaysLeft !== null && (
        <div className="mb-4 flex items-center justify-between rounded-xl bg-brand-50 px-4 py-3 text-sm">
          <span>
            {data.trialDaysLeft > 0
              ? `${data.trialDaysLeft} day${data.trialDaysLeft === 1 ? '' : 's'} left in your free trial.`
              : 'Your trial has ended.'}
          </span>
          <button onClick={startCheckout} className="btn-primary py-1.5" disabled={busy}>
            Subscribe $35/mo
          </button>
        </div>
      )}

      <h1 className="text-2xl font-bold">{greet}.</h1>
      {data.goal && (
        <p className="mt-1 text-slate-600">
          Working toward: <span className="font-medium text-ink">{data.goal.statement}</span>
        </p>
      )}

      {/* Today's most important action */}
      <section className="card mt-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Today</h2>
        {data.todaysCommitments.length === 0 ? (
          <p className="mt-2 text-sm text-slate-600">
            No commitment set for today. What&apos;s one small action you&apos;ll commit to?
          </p>
        ) : (
          <ul className="mt-3 space-y-3">
            {data.todaysCommitments.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-3">
                <span className="text-sm">{c.description}</span>
                <span className="flex gap-2">
                  <button className="btn-primary py-1.5" disabled={busy} onClick={() => resolve(c.id, 'complete')}>Done</button>
                  <button className="btn-ghost py-1.5" disabled={busy} onClick={() => {
                    const reason = window.prompt('What got in the way? (optional)') ?? undefined;
                    resolve(c.id, 'miss', reason);
                  }}>Missed</button>
                </span>
              </li>
            ))}
          </ul>
        )}

        <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-4 sm:flex-row">
          <input className="input mt-0 flex-1" placeholder="Add a commitment for today" value={newText} onChange={(e) => setNewText(e.target.value)} />
          <input type="time" className="input mt-0 w-28" value={newTime} onChange={(e) => setNewTime(e.target.value)} />
          <button className="btn-primary" disabled={busy || newText.length < 3} onClick={addCommitment}>Commit</button>
        </div>
      </section>

      {/* Accountability partner message */}
      {partnerMsg && (
        <section className="card mt-4 border-l-4 border-brand-500">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Your partner</h2>
          <p className="mt-2 text-sm">{partnerMsg}</p>
        </section>
      )}

      {/* Behavioral insight (clearly labeled by tier) */}
      {data.insight && (
        <section className="card mt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">What we&apos;re noticing</h2>
          <p className="mt-2 text-sm">{data.insight.summary}</p>
          {data.insight.evidence && <p className="mt-1 text-xs text-slate-500">{data.insight.evidence}</p>}
          <p className="mt-1 text-xs text-slate-400">
            Based on {labelTier(data.insight.tier)} · confidence: {data.insight.confidence}
          </p>
        </section>
      )}

      {/* Progress */}
      {data.progress && data.progress.percent !== null && (
        <section className="card mt-4">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Progress</h2>
          <div className="mt-3 h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-brand-600" style={{ width: `${data.progress.percent}%` }} />
          </div>
          <p className="mt-2 text-sm text-slate-600">{data.progress.percent}% of the way there.</p>
        </section>
      )}

      {/* Coaching */}
      <Coach />

      {data.nextCommitment && (
        <p className="mt-6 text-center text-xs text-slate-400">
          Next up: {data.nextCommitment.description} on {new Date(data.nextCommitment.dueAt).toLocaleDateString()}
        </p>
      )}
    </main>
  );
}

function labelTier(tier: string): string {
  const map: Record<string, string> = {
    observed: 'observed behavior',
    ai_inference: 'an AI inference',
    ai_hypothesis: 'an AI hypothesis',
    app_recorded: 'recorded facts',
    customer_confirmed: 'what you confirmed',
  };
  return map[tier] ?? tier;
}

function Coach() {
  const [msg, setMsg] = useState('');
  const [reply, setReply] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send() {
    if (!msg.trim()) return;
    setBusy(true);
    const res = await fetch('/api/ai/coach', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg }),
    });
    const json = await res.json();
    setBusy(false);
    if (json.ok) {
      setReply(json.data.message);
      setMsg('');
    }
  }

  return (
    <section className="card mt-4">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Talk to your partner</h2>
      {reply && <p className="mt-2 rounded-lg bg-slate-50 p-3 text-sm">{reply}</p>}
      <div className="mt-3 flex gap-2">
        <input className="input mt-0 flex-1" placeholder="What's on your mind?" value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} />
        <button className="btn-primary" disabled={busy} onClick={send}>Send</button>
      </div>
      <p className="mt-2 text-xs text-slate-400">You&apos;re talking with an AI partner, not a medical professional.</p>
    </section>
  );
}
