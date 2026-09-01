# Class Attendance PWA

A fast, mobile-first Progressive Web App for marking student attendance. Built for one-handed
use on an iPhone: pick the subject and hour, tap the handful of students who differ from the
default, save. Records live in Supabase and stay editable and exportable afterwards.

- **Live:** https://class-attendance-pwa-wine.vercel.app
- **Stack:** Next.js 15 (App Router) · React 19 · TypeScript · Tailwind CSS · Supabase
- **Deploy target:** Vercel
- **Install:** open the live URL in Safari → Share → *Add to Home Screen*

> **Redeploying:** run `vercel deploy --prod` from the project folder. To get automatic
> deploys on every `git push` instead, open the project on vercel.com → **Settings → Git**
> → **Connect Git Repository**, and authorise the Vercel GitHub App for this private repo.

---

## Table of contents

1. [What it does](#what-it-does)
2. [Project structure](#project-structure)
3. [Database design](#database-design)
4. [Security model](#security-model)
5. [Setup, step by step](#setup-step-by-step)
6. [Deploying to Vercel](#deploying-to-vercel)
7. [Installing on iPhone](#installing-on-iphone)
8. [How the app behaves](#how-the-app-behaves)
9. [Configuration](#configuration)
10. [Troubleshooting](#troubleshooting)

---

## What it does

| Screen | Route | Purpose |
| --- | --- | --- |
| Dashboard | `/` | Two large actions plus today's saved classes |
| Mark attendance | `/attendance` | The main workflow |
| Edit attendance | `/attendance?session=<id>` | Same screen, loaded with a saved session |
| History | `/history` | Past sessions, filterable by date and subject |
| Session detail | `/history/<id>` | Counts, present/absent name lists, export, edit, delete |
| Sign in | `/login` | Supabase email + password |

**Two marking modes**

- **Mark Absent** — everyone starts *present*; tap the absentees. The fast path on a normal day.
- **Mark Present** — everyone starts *absent*; tap who turned up.

Switching modes when marks exist asks first, and offers *Switch and keep my marks* as well as
*Switch and reset*.

**Everything else**

- Live present/absent/total counters in the sticky header, always visible while scrolling
- CF and OR are electives: each shows only its enrolled students (33 and 24). DL, DS and DAA
  show the whole class of 57
- Search by name or roll number (never changes attendance state)
- Mark All Present / Mark All Absent / Reset, each guarded when it would destroy marks
- Duplicate-proof saving: one session per date + subject + hour, enforced in the database
- Editing a saved session updates it in place and stamps `updated_at`
- CSV and human-readable export, shared through the iOS share sheet where available
- Unsaved marks survive a refresh, a crash, or a failed save (localStorage draft)
- Installable, works offline for the shell, respects iPhone safe areas

---

## Project structure

```
app/
  layout.tsx              root layout, PWA metadata, viewport, providers
  page.tsx                dashboard
  login/page.tsx          teacher sign-in
  attendance/page.tsx     mark + edit attendance (the core screen)
  history/page.tsx        session list with filters
  history/[id]/           session detail / export / delete
  globals.css             theme tokens, safe-area helpers, component classes

components/               presentational + interactive UI, one concern each
  AttendanceModeToggle  SubjectSelector  PeriodSelector  DateField
  StudentAttendanceRow  AttendanceCounter  StudentSearch  QuickActions
  AttendanceSummary     SaveAttendanceButton  ExportButton  HistoryCard
  ClassSetupPanel       ConfirmDialog  Sheet  PageHeader  Toast  States  Icons
  ServiceWorkerRegistrar

hooks/
  useAttendanceMarking.ts   local status map, counts, mode switching
  useRoster.ts              students + subjects, cached for poor connections
  useUnsavedChangesWarning.ts

lib/
  supabase/client.ts        browser client (cookie-based session)
  attendance.ts             every database call the app makes
  draft.ts                  localStorage drafts + last-used class
  export.ts                 CSV, summary text, Web Share / download
  format.ts                 timezone-safe date helpers
  constants.ts              period list and storage keys
  utils.ts                  cn(), tap feedback, search normalisation

types/
  database.ts               mirror of the SQL schema
  index.ts                  app-level types and row mappers

public/
  manifest.webmanifest  sw.js  offline.html  icons/

supabase/setup.sql        the entire database: run once on a new project
supabase/002-elective-enrollments.sql  adds CF/OR electives to an existing project
scripts/generate-icons.mjs  regenerates the PNG icon set
middleware.ts             session refresh + route protection
```

UI components never import the Supabase client directly; all data access goes through
`lib/attendance.ts`.

---

## Database design

Five tables, one view, one function. All of it is in **`supabase/setup.sql`**, which is
idempotent — running it twice is safe.

```
subjects                students
   │  id (uuid, pk)        │  id (uuid, pk)
   │  code  unique         │  roll_number  int unique
   │  name                 │  name
   │  active               │  active
   └──────┐                └──────────────┐
          │                               │
   attendance_sessions                    │
      id (uuid, pk)                       │
      attendance_date  date               │
      subject_id  ──► subjects.id         │
      period  smallint (1..12)            │
      created_by ──► auth.users.id        │
      created_at / updated_at             │
      UNIQUE (attendance_date, subject_id, period)   ◄── no duplicate classes
          │                               │
          └──► attendance_records ◄───────┘
                  id (uuid, pk)
                  attendance_session_id ──► attendance_sessions.id  (ON DELETE CASCADE)
                  student_id            ──► students.id
                  status  enum('PRESENT','ABSENT')
                  UNIQUE (attendance_session_id, student_id)   ◄── no duplicate students
```

**Constraints that matter**

- `attendance_sessions_unique_class` makes a second session for the same date + subject + hour
  impossible at the database level, not just in the UI.
- `attendance_records_unique_student_per_session` makes a student appear at most once per session.
- `period BETWEEN 1 AND 12` and `roll_number > 0` are checked in the database.
- `subject_enrollments_unique_pair` stops a student being enrolled twice in the same elective.

**Electives.** `subjects.elective` marks CF and OR. For those two, the class roster comes from
`subject_enrollments`; for every other subject it is the whole active roster. The app fetches the
enrolment table once with the roster and works the per-subject list out locally, so switching
between CF and OR is instant.

**Indexes** cover the queries the app actually runs: history by date, history by subject, records
by session, records by student, plus partial indexes on the active roster.

**`attendance_session_summary`** is a view returning present/absent/total counts per session, so
the History screen needs one query rather than N. It is declared `security_invoker = true`, so it
obeys the caller's RLS policies rather than the view owner's.

**`save_attendance()`** is the single write path:

```sql
select save_attendance(
  p_attendance_date := '2026-09-01',
  p_subject_id      := '<uuid>',
  p_period          := 3,
  p_records         := '[{"student_id":"<uuid>","status":"PRESENT"}, ...]'::jsonb,
  p_overwrite       := false
);
```

A `plpgsql` function runs inside one implicit transaction, so the session row and all 57 student
rows commit together or not at all — there is no way to end up with half-saved attendance. It
locks the class row with `SELECT ... FOR UPDATE` so two devices saving at the same moment cannot
race, and it raises `ATTENDANCE_SESSION_EXISTS` (with the existing session id in the error
`detail`) instead of silently creating a duplicate. With `p_overwrite := true` it updates the
existing session in place and refreshes `updated_at`.

**Seed data** — the 57 students in the roster with their exact roll numbers (25, 34 and 52 stay
missing; nobody is renumbered) and subjects DL, OR, CF, DS, DAA.

---

## Security model

**RLS is enabled on every table, and there is no policy for the `anon` role.** The
`NEXT_PUBLIC_SUPABASE_ANON_KEY` shipped to the browser therefore grants nothing on its own: with
that key alone, an unauthenticated request can read no student names and write no attendance.

| Table | `anon` | `authenticated` (signed-in teacher) |
| --- | --- | --- |
| `students` | none | read |
| `subjects` | none | read |
| `attendance_sessions` | none | read / insert / update / delete |
| `attendance_records` | none | read / insert / update / delete |

Both layers are set explicitly by the script: table **grants** decide whether a role may touch
a table at all, and **RLS policies** decide which rows. Because the grants are written out in
full, the setup works whether or not the project option *Automatically expose new tables* is
enabled - you can safely leave that switch off, which is what Supabase recommends.

The roster is intentionally **not writable from the app** — add or edit students and subjects from
the Supabase SQL editor, where you are the service role. That keeps the class list from being
changed by accident mid-lesson.

**Why not just disable RLS?** With RLS off, the anon key is a public read/write credential for
your database: the key is visible in the browser bundle of any deployed site, so anyone who opens
dev tools could dump the student roster and rewrite or delete attendance history. Student names
tied to daily attendance are personal data about minors. RLS plus a login is the minimum
defensible configuration here, and it costs one sign-in.

**Authentication is deliberately small.** Students never get accounts. Teachers sign in with
email + password through Supabase Auth; the session lives in a cookie, `middleware.ts` refreshes
it and redirects anonymous visitors to `/login`. There is no sign-up screen — you create teacher
accounts yourself:

> Supabase Dashboard → **Authentication** → **Users** → **Add user** → *Create new user*
> (tick **Auto Confirm User** so no email confirmation is needed).

**Turn public sign-ups off**, or anyone could create an account and edit attendance:

> Supabase Dashboard → **Authentication** → **Sign In / Providers** → **Email** →
> disable **Allow new users to sign up**.

`save_attendance()` also re-checks `auth.uid()` server-side and rejects anonymous calls, so the
write path is protected even if a policy is loosened later.

---

## Setup, step by step

### 1. Create the Supabase project

1. Go to [supabase.com/dashboard](https://supabase.com/dashboard) and sign in.
2. **New project** → give it a name (e.g. `attendance`), choose a strong database password and the
   region closest to you → **Create new project**.
3. Wait for provisioning to finish (about a minute).

### 2. Run the SQL setup

1. In the project sidebar open **SQL Editor** → **New query**.
2. Copy the entire contents of [`supabase/setup.sql`](supabase/setup.sql) and paste it in.
3. Press **Run**.
4. The final result should read `active_students = 57`, `active_subjects = 5`.

Everything is created by that one script: tables, foreign keys, unique constraints, indexes,
triggers, the summary view, `save_attendance()`, RLS policies, and the seed data.

### 3. Create your teacher account

1. **Authentication** → **Users** → **Add user** → *Create new user*.
2. Enter your email and a password, tick **Auto Confirm User**, and create it.
3. **Authentication** → **Sign In / Providers** → **Email** → turn off
   **Allow new users to sign up**.

### 4. Get the project URL

**Project Settings** → **Data API** → copy **Project URL**
(`https://<your-project-ref>.supabase.co`).

### 5. Get the anon / publishable key

**Project Settings** → **API Keys** → copy the **anon public** key (newer projects call it the
**publishable** key — either works). It is safe in the browser because of the RLS policies above.

> Never copy the **service_role** / secret key into this app. It bypasses RLS entirely.

### 6. Create `.env.local`

In the project root, next to `package.json`:

```bash
cp .env.example .env.local
```

Then fill it in:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

`.env.local` is git-ignored and must never be committed.

### 7. Run locally

```bash
npm install
npm run dev
```

Open <http://localhost:3000>, sign in with the account from step 3, and mark a class.

Useful scripts:

```bash
npm run dev        # development server
npm run build      # production build
npm start          # serve the production build
npm run typecheck  # tsc --noEmit
npm run icons      # regenerate public/icons/*.png
```

> The service worker is only registered in production builds, so development reloads are never
> served stale.

---

## Deploying to Vercel

### 8. Push to GitHub

```bash
git init
git add .
git commit -m "Attendance PWA"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

### 9. Import the repository into Vercel

1. Go to [vercel.com/new](https://vercel.com/new) and sign in with GitHub.
2. **Import** the repository.
3. Framework preset is detected as **Next.js**; leave the build command, output directory and
   install command at their defaults.

### 10. Add the environment variables

In the import screen (or later under **Settings** → **Environment Variables**) add both, for
**Production**, **Preview** and **Development**:

| Name | Value |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://your-project-ref.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | your anon / publishable key |

Optional: `NEXT_PUBLIC_PERIOD_COUNT` (defaults to `6`).

> Changing an environment variable later requires a redeploy — Vercel bakes `NEXT_PUBLIC_*` values
> into the client bundle at build time.

### 11. Deploy

Press **Deploy**. When it finishes you get a URL such as `https://your-app.vercel.app`.
Every later `git push` to `main` redeploys automatically.

Optionally add your Vercel URL to Supabase under **Authentication** → **URL Configuration** →
**Site URL**.

### 12. Test the PWA

Open the deployed URL on your iPhone in **Safari** (installation only works from Safari, not
Chrome) and check:

- Signing in works and the roster loads
- Marking students feels instant and the counters track every tap
- Saving stores the session, and saving the same class again reports that it already exists
- History lists the session; opening it shows present/absent names
- Export opens the iOS share sheet

---

## Installing on iPhone

1. Open the site in **Safari**.
2. Tap the **Share** button (the square with the arrow).
3. Scroll and tap **Add to Home Screen**.
4. Confirm the name (**Attendance**) and tap **Add**.
5. Launch it from the home screen — it opens standalone, with no Safari chrome.

What is configured for iOS:

- `display: standalone` and Apple web-app meta tags, so it opens like a native app
- `viewport-fit=cover` plus `env(safe-area-inset-*)` padding, so the sticky header clears the
  notch/Dynamic Island and the save bar sits above the home indicator
- `100dvh` / `100svh` layout heights, so the moving Safari bars never clip the save button
- 16px inputs, so focusing search does not zoom the page
- 48px+ touch targets everywhere; whole rows are tappable
- A 180×180 PNG apple-touch-icon plus 192/512 and maskable icons
- Theme colours for light and dark mode
- A service worker that caches the app shell, with an offline fallback page

---

## How the app behaves

**Nothing is written when the screen opens.** Loading `/attendance` only reads the roster and
checks whether this class already has attendance. Every tap changes React state alone — no request
per student — and the whole class is sent in one transactional call when you press
**SAVE ATTENDANCE**.

**Duplicates.** If a session already exists for the chosen date + subject + hour you see
*Attendance already exists for this class* before you even save, with **View** and **Edit**. If it
appears between opening the screen and saving, the save is rejected by the database and you are
offered *Open the saved attendance* or *Replace with my marks*. Nothing is ever duplicated.

**Failed saves keep your work.** On a network error the marks stay exactly as they were, an error
toast explains what happened, and the button is ready to retry. Marks are also mirrored into
`localStorage` (debounced), keyed by date + subject + hour, so a Safari refresh, a tab eviction or
a battery death restores them — with a *marks restored* notice. Drafts older than seven days are
pruned, and a draft is deleted as soon as its class saves successfully.

**Changing your mind about the class.** Picking a different hour or subject after marking keeps
your marks and re-keys the draft, rather than throwing the work away.

**Editing.** Opening a saved session loads the stored statuses, the button reads
**UPDATE ATTENDANCE**, and saving updates the same row and refreshes `updated_at` instead of
creating a second session.

---

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | — | Supabase project URL (required) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | — | Supabase anon / publishable key (required) |
| `NEXT_PUBLIC_PERIOD_COUNT` | `6` | How many class hours to offer (1–12) |

**Changing who sits an elective.** Edit the roll-number lists in
`supabase/002-elective-enrollments.sql` and re-run it. Both rosters are rebuilt from scratch on
every run, so that file stays the source of truth. To make another subject an elective:

```sql
update public.subjects set elective = true where code = 'DS';

insert into public.subject_enrollments (subject_id, student_id)
select sub.id, st.id
from public.subjects sub
cross join public.students st
where sub.code = 'DS'
  and st.roll_number in (1, 2, 3);
```

Setting `elective = false` again makes a subject fall back to the whole class.

**Changing the class list.** Edit the seed block at the end of `supabase/setup.sql` and re-run it,
or insert directly:

```sql
insert into public.students (roll_number, name) values (61, 'NEW STUDENT');
```

To retire a student without losing their history, set `active = false` rather than deleting them:

```sql
update public.students set active = false where roll_number = 61;
```

Subjects work the same way (`public.subjects`, with `sort_order` controlling button order).

---

## Troubleshooting

**"Finish the Supabase setup" instead of the app** — `.env.local` is missing or the dev server was
not restarted after creating it.

**Sign-in fails with "Incorrect email or password"** — the user does not exist yet, or was created
without **Auto Confirm User**. Fix it under Authentication → Users.

**"No students found"** — `supabase/setup.sql` has not been run in this project. Run it and reload.

**Everything loads but attendance will not save** — you are signed out (the session cookie
expired). Sign in again; your marks are still on the device.

**History is empty after saving** — check you are looking at the same Supabase project as the one
in `.env.local`.

**Add to Home Screen is missing** — you are not in Safari. iOS only allows installation from
Safari.

**The installed app looks stale after a deploy** — the service worker serves the cached shell
first. Close the app fully (swipe it away in the app switcher) and reopen; it revalidates on the
next launch.
