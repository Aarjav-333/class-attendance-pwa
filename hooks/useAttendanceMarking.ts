'use client';

import { useCallback, useMemo, useState } from 'react';

import { tapFeedback } from '@/lib/utils';
import {
  DEFAULT_STATUS_FOR_MODE,
  type AttendanceCounts,
  type AttendanceStatus,
  type MarkingMode,
  type StatusMap,
  type Student,
} from '@/types';

/**
 * The heart of the app: a purely local status map.
 *
 * Nothing here talks to Supabase. Tapping a student updates React state only,
 * which is what keeps marking 57 students instantaneous; the whole map is sent
 * once when Save is pressed.
 */

export function buildDefaultStatuses(students: Student[], mode: MarkingMode): StatusMap {
  const fallback = DEFAULT_STATUS_FOR_MODE[mode];
  const map: StatusMap = {};
  for (const student of students) {
    map[student.id] = fallback;
  }
  return map;
}

/** Keeps only students that still exist, and fills in any that are missing. */
export function reconcileStatuses(
  students: Student[],
  statuses: StatusMap,
  mode: MarkingMode,
): StatusMap {
  const fallback = DEFAULT_STATUS_FOR_MODE[mode];
  const map: StatusMap = {};
  for (const student of students) {
    map[student.id] = statuses[student.id] ?? fallback;
  }
  return map;
}

export interface AttendanceMarking {
  mode: MarkingMode;
  statuses: StatusMap;
  counts: AttendanceCounts;
  /** How many students differ from what the current mode assumes. */
  markedCount: number;
  /** True once anything has been touched, i.e. worth warning about on exit. */
  isDirty: boolean;
  toggleStudent: (studentId: string) => void;
  setStudentStatus: (studentId: string, status: AttendanceStatus) => void;
  markAll: (status: AttendanceStatus) => void;
  resetToDefault: () => void;
  /** Switches mode; `keepMarks` preserves the current statuses instead of resetting. */
  switchMode: (nextMode: MarkingMode, options?: { keepMarks?: boolean }) => void;
  /** Replaces the whole state, e.g. from a saved session or a restored draft. */
  hydrate: (statuses: StatusMap, mode: MarkingMode, options?: { dirty?: boolean }) => void;
  markClean: () => void;
}

export function useAttendanceMarking(
  students: Student[],
  initialMode: MarkingMode = 'MARK_ABSENT',
): AttendanceMarking {
  const [mode, setMode] = useState<MarkingMode>(initialMode);
  const [statuses, setStatuses] = useState<StatusMap>({});
  const [dirty, setDirty] = useState(false);

  const effectiveStatuses = useMemo(
    () => reconcileStatuses(students, statuses, mode),
    [students, statuses, mode],
  );

  const counts = useMemo<AttendanceCounts>(() => {
    let present = 0;
    for (const student of students) {
      if (effectiveStatuses[student.id] === 'PRESENT') present += 1;
    }
    return { total: students.length, present, absent: students.length - present };
  }, [students, effectiveStatuses]);

  const markedCount = useMemo(() => {
    const fallback = DEFAULT_STATUS_FOR_MODE[mode];
    let marked = 0;
    for (const student of students) {
      if (effectiveStatuses[student.id] !== fallback) marked += 1;
    }
    return marked;
  }, [students, effectiveStatuses, mode]);

  const setStudentStatus = useCallback((studentId: string, status: AttendanceStatus) => {
    setStatuses((previous) => {
      if (previous[studentId] === status) return previous;
      return { ...previous, [studentId]: status };
    });
    setDirty(true);
  }, []);

  const toggleStudent = useCallback(
    (studentId: string) => {
      setStatuses((previous) => {
        const current = previous[studentId] ?? DEFAULT_STATUS_FOR_MODE[mode];
        return { ...previous, [studentId]: current === 'PRESENT' ? 'ABSENT' : 'PRESENT' };
      });
      setDirty(true);
      tapFeedback();
    },
    [mode],
  );

  const markAll = useCallback(
    (status: AttendanceStatus) => {
      setStatuses(() => {
        const map: StatusMap = {};
        for (const student of students) map[student.id] = status;
        return map;
      });
      setDirty(true);
      tapFeedback(12);
    },
    [students],
  );

  const resetToDefault = useCallback(() => {
    setStatuses(buildDefaultStatuses(students, mode));
    setDirty(false);
    tapFeedback(12);
  }, [students, mode]);

  const switchMode = useCallback(
    (nextMode: MarkingMode, options?: { keepMarks?: boolean }) => {
      setMode(nextMode);
      if (options?.keepMarks) {
        setStatuses((previous) => reconcileStatuses(students, previous, nextMode));
        return;
      }
      setStatuses(buildDefaultStatuses(students, nextMode));
      setDirty(false);
    },
    [students],
  );

  const hydrate = useCallback(
    (nextStatuses: StatusMap, nextMode: MarkingMode, options?: { dirty?: boolean }) => {
      setMode(nextMode);
      setStatuses(nextStatuses);
      setDirty(options?.dirty ?? false);
    },
    [],
  );

  const markClean = useCallback(() => setDirty(false), []);

  return {
    mode,
    statuses: effectiveStatuses,
    counts,
    markedCount,
    isDirty: dirty,
    toggleStudent,
    setStudentStatus,
    markAll,
    resetToDefault,
    switchMode,
    hydrate,
    markClean,
  };
}
