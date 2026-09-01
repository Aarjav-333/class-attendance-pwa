'use client';

import Link from 'next/link';
import { useEffect, useState, type ReactNode } from 'react';

import { AlertIcon, OfflineIcon, RefreshIcon, SpinnerIcon } from './Icons';
import { isSupabaseConfigured } from '@/lib/supabase/client';

/** Centred spinner for first loads. */
export function LoadingState({ label = 'Loading...' }: { label?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-16 text-muted">
      <SpinnerIcon width={28} height={28} />
      <p className="text-[15px]">{label}</p>
    </div>
  );
}

/** Nothing-here state with an optional action. */
export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
      <div className="mb-1 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">
        {icon ?? <AlertIcon width={22} height={22} />}
      </div>
      <h2 className="text-[17px] font-bold">{title}</h2>
      {description ? <p className="max-w-xs text-[15px] text-muted">{description}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}

/** Recoverable failure with a retry button. */
export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="mx-4 my-6 rounded-2xl border border-absent/25 bg-absent-soft px-4 py-4">
      <div className="flex items-start gap-3">
        <AlertIcon className="mt-0.5 shrink-0 text-absent" width={20} height={20} />
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold text-absent">Something went wrong</p>
          <p className="mt-1 break-words text-[14px] text-absent/90">{message}</p>
          {onRetry ? (
            <button type="button" onClick={onRetry} className="btn-secondary mt-3 h-10 min-h-0 px-3 text-[14px]">
              <RefreshIcon width={16} height={16} />
              Try again
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/** Shown instead of the app when the Supabase env vars are missing. */
export function SetupNotice() {
  return (
    <div className="mx-4 my-6 rounded-2xl border border-line bg-surface px-4 py-5">
      <h2 className="text-[17px] font-bold">Finish the Supabase setup</h2>
      <p className="mt-1.5 text-[15px] text-muted">
        The app cannot reach a database yet. Create <code className="font-mono text-[13px]">.env.local</code>{' '}
        in the project root with:
      </p>
      <pre className="mt-3 overflow-x-auto rounded-xl bg-bg px-3 py-3 font-mono text-[12.5px] leading-relaxed text-muted">
{`NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key`}
      </pre>
      <p className="mt-3 text-[14px] text-muted">
        Run <code className="font-mono text-[13px]">supabase/setup.sql</code> in the Supabase SQL editor
        first, then restart the dev server. Full steps are in the README.
      </p>
    </div>
  );
}

/** Wraps a screen so it degrades gracefully before Supabase is configured. */
export function RequireSupabase({ children }: { children: ReactNode }) {
  if (!isSupabaseConfigured) return <SetupNotice />;
  return <>{children}</>;
}

/** Slim banner shown while the device reports no connection. */
export function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    const update = () => setOffline(!navigator.onLine);
    update();

    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;

  return (
    <div className="flex items-center gap-2 bg-absent px-4 py-2 text-[13px] font-semibold text-white">
      <OfflineIcon width={16} height={16} />
      Offline - marks are kept on this device until you save.
    </div>
  );
}

/** Simple text link styled as a secondary button. */
export function LinkButton({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} className="btn-secondary px-4">
      {children}
    </Link>
  );
}
