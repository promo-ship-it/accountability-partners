import Link from 'next/link';
import { PRICE_USD, TRIAL_DAYS } from '@/modules/billing/trial';
import { brand } from '@/lib/brand';

export default function LandingPage() {
  return (
    <main className="mx-auto max-w-5xl px-5">
      <header className="flex items-center justify-between py-6">
        <span className="text-lg font-bold text-brand-700">{brand.name}</span>
        <nav className="flex items-center gap-3 text-sm">
          <Link href="/login" className="font-medium text-slate-600 hover:text-ink">
            Log in
          </Link>
          <Link href="/signup" className="btn-primary">
            Start free trial
          </Link>
        </nav>
      </header>

      <section className="py-14 text-center">
        <p className="mb-3 text-sm font-semibold uppercase tracking-wide text-brand-600">
          AI-powered goal achievement
        </p>
        <h1 className="mx-auto max-w-3xl text-4xl font-extrabold leading-tight sm:text-5xl">
          Build the discipline to actually reach your goals.
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
          Most people don&apos;t fail for lack of a goal — they fail for lack of consistent
          follow-through. Your AI accountability partner understands your barriers, keeps you
          accountable, and adapts as you go.
        </p>
        <div className="mt-8 flex items-center justify-center gap-3">
          <Link href="/signup" className="btn-primary px-6 py-3 text-base">
            Start your {TRIAL_DAYS}-day free trial
          </Link>
          <Link href="/login" className="btn-ghost px-6 py-3 text-base">
            I have an account
          </Link>
        </div>
        <p className="mt-3 text-sm text-slate-500">
          Then ${PRICE_USD}/month. Cancel anytime. Fitness &amp; wellness goals to start.
        </p>
      </section>

      <section className="grid gap-4 pb-14 sm:grid-cols-3">
        {[
          {
            title: 'AI accountability',
            body: 'Daily check-ins that adapt to you — supportive when you need it, direct when it helps.',
          },
          {
            title: 'Progress tracking',
            body: 'See the goal, the next action, and real momentum — without a wall of charts.',
          },
          {
            title: 'AI coaching',
            body: 'When you miss, your partner investigates the real barrier and helps you adapt.',
          },
        ].map((f) => (
          <div key={f.title} className="card">
            <h3 className="font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-slate-600">{f.body}</p>
          </div>
        ))}
      </section>

      <section className="card mb-16">
        <h2 className="text-xl font-bold">How it works</h2>
        <ol className="mt-4 grid gap-3 text-sm text-slate-700 sm:grid-cols-2">
          <li>1. Define a meaningful goal and why it matters.</li>
          <li>2. Make a realistic commitment you actually own.</li>
          <li>3. Take action and check in.</li>
          <li>4. Get held accountable — and challenged when the evidence supports it.</li>
          <li>5. Discover the barriers that keep stopping you.</li>
          <li>6. Adapt, repeat, and build the discipline muscle.</li>
        </ol>
      </section>

      <footer className="border-t border-slate-200 py-8 text-center text-sm text-slate-500">
        <p>
          {brand.name} is a wellness coaching tool, not a medical service. It does not
          diagnose or treat conditions.
        </p>
        <p className="mt-2">© {new Date().getFullYear()} {brand.name}</p>
      </footer>
    </main>
  );
}
