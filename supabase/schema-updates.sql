-- ============================================================
-- Phase 3 Schema Updates
-- Jalankan di Supabase SQL Editor
-- ============================================================

-- 1. kpis: tambah kolom yang dibutuhkan app (type, unit, year, month, dll)
alter table public.kpis
  add column if not exists type     text not null default 'result'
    check (type in ('result','activity','quality')),
  add column if not exists unit     text not null default 'number',
  add column if not exists period   text not null default 'monthly',
  add column if not exists monthly_target numeric not null default 0,
  add column if not exists year     int  not null default extract(year  from now())::int,
  add column if not exists month    int  not null check (month between 1 and 12) default extract(month from now())::int,
  add column if not exists brand    text,
  add column if not exists status   text not null default 'active';

-- 2. kpi_assignments: tambah status dan department_id
alter table public.kpi_assignments
  add column if not exists status text not null default 'active'
    check (status in ('active','hold','cancelled','completed')),
  add column if not exists department_id uuid references public.departments(id);

-- 3. kpi_settings: tambah result_weight dan activity_weight
alter table public.kpi_settings
  add column if not exists result_weight   numeric not null default 40,
  add column if not exists activity_weight numeric not null default 30;

-- 4. Recreate feedbacks table sebagai bug/feature report system
-- (tabel lama: assignment_id FK, tidak cocok dengan app)
drop table if exists public.feedbacks cascade;

create table public.feedbacks (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.users(id) on delete set null,
  user_name   text not null,
  department  text not null default '',
  role        text not null default 'tim',
  type        text not null default 'other'
    check (type in ('bug','feature','other')),
  status      text not null default 'open'
    check (status in ('open','in_progress','resolved','rejected')),
  message     text not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.feedbacks enable row level security;

create policy "feedbacks_read" on public.feedbacks
  for select using (true);

create policy "feedbacks_insert" on public.feedbacks
  for insert with check (auth.uid() = user_id);

create policy "feedbacks_update" on public.feedbacks
  for update using (
    (select kpi_role from public.users where id = auth.uid()) = 'developer'
  );

create trigger set_updated_at_feedbacks
  before update on public.feedbacks
  for each row execute function public.set_updated_at();

-- 5. Enable Supabase Realtime pada tabel-tabel kritis
do $$ begin
  alter publication supabase_realtime add table public.kpi_assignments;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.daily_reports;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.monthly_scores;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.kpi_settings;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.users;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.feedbacks;
exception when duplicate_object then null; end $$;

-- 6. Tambah kolom yang dibutuhkan app tapi belum ada di schema awal
alter table public.users
  add column if not exists managed_departments text[] not null default '{}';

alter table public.kpis
  add column if not exists deleted_at timestamptz;

alter table public.kpi_assignments
  add column if not exists cancelled_at timestamptz;

alter table public.kpi_settings
  add column if not exists updated_by uuid references public.users(id) on delete set null;

alter table public.daily_reports
  add column if not exists kpi_id uuid references public.kpis(id) on delete set null;
