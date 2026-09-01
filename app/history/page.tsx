'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

import { HistoryCard } from '@/components/HistoryCard';
import { CrossIcon, HistoryIcon, SpinnerIcon } from '@/components/Icons';
import { PageHeader } from '@/components/PageHeader';
import { EmptyState, ErrorState, LinkButton, RequireSupabase } from '@/components/States';
import { useRoster } from '@/hooks/useRoster';
import { describeError, fetchSessionSummaries } from '@/lib/attendance';
import { cn } from '@/lib/utils';
import type { SessionSummary } from '@/types';

export default function HistoryPage() {
  return (
    <RequireSupabase>
      <HistoryScreen />
    </RequireSupabase>
  );
}

function HistoryScreen() {
  const { subjects } = useRoster();

  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState('');
  const [subjectFilter, setSubjectFilter] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSessionSummaries({
        date: dateFilter || null,
        subjectId: subjectFilter,
        limit: 200,
      });
      setSessions(data);
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setLoading(false);
    }
  }, [dateFilter, subjectFilter]);

  useEffect(() => {
    void load();
  }, [load]);

  const filtersActive = Boolean(dateFilter) || Boolean(subjectFilter);

  const totals = useMemo(() => {
    const present = sessions.reduce((sum, session) => sum + session.present, 0);
    const total = sessions.reduce((sum, session) => sum + session.total, 0);
    return { present, total };
  }, [sessions]);

  return (
    <main className="app-shell mx-auto flex w-full max-w-2xl flex-col">
      <PageHeader
        title="Attendance History"
        subtitle={
          loading
            ? 'Loading...'
            : `${sessions.length} session${sessions.length === 1 ? '' : 's'}${
                totals.total > 0 ? ` · ${totals.present}/${totals.total} present` : ''
              }`
        }
        backHref="/"
      />

      <div className="space-y-3 px-4 pt-3">
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFilter}
            aria-label="Filter by date"
            onChange={(event) => setDateFilter(event.target.value)}
            className="h-11 min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 text-[16px] font-medium focus-ring"
          />
          {filtersActive ? (
            <button
              type="button"
              onClick={() => {
                setDateFilter('');
                setSubjectFilter(null);
              }}
              className="btn-secondary h-11 min-h-0 shrink-0 px-3 text-[14px]"
            >
              <CrossIcon width={16} height={16} />
              Clear
            </button>
          ) : null}
        </div>

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
          <FilterChip label="All" active={subjectFilter === null} onClick={() => setSubjectFilter(null)} />
          {subjects.map((subject) => (
            <FilterChip
              key={subject.id}
              label={subject.code}
              active={subjectFilter === subject.id}
              onClick={() => setSubjectFilter(subjectFilter === subject.id ? null : subject.id)}
            />
          ))}
        </div>
      </div>

      <div className="flex-1 px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-3">
        {loading ? (
          <div className="flex items-center gap-2 rounded-2xl border border-line bg-surface px-4 py-4 text-[15px] text-muted">
            <SpinnerIcon width={18} height={18} />
            Loading attendance history...
          </div>
        ) : error ? (
          <ErrorState message={error} onRetry={() => void load()} />
        ) : sessions.length === 0 ? (
          <EmptyState
            title={filtersActive ? 'Nothing matches those filters' : 'No attendance saved yet'}
            description={
              filtersActive
                ? 'Try a different date or subject.'
                : 'Attendance you save will appear here, newest first.'
            }
            icon={<HistoryIcon width={22} height={22} />}
            action={filtersActive ? null : <LinkButton href="/attendance">Mark attendance</LinkButton>}
          />
        ) : (
          <ul className="space-y-2">
            {sessions.map((session) => (
              <li key={session.id}>
                <HistoryCard session={session} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}

function FilterChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-10 shrink-0 rounded-xl border px-4 text-[14px] font-bold transition-colors focus-ring tap',
        active ? 'border-brand bg-brand text-brand-fg' : 'border-line bg-surface text-muted',
      )}
    >
      {label}
    </button>
  );
}
