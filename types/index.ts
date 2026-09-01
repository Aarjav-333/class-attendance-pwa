import type {
  AttendanceStatus,
  AttendanceSessionSummaryRow,
  StudentRow,
  SubjectRow,
} from './database';

export type { AttendanceStatus };

/** A student as the UI uses it. */
export interface Student {
  id: string;
  rollNumber: number;
  name: string;
}

/** A subject as the UI uses it. */
export interface Subject {
  id: string;
  code: string;
  name: string;
}

/**
 * Which way round attendance is being marked.
 *
 *  MARK_ABSENT  -> everyone starts PRESENT, you tap the absentees (the fast
 *                  path for a normal day)
 *  MARK_PRESENT -> everyone starts ABSENT, you tap the students who turned up
 */
export type MarkingMode = 'MARK_ABSENT' | 'MARK_PRESENT';

/** The status every student holds while the mode default is untouched. */
export const DEFAULT_STATUS_FOR_MODE: Record<MarkingMode, AttendanceStatus> = {
  MARK_ABSENT: 'PRESENT',
  MARK_PRESENT: 'ABSENT',
};

/** studentId -> status. The single source of truth while marking. */
export type StatusMap = Record<string, AttendanceStatus>;

export interface AttendanceCounts {
  total: number;
  present: number;
  absent: number;
}

/** A saved session as shown on the History list. */
export interface SessionSummary {
  id: string;
  date: string;
  period: number;
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  total: number;
  present: number;
  absent: number;
  createdAt: string;
  updatedAt: string;
}

/** One student together with the status stored for a session. */
export interface SessionStudentStatus {
  student: Student;
  status: AttendanceStatus;
}

/** Everything the detail / edit / export screens need about one session. */
export interface SessionDetail {
  id: string;
  date: string;
  period: number;
  subject: Subject;
  createdAt: string;
  updatedAt: string;
  entries: SessionStudentStatus[];
  counts: AttendanceCounts;
}

/** Locally persisted, not-yet-saved attendance. */
export interface AttendanceDraft {
  date: string;
  subjectId: string | null;
  period: number | null;
  mode: MarkingMode;
  statuses: StatusMap;
  sessionId: string | null;
  savedAt: number;
}

export function toStudent(row: Pick<StudentRow, 'id' | 'roll_number' | 'name'>): Student {
  return { id: row.id, rollNumber: row.roll_number, name: row.name };
}

export function toSubject(row: Pick<SubjectRow, 'id' | 'code' | 'name'>): Subject {
  return { id: row.id, code: row.code, name: row.name };
}

export function toSessionSummary(row: AttendanceSessionSummaryRow): SessionSummary {
  return {
    id: row.id,
    date: row.attendance_date,
    period: row.period,
    subjectId: row.subject_id,
    subjectCode: row.subject_code,
    subjectName: row.subject_name,
    total: row.total_count ?? 0,
    present: row.present_count ?? 0,
    absent: row.absent_count ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
