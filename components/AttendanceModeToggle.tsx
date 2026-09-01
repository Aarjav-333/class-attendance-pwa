'use client';

import { CheckIcon, CrossIcon } from './Icons';
import { cn } from '@/lib/utils';
import type { MarkingMode } from '@/types';

interface AttendanceModeToggleProps {
  mode: MarkingMode;
  onChange: (mode: MarkingMode) => void;
  disabled?: boolean;
}

const OPTIONS: { value: MarkingMode; label: string; hint: string }[] = [
  { value: 'MARK_ABSENT', label: 'Mark Absent', hint: 'Everyone starts present. Tap the absentees.' },
  { value: 'MARK_PRESENT', label: 'Mark Present', hint: 'Everyone starts absent. Tap who is here.' },
];

/** The segmented control that decides which way round attendance is marked. */
export function AttendanceModeToggle({ mode, onChange, disabled }: AttendanceModeToggleProps) {
  const active = OPTIONS.find((option) => option.value === mode) ?? OPTIONS[0];

  return (
    <div>
      <div className="segmented grid-cols-2" role="group" aria-label="Attendance marking mode">
        {OPTIONS.map((option) => {
          const selected = option.value === mode;
          const Glyph = option.value === 'MARK_ABSENT' ? CrossIcon : CheckIcon;

          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              disabled={disabled}
              onClick={() => onChange(option.value)}
              className={cn(
                'flex min-h-[46px] items-center justify-center gap-1.5 rounded-xl text-[15px] font-semibold transition-colors focus-ring tap',
                selected
                  ? option.value === 'MARK_ABSENT'
                    ? 'bg-absent text-white'
                    : 'bg-present text-white'
                  : 'text-muted hover:text-fg',
                disabled && 'opacity-50',
              )}
            >
              <Glyph width={17} height={17} />
              {option.label}
            </button>
          );
        })}
      </div>

      <p className="mt-1.5 px-1 text-[13px] leading-snug text-faint">{active.hint}</p>
    </div>
  );
}
