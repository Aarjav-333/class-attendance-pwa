'use client';

import { CheckIcon, CrossIcon } from './Icons';
import { formatRollList } from '@/lib/export';
import { formatRoll } from '@/lib/format';
import { cn } from '@/lib/utils';
import type { AttendanceCounts, AttendanceStatus, SessionStudentStatus } from '@/types';

interface AttendanceSummaryProps {
  entries: SessionStudentStatus[];
  counts: AttendanceCounts;
  /** `full` shows both name lists; `compact` is used inside the save sheet. */
  variant?: 'full' | 'compact';
}

/** Present / absent breakdown shared by the detail screen and the save sheet. */
export function AttendanceSummary({ entries, counts, variant = 'full' }: AttendanceSummaryProps) {
  const present = entries.filter((entry) => entry.status === 'PRESENT');
  const absent = entries.filter((entry) => entry.status === 'ABSENT');

  if (variant === 'compact') {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-present/25 bg-present-soft px-3 py-2.5">
            <div className="text-[24px] font-bold leading-none tabular-nums text-present">
              {counts.present}
            </div>
            <div className="mt-1 text-[12px] font-semibold uppercase tracking-wide text-present/80">
              Present
            </div>
          </div>
          <div className="rounded-xl border border-absent/25 bg-absent-soft px-3 py-2.5">
            <div className="text-[24px] font-bold leading-none tabular-nums text-absent">
              {counts.absent}
            </div>
            <div className="mt-1 text-[12px] font-semibold uppercase tracking-wide text-absent/80">
              Absent
            </div>
          </div>
        </div>

        {absent.length > 0 ? (
          <div className="rounded-xl border border-line bg-bg px-3 py-2.5">
            <p className="text-[12px] font-semibold uppercase tracking-wide text-faint">
              Absent roll numbers
            </p>
            <p className="mt-1 text-[14px] font-semibold leading-snug tabular-nums text-fg">
              {formatRollList(entries, 'ABSENT')}
            </p>
          </div>
        ) : (
          <p className="rounded-xl border border-line bg-bg px-3 py-2.5 text-[14px] text-muted">
            Full attendance - nobody is marked absent.
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <StudentList title="Present Students" status="PRESENT" entries={present} />
      <StudentList title="Absent Students" status="ABSENT" entries={absent} />
    </div>
  );
}

function StudentList({
  title,
  status,
  entries,
}: {
  title: string;
  status: AttendanceStatus;
  entries: SessionStudentStatus[];
}) {
  const isPresent = status === 'PRESENT';

  return (
    <section className="card overflow-hidden">
      <header
        className={cn(
          'flex items-center gap-2 border-b px-4 py-3',
          isPresent ? 'border-present/20 bg-present-soft' : 'border-absent/20 bg-absent-soft',
        )}
      >
        <span
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full text-white',
            isPresent ? 'bg-present' : 'bg-absent',
          )}
        >
          {isPresent ? <CheckIcon width={14} height={14} /> : <CrossIcon width={14} height={14} />}
        </span>
        <h3
          className={cn(
            'text-[13px] font-bold uppercase tracking-wide',
            isPresent ? 'text-present' : 'text-absent',
          )}
        >
          {title}
        </h3>
        <span
          className={cn(
            'ml-auto text-[15px] font-bold tabular-nums',
            isPresent ? 'text-present' : 'text-absent',
          )}
        >
          {entries.length}
        </span>
      </header>

      {entries.length === 0 ? (
        <p className="px-4 py-4 text-[15px] text-muted">No students in this list.</p>
      ) : (
        <ul className="divide-y divide-line">
          {entries.map((entry) => (
            <li key={entry.student.id} className="flex items-center gap-3 px-4 py-2.5">
              <span className="w-8 shrink-0 text-[14px] font-bold tabular-nums text-faint">
                {formatRoll(entry.student.rollNumber)}
              </span>
              <span className="min-w-0 flex-1 truncate text-[15px] font-medium">
                {entry.student.name}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
