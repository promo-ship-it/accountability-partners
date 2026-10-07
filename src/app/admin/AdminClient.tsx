'use client';

import { useState } from 'react';

interface Stats {
  customers: { total: number; trialing: number; active: number; pastDue: number; canceled: number };
  revenue: { mrr: number; pricePerCustomer: number };
  ai: { costToday: number; costMonth: number };
  jobs: { failed: number; pending: number };
  unitEconomics: { revenuePerCustomer: number; aiCostPerCustomer: number; paymentFeePerCustomer: number; grossMarginPerCustomer: number };
}
interface Customer { id: string; email: string; state: string; subscriptionStatus: string; goals: number; commitments: number; }
interface Flag { id: string; key: string; enabled: boolean; description: string | null; }
interface Audit { id: string; action: string; target: string | null; createdAt: string; }
interface Budget {
  enabled: boolean;
  pct: number;
  perCustomerCapUsd: number;
  poolCapUsd: number;
  poolSpendUsd: number;
  poolUsedPct: number;
  activeCustomers: number;
}

const PCT_OPTIONS = [10, 15, 20, 25];

const KILL_SWITCHES = [
  { key: 'ai_kill_switch', label: 'Disable ALL AI' },
  { key: 'ai_disable_coaching', label: 'Disable AI coaching' },
  { key: 'ai_disable_challenge_reframe', label: 'Disable AI challenge' },
  { key: 'notifications_kill_switch', label: 'Disable notifications' },
];

