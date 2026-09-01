'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';

import { AlertIcon, CheckIcon, SpinnerIcon } from '@/components/Icons';
import { LoadingState, SetupNotice } from '@/components/States';
import { APP_LONG_NAME } from '@/lib/constants';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get('next') ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting) return;

    setSubmitting(true);
    setError(null);

    try {
      const supabase = getSupabaseClient();
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (signInError) {
        setError(
          signInError.message === 'Invalid login credentials'
            ? 'Incorrect email or password.'
            : signInError.message,
        );
        return;
      }

      // Full navigation so the middleware sees the fresh auth cookie.
      router.replace(nextPath.startsWith('/') ? nextPath : '/');
      router.refresh();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Sign in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <label htmlFor="email" className="mb-1.5 block text-[14px] font-semibold text-muted">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          inputMode="email"
          autoCapitalize="none"
          autoCorrect="off"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="h-12 w-full rounded-xl border border-line bg-surface px-3 text-[16px] focus-ring"
          placeholder="teacher@school.edu"
        />
      </div>

      <div>
        <label htmlFor="password" className="mb-1.5 block text-[14px] font-semibold text-muted">
          Password
        </label>
        <input
          id="password"
          type="password"
          required
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-12 w-full rounded-xl border border-line bg-surface px-3 text-[16px] focus-ring"
          placeholder="Your password"
        />
      </div>

      {error ? (
        <p className="flex items-start gap-2 rounded-xl border border-absent/25 bg-absent-soft px-3 py-2.5 text-[14px] font-medium text-absent">
          <AlertIcon className="mt-0.5 shrink-0" width={16} height={16} />
          {error}
        </p>
      ) : null}

      <button type="submit" disabled={submitting} className="btn-primary w-full">
        {submitting ? <SpinnerIcon width={18} height={18} /> : null}
        {submitting ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <main className="app-shell flex flex-col items-center justify-center px-5 pb-[max(env(safe-area-inset-bottom),1rem)] pt-[max(env(safe-area-inset-top),1rem)]">
      <div className="w-full max-w-sm">
        <div className="mb-6 text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand text-brand-fg">
            <CheckIcon width={28} height={28} />
          </div>
          <h1 className="text-[24px] font-bold tracking-tight">{APP_LONG_NAME}</h1>
          <p className="mt-1 text-[15px] text-muted">Sign in to mark attendance.</p>
        </div>

        {isSupabaseConfigured ? (
          <Suspense fallback={<LoadingState label="Preparing sign in..." />}>
            <LoginForm />
          </Suspense>
        ) : (
          <SetupNotice />
        )}

        <p className="mt-6 text-center text-[13px] leading-relaxed text-faint">
          Teacher accounts are created in the Supabase dashboard
          <br />
          (Authentication - Users - Add user).
        </p>
      </div>
    </main>
  );
}
