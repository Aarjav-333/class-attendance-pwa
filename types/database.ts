/**
 * Hand-written mirror of the schema created by `supabase/setup.sql`.
 *
 * Keeping this file in sync with the SQL is what gives the Supabase client
 * end-to-end type safety without a code-generation step.
 *
 * NOTE: every shape here is a `type` alias, not an `interface`. The Supabase
 * client constrains rows to `Record<string, unknown>`, and only type aliases
 * get the implicit index signature that satisfies it.
 */

export type AttendanceStatus = 'PRESENT' | 'ABSENT';

export type StudentRow = {
  id: string;
  roll_number: number;
  name: string;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type SubjectRow = {
  id: string;
  code: string;
  name: string;
  active: boolean;
  /** true when only enrolled students sit this subject (CF and OR). */
  elective: boolean;
  sort_order: number;
  created_at: string;
  updated_at: string;
};

export type SubjectEnrollmentRow = {
  id: string;
  subject_id: string;
  student_id: string;
  created_at: string;
};

export type AttendanceSessionRow = {
  id: string;
  attendance_date: string; // ISO date, e.g. 2026-09-01
  subject_id: string;
  period: number;
  note: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

export type AttendanceRecordRow = {
  id: string;
  attendance_session_id: string;
  student_id: string;
  status: AttendanceStatus;
  created_at: string;
  updated_at: string;
};

export type AttendanceSessionSummaryRow = {
  id: string;
  attendance_date: string;
  period: number;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  total_count: number;
  present_count: number;
  absent_count: number;
  created_at: string;
  updated_at: string;
};

export type SaveAttendanceArgs = {
  p_attendance_date: string;
  p_subject_id: string;
  p_period: number;
  p_records: { student_id: string; status: AttendanceStatus }[];
  p_overwrite: boolean;
};

export type Database = {
  public: {
    Tables: {
      students: {
        Row: StudentRow;
        Insert: Partial<StudentRow> & Pick<StudentRow, 'roll_number' | 'name'>;
        Update: Partial<StudentRow>;
        Relationships: [];
      };
      subjects: {
        Row: SubjectRow;
        Insert: Partial<SubjectRow> & Pick<SubjectRow, 'code' | 'name'>;
        Update: Partial<SubjectRow>;
        Relationships: [];
      };
      subject_enrollments: {
        Row: SubjectEnrollmentRow;
        Insert: Partial<SubjectEnrollmentRow> &
          Pick<SubjectEnrollmentRow, 'subject_id' | 'student_id'>;
        Update: Partial<SubjectEnrollmentRow>;
        Relationships: [];
      };
      attendance_sessions: {
        Row: AttendanceSessionRow;
        Insert: Partial<AttendanceSessionRow> &
          Pick<AttendanceSessionRow, 'attendance_date' | 'subject_id' | 'period'>;
        Update: Partial<AttendanceSessionRow>;
        Relationships: [];
      };
      attendance_records: {
        Row: AttendanceRecordRow;
        Insert: Partial<AttendanceRecordRow> &
          Pick<AttendanceRecordRow, 'attendance_session_id' | 'student_id' | 'status'>;
        Update: Partial<AttendanceRecordRow>;
        Relationships: [];
      };
    };
    Views: {
      attendance_session_summary: {
        Row: AttendanceSessionSummaryRow;
        Relationships: [];
      };
    };
    Functions: {
      save_attendance: {
        Args: SaveAttendanceArgs;
        Returns: string;
      };
    };
    Enums: {
      attendance_status: AttendanceStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
