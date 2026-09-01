'use client';

import { memo } from 'react';

import { CheckIcon, CrossIcon } from './Icons';
import { formatRoll } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AttendanceStatus, Student } from '@/types';

interface StudentAttendanceRowProps {
  student: Student;
  status: AttendanceStatus;
  /** The status this student would have if untouched in the current mode. */
  defaultStatus: AttendanceStatus;
  onToggle: (studentId: string) => void;
  disabled?: boolean;
}

/**
 * One tappable student row.
 *
 * Memoised on purpose: with 57 rows on screen, tapping one student must only
 * re-render that row. Status is conveyed by colour, icon AND text so it never
 * relies on colour alone.
 */
function StudentAttendanceRowComponent({
  student,
  status,
  defaultStatus,
  onToggle,
  disabled,
}: StudentAttendanceRowProps) {
  const present = status === 'PRESENT';
  const touched = status !== defaultStatus;

  return (
    <button
      type="button"
      role="switch"
      aria-checked={present}
      aria-label={`Roll ${student.rollNumber}, ${student.name}, currently ${present ? 'present' : 'absent'}`}
      disabled={disabled}
      onClick={() => onToggle(student.id)}
      className={cn(
        'flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left transition-colors duration-100 focus-ring active:scale-[0.99]',
        'min-h-[52px]',
        present
          ? touched
            ? 'border-present bg-present-soft'
            : 'border-line bg-surface'
          : touched
            ? 'border-absent bg-absent-soft'
            : 'border-line bg-surface',
        disabled && 'opacity-60',
      )}
    >
      <span
        className={cn(
          'w-9 shrink-0 text-center text-[15px] font-bold tabular-nums',
          touched ? (present ? 'text-present' : 'text-absent') : 'text-faint',
        )}
      >
        {formatRoll(student.rollNumber)}
      </span>

      <span
        className={cn(
          'min-w-0 flex-1 truncate text-[15.5px] font-semibold leading-tight',
          !present && touched ? 'text-absent' : 'text-fg',
        )}
      >
        {student.name}
      </span>

      <span
        className={cn(
          'flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold uppercase tracking-wide',
          present
            ? touched
              ? 'bg-present text-white'
              : 'bg-present-soft text-present'
            : touched
              ? 'bg-absent text-white'
              : 'bg-absent-soft text-absent',
        )}
      >
        {present ? <CheckIcon width={14} height={14} /> : <CrossIcon width={14} height={14} />}
        {present ? 'Present' : 'Absent'}
      </span>
    </button>
  );
}

export const StudentAttendanceRow = memo(StudentAttendanceRowComponent);
