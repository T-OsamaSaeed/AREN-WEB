-- Aren Academy Teacher PWA clean Next.js + Supabase schema.
-- Run this in the Supabase SQL Editor.

create extension if not exists pgcrypto;

create table if not exists public.teachers (
  id uuid primary key default gen_random_uuid(),
  teacher_name text unique not null,
  subject_area text,
  role_note text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.schedule_sessions (
  id uuid primary key default gen_random_uuid(),
  teacher_name text not null,
  day text not null,
  start_time text,
  end_time text,
  time_slot text not null,
  subject text not null,
  session_type text not null,
  class_or_student text not null,
  notes text,
  source text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.call_assignments (
  id uuid primary key default gen_random_uuid(),
  teacher_name text not null,
  student_name text not null,
  phone_number text,
  is_active boolean default true,
  created_at timestamptz default now()
);

create table if not exists public.weekly_call_notes (
  id uuid primary key default gen_random_uuid(),
  teacher_name text not null,
  student_name text not null,
  phone_number text,
  week_key text not null,
  note text,
  updated_at timestamptz default now(),
  created_at timestamptz default now(),
  unique (teacher_name, student_name, week_key)
);

create table if not exists public.call_activity_log (
  id uuid primary key default gen_random_uuid(),
  teacher_name text not null,
  student_name text not null,
  phone_number text,
  week_key text not null,
  action_type text not null check (action_type in ('call', 'whatsapp')),
  action_time timestamptz default now(),
  created_at timestamptz default now()
);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  date text,
  title text not null,
  body text,
  created_at timestamptz default now()
);

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  teacher_name text,
  endpoint text unique not null,
  subscription jsonb not null,
  created_at timestamptz default now()
);

alter table public.schedule_sessions add column if not exists is_active boolean default true;
alter table public.schedule_sessions add column if not exists source text;
alter table public.schedule_sessions alter column start_time type text using start_time::text;
alter table public.schedule_sessions alter column end_time type text using end_time::text;
alter table public.announcements alter column date type text using date::text;

create index if not exists teachers_active_name_idx
  on public.teachers (is_active, teacher_name);

create index if not exists schedule_sessions_teacher_active_day_idx
  on public.schedule_sessions (teacher_name, is_active, day, start_time);

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

drop policy if exists "teachers_select_anon" on public.teachers;
drop policy if exists "schedule_sessions_select_anon" on public.schedule_sessions;
drop policy if exists "call_assignments_select_anon" on public.call_assignments;
drop policy if exists "announcements_select_anon" on public.announcements;
drop policy if exists "weekly_call_notes_select_anon" on public.weekly_call_notes;
drop policy if exists "weekly_call_notes_insert_anon" on public.weekly_call_notes;
drop policy if exists "weekly_call_notes_update_anon" on public.weekly_call_notes;
drop policy if exists "call_activity_log_select_anon" on public.call_activity_log;
drop policy if exists "call_activity_log_insert_anon" on public.call_activity_log;

create policy "teachers_select_anon"
  on public.teachers
  for select
  to anon, authenticated
  using (true);

create policy "schedule_sessions_select_anon"
  on public.schedule_sessions
  for select
  to anon, authenticated
  using (true);

create policy "call_assignments_select_anon"
  on public.call_assignments
  for select
  to anon, authenticated
  using (true);

create policy "announcements_select_anon"
  on public.announcements
  for select
  to anon, authenticated
  using (true);

create policy "weekly_call_notes_select_anon"
  on public.weekly_call_notes
  for select
  to anon, authenticated
  using (true);

create policy "weekly_call_notes_insert_anon"
  on public.weekly_call_notes
  for insert
  to anon, authenticated
  with check (true);

create policy "weekly_call_notes_update_anon"
  on public.weekly_call_notes
  for update
  to anon, authenticated
  using (true)
  with check (true);

create policy "call_activity_log_select_anon"
  on public.call_activity_log
  for select
  to anon, authenticated
  using (true);

create policy "call_activity_log_insert_anon"
  on public.call_activity_log
  for insert
  to anon, authenticated
  with check (true);

insert into public.teachers (teacher_name, subject_area, role_note, is_active)
values
  ('GÖKHAN HOCA', 'Matematik / Akıl Oyunları / Mental Aritmetik', '', true),
  ('SAİKOU TEACHER', 'İngilizce', '', true),
  ('AYŞEGÜL HOCA', 'Fen-Bilim', '', true),
  ('RABİA HOCA', 'Çalışma Salonu / Support / Aramalar', '', true)
on conflict (teacher_name) do update set
  subject_area = excluded.subject_area,
  role_note = excluded.role_note,
  is_active = true;

update public.teachers
set is_active = false
where teacher_name in ('ELİF HOCA', 'ZEYNA HOCA');
