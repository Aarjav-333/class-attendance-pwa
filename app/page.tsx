'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { HistoryCard } from '@/components/HistoryCard';
import {
  CheckIcon,
  HistoryIcon,
  LogoutIcon,
  SpinnerIcon,
  UsersIcon,
} from '@/components/Icons';
import { ErrorState, RequireSupabase } from '@/components/States';
import { describeError, fetchSessionSummaries } from '@/lib/attendance';
import { APP_LONG_NAME } from '@/lib/constants';
import { formatDateLong, formatWeekday, todayISO } from '@/lib/format';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';
import type { SessionSummary } from '@/types';

export default function DashboardPage() {
  return (
    <main className="app-shell mx-auto w-full max-w-2xl px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-[max(env(safe-area-inset-top),1rem)]">
      <RequireSupabase>
        <Dashboard />
      </RequireSupabase>
    </main>
  );
}

function Dashboard() {
  const router = useRouter();
  const today = todayISO();

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSessionSummaries({ date: today, limit: 12 });
      setSessions(data);
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setLoading(false);
    }
  }, [today]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await getSupabaseClient().auth.signOut();
      router.replace('/login');
      router.refresh();
    } catch {
      setSigningOut(false);
    }
  }

  return (
    <>
      <header className="flex items-start justify-between gap-3 pb-6 pt-2">
        <div className="min-w-0">
          <p className="text-[13px] font-semibold uppercase tracking-wide text-faint">
            {formatWeekday(today)}
          </p>
          <h1 className="mt-0.5 text-[26px] font-bold leading-tight tracking-tight">
            {APP_LONG_NAME}
          </h1>
          <p className="mt-0.5 text-[15px] text-muted">{formatDateLong(today)}</p>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          aria-label="Sign out"
          disabled={signingOut}
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-muted focus-ring tap"
        >
          {signingOut ? <SpinnerIcon width={18} height={18} /> : <LogoutIcon width={18} height={18} />}
        </button>
      </header>

      <nav className="space-y-3">
        <Link
          href="/attendance"
          className="flex items-center gap-4 rounded-3xl bg-brand px-5 py-5 text-brand-fg transition-transform focus-ring tap"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15">
            <CheckIcon width={26} height={26} />
          </span>
          <span className="min-w-0">
            <span className="block text-[19px] font-bold tracking-tight">MARK ATTENDANCE</span>
            <span className="block text-[14px] opacity-85">Subject, hour, then tap the students</span>
          </span>
        </Link>

        <Link
          href="/history"
          className="flex items-center gap-4 rounded-3xl border border-line bg-surface px-5 py-5 transition-colors focus-ring tap hover:border-brand/40"
        >
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-brand-soft text-brand">
            <HistoryIcon width={24} height={24} />
          </span>
          <span className="min-w-0">
            <span className="block text-[19px] font-bold tracking-tight">ATTENDANCE HISTORY</span>
            <span className="block text-[14px] text-muted">View, edit and export past classes</span>
          </span>
        </Link>
      </nav>

      <section className="mt-8">
        <div className="mb-2.5 flex items-center justify-between px-1">
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-faint">
            Today&apos;s attendance
          </h2>
          {sessions.length > 0 ? (
            <Link href="/history" className="text-[13px] font-semibold text-brand focus-ring">
              See all
            </Link>
          ) : null}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-4 text-[15px] text-muted">
            <SpinnerIcon width={18} height={18} />
            Loading today&apos;s classes...
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : sessions.length === 0 ? (
          <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line bg-surface px-4 py-5">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-bg text-faint">
              <UsersIcon width={20} height={20} />
            </span>
            <p className="text-[15px] text-muted">
              No attendance saved today yet. Tap <strong className="text-fg">Mark Attendance</strong> to
              start.
            </p>
          </div>
        ) : (
          <ul className="space-y-2">
            {sessions.map((session) => (
              <li key={session.id}>
                <HistoryCard session={session} />
              </li>
            ))}
          </ul>
        )}
      </section>

      {!isSupabaseConfigured ? null : (
        <p className="mt-10 text-center text-[12.5px] text-faint">
          Add to Home Screen from Safari for the full-screen app.
        </p>
      )}
    </>
  );
}
