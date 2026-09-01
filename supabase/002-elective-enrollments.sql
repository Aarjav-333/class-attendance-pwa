-- ============================================================================
--  MIGRATION 002 - ELECTIVE ENROLMENT FOR CF AND OR
-- ----------------------------------------------------------------------------
--  Run this ONCE in: Supabase Dashboard -> SQL Editor -> New query -> Run.
--
--  Only needed for a project that was already set up with the original
--  setup.sql. A fresh project created from setup.sql already includes all of
--  this, and running both is harmless (everything below is idempotent).
--
--  What changes:
--    * subjects gains an `elective` flag
--    * new table subject_enrollments (which students sit which elective)
--    * CF and OR are marked elective and their rosters are seeded
--        CF -> 33 students
--        OR -> the other 24
--    * DL, DS and DAA are untouched and keep the whole class of 57
--
--  Existing attendance records are NOT modified.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. Schema
-- ---------------------------------------------------------------------------
alter table public.subjects add column if not exists elective boolean not null default false;

create table if not exists public.subject_enrollments (
  id         uuid primary key default gen_random_uuid(),
  subject_id uuid        not null references public.subjects (id) on delete cascade,
  student_id uuid        not null references public.students (id) on delete cascade,
  created_at timestamptz not null default now(),
  constraint subject_enrollments_unique_pair unique (subject_id, student_id)
);

create index if not exists subject_enrollments_subject_idx
  on public.subject_enrollments (subject_id);

create index if not exists subject_enrollments_student_idx
  on public.subject_enrollments (student_id);

-- ---------------------------------------------------------------------------
-- 2. Row Level Security and grants (same rules as the rest of the roster)
-- ---------------------------------------------------------------------------
alter table public.subject_enrollments enable row level security;

drop policy if exists "enrollments readable by authenticated" on public.subject_enrollments;
create policy "enrollments readable by authenticated"
  on public.subject_enrollments for select
  to authenticated
  using (true);

revoke all on public.subject_enrollments from anon, authenticated;
grant select on public.subject_enrollments to authenticated;
grant select, insert, update, delete on public.subject_enrollments to service_role;

-- ---------------------------------------------------------------------------
-- 3. Mark the two electives
-- ---------------------------------------------------------------------------
update public.subjects set elective = true  where code in ('CF', 'OR');
update public.subjects set elective = false where code in ('DL', 'DS', 'DAA');

-- ---------------------------------------------------------------------------
-- 4. Seed the elective rosters
--     Rebuilt from scratch each run, so editing the roll numbers below and
--     re-running this file re-syncs both lists exactly.
-- ---------------------------------------------------------------------------
delete from public.subject_enrollments
where subject_id in (select id from public.subjects where code in ('CF', 'OR'));

-- 4.1 CF - Computer Fundamentals (33 students)
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

-- 4.2 OR - Operations Research (everyone not sitting CF: 24 students)
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
-- 5. Sanity check - expected: cf_students 33, or_students 24, total 57
-- ---------------------------------------------------------------------------
select
  (select count(*) from public.subject_enrollments e
     join public.subjects s on s.id = e.subject_id where s.code = 'CF') as cf_students,
  (select count(*) from public.subject_enrollments e
     join public.subjects s on s.id = e.subject_id where s.code = 'OR') as or_students,
  (select count(*) from public.subject_enrollments)                     as total_enrollments,
  (select count(*) from public.students where active)                   as active_students;
