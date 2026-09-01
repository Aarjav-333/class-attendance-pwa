import { getSupabaseClient } from './supabase/client';
import {
  toSessionSummary,
  toStudent,
  toSubject,
  type AttendanceCounts,
  type AttendanceStatus,
  type SessionDetail,
  type SessionSummary,
  type StatusMap,
  type Student,
  type Subject,
} from '@/types';
import type {
  AttendanceRecordRow,
  AttendanceSessionRow,
  AttendanceSessionSummaryRow,
  StudentRow,
  SubjectRow,
} from '@/types/database';

/**
 * Every Supabase call the app makes lives here, so UI components never touch
 * the database client directly.
 */

/** Raised when a session already exists for the same date + subject + period. */
export class SessionExistsError extends Error {
  readonly sessionId: string | null;

  constructor(sessionId: string | null) {
    super('Attendance already exists for this class.');
    this.name = 'SessionExistsError';
    this.sessionId = sessionId;
  }
}

/** Turns any thrown value into a message that is safe to show a user. */
export function describeError(error: unknown): string {
  if (error instanceof SessionExistsError) return error.message;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return 'You appear to be offline. Your marks are safe - try again once you have a connection.';
  }

  if (error instanceof Error) {
    if (error.message.includes('AUTH_REQUIRED')) {
      return 'Your session expired. Please sign in again.';
    }
    if (error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
      return 'Network error. Your marks are safe - please try again.';
    }
    return error.message;
  }

  return 'Something went wrong. Please try again.';
}

// ---------------------------------------------------------------------------
// Roster
// ---------------------------------------------------------------------------

export async function fetchStudents(): Promise<Student[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('students')
    .select('id, roll_number, name, active, created_at, updated_at')
    .eq('active', true)
    .order('roll_number', { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as StudentRow[]).map(toStudent);
}

export async function fetchSubjects(): Promise<Subject[]> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('subjects')
    .select('id, code, name, active, sort_order, created_at, updated_at')
    .eq('active', true)
    .order('sort_order', { ascending: true })
    .order('code', { ascending: true });

  if (error) throw new Error(error.message);
  return ((data ?? []) as SubjectRow[]).map(toSubject);
}

// ---------------------------------------------------------------------------
// Sessions
// ---------------------------------------------------------------------------

export interface ExistingSession {
  id: string;
  updatedAt: string;
}

/** Looks up the session for a class. Read-only: opening a screen never writes. */
export async function findSessionForClass(
  attendanceDate: string,
  subjectId: string,
  period: number,
): Promise<ExistingSession | null> {
  const supabase = getSupabaseClient();
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select('id, updated_at')
    .eq('attendance_date', attendanceDate)
    .eq('subject_id', subjectId)
    .eq('period', period)
    .maybeSingle();

  if (error) throw new Error(error.message);
  if (!data) return null;

  const row = data as Pick<AttendanceSessionRow, 'id' | 'updated_at'>;
  return { id: row.id, updatedAt: row.updated_at };
}

export interface SessionFilters {
  date?: string | null;
  subjectId?: string | null;
  fromDate?: string | null;
  limit?: number;
}

export async function fetchSessionSummaries(filters: SessionFilters = {}): Promise<SessionSummary[]> {
  const supabase = getSupabaseClient();

  let query = supabase
    .from('attendance_session_summary')
    .select(
      'id, attendance_date, period, subject_id, subject_code, subject_name, total_count, present_count, absent_count, created_at, updated_at',
    )
    .order('attendance_date', { ascending: false })
    .order('period', { ascending: true });

  if (filters.date) query = query.eq('attendance_date', filters.date);
  if (filters.fromDate) query = query.gte('attendance_date', filters.fromDate);
  if (filters.subjectId) query = query.eq('subject_id', filters.subjectId);

  query = query.limit(filters.limit ?? 100);

  const { data, error } = await query;
  if (error) throw new Error(error.message);

  return ((data ?? []) as AttendanceSessionSummaryRow[]).map(toSessionSummary);
}

export function countStatuses(statuses: AttendanceStatus[]): AttendanceCounts {
  let present = 0;
  for (const status of statuses) {
    if (status === 'PRESENT') present += 1;
  }
  return { total: statuses.length, present, absent: statuses.length - present };
}

