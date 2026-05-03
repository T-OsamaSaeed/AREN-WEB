-- Aren Academy Teacher PWA Supabase schema
-- Run this in the Supabase SQL Editor for the internal test version.

create extension if not exists pgcrypto;

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  teacher_name text not null unique,
  subject_area text not null default '',
  role_note text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.schedule_sessions (
  id uuid primary key default gen_random_uuid(),
  teacher_name text not null,
  day text not null,
  start_time time,
  end_time time,
  time_slot text not null default '',
  subject text not null default '',
  session_type text not null default 'group',
  class_or_student text not null default '',
  notes text not null default '',
  source text not null default 'manual',
  created_at timestamptz not null default now()
);

create table if not exists public.call_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_name text not null,
  student_name text not null,
  phone_number text not null default '',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.weekly_call_notes (
  id uuid primary key default gen_random_uuid(),
  teacher_name text not null,
  student_name text not null,
  phone_number text not null default '',
  week_key text not null,
  note text not null default '',
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint weekly_call_notes_unique_teacher_student_week
    unique (teacher_name, student_name, week_key)
);

create table if not exists public.call_activity_log (
  id uuid primary key default gen_random_uuid(),
  teacher_name text not null,
  student_name text not null,
  phone_number text not null default '',
  week_key text not null,
  action_type text not null,
  action_time timestamptz not null default now(),
  created_at timestamptz not null default now(),
  constraint call_activity_log_action_type_check
    check (action_type in ('call', 'whatsapp'))
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  title text not null default '',
  body text not null default '',
  created_at timestamptz not null default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  teacher_name text not null,
  endpoint text not null unique,
  subscription jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists teachers_active_name_idx
  on public.teachers (is_active, teacher_name);

create index if not exists schedule_sessions_teacher_day_start_idx
  on public.schedule_sessions (teacher_name, day, start_time);

create index if not exists call_assignments_teacher_active_student_idx
  on public.call_assignments (teacher_name, is_active, student_name);

create index if not exists weekly_call_notes_teacher_week_student_idx
  on public.weekly_call_notes (teacher_name, week_key, student_name);

create index if not exists call_activity_log_teacher_week_student_time_idx
  on public.call_activity_log (teacher_name, week_key, student_name, action_time desc);

create index if not exists announcements_created_at_idx
  on public.announcements (created_at desc);

alter table public.teachers enable row level security;
alter table public.schedule_sessions enable row level security;
alter table public.call_assignments enable row level security;
alter table public.weekly_call_notes enable row level security;
alter table public.call_activity_log enable row level security;
alter table public.announcements enable row level security;
alter table public.push_subscriptions enable row level security;

drop policy if exists "Teachers are readable by frontend" on public.teachers;
drop policy if exists "Schedule sessions are readable by frontend" on public.schedule_sessions;
drop policy if exists "Call assignments are readable by frontend" on public.call_assignments;
drop policy if exists "Weekly call notes are readable by frontend" on public.weekly_call_notes;
drop policy if exists "Weekly call notes can be inserted by frontend" on public.weekly_call_notes;
drop policy if exists "Weekly call notes can be updated by frontend" on public.weekly_call_notes;
drop policy if exists "Call activity log is readable by frontend" on public.call_activity_log;
drop policy if exists "Call activity log can be inserted by frontend" on public.call_activity_log;
drop policy if exists "Announcements are readable by frontend" on public.announcements;
drop policy if exists "Push subscriptions are readable by frontend" on public.push_subscriptions;
drop policy if exists "Push subscriptions can be inserted by frontend" on public.push_subscriptions;
drop policy if exists "Push subscriptions can be updated by frontend" on public.push_subscriptions;

create policy "Teachers are readable by frontend"
  on public.teachers
  for select
  to anon, authenticated
  using (true);

create policy "Schedule sessions are readable by frontend"
  on public.schedule_sessions
  for select
  to anon, authenticated
  using (true);

create policy "Call assignments are readable by frontend"
  on public.call_assignments
  for select
  to anon, authenticated
  using (true);

create policy "Weekly call notes are readable by frontend"
  on public.weekly_call_notes
  for select
  to anon, authenticated
  using (true);

create policy "Weekly call notes can be inserted by frontend"
  on public.weekly_call_notes
  for insert
  to anon, authenticated
  with check (true);

create policy "Weekly call notes can be updated by frontend"
  on public.weekly_call_notes
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "Call activity log is readable by frontend"
  on public.call_activity_log
  for select
  to anon, authenticated
  using (true);

create policy "Call activity log can be inserted by frontend"
  on public.call_activity_log
  for insert
  to anon, authenticated
  with check (true);

create policy "Announcements are readable by frontend"
  on public.announcements
  for select
  to anon, authenticated
  using (true);

create policy "Push subscriptions are readable by frontend"
  on public.push_subscriptions
  for select
  to anon, authenticated
  using (true);

create policy "Push subscriptions can be inserted by frontend"
  on public.push_subscriptions
  for insert
  to anon, authenticated
  with check (true);

create policy "Push subscriptions can be updated by frontend"
  on public.push_subscriptions
  for update
  to anon, authenticated
  using (true)
  with check (true);

insert into public.teachers (teacher_name, subject_area, role_note, is_active)
values
  ('GÖKHAN HOCA', 'Matematik / Akıl Oyunları / Mental Aritmetik', '', true),
  ('SAİKOU TEACHER', 'İngilizce', '', true),
  ('AYŞEGÜL HOCA', 'Fen-Bilim', '', true),
  ('RABİA HOCA', 'Çalışma Salonu / Support / Aramalar', '', true),
  ('ZEYNA HOCA', '', 'Inactive teacher kept for archive/history.', false),
  ('ELİF HOCA', '', 'Inactive teacher kept for archive/history.', false)
on conflict (teacher_name) do update set
  subject_area = excluded.subject_area,
  role_note = excluded.role_note,
  is_active = excluded.is_active;
