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

-- 4. Enable Supabase Realtime pada tabel-tabel kritis
alter publication supabase_realtime add table public.kpi_assignments;
alter publication supabase_realtime add table public.daily_reports;
alter publication supabase_realtime add table public.monthly_scores;
alter publication supabase_realtime add table public.kpi_settings;
alter publication supabase_realtime add table public.users;
