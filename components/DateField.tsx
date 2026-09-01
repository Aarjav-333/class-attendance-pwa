'use client';

import { ChevronLeftIcon, ChevronRightIcon } from './Icons';
import { formatWeekday, shiftISODate, todayISO } from '@/lib/format';
import { cn } from '@/lib/utils';

interface DateFieldProps {
  value: string;
  onChange: (date: string) => void;
  disabled?: boolean;
}

/** Date input that defaults to today, with one-tap day stepping. */
export function DateField({ value, onChange, disabled }: DateFieldProps) {
  const isToday = value === todayISO();

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        aria-label="Previous day"
        disabled={disabled}
        onClick={() => onChange(shiftISODate(value, -1))}
        className="btn-secondary w-12 shrink-0 px-0"
      >
        <ChevronLeftIcon />
      </button>

      <div className="relative min-w-0 flex-1">
        <input
          type="date"
          value={value}
          disabled={disabled}
          aria-label="Attendance date"
          onChange={(event) => {
            if (event.target.value) onChange(event.target.value);
          }}
          className={cn(
            'h-12 w-full rounded-xl border border-line bg-surface px-3 text-[16px] font-semibold text-fg focus-ring',
            disabled && 'opacity-50',
          )}
        />
      </div>

      <button
        type="button"
        aria-label="Next day"
        disabled={disabled}
        onClick={() => onChange(shiftISODate(value, 1))}
        className="btn-secondary w-12 shrink-0 px-0"
      >
        <ChevronRightIcon />
      </button>

      {!isToday ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => onChange(todayISO())}
          className="btn-secondary shrink-0 px-3 text-[14px]"
        >
          Today
        </button>
      ) : (
        <span className="shrink-0 rounded-lg bg-brand-soft px-2.5 py-1.5 text-[13px] font-semibold text-brand">
          {formatWeekday(value).slice(0, 3)}
        </span>
      )}
    </div>
  );
}
