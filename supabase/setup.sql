-- ============================================================================
--  STUDENT ATTENDANCE PWA - COMPLETE SUPABASE SETUP
-- ----------------------------------------------------------------------------
--  Run this ONCE in: Supabase Dashboard -> SQL Editor -> New query -> Run.
--  The script is idempotent: re-running it is safe and will not duplicate data.
--
--  It creates:
--    * enum   attendance_status
--    * tables students, subjects, attendance_sessions, attendance_records
--    * primary keys, foreign keys, unique constraints, indexes
--    * updated_at triggers
--    * view   attendance_session_summary (per-session present/absent counts)
--    * rpc    save_attendance() - atomic, transactional save/update
--    * Row Level Security policies (authenticated teachers only)
--    * seed data: 5 subjects + 57 students
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";  -- gen_random_uuid()

-- ---------------------------------------------------------------------------
-- 1. Enum: attendance status
-- ---------------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_type where typname = 'attendance_status') then
    create type public.attendance_status as enum ('PRESENT', 'ABSENT');
  end if;
end
$$;

-- ---------------------------------------------------------------------------
-- 2. Shared trigger function: keep updated_at fresh
-- ---------------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- 3. Tables
-- ---------------------------------------------------------------------------

-- 3.1 students -------------------------------------------------------------
create table if not exists public.students (
  id          uuid primary key default gen_random_uuid(),
  roll_number integer     not null,
  name        text        not null,
  active      boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint students_roll_number_key unique (roll_number),
  constraint students_roll_number_positive check (roll_number > 0),
  constraint students_name_not_blank check (length(btrim(name)) > 0)
);

-- 3.2 subjects -------------------------------------------------------------
--  elective = true means only the students listed in subject_enrollments sit
--  this subject. false (the default) means the whole active roster does.
create table if not exists public.subjects (
  id         uuid primary key default gen_random_uuid(),
  code       text        not null,
  name       text        not null,
  active     boolean     not null default true,
  elective   boolean     not null default false,
  sort_order integer     not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subjects_code_key unique (code),
  constraint subjects_code_not_blank check (length(btrim(code)) > 0)
);

-- Added after the first release, so existing projects need it too.
alter table public.subjects add column if not exists elective boolean not null default false;

