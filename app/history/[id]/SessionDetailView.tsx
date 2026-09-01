'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { AttendanceCounter } from '@/components/AttendanceCounter';
import { AttendanceSummary } from '@/components/AttendanceSummary';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ExportButton } from '@/components/ExportButton';
import { EditIcon, TrashIcon } from '@/components/Icons';
import { PageHeader } from '@/components/PageHeader';
import { ErrorState, LoadingState, RequireSupabase } from '@/components/States';
import { useToast } from '@/components/Toast';
import { deleteSession, describeError, fetchSessionDetail } from '@/lib/attendance';
import type { ExportPayload } from '@/lib/export';
import { formatDateLong, formatTimestamp } from '@/lib/format';
import type { SessionDetail } from '@/types';

export function SessionDetailView({ sessionId }: { sessionId: string }) {
  return (
    <RequireSupabase>
      <SessionDetailScreen sessionId={sessionId} />
    </RequireSupabase>
  );
}

function SessionDetailScreen({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const { showToast } = useToast();

  const [detail, setDetail] = useState<SessionDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setDetail(await fetchSessionDetail(sessionId));
    } catch (caught) {
      setError(describeError(caught));
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteSession(sessionId);
      showToast('Attendance session deleted.', 'success');
      router.replace('/history');
      router.refresh();
    } catch (caught) {
      showToast(describeError(caught), 'error');
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  if (loading) {
    return (
      <main className="app-shell mx-auto w-full max-w-2xl">
        <PageHeader title="Attendance" backHref="/history" />
        <LoadingState label="Loading attendance..." />
      </main>
    );
  }

  if (error || !detail) {
    return (
      <main className="app-shell mx-auto w-full max-w-2xl">
        <PageHeader title="Attendance" backHref="/history" />
        <ErrorState message={error ?? 'Attendance not found.'} onRetry={() => void load()} />
      </main>
    );
  }

  const payload: ExportPayload = {
    date: detail.date,
    subjectCode: detail.subject.code,
    period: detail.period,
    entries: detail.entries,
    counts: detail.counts,
  };

  return (
    <main className="app-shell mx-auto flex w-full max-w-2xl flex-col">
      <PageHeader
        title={`${detail.subject.code} · Hour ${detail.period}`}
        subtitle={formatDateLong(detail.date)}
        backHref="/history"
        actions={<ExportButton payload={payload} label="" className="h-10 min-h-0 w-10 px-0" />}
      />

      <div className="space-y-4 px-4 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-4">
        <section className="card p-4">
          <dl className="grid grid-cols-2 gap-y-2 text-[15px]">
            <dt className="text-muted">Date</dt>
            <dd className="text-right font-semibold">{formatDateLong(detail.date)}</dd>

            <dt className="text-muted">Subject</dt>
            <dd className="text-right font-semibold">
              {detail.subject.code}
              <span className="block text-[13px] font-normal text-faint">{detail.subject.name}</span>
            </dd>

            <dt className="text-muted">Hour</dt>
            <dd className="text-right font-semibold">{detail.period}</dd>
          </dl>

          <div className="mt-3 border-t border-line pt-3">
            <AttendanceCounter counts={detail.counts} variant="cards" />
          </div>

          <p className="mt-3 text-[12.5px] text-faint">
            Saved {formatTimestamp(detail.createdAt)}
            {detail.updatedAt !== detail.createdAt
              ? ` · Updated ${formatTimestamp(detail.updatedAt)}`
              : ''}
          </p>
        </section>

        <div className="grid grid-cols-2 gap-2">
          <Link href={`/attendance?session=${detail.id}`} className="btn-primary">
            <EditIcon width={18} height={18} />
            Edit
          </Link>
          <ExportButton payload={payload} label="Export" />
        </div>

        <AttendanceSummary entries={detail.entries} counts={detail.counts} />

        <button
          type="button"
          onClick={() => setConfirmingDelete(true)}
          className="btn-ghost w-full text-[14px] text-absent"
        >
          <TrashIcon width={16} height={16} />
          Delete this session
        </button>
      </div>

      <ConfirmDialog
        open={confirmingDelete}
        title="Delete this attendance?"
        description={`${detail.subject.code} - Hour ${detail.period} - ${formatDateLong(detail.date)} and all ${detail.counts.total} student records will be permanently removed.`}
        confirmLabel="Delete"
        tone="danger"
        busy={deleting}
        onCancel={() => setConfirmingDelete(false)}
        onConfirm={() => void handleDelete()}
      />
    </main>
  );
}
