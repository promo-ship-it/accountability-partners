'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

const STYLES = [
  ['supportive', 'Supportive — warm and encouraging'],
  ['encouraging', 'Encouraging — upbeat and positive'],
  ['direct', 'Direct — clear and to the point'],
  ['challenging', 'Challenging — pushes me when I slip'],
  ['structured', 'Structured — routines and specifics'],
  ['reflective', 'Reflective — asks me to think'],
  ['firm', 'Firm — holds a hard line'],
];

const CATEGORIES = ['fitness', 'weight', 'strength', 'activity', 'nutrition', 'wellness', 'habit'];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [form, setForm] = useState({
    displayName: '',
    goalStatement: '',
    whyItMatters: '',
    category: 'fitness',
    baseline: '',
    target: '',
    targetDate: '',
    accountabilityStyle: 'supportive',
    availabilityNotes: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  function set<K extends keyof typeof form>(k: K, v: string) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function finish() {
    setLoading(true);
    setError(null);
    const res = await fetch('/api/onboarding', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    setLoading(false);
    if (!json.ok) return setError(json.error);
    router.push(json.data.next);
  }

  return (
    <main className="mx-auto max-w-lg px-5 py-10">
      <p className="text-sm font-semibold text-brand-600">Step {step} of 3</p>
      <h1 className="mt-1 text-2xl font-bold">Let&apos;s set you up</h1>
      <p className="mt-1 text-sm text-slate-600">This takes under two minutes. We&apos;ll learn more as we go.</p>

      <div className="card mt-6 space-y-4">
        {step === 1 && (
          <>
            <div>
              <label className="label">What should we call you?</label>
              <input className="input" value={form.displayName} onChange={(e) => set('displayName', e.target.value)} placeholder="First name" />
            </div>
            <div>
              <label className="label">What&apos;s your main goal?</label>
              <input className="input" value={form.goalStatement} onChange={(e) => set('goalStatement', e.target.value)} placeholder="e.g. Run a 5K without stopping" />
            </div>
            <div>
              <label className="label">Category</label>
              <select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button className="btn-primary w-full" onClick={() => form.goalStatement.length >= 3 ? setStep(2) : setError('Describe your goal first.')}>Continue</button>
          </>
        )}

        {step === 2 && (
          <>
            <div>
              <label className="label">Why does this matter to you?</label>
              <textarea className="input" rows={3} value={form.whyItMatters} onChange={(e) => set('whyItMatters', e.target.value)} placeholder="The reason behind the goal keeps you going." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label">Starting point</label>
                <input className="input" value={form.baseline} onChange={(e) => set('baseline', e.target.value)} placeholder="e.g. 0 min run" />
              </div>
              <div>
                <label className="label">Target</label>
                <input className="input" value={form.target} onChange={(e) => set('target', e.target.value)} placeholder="e.g. 30 min run" />
              </div>
            </div>
            <div>
              <label className="label">Target date (optional)</label>
              <input type="date" className="input" value={form.targetDate} onChange={(e) => set('targetDate', e.target.value)} />
            </div>
            <div className="flex gap-3">
              <button className="btn-ghost w-full" onClick={() => setStep(1)}>Back</button>
              <button className="btn-primary w-full" onClick={() => setStep(3)}>Continue</button>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <div>
              <label className="label">How do you want to be held accountable?</label>
              <select className="input" value={form.accountabilityStyle} onChange={(e) => set('accountabilityStyle', e.target.value)}>
                {STYLES.map(([v, label]) => <option key={v} value={v}>{label}</option>)}
              </select>
              <p className="mt-1 text-xs text-slate-500">We&apos;ll adapt this over time based on what actually works for you.</p>
            </div>
            <div>
              <label className="label">When are you most likely to follow through? (optional)</label>
              <input className="input" value={form.availabilityNotes} onChange={(e) => set('availabilityNotes', e.target.value)} placeholder="e.g. mornings before work" />
            </div>
            {error && <p className="text-sm text-bad">{error}</p>}
            <div className="flex gap-3">
              <button className="btn-ghost w-full" onClick={() => setStep(2)}>Back</button>
              <button className="btn-primary w-full" disabled={loading} onClick={finish}>
                {loading ? 'Setting up…' : 'Start'}
              </button>
            </div>
          </>
        )}
        {step === 1 && error && <p className="text-sm text-bad">{error}</p>}
      </div>
    </main>
  );
}
