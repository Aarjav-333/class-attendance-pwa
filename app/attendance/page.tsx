'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { AttendanceCounter } from '@/components/AttendanceCounter';
import { AttendanceModeToggle } from '@/components/AttendanceModeToggle';
import { AttendanceSummary } from '@/components/AttendanceSummary';
import { ClassSetupPanel } from '@/components/ClassSetupPanel';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { ExportButton } from '@/components/ExportButton';
import { AlertIcon, CheckIcon, EditIcon, InfoIcon } from '@/components/Icons';
import { PageHeader } from '@/components/PageHeader';
import { QuickActions } from '@/components/QuickActions';
import { SaveAttendanceButton } from '@/components/SaveAttendanceButton';
import { StudentAttendanceRow } from '@/components/StudentAttendanceRow';
import { StudentSearch } from '@/components/StudentSearch';
import { EmptyState, ErrorState, LoadingState, RequireSupabase } from '@/components/States';
import { useToast } from '@/components/Toast';
import {
  buildDefaultStatuses,
  reconcileStatuses,
  useAttendanceMarking,
} from '@/hooks/useAttendanceMarking';
import { useRoster } from '@/hooks/useRoster';
import { useUnsavedChangesWarning } from '@/hooks/useUnsavedChangesWarning';
import {
  describeError,
  fetchSessionDetail,
  findSessionForClass,
  rosterForSubject,
  saveAttendance,
  SessionExistsError,
  type ExistingSession,
} from '@/lib/attendance';
import { clearDraft, draftKey, loadDraft, loadLastClass, pruneDrafts, saveDraft, saveLastClass } from '@/lib/draft';
import type { ExportPayload } from '@/lib/export';
import { formatDateShort, formatRoll, todayISO } from '@/lib/format';
import { normalise } from '@/lib/utils';
import {
  DEFAULT_STATUS_FOR_MODE,
  type AttendanceStatus,
  type MarkingMode,
  type StatusMap,
} from '@/types';

type DialogState =
  | null
  | { kind: 'confirm-save' }
  | { kind: 'confirm-reset' }
  | { kind: 'confirm-mark-all'; status: AttendanceStatus }
  | { kind: 'switch-mode'; target: MarkingMode }
  | { kind: 'session-exists'; sessionId: string | null }
  | { kind: 'leave' };

export default function MarkAttendancePage() {
  return (
    <Suspense fallback={<LoadingState label="Opening attendance..." />}>
      <RequireSupabase>
        <MarkAttendanceScreen />
      </RequireSupabase>
    </Suspense>
  );
}

