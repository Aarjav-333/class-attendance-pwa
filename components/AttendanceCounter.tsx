'use client';

import { cn } from '@/lib/utils';
import type { AttendanceCounts } from '@/types';

interface AttendanceCounterProps {
  counts: AttendanceCounts;
  className?: string;
  /** `compact` fits the sticky header, `cards` is the roomier block layout. */
  variant?: 'compact' | 'cards';
}

/** Live present/absent tally. Values come from local state, so they never lag. */
export function AttendanceCounter({ counts, className, variant = 'compact' }: AttendanceCounterProps) {
  if (variant === 'cards') {
    return (
      <div className={cn('grid grid-cols-3 gap-2', className)}>
        <Stat label="Total" value={counts.total} tone="neutral" />
        <Stat label="Present" value={counts.present} tone="present" />
        <Stat label="Absent" value={counts.absent} tone="absent" />
      </div>
    );
  }

  return (
    <div className={cn('flex items-center gap-3 text-[13px] font-semibold tabular-nums', className)}>
      <span className="flex items-center gap-1.5 text-present">
        <span className="h-2 w-2 rounded-full bg-present" aria-hidden="true" />
        {counts.present} Present
      </span>
      <span className="flex items-center gap-1.5 text-absent">
        <span className="h-2 w-2 rounded-full bg-absent" aria-hidden="true" />
        {counts.absent} Absent
      </span>
      <span className="ml-auto text-faint">Total {counts.total}</span>
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: 'neutral' | 'present' | 'absent';
}) {
  return (
    <div
      className={cn(
        'rounded-2xl border px-3 py-2.5',
        tone === 'present'
          ? 'border-present/25 bg-present-soft'
          : tone === 'absent'
            ? 'border-absent/25 bg-absent-soft'
            : 'border-line bg-surface',
      )}
    >
      <div
        className={cn(
          'text-[22px] font-bold leading-none tabular-nums',
          tone === 'present' ? 'text-present' : tone === 'absent' ? 'text-absent' : 'text-fg',
        )}
      >
        {value}
      </div>
      <div
        className={cn(
          'mt-1 text-[12px] font-semibold uppercase tracking-wide',
          tone === 'present' ? 'text-present/80' : tone === 'absent' ? 'text-absent/80' : 'text-faint',
        )}
      >
        {label}
      </div>
    </div>
  );
}