/**
 * Full detail for one session. The roster is fetched alongside the records and
 * joined in memory: it is 57 rows, and it keeps the query free of embedded
 * resource syntax.
 */
export async function fetchSessionDetail(sessionId: string): Promise<SessionDetail> {
  const supabase = getSupabaseClient();

  const [sessionResult, recordsResult, students, subjects] = await Promise.all([
    supabase
      .from('attendance_sessions')
      .select('id, attendance_date, subject_id, period, created_at, updated_at')
      .eq('id', sessionId)
      .maybeSingle(),
    supabase
      .from('attendance_records')
      .select('id, attendance_session_id, student_id, status, created_at, updated_at')
      .eq('attendance_session_id', sessionId),
    fetchStudents(),
    fetchSubjects(),
  ]);

  if (sessionResult.error) throw new Error(sessionResult.error.message);
  if (!sessionResult.data) throw new Error('That attendance session no longer exists.');
  if (recordsResult.error) throw new Error(recordsResult.error.message);

  const session = sessionResult.data as AttendanceSessionRow;
  const records = (recordsResult.data ?? []) as AttendanceRecordRow[];

  const subject =
    subjects.find((item) => item.id === session.subject_id) ??
    ({ id: session.subject_id, code: 'N/A', name: 'Unknown subject' } satisfies Subject);

  const statusByStudent = new Map<string, AttendanceStatus>(
    records.map((record) => [record.student_id, record.status]),
  );

  // Students stored in the session but no longer active still belong in the
  // record, so start from the stored rows and add any missing roster entries.
  const studentById = new Map(students.map((student) => [student.id, student]));
  const entries = students
    .filter((student) => statusByStudent.has(student.id))
    .map((student) => ({
      student,
      status: statusByStudent.get(student.id) as AttendanceStatus,
    }));

  for (const record of records) {
    if (!studentById.has(record.student_id)) {
      entries.push({
        student: { id: record.student_id, rollNumber: 0, name: 'Removed student' },
        status: record.status,
      });
    }
  }

  entries.sort((a, b) => a.student.rollNumber - b.student.rollNumber);

  return {
    id: session.id,
    date: session.attendance_date,
    period: session.period,
    subject,
    createdAt: session.created_at,
    updatedAt: session.updated_at,
    entries,
    counts: countStatuses(entries.map((entry) => entry.status)),
  };
}

// ---------------------------------------------------------------------------
// Saving
// ---------------------------------------------------------------------------

export interface SaveAttendanceInput {
  attendanceDate: string;
  subjectId: string;
  period: number;
  statuses: StatusMap;
  /** true when updating a session that is knowingly being edited. */
  overwrite?: boolean;
}

/**
 * Writes the whole class in one transactional RPC call. Either the session and
 * all 57 records land, or nothing does.
 */
export async function saveAttendance(input: SaveAttendanceInput): Promise<string> {
  const supabase = getSupabaseClient();

  const records = Object.entries(input.statuses).map(([studentId, status]) => ({
    student_id: studentId,
    status,
  }));

  if (records.length === 0) {
    throw new Error('There is nothing to save - the student list is empty.');
  }

  const { data, error } = await supabase.rpc('save_attendance', {
    p_attendance_date: input.attendanceDate,
    p_subject_id: input.subjectId,
    p_period: input.period,
    p_records: records,
    p_overwrite: input.overwrite ?? false,
  });

  if (error) {
    if (error.message.includes('ATTENDANCE_SESSION_EXISTS')) {
      const existingId = typeof error.details === 'string' ? error.details.trim() : '';
      throw new SessionExistsError(existingId.length > 0 ? existingId : null);
    }
    throw new Error(error.message);
  }

  if (typeof data !== 'string') {
    throw new Error('The server did not return a session id.');
  }

  return data;
}

export async function deleteSession(sessionId: string): Promise<void> {
  const supabase = getSupabaseClient();
  const { error } = await supabase.from('attendance_sessions').delete().eq('id', sessionId);
  if (error) throw new Error(error.message);
}
