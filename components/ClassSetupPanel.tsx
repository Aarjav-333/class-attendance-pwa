'use client';

import { DateField } from './DateField';
import { PeriodSelector } from './PeriodSelector';
import { SubjectSelector } from './SubjectSelector';
import { CalendarIcon, ChevronRightIcon } from './Icons';
import { formatDateShort } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { Subject } from '@/types';

interface ClassSetupPanelProps {
  date: string;
  subjectId: string | null;
  period: number | null;
  subjects: Subject[];
  expanded: boolean;
  disabled?: boolean;
  onDateChange: (date: string) => void;
  onSubjectChange: (subjectId: string) => void;
  onPeriodChange: (period: number) => void;
  onExpandedChange: (expanded: boolean) => void;
}

/**
 * Date + subject + hour, i.e. the three things that identify a class.
 * Collapses to a single line once chosen so the student list gets the screen.
 */
export function ClassSetupPanel({
  date,
  subjectId,
  period,
  subjects,
  expanded,
  disabled,
  onDateChange,
  onSubjectChange,
  onPeriodChange,
  onExpandedChange,
}: ClassSetupPanelProps) {
  const subject = subjects.find((item) => item.id === subjectId) ?? null;
  const complete = Boolean(subject) && period !== null;

  if (!expanded && complete) {
    return (
      <button
        type="button"
        onClick={() => onExpandedChange(true)}
        className="flex w-full items-center gap-3 rounded-2xl border border-line bg-surface px-4 py-3 text-left focus-ring tap"
      >
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">
          <CalendarIcon width={18} height={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[15px] font-bold">
            {subject?.code} - Hour {period}
          </span>
          <span className="block truncate text-[13px] text-muted">{formatDateShort(date)}</span>
        </span>
        <span className="shrink-0 text-[13px] font-semibold text-brand">Change</span>
        <ChevronRightIcon className="shrink-0 text-faint" width={16} height={16} />
      </button>
    );
  }

  return (
    <div className={cn('card space-y-3 p-3', disabled && 'opacity-70')}>
      <Field label="Date">
        <DateField value={date} onChange={onDateChange} disabled={disabled} />
      </Field>

      <Field label="Subject">
        <SubjectSelector
          subjects={subjects}
          value={subjectId}
          onChange={onSubjectChange}
          disabled={disabled}
        />
      </Field>

      <Field label="Hour">
        <PeriodSelector value={period} onChange={onPeriodChange} disabled={disabled} />
      </Field>

      {complete ? (
        <button
          type="button"
          onClick={() => onExpandedChange(false)}
          className="btn-ghost h-10 min-h-0 w-full text-[14px]"
        >
          Done
        </button>
      ) : null}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1.5 px-1 text-[12px] font-bold uppercase tracking-wide text-faint">{label}</p>
      {children}
    </div>
  );
}