-- 3.3 attendance_sessions --------------------------------------------------
--  One row per (date + subject + period). The unique constraint is what makes
--  duplicate attendance for the same class physically impossible.
create table if not exists public.attendance_sessions (
  id              uuid primary key default gen_random_uuid(),
  attendance_date date        not null,
  subject_id      uuid        not null references public.subjects (id) on delete restrict,
  period          smallint    not null,
  note            text,
  created_by      uuid references auth.users (id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint attendance_sessions_unique_class unique (attendance_date, subject_id, period),
  constraint attendance_sessions_period_range check (period between 1 and 12)
);

-- 3.4 attendance_records ---------------------------------------------------
--  One row per student per session. The unique constraint prevents a student
--  appearing twice inside the same session.
create table if not exists public.attendance_records (
  id                    uuid not null default gen_random_uuid(),
  attendance_session_id uuid not null references public.attendance_sessions (id) on delete cascade,
  student_id            uuid not null references public.students (id) on delete cascade,
  status                public.attendance_status not null,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint attendance_records_pkey primary key (id),
  constraint attendance_records_unique_student_per_session unique (attendance_session_id, student_id)
);

-- 3.5 subject_enrollments ---------------------------------------------------
--  Which students sit an elective. Only used for subjects flagged elective;
--  everyone sits the rest, so those subjects have no rows here.
create table if not exists public.subject_enrollments (
  id         uuid primary key default gen_random_uuid(),
  subject_id uuid        not null references public.subjects (id) on delete cascade,
  student_id uuid        not null references public.students (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint subject_enrollments_unique_pair unique (subject_id, student_id)
);

-- ---------------------------------------------------------------------------
-- 4. Indexes
-- ---------------------------------------------------------------------------
create index if not exists subject_enrollments_subject_idx
  on public.subject_enrollments (subject_id);

create index if not exists subject_enrollments_student_idx
  on public.subject_enrollments (student_id);

create index if not exists students_roll_number_idx
  on public.students (roll_number) where active;

create index if not exists subjects_sort_idx
  on public.subjects (sort_order, code) where active;

create index if not exists attendance_sessions_date_idx
  on public.attendance_sessions (attendance_date desc, period);

create index if not exists attendance_sessions_subject_idx
  on public.attendance_sessions (subject_id, attendance_date desc);

create index if not exists attendance_records_session_idx
  on public.attendance_records (attendance_session_id);

create index if not exists attendance_records_student_idx
  on public.attendance_records (student_id);

create index if not exists attendance_records_status_idx
  on public.attendance_records (attendance_session_id, status);

-- ---------------------------------------------------------------------------
-- 5. updated_at triggers
-- ---------------------------------------------------------------------------
drop trigger if exists students_set_updated_at on public.students;
create trigger students_set_updated_at
  before update on public.students
  for each row execute function public.set_updated_at();

drop trigger if exists subjects_set_updated_at on public.subjects;
create trigger subjects_set_updated_at
  before update on public.subjects
  for each row execute function public.set_updated_at();

drop trigger if exists attendance_sessions_set_updated_at on public.attendance_sessions;
create trigger attendance_sessions_set_updated_at
  before update on public.attendance_sessions
  for each row execute function public.set_updated_at();

drop trigger if exists attendance_records_set_updated_at on public.attendance_records;
create trigger attendance_records_set_updated_at
  before update on public.attendance_records
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 6. Summary view (used by the History screen)
--    security_invoker = true  ->  the view obeys the RLS policies of the caller
--    instead of running with the rights of the view owner.
-- ---------------------------------------------------------------------------
drop view if exists public.attendance_session_summary;
create view public.attendance_session_summary
with (security_invoker = true) as
select
  s.id,
  s.attendance_date,
  s.period,
  s.subject_id,
  sub.code as subject_code,
  sub.name as subject_name,
  count(r.id)::int                                    as total_count,
  count(r.id) filter (where r.status = 'PRESENT')::int as present_count,
  count(r.id) filter (where r.status = 'ABSENT')::int  as absent_count,
  s.created_at,
  s.updated_at
from public.attendance_sessions s
join public.subjects sub on sub.id = s.subject_id
left join public.attendance_records r on r.attendance_session_id = s.id
group by s.id, sub.code, sub.name;

-- ---------------------------------------------------------------------------
-- 7. save_attendance() - the single, atomic write path
-- ---------------------------------------------------------------------------
--  A plpgsql function runs inside one implicit transaction, so either the
--  session AND every student record are written, or nothing is. That is what
--  guarantees no partially saved attendance.
--
--  p_records shape: [{"student_id": "<uuid>", "status": "PRESENT"|"ABSENT"}, ...]
--
--  When a session already exists for (date, subject, period):
--    p_overwrite = false -> raises ATTENDANCE_SESSION_EXISTS (detail = session id)
--    p_overwrite = true  -> updates that session in place (never a duplicate row)
--
--  SECURITY INVOKER (the default) means RLS still applies to the caller.
-- ---------------------------------------------------------------------------
create or replace function public.save_attendance(
  p_attendance_date date,
  p_subject_id      uuid,
  p_period          integer,
  p_records         jsonb,
  p_overwrite       boolean default false
)
returns uuid
language plpgsql
set search_path = public
as $$
declare
  v_session_id uuid;
  v_count      integer;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '42501';
  end if;

  if p_records is null or jsonb_typeof(p_records) <> 'array' then
    raise exception 'INVALID_RECORDS' using errcode = '22023';
  end if;

  select count(*) into v_count from jsonb_array_elements(p_records);
  if v_count = 0 then
    raise exception 'INVALID_RECORDS' using errcode = '22023';
  end if;

  -- Lock the class row (if there is one) so two devices saving at the same
  -- moment cannot race each other into a duplicate.
  select id into v_session_id
  from public.attendance_sessions
  where attendance_date = p_attendance_date
    and subject_id      = p_subject_id
    and period          = p_period::smallint
  for update;

  if v_session_id is not null and not p_overwrite then
    raise exception 'ATTENDANCE_SESSION_EXISTS'
      using errcode = 'P0001', detail = v_session_id::text;
  end if;

  if v_session_id is null then
    insert into public.attendance_sessions (attendance_date, subject_id, period, created_by)
    values (p_attendance_date, p_subject_id, p_period::smallint, auth.uid())
    returning id into v_session_id;
  else
    update public.attendance_sessions
       set updated_at = now()
     where id = v_session_id;
  end if;

  -- Upsert every submitted student status.
  insert into public.attendance_records (attendance_session_id, student_id, status)
  select
    v_session_id,
    (rec ->> 'student_id')::uuid,
    (rec ->> 'status')::public.attendance_status
  from jsonb_array_elements(p_records) as rec
  on conflict (attendance_session_id, student_id)
  do update set status = excluded.status, updated_at = now();

  -- Drop stale rows for students that are no longer part of the submission
  -- (for example a student deactivated since the first save).
  delete from public.attendance_records ar
  where ar.attendance_session_id = v_session_id
    and ar.student_id not in (
      select (rec ->> 'student_id')::uuid
      from jsonb_array_elements(p_records) as rec
    );

  return v_session_id;
end;
$$;

comment on function public.save_attendance is
  'Atomically creates or updates one attendance session and all of its student records.';

-- ---------------------------------------------------------------------------
-- 8. Row Level Security
-- ---------------------------------------------------------------------------
--  Every table has RLS ENABLED and there is no policy for the anon role, so the
--  public anon key on its own can read and write nothing. Only a signed-in
--  (authenticated) teacher account can read the roster and read/write
--  attendance. See README.md -> "Security model" for the full explanation.
-- ---------------------------------------------------------------------------
alter table public.students            enable row level security;
alter table public.subjects            enable row level security;
alter table public.subject_enrollments enable row level security;
alter table public.attendance_sessions enable row level security;
alter table public.attendance_records  enable row level security;

-- 8.1 Roster data: read-only for signed-in teachers -------------------------
drop policy if exists "students readable by authenticated" on public.students;
create policy "students readable by authenticated"
  on public.students for select
  to authenticated
  using (true);

drop policy if exists "subjects readable by authenticated" on public.subjects;
create policy "subjects readable by authenticated"
  on public.subjects for select
  to authenticated
  using (true);

drop policy if exists "enrollments readable by authenticated" on public.subject_enrollments;
create policy "enrollments readable by authenticated"
  on public.subject_enrollments for select
  to authenticated
  using (true);

-- The roster is intentionally NOT writable from the app. Add or edit students
-- and subjects from the Supabase SQL editor / table editor (service role).

-- 8.2 Attendance sessions: full access for signed-in teachers ---------------
drop policy if exists "sessions readable by authenticated" on public.attendance_sessions;
create policy "sessions readable by authenticated"
  on public.attendance_sessions for select
  to authenticated
  using (true);

drop policy if exists "sessions insertable by authenticated" on public.attendance_sessions;
create policy "sessions insertable by authenticated"
  on public.attendance_sessions for insert
  to authenticated
  with check (created_by is null or created_by = auth.uid());

drop policy if exists "sessions updatable by authenticated" on public.attendance_sessions;
create policy "sessions updatable by authenticated"
  on public.attendance_sessions for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "sessions deletable by authenticated" on public.attendance_sessions;
create policy "sessions deletable by authenticated"
  on public.attendance_sessions for delete
  to authenticated
  using (true);

-- 8.3 Attendance records ----------------------------------------------------
drop policy if exists "records readable by authenticated" on public.attendance_records;
create policy "records readable by authenticated"
  on public.attendance_records for select
  to authenticated
  using (true);

drop policy if exists "records insertable by authenticated" on public.attendance_records;
create policy "records insertable by authenticated"
  on public.attendance_records for insert
  to authenticated
  with check (true);

drop policy if exists "records updatable by authenticated" on public.attendance_records;
create policy "records updatable by authenticated"
  on public.attendance_records for update
  to authenticated
  using (true)
  with check (true);

drop policy if exists "records deletable by authenticated" on public.attendance_records;
create policy "records deletable by authenticated"
  on public.attendance_records for delete
  to authenticated
  using (true);

-- 8.4 Grants ---------------------------------------------------------------
--  RLS decides WHICH ROWS a role may touch; grants decide whether the role may
--  touch the table at all. Both are set explicitly here so the script does not
--  depend on the project setting "Automatically expose new tables" - it works
--  whether that option is on or off.
--
--  anon is deliberately left with nothing: the public key alone cannot read a
--  single student name.
-- ---------------------------------------------------------------------------
grant usage on schema public to anon, authenticated, service_role;

-- Roster: readable by signed-in teachers, fully managed by the service role.
revoke all on public.students from anon, authenticated;
revoke all on public.subjects from anon, authenticated;
revoke all on public.subject_enrollments from anon, authenticated;
grant select on public.students to authenticated;
grant select on public.subjects to authenticated;
grant select on public.subject_enrollments to authenticated;
grant select, insert, update, delete on public.students to service_role;
grant select, insert, update, delete on public.subjects to service_role;
grant select, insert, update, delete on public.subject_enrollments to service_role;

-- Attendance: signed-in teachers have full control.
revoke all on public.attendance_sessions from anon, authenticated;
revoke all on public.attendance_records from anon, authenticated;
grant select, insert, update, delete on public.attendance_sessions to authenticated, service_role;
grant select, insert, update, delete on public.attendance_records to authenticated, service_role;

-- History summary view.
revoke all on public.attendance_session_summary from anon, authenticated;
grant select on public.attendance_session_summary to authenticated, service_role;

-- The transactional write path.
revoke all on function public.save_attendance(date, uuid, integer, jsonb, boolean) from public, anon;
grant execute on function public.save_attendance(date, uuid, integer, jsonb, boolean) to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- 9. Seed: subjects
-- ---------------------------------------------------------------------------
--  CF and OR are the two electives: each student sits one or the other, so
--  their rosters come from subject_enrollments (seeded in section 11).
insert into public.subjects (code, name, sort_order, elective) values
  ('DL',  'Digital Logic',                     1, false),
  ('OR',  'Operations Research',               2, true),
  ('CF',  'Computer Fundamentals',             3, true),
  ('DS',  'Data Structures',                   4, false),
  ('DAA', 'Design and Analysis of Algorithms', 5, false)
on conflict (code) do update
  set name       = excluded.name,
      sort_order = excluded.sort_order,
      elective   = excluded.elective,
      active     = true;

-- ---------------------------------------------------------------------------
-- 10. Seed: students
--     57 students. Roll numbers 25, 34 and 52 are intentionally missing and
--     students are NEVER renumbered.
-- ---------------------------------------------------------------------------
insert into public.students (roll_number, name) values
  (1,  'AAFTHAB K J'),
  (2,  'AARJAV ORAVAKANDI'),
  (3,  'ABHAYJITH A'),
  (4,  'ABHIJITH KRISHNAN'),
  (5,  'ABHIJITH SUDHAKARAN'),
  (6,  'ABHIJITH V'),
  (7,  'ABHINAV RAJ P'),
  (8,  'ABHISHEK ANSON'),
  (9,  'ABIN SAJEEV'),
  (10, 'ADWAIT R'),
  (11, 'AJMAL K P'),
  (12, 'AJMAL KHAN A S'),
  (13, 'AKHIL KRISHNA V U'),
  (14, 'AKSHAY BIJU'),
  (15, 'ALI FAHIM'),
  (16, 'AMARJITH ANAND'),
  (17, 'ANJANA PRADEESH'),
  (18, 'ANNA Y M'),
  (19, 'ANOOP KRISHNA V A'),
  (20, 'ANSAF P BASHEER'),
  (21, 'ANUGRAHA DAVIS'),
  (22, 'ARAVINDH C'),
  (23, 'ARSHITH A D'),
  (24, 'ASHIN K P'),
  (26, 'ASWIN A R'),
  (27, 'BABITHA B'),
  (28, 'CHRISTO THOMAS'),
  (29, 'DEVIKA KARTHIK'),
  (30, 'FAHAD M K'),
  (31, 'FATHIMA SHIFNA V'),
  (32, 'FLICKSON J'),
  (33, 'HAFIS MOHAMED'),
  (35, 'JAYAKRISHNAN R'),
  (36, 'JOBIN JOSHY'),
  (37, 'JOHN PRASAD'),
  (38, 'JUMNA K V'),
  (39, 'KARTHIKA PRADEEP'),
  (40, 'KRISHNA DHATH K J'),
  (41, 'MARY VRINDA'),
  (42, 'MERLY C M'),
  (43, 'MUHAMMAD IRSHAD'),
  (44, 'MUHAMMED AJMAL U K'),
  (45, 'MUHAMMED ASLAM NIZAR'),
  (46, 'MUHAMMED RASHID K P'),
  (47, 'MUHAMMED SHAFI'),
  (48, 'MUHAMMED SHIFAS M'),
  (49, 'NANDANA ANILKUMAR'),
  (50, 'NANDHANA GOPAN'),
  (51, 'NANDHANA SUDHEER C'),
  (53, 'PARTHIV U'),
  (54, 'SAFA ABDUL HAMEED THUPPILIKKADAN'),
  (55, 'SAFAL DAS'),
  (56, 'SARATH P B'),
  (57, 'SOURAV SHAJI'),
  (58, 'SREEVIDYA MADHU'),
  (59, 'SWEETY N'),
  (60, 'YADHUKRISHNA K')
on conflict (roll_number) do update
  set name   = excluded.name,
      active = true;

-- ---------------------------------------------------------------------------
-- 11. Seed: elective enrolment (CF and OR)
--     Every student sits exactly one of the two: the 33 listed below take CF,
--     the remaining 24 take OR. DL, DS and DAA are taken by the whole class
--     and therefore have no rows here.
--
--     The two elective rosters are rebuilt from scratch on every run, so
--     editing the list below and re-running this script re-syncs them exactly.
-- ---------------------------------------------------------------------------
delete from public.subject_enrollments
where subject_id in (select id from public.subjects where code in ('CF', 'OR'));

-- 11.1 CF - Computer Fundamentals (33 students) ------------------------------
insert into public.subject_enrollments (subject_id, student_id)
select sub.id, st.id
from public.subjects sub
cross join public.students st
where sub.code = 'CF'
  and st.roll_number in (
     2,  3,  4,  5,  6,  8,  9, 11, 12, 13,
    18, 19, 20, 21, 22, 23, 26, 27, 28, 32,
    33, 36, 37, 39, 41, 45, 46, 47, 50, 55,
    56, 57, 59
  )
on conflict (subject_id, student_id) do nothing;

-- 11.2 OR - Operations Research (everyone not sitting CF: 24 students) -------
insert into public.subject_enrollments (subject_id, student_id)
select sub.id, st.id
from public.subjects sub
cross join public.students st
where sub.code = 'OR'
  and st.roll_number not in (
     2,  3,  4,  5,  6,  8,  9, 11, 12, 13,
    18, 19, 20, 21, 22, 23, 26, 27, 28, 32,
    33, 36, 37, 39, 41, 45, 46, 47, 50, 55,
    56, 57, 59
  )
on conflict (subject_id, student_id) do nothing;

-- ---------------------------------------------------------------------------
-- 12. Sanity check
--     Expected: 57 students, 5 subjects, CF 33, OR 24, CF + OR = 57
-- ---------------------------------------------------------------------------
select
  (select count(*) from public.students where active)                 as active_students,
  (select count(*) from public.subjects where active)                 as active_subjects,
  (select count(*) from public.subject_enrollments e
     join public.subjects s on s.id = e.subject_id where s.code = 'CF') as cf_students,
  (select count(*) from public.subject_enrollments e
     join public.subjects s on s.id = e.subject_id where s.code = 'OR') as or_students;