export default function AdminClient({
  initial,
}: {
  initial: { stats: Stats; customers: Customer[]; flags: Flag[]; audit: Audit[]; budget: Budget };
}) {
  const [flags, setFlags] = useState<Flag[]>(initial.flags);
  const [customers, setCustomers] = useState<Customer[]>(initial.customers);
  const [budget, setBudget] = useState<Budget>(initial.budget);
  const { stats, audit } = initial;

  const flagOn = (key: string) => flags.find((f) => f.key === key)?.enabled ?? false;

  async function postFlag(key: string, enabled: boolean) {
    const res = await fetch('/api/admin/flags', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, enabled }),
    });
    return (await res.json()).ok as boolean;
  }

  async function toggleFlag(key: string, enabled: boolean) {
    if (await postFlag(key, enabled)) {
      setFlags((prev) => {
        const exists = prev.find((f) => f.key === key);
        if (exists) return prev.map((f) => (f.key === key ? { ...f, enabled } : f));
        return [...prev, { id: key, key, enabled, description: null }];
      });
    }
  }

  async function setBudgetPct(pct: number) {
    // Enable the chosen pct flag; disable all other pct flags so only one wins.
    for (const p of PCT_OPTIONS) {
      if (p !== pct) await postFlag(`ai_budget_pct_${p}`, false);
    }
    await postFlag(`ai_budget_pct_${pct}`, true);
    const cap = (pct / 100) * stats.revenue.pricePerCustomer;
    setBudget((b) => ({
      ...b,
      pct,
      perCustomerCapUsd: Math.round(cap * 100) / 100,
      poolCapUsd: Math.round(cap * b.activeCustomers * 100) / 100,
    }));
  }

  async function setBudgetEnabled(enabled: boolean) {
    // "disabled" flag is the inverse: enabling budget = clearing ai_budget_disabled.
    await postFlag('ai_budget_disabled', !enabled);
    setBudget((b) => ({ ...b, enabled }));
  }

  async function suspend(id: string, action: 'suspend' | 'unsuspend') {
    const res = await fetch(`/api/admin/customers/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
    if ((await res.json()).ok) {
      setCustomers((prev) => prev.map((c) => (c.id === id ? { ...c, state: action === 'suspend' ? 'suspended' : 'active' } : c)));
    }
  }

  return (
    <main className="mx-auto max-w-5xl px-5 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Owner dashboard</h1>
        <a href="/app" className="text-sm text-brand-600">Back to app</a>
      </div>

      {/* KPIs */}
      <section className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Kpi label="Customers" value={stats.customers.total} />
        <Kpi label="Active" value={stats.customers.active} />
        <Kpi label="Trialing" value={stats.customers.trialing} />
        <Kpi label="MRR" value={`$${stats.revenue.mrr}`} />
        <Kpi label="AI cost (today)" value={`$${stats.ai.costToday}`} />
        <Kpi label="AI cost (month)" value={`$${stats.ai.costMonth}`} />
        <Kpi label="Jobs pending" value={stats.jobs.pending} />
        <Kpi label="Jobs failed" value={stats.jobs.failed} tone={stats.jobs.failed > 0 ? 'bad' : undefined} />
      </section>

      {/* Unit economics */}
      <section className="card mt-4">
        <h2 className="font-semibold">Unit economics (per active customer / month)</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
          <div><div className="text-slate-500">Revenue</div><div className="font-semibold">${stats.unitEconomics.revenuePerCustomer}</div></div>
          <div><div className="text-slate-500">AI cost</div><div className="font-semibold">${stats.unitEconomics.aiCostPerCustomer}</div></div>
          <div><div className="text-slate-500">Payment fees</div><div className="font-semibold">${stats.unitEconomics.paymentFeePerCustomer}</div></div>
          <div><div className="text-slate-500">Gross margin</div><div className="font-semibold text-ok">${stats.unitEconomics.grossMarginPerCustomer}</div></div>
        </div>
      </section>

      {/* AI budget */}
      <section className="card mt-4">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold">AI budget</h2>
          <label className="flex items-center gap-2 text-sm">
            <span>{budget.enabled ? 'On' : 'Off'}</span>
            <input type="checkbox" checked={budget.enabled} onChange={(e) => setBudgetEnabled(e.target.checked)} />
          </label>
        </div>
        <p className="text-sm text-slate-500">
          Caps AI cost at a % of the ${stats.revenue.pricePerCustomer}/mo price — per customer and pooled. Changes apply live.
        </p>

        <div className="mt-3 flex items-center gap-3">
          <span className="text-sm text-slate-600">Cap %</span>
          <select
            className="input mt-0 w-24"
            value={budget.pct}
            disabled={!budget.enabled}
            onChange={(e) => setBudgetPct(Number(e.target.value))}
          >
            {PCT_OPTIONS.map((p) => <option key={p} value={p}>{p}%</option>)}
          </select>
          <span className="text-sm text-slate-500">
            = ${budget.perCustomerCapUsd}/customer · ${budget.poolCapUsd} pool ({budget.activeCustomers} active)
          </span>
        </div>

        <div className="mt-4">
          <div className="flex justify-between text-xs text-slate-500">
            <span>Pool used this month</span>
            <span>${budget.poolSpendUsd} of ${budget.poolCapUsd} ({budget.poolUsedPct}%)</span>
          </div>
          <div className="mt-1 h-3 w-full overflow-hidden rounded-full bg-slate-100">
            <div
              className={`h-full rounded-full ${budget.poolUsedPct >= 90 ? 'bg-bad' : budget.poolUsedPct >= 70 ? 'bg-warn' : 'bg-ok'}`}
              style={{ width: `${budget.poolUsedPct}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-400">
            At the cap, AI falls back to free built-in responses (app stays fully functional); resets at month start.
          </p>
        </div>
      </section>

      {/* Emergency controls */}
      <section className="card mt-4">
        <h2 className="font-semibold">Emergency controls</h2>
        <p className="text-sm text-slate-500">Take effect immediately — no redeploy.</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {KILL_SWITCHES.map((k) => (
            <label key={k.key} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
              <span>{k.label}</span>
              <input type="checkbox" checked={flagOn(k.key)} onChange={(e) => toggleFlag(k.key, e.target.checked)} />
            </label>
          ))}
        </div>
      </section>

      {/* Customers */}
      <section className="card mt-4 overflow-x-auto">
        <h2 className="font-semibold">Customers</h2>
        <table className="mt-3 w-full text-left text-sm">
          <thead className="text-slate-500">
            <tr><th className="py-1">Email</th><th>State</th><th>Sub</th><th>Goals</th><th>Commits</th><th></th></tr>
          </thead>
          <tbody>
            {customers.map((c) => (
              <tr key={c.id} className="border-t border-slate-100">
                <td className="py-2">{c.email}</td>
                <td>{c.state}</td>
                <td>{c.subscriptionStatus}</td>
                <td>{c.goals}</td>
                <td>{c.commitments}</td>
                <td className="text-right">
                  {c.state === 'suspended' ? (
                    <button className="text-xs text-brand-600" onClick={() => suspend(c.id, 'unsuspend')}>Unsuspend</button>
                  ) : (
                    <button className="text-xs text-bad" onClick={() => suspend(c.id, 'suspend')}>Suspend</button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {/* Audit */}
      <section className="card mt-4">
        <h2 className="font-semibold">Recent audit log</h2>
        <ul className="mt-2 space-y-1 text-sm text-slate-600">
          {audit.length === 0 && <li className="text-slate-400">No audit entries yet.</li>}
          {audit.map((a) => (
            <li key={a.id}>
              <span className="font-mono text-xs">{new Date(a.createdAt).toLocaleString()}</span> — {a.action} {a.target ? `(${a.target})` : ''}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

function Kpi({ label, value, tone }: { label: string; value: string | number; tone?: 'bad' }) {
  return (
    <div className="card">
      <div className="text-xs uppercase tracking-wide text-slate-500">{label}</div>
      <div className={`mt-1 text-2xl font-bold ${tone === 'bad' ? 'text-bad' : ''}`}>{value}</div>
    </div>
  );
}