function MarkAttendanceScreen() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { showToast } = useToast();

  const editSessionId = searchParams.get('session');

  const {
    students,
    subjects,
    enrollments,
    loading: rosterLoading,
    error: rosterError,
    stale,
    reload,
  } = useRoster();

  const [date, setDate] = useState<string>(todayISO());
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [period, setPeriod] = useState<number | null>(null);
  const [setupExpanded, setSetupExpanded] = useState(true);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [savedSessionId, setSavedSessionId] = useState<string | null>(null);
  const [existing, setExisting] = useState<ExistingSession | null>(null);
  const [dialog, setDialog] = useState<DialogState>(null);
  const [loadingSession, setLoadingSession] = useState(Boolean(editSessionId));
  const [sessionError, setSessionError] = useState<string | null>(null);

  /** Set once an existing session is being updated rather than created. */
  const targetSessionId = editSessionId ?? savedSessionId;
  const editing = Boolean(targetSessionId);

  const subject = useMemo(
    () => subjects.find((item) => item.id === subjectId) ?? null,
    [subjects, subjectId],
  );

  /**
   * Who actually sits this class. CF and OR are electives, so their rosters are
   * the enrolled subset; every other subject is taken by the whole class.
   */
  const rosterStudents = useMemo(
    () => rosterForSubject(students, subject, enrollments),
    [students, subject, enrollments],
  );

  const marking = useAttendanceMarking(rosterStudents);
  const classReady = Boolean(subjectId) && period !== null;
  const classKey = `${date}|${subjectId ?? ''}|${period ?? ''}`;

  // Keep a live reference so effects can read the latest marking state without
  // re-running every time a student is tapped.
  const markingRef = useRef(marking);
  useEffect(() => {
    markingRef.current = marking;
  });

  const lastClassKeyRef = useRef<string | null>(null);
  const loadedSessionRef = useRef<string | null>(null);

  useUnsavedChangesWarning(marking.isDirty && !saving);

  // --- Restore the last used subject / hour / mode -------------------------
  useEffect(() => {
    pruneDrafts();
    if (editSessionId) return;

    const last = loadLastClass();
    if (!last) return;

    if (last.subjectId) setSubjectId(last.subjectId);
    if (last.period !== null) setPeriod(last.period);
    if (last.subjectId && last.period !== null) setSetupExpanded(false);
    if (last.mode !== 'MARK_ABSENT') {
      markingRef.current.switchMode(last.mode);
    }
  }, [editSessionId]);

  useEffect(() => {
    if (!classReady) return;
    saveLastClass({ subjectId, period, mode: marking.mode });
  }, [classReady, subjectId, period, marking.mode]);

  // --- Load an existing session when editing -------------------------------
  useEffect(() => {
    if (!editSessionId || students.length === 0) return;
    if (loadedSessionRef.current === editSessionId) return;

    let cancelled = false;
    setLoadingSession(true);
    setSessionError(null);

    (async () => {
      try {
        const detail = await fetchSessionDetail(editSessionId);
        if (cancelled) return;

        // Marked as loaded only once the data is actually applied, so an
        // interrupted run (a remount, or the roster arriving late) retries
        // instead of leaving the screen stuck on its loading state.
        loadedSessionRef.current = editSessionId;

        setDate(detail.date);
        setSubjectId(detail.subject.id);
        setPeriod(detail.period);
        setSetupExpanded(false);
        lastClassKeyRef.current = `${detail.date}|${detail.subject.id}|${detail.period}`;

        const stored: StatusMap = {};
        for (const entry of detail.entries) stored[entry.student.id] = entry.status;

        const draft = loadDraft(draftKey(detail.date, detail.subject.id, detail.period));
        if (draft && draft.sessionId === editSessionId) {
          markingRef.current.hydrate(reconcileStatuses(students, draft.statuses, draft.mode), draft.mode, {
            dirty: true,
          });
          showToast('Unsaved edits restored.', 'info');
        } else {
          const inferredMode: MarkingMode =
            detail.counts.absent <= detail.counts.present ? 'MARK_ABSENT' : 'MARK_PRESENT';
          markingRef.current.hydrate(reconcileStatuses(students, stored, inferredMode), inferredMode);
        }
      } catch (caught) {
        if (!cancelled) setSessionError(describeError(caught));
      } finally {
        if (!cancelled) setLoadingSession(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [editSessionId, students, showToast]);

  // --- Restore or reset marks when the class changes ------------------------
  useEffect(() => {
    if (students.length === 0 || loadingSession) return;
    if (editSessionId && loadedSessionRef.current !== editSessionId) return;
    if (lastClassKeyRef.current === classKey) return;

    const previousKey = lastClassKeyRef.current;
    lastClassKeyRef.current = classKey;

    // Marks already made carry over to the newly chosen class rather than being
    // thrown away - picking the wrong hour by mistake must not cost the work.
    if (previousKey !== null && markingRef.current.isDirty) return;

    const draft = loadDraft(draftKey(date, subjectId, period));
    if (draft) {
      markingRef.current.hydrate(reconcileStatuses(students, draft.statuses, draft.mode), draft.mode, {
        dirty: true,
      });
      showToast('Unsaved marks for this class were restored.', 'info');
      return;
    }

    if (previousKey !== null) {
      const mode = markingRef.current.mode;
      markingRef.current.hydrate(buildDefaultStatuses(students, mode), mode);
      setSavedSessionId(null);
    }
  }, [classKey, students, loadingSession, editSessionId, date, subjectId, period, showToast]);

  // --- Persist the draft (debounced) ---------------------------------------
  useEffect(() => {
    if (students.length === 0 || !marking.isDirty) return;

    const timer = window.setTimeout(() => {
      saveDraft({
        date,
        subjectId,
        period,
        mode: marking.mode,
        statuses: marking.statuses,
        sessionId: targetSessionId,
      });
    }, 250);

    return () => window.clearTimeout(timer);
  }, [
    students.length,
    marking.isDirty,
    marking.statuses,
    marking.mode,
    date,
    subjectId,
    period,
    targetSessionId,
  ]);

  // --- Warn when this class already has saved attendance --------------------
  useEffect(() => {
    if (!subjectId || period === null || editSessionId) {
      setExisting(null);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const found = await findSessionForClass(date, subjectId, period);
        if (!cancelled) setExisting(found);
      } catch {
        if (!cancelled) setExisting(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [date, subjectId, period, editSessionId, savedSessionId]);

  // --- Derived data ---------------------------------------------------------
  const filteredStudents = useMemo(() => {
    const term = normalise(query);
    if (!term) return rosterStudents;

    return rosterStudents.filter((student) => {
      const roll = String(student.rollNumber);
      return (
        normalise(student.name).includes(term) ||
        roll.includes(term) ||
        formatRoll(student.rollNumber).includes(term)
      );
    });
  }, [rosterStudents, query]);

  const exportPayload: ExportPayload = useMemo(
    () => ({
      date,
      subjectCode: subject?.code ?? '--',
      period: period ?? 0,
      entries: rosterStudents.map((student) => ({
        student,
        status: marking.statuses[student.id] ?? DEFAULT_STATUS_FOR_MODE[marking.mode],
      })),
      counts: marking.counts,
    }),
    [date, subject, period, rosterStudents, marking.statuses, marking.counts, marking.mode],
  );

  const defaultStatus = DEFAULT_STATUS_FOR_MODE[marking.mode];

  // --- Handlers -------------------------------------------------------------
  const handleSubjectChange = useCallback((nextSubjectId: string) => {
    setSubjectId(nextSubjectId);
  }, []);

  const handlePeriodChange = useCallback((nextPeriod: number) => {
    setPeriod(nextPeriod);
    setSetupExpanded(false);
  }, []);

  const handleModeChange = useCallback(
    (nextMode: MarkingMode) => {
      if (nextMode === marking.mode) return;
      if (marking.markedCount > 0) {
        setDialog({ kind: 'switch-mode', target: nextMode });
        return;
      }
      marking.switchMode(nextMode);
    },
    [marking],
  );

  const handleMarkAll = useCallback(
    (status: AttendanceStatus) => {
      if (marking.markedCount > 0) {
        setDialog({ kind: 'confirm-mark-all', status });
        return;
      }
      marking.markAll(status);
    },
    [marking],
  );

  const performSave = useCallback(
    async (overwrite: boolean) => {
      if (!subjectId) {
        showToast('Select a subject first.', 'error');
        return;
      }
      if (period === null) {
        showToast('Select the class hour first.', 'error');
        return;
      }
      if (rosterStudents.length === 0) {
        showToast('There are no students to save for this subject.', 'error');
        return;
      }

      setSaving(true);
      try {
        const sessionId = await saveAttendance({
          attendanceDate: date,
          subjectId,
          period,
          statuses: marking.statuses,
          overwrite: overwrite || editing,
        });

        clearDraft(date, subjectId, period);
        marking.markClean();
        setSavedSessionId(sessionId);
        setDialog(null);
        showToast(editing ? 'Attendance updated.' : 'Attendance saved.', 'success');
      } catch (caught) {
        // The marked state is deliberately left untouched so a failed save can
        // simply be retried.
        if (caught instanceof SessionExistsError) {
          setDialog({ kind: 'session-exists', sessionId: caught.sessionId });
        } else {
          setDialog(null);
          showToast(describeError(caught), 'error');
        }
      } finally {
        setSaving(false);
      }
    },
    [subjectId, period, rosterStudents.length, date, marking, editing, showToast],
  );

  const handleBack = useCallback(() => {
    if (marking.isDirty) {
      setDialog({ kind: 'leave' });
      return;
    }
    router.push('/');
  }, [marking.isDirty, router]);

  // --- Render ---------------------------------------------------------------
  if (rosterError && students.length === 0) {
    return (
      <main className="app-shell mx-auto w-full max-w-2xl">
        <PageHeader title="Mark Attendance" backHref="/" />
        <ErrorState message={rosterError} onRetry={reload} />
      </main>
    );
  }

  if (sessionError) {
    return (
      <main className="app-shell mx-auto w-full max-w-2xl">
        <PageHeader title="Edit Attendance" backHref="/history" />
        <ErrorState message={sessionError} onRetry={() => router.refresh()} />
      </main>
    );
  }

  const subtitleParts = [
    subject ? subject.code : 'No subject',
    period !== null ? `Hour ${period}` : 'No hour',
    formatDateShort(date),
  ];

  return (
    <main className="app-shell mx-auto flex w-full max-w-2xl flex-col">
      <PageHeader
        title={editing ? 'Edit Attendance' : 'Mark Attendance'}
        subtitle={subtitleParts.join(' · ')}
        onBack={handleBack}
        actions={
          classReady ? (
            <ExportButton
              payload={exportPayload}
              label=""
              className="h-10 min-h-0 w-10 px-0"
              disabled={rosterStudents.length === 0}
            />
          ) : null
        }
      >
        {classReady && rosterStudents.length > 0 ? <AttendanceCounter counts={marking.counts} /> : null}
      </PageHeader>

      <div className="space-y-3 px-4 pt-3">
        {stale ? (
          <p className="flex items-center gap-2 rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-muted">
            <InfoIcon width={16} height={16} className="shrink-0" />
            Showing the saved student list - could not reach the server.
          </p>
        ) : null}

        {editSessionId ? (
          <div className="flex items-center gap-3 rounded-2xl border border-brand/30 bg-brand-soft px-4 py-3">
            <EditIcon className="shrink-0 text-brand" width={18} height={18} />
            <p className="text-[14px] font-medium text-brand">
              Editing saved attendance for {subject?.code ?? ''} - Hour {period} -{' '}
              {formatDateShort(date)}.
            </p>
          </div>
        ) : (
          <ClassSetupPanel
            date={date}
            subjectId={subjectId}
            period={period}
            subjects={subjects}
            expanded={setupExpanded}
            disabled={saving}
            onDateChange={setDate}
            onSubjectChange={handleSubjectChange}
            onPeriodChange={handlePeriodChange}
            onExpandedChange={setSetupExpanded}
          />
        )}

        <AttendanceModeToggle mode={marking.mode} onChange={handleModeChange} disabled={saving} />

        {savedSessionId && !marking.isDirty ? (
          <div className="flex items-center gap-3 rounded-2xl border border-present/30 bg-present-soft px-4 py-3">
            <CheckIcon className="shrink-0 text-present" width={18} height={18} />
            <p className="flex-1 text-[14px] font-medium text-present">Attendance saved.</p>
            <Link
              href={`/history/${savedSessionId}`}
              className="shrink-0 text-[14px] font-bold text-present underline underline-offset-2"
            >
              View
            </Link>
          </div>
        ) : null}

        {existing && !savedSessionId ? (
          <div className="rounded-2xl border border-absent/30 bg-absent-soft px-4 py-3">
            <p className="flex items-start gap-2 text-[14px] font-semibold text-absent">
              <AlertIcon className="mt-0.5 shrink-0" width={17} height={17} />
              Attendance already exists for this class.
            </p>
            <div className="mt-2.5 flex gap-2">
              <Link href={`/history/${existing.id}`} className="btn-secondary h-10 min-h-0 flex-1 text-[14px]">
                View
              </Link>
              <Link
                href={`/attendance?session=${existing.id}`}
                className="btn-secondary h-10 min-h-0 flex-1 text-[14px]"
              >
                Edit
              </Link>
            </div>
          </div>
        ) : null}

        <StudentSearch
          value={query}
          onChange={setQuery}
          resultCount={filteredStudents.length}
          totalCount={rosterStudents.length}
        />

        <QuickActions
          onMarkAllPresent={() => handleMarkAll('PRESENT')}
          onMarkAllAbsent={() => handleMarkAll('ABSENT')}
          onReset={() => setDialog({ kind: 'confirm-reset' })}
          disabled={saving || rosterStudents.length === 0}
        />
      </div>

      <div className="flex-1 px-4 pb-4 pt-3">
        {rosterLoading && students.length === 0 ? (
          <LoadingState label="Loading students..." />
        ) : loadingSession ? (
          <LoadingState label="Loading saved attendance..." />
        ) : students.length === 0 ? (
          <EmptyState
            title="No students found"
            description="Run supabase/setup.sql in the Supabase SQL editor to seed the class list."
          />
        ) : rosterStudents.length === 0 ? (
          <EmptyState
            title={`No students enrolled in ${subject?.code ?? 'this subject'}`}
            description="This is an elective. Add its enrolment rows to subject_enrollments in Supabase."
          />
        ) : filteredStudents.length === 0 ? (
          <EmptyState
            title="No matching students"
            description={`Nothing matches "${query}". Clear the search to see everyone.`}
          />
        ) : (
          <ul className="space-y-1.5">
            {filteredStudents.map((student) => (
              <li key={student.id}>
                <StudentAttendanceRow
                  student={student}
                  status={marking.statuses[student.id] ?? defaultStatus}
                  defaultStatus={defaultStatus}
                  onToggle={marking.toggleStudent}
                  disabled={saving}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <SaveAttendanceButton
        counts={marking.counts}
        saving={saving}
        editing={editing}
        disabled={!classReady || rosterStudents.length === 0}
        disabledReason={!classReady ? 'Select a subject and hour to save.' : null}
        onSave={() => setDialog({ kind: 'confirm-save' })}
      />

      {/* ---------------------------- dialogs ---------------------------- */}

      <ConfirmDialog
        open={dialog?.kind === 'confirm-save'}
        title={editing ? 'Update attendance?' : 'Save attendance?'}
        description={
          <span className="font-semibold text-fg">
            {subject?.code} - Hour {period}
            <span className="block font-normal text-muted">{formatDateShort(date)}</span>
          </span>
        }
        confirmLabel={editing ? 'Update' : 'Save'}
        busy={saving}
        onCancel={() => setDialog(null)}
        onConfirm={() => void performSave(false)}
      >
        <AttendanceSummary entries={exportPayload.entries} counts={marking.counts} variant="compact" />
      </ConfirmDialog>

      <ConfirmDialog
        open={dialog?.kind === 'confirm-reset'}
        title="Reset attendance?"
        description={`Every student goes back to ${defaultStatus === 'PRESENT' ? 'present' : 'absent'} and your ${marking.markedCount} mark${marking.markedCount === 1 ? '' : 's'} will be cleared.`}
        confirmLabel="Reset"
        tone="danger"
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          marking.resetToDefault();
          setDialog(null);
        }}
      />

      <ConfirmDialog
        open={dialog?.kind === 'confirm-mark-all'}
        title={
          dialog?.kind === 'confirm-mark-all' && dialog.status === 'PRESENT'
            ? 'Mark everyone present?'
            : 'Mark everyone absent?'
        }
        description={`This replaces your ${marking.markedCount} current mark${marking.markedCount === 1 ? '' : 's'}.`}
        confirmLabel="Yes, mark all"
        tone="danger"
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          if (dialog?.kind === 'confirm-mark-all') marking.markAll(dialog.status);
          setDialog(null);
        }}
      />

      <ConfirmDialog
        open={dialog?.kind === 'switch-mode'}
        title="Switch marking mode?"
        description={
          dialog?.kind === 'switch-mode' ? (
            <>
              You have marked {marking.markedCount} student{marking.markedCount === 1 ? '' : 's'}.
              Switching to{' '}
              <strong className="text-fg">
                {dialog.target === 'MARK_ABSENT' ? 'Mark Absent' : 'Mark Present'}
              </strong>{' '}
              can start everyone from{' '}
              {dialog.target === 'MARK_ABSENT' ? 'present' : 'absent'} again.
            </>
          ) : null
        }
        confirmLabel="Switch and reset"
        cancelLabel="Cancel"
        tone="danger"
        extraActions={[
          {
            label: 'Switch and keep my marks',
            tone: 'primary',
            onClick: () => {
              if (dialog?.kind === 'switch-mode') marking.switchMode(dialog.target, { keepMarks: true });
              setDialog(null);
            },
          },
        ]}
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          if (dialog?.kind === 'switch-mode') marking.switchMode(dialog.target);
          setDialog(null);
        }}
      />

      <ConfirmDialog
        open={dialog?.kind === 'session-exists'}
        title="Attendance already exists"
        description={`${subject?.code ?? ''} - Hour ${period} on ${formatDateShort(date)} has already been saved. Nothing was duplicated.`}
        confirmLabel="Replace with my marks"
        cancelLabel="Cancel"
        tone="danger"
        busy={saving}
        extraActions={
          dialog?.kind === 'session-exists' && dialog.sessionId
            ? [
                {
                  label: 'Open the saved attendance',
                  tone: 'secondary',
                  onClick: () => {
                    const id = dialog.kind === 'session-exists' ? dialog.sessionId : null;
                    setDialog(null);
                    if (id) router.push(`/history/${id}`);
                  },
                },
              ]
            : undefined
        }
        onCancel={() => setDialog(null)}
        onConfirm={() => void performSave(true)}
      />

      <ConfirmDialog
        open={dialog?.kind === 'leave'}
        title="Leave without saving?"
        description="Your marks are kept on this device as a draft and will be waiting when you come back."
        confirmLabel="Leave"
        cancelLabel="Stay"
        tone="danger"
        extraActions={[
          {
            label: 'Save now',
            tone: 'primary',
            onClick: () => setDialog({ kind: 'confirm-save' }),
          },
        ]}
        onCancel={() => setDialog(null)}
        onConfirm={() => {
          setDialog(null);
          router.push('/');
        }}
      />
    </main>
  );
}
