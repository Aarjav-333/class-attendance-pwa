'use client';

import Link from 'next/link';

import { ChevronRightIcon } from './Icons';
import { formatDateShort, formatRelativeDay } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { SessionSummary } from '@/types';

interface HistoryCardProps {
  session: SessionSummary;
}

/** One saved class on the History list. */
export function HistoryCard({ session }: HistoryCardProps) {
  const relative = formatRelativeDay(session.date);
  const showExactDate = relative === 'Today' || relative === 'Yesterday';
  const percentage = session.total > 0 ? Math.round((session.present / session.total) * 100) : 0;

  return (
    <Link
      href={`/history/${session.id}`}
      className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 transition-colors focus-ring tap hover:border-brand/40"
    >
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-bold">{relative}</span>
          {showExactDate ? (
            <span className="text-[13px] text-faint">{formatDateShort(session.date)}</span>
          ) : null}
        </div>

        <div className="mt-1 flex items-center gap-2 text-[14px] text-muted">
          <span className="rounded-md bg-brand-soft px-1.5 py-0.5 text-[13px] font-bold text-brand">
            {session.subjectCode}
          </span>
          <span>Hour {session.period}</span>
        </div>

        <div className="mt-2 flex items-center gap-2">
          <div className="h-1.5 w-full max-w-[140px] overflow-hidden rounded-full bg-line">
            <div
              className={cn('h-full rounded-full', percentage >= 75 ? 'bg-present' : 'bg-absent')}
              style={{ width: `${percentage}%` }}
            />
          </div>
          <span className="text-[13px] font-semibold tabular-nums text-muted">
            Present {session.present} / {session.total}
          </span>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {session.absent > 0 ? (
          <span className="rounded-full bg-absent-soft px-2 py-1 text-[12px] font-bold text-absent">
            {session.absent} absent
          </span>
        ) : (
          <span className="rounded-full bg-present-soft px-2 py-1 text-[12px] font-bold text-present">
            Full
          </span>
        )}
        <ChevronRightIcon className="text-faint" width={18} height={18} />
      </div>
    </Link>
  );
}
