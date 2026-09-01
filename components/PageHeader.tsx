'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';

import { ChevronLeftIcon } from './Icons';

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  backHref?: string;
  onBack?: () => void;
  actions?: ReactNode;
  /** Extra content pinned under the title, e.g. the live counter. */
  children?: ReactNode;
}

/** Sticky top bar that respects the iPhone status-bar safe area. */
export function PageHeader({
  title,
  subtitle,
  backHref,
  onBack,
  actions,
  children,
}: PageHeaderProps) {
  const backButtonClasses =
    'flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-line bg-surface text-fg focus-ring tap';

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/90 pt-[max(env(safe-area-inset-top),0.5rem)] backdrop-blur">
      <div className="flex items-center gap-3 px-4 pb-3 pt-1">
        {onBack ? (
          <button type="button" onClick={onBack} aria-label="Go back" className={backButtonClasses}>
            <ChevronLeftIcon />
          </button>
        ) : backHref ? (
          <Link href={backHref} aria-label="Go back" className={backButtonClasses}>
            <ChevronLeftIcon />
          </Link>
        ) : null}

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[19px] font-bold leading-tight tracking-tight">{title}</h1>
          {subtitle ? (
            <div className="truncate text-[13px] font-medium text-muted">{subtitle}</div>
          ) : null}
        </div>

        {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
      </div>

      {children ? <div className="px-4 pb-2.5">{children}</div> : null}
    </header>
  );
}
