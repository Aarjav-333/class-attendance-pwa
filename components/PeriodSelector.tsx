'use client';

import { PERIODS } from '@/lib/constants';
import { cn } from '@/lib/utils';

interface PeriodSelectorProps {
  value: number | null;
  onChange: (period: number) => void;
  periods?: number[];
  disabled?: boolean;
}

/**
 * Class hour picker. The list comes from lib/constants (NEXT_PUBLIC_PERIOD_COUNT),
 * so nothing about the number of hours is hard-coded in the UI.
 */
export function PeriodSelector({ value, onChange, periods = PERIODS, disabled }: PeriodSelectorProps) {
  return (
    <div
      className="grid gap-2"
      style={{ gridTemplateColumns: `repeat(${Math.min(periods.length, 6)}, minmax(0, 1fr))` }}
      role="group"
      aria-label="Class hour"
    >
      {periods.map((period) => {
        const selected = period === value;
        return (
          <button
            key={period}
            type="button"
            aria-pressed={selected}
            aria-label={`Hour ${period}`}
            disabled={disabled}
            onClick={() => onChange(period)}
            className={cn(
              'min-h-[48px] rounded-xl border text-[16px] font-bold transition-colors focus-ring tap',
              selected
                ? 'border-brand bg-brand text-brand-fg'
                : 'border-line bg-surface text-fg hover:border-brand/40',
              disabled && 'opacity-50',
            )}
          >
            {period}
          </button>
        );
      })}
    </div>
  );
}
