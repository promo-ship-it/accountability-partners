'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function SignupPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const res = await fetch('/api/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, timezone: tz }),
    });
    const json = await res.json();
    setLoading(false);
    if (!json.ok) return setError(json.error);
    router.push(json.data.next);
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-5">
      <h1 className="text-2xl font-bold">Start your 7-day free trial</h1>
      <p className="mt-1 text-sm text-slate-600">No charge today. Cancel anytime.</p>
      <form onSubmit={submit} className="card mt-6 space-y-4">
        <div>
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" required className="input" value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div>
          <label className="label" htmlFor="password">Password</label>
          <input id="password" type="password" required minLength={8} className="input" value={password} onChange={(e) => setPassword(e.target.value)} />
          <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
        </div>
        {error && <p className="text-sm text-bad">{error}</p>}
        <button className="btn-primary w-full" disabled={loading}>
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-slate-600">
        Already have an account?{' '}
        <Link href="/login" className="font-medium text-brand-600">Log in</Link>
      </p>
    </main>
  );
}
