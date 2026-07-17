-- ============================================================
-- NovaCore KPI — PostgreSQL Schema
-- Jalankan seluruh file ini di Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ============================================================
-- 1. DEPARTMENTS
-- ============================================================
create table if not exists public.departments (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- 2. USERS
-- ============================================================
create table if not exists public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  name          text not null,
  email         text not null unique,
  kpi_role      text not null default 'tim'
                  check (kpi_role in ('tim','head','hr','executive','developer')),
  department_id uuid references public.departments(id) on delete set null,
  position      text,
  photo_url     text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============================================================
-- 3. KPIs
-- ============================================================
create table if not exists public.kpis (
  id             uuid primary key default gen_random_uuid(),
  title          text not null,
  description    text,
  unit           text not null default '',
  category       text not null default 'quantity'
                   check (category in ('quantity','quality')),
  created_by     uuid references public.users(id) on delete set null,
  department_id  uuid references public.departments(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

-- ============================================================
-- 4. KPI_ASSIGNMENTS
-- ============================================================
create table if not exists public.kpi_assignments (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.users(id) on delete cascade,
  kpi_id                 uuid not null references public.kpis(id) on delete cascade,
  year                   int  not null,
  month                  int  not null check (month between 1 and 12),
  monthly_target         numeric not null default 0,
  actual_total           numeric not null default 0,
  achievement_percentage numeric not null default 0,
  weight                 numeric not null default 0,
  notes                  text,
  assigned_by            uuid references public.users(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (user_id, kpi_id, year, month)
);

-- ============================================================
-- 5. MONTHLY_SCORES  (hanya untuk KPI quality)
-- ============================================================
create table if not exists public.monthly_scores (
  id                     uuid primary key default gen_random_uuid(),
  assignment_id          uuid not null references public.kpi_assignments(id) on delete cascade,
  year                   int  not null,
  month                  int  not null check (month between 1 and 12),
  actual_total           numeric not null default 0,
  monthly_target         numeric not null default 0,
  achievement_percentage numeric not null default 0,
  inputted_by            uuid references public.users(id) on delete set null,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  unique (assignment_id, year, month)
);

-- ============================================================
-- 6. DAILY_REPORTS
-- ============================================================
create table if not exists public.daily_reports (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.kpi_assignments(id) on delete cascade,
  user_id       uuid not null references public.users(id) on delete cascade,
  date          date not null,
  value         numeric not null default 0,
  notes         text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  unique (assignment_id, date)
);

-- ============================================================
-- 7. KPI_SETTINGS  (bobot per user)
-- ============================================================
create table if not exists public.kpi_settings (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null unique references public.users(id) on delete cascade,
  quantity_weight numeric not null default 60,
  quality_weight  numeric not null default 40,
  updated_at      timestamptz not null default now()
);

-- ============================================================
-- 8. FEEDBACKS
-- ============================================================
create table if not exists public.feedbacks (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid not null references public.kpi_assignments(id) on delete cascade,
  from_user_id  uuid references public.users(id) on delete set null,
  message       text not null,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- 9. KPI_HISTORIES  (audit log)
-- ============================================================
create table if not exists public.kpi_histories (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid references public.kpi_assignments(id) on delete cascade,
  user_id       uuid references public.users(id) on delete set null,
  action        text not null,
  old_value     jsonb,
  new_value     jsonb,
  created_at    timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_kpi_assignments_user_year_month
  on public.kpi_assignments (user_id, year, month);

create index if not exists idx_kpi_assignments_kpi_id
  on public.kpi_assignments (kpi_id);

create index if not exists idx_daily_reports_assignment_date
  on public.daily_reports (assignment_id, date);

create index if not exists idx_daily_reports_user_id
  on public.daily_reports (user_id);

create index if not exists idx_monthly_scores_assignment_id
  on public.monthly_scores (assignment_id);

create index if not exists idx_users_department
  on public.users (department_id);

-- ============================================================
-- TRIGGERS: auto-update updated_at
-- ============================================================
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_updated_at on public.users;
create trigger trg_users_updated_at
  before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists trg_kpis_updated_at on public.kpis;
create trigger trg_kpis_updated_at
  before update on public.kpis
  for each row execute function public.set_updated_at();

drop trigger if exists trg_kpi_assignments_updated_at on public.kpi_assignments;
create trigger trg_kpi_assignments_updated_at
  before update on public.kpi_assignments
  for each row execute function public.set_updated_at();

drop trigger if exists trg_monthly_scores_updated_at on public.monthly_scores;
create trigger trg_monthly_scores_updated_at
  before update on public.monthly_scores
  for each row execute function public.set_updated_at();

drop trigger if exists trg_daily_reports_updated_at on public.daily_reports;
create trigger trg_daily_reports_updated_at
  before update on public.daily_reports
  for each row execute function public.set_updated_at();

-- ============================================================
-- TRIGGER: recalculate kpi_assignments.actual_total setelah daily_report insert/update/delete
-- ============================================================
create or replace function public.recalculate_assignment_totals()
returns trigger language plpgsql as $$
declare
  v_assignment_id uuid;
  v_total         numeric;
  v_target        numeric;
begin
  v_assignment_id := coalesce(new.assignment_id, old.assignment_id);

  select coalesce(sum(value), 0)
  into   v_total
  from   public.daily_reports
  where  assignment_id = v_assignment_id;

  select monthly_target
  into   v_target
  from   public.kpi_assignments
  where  id = v_assignment_id;

  update public.kpi_assignments
  set
    actual_total           = v_total,
    achievement_percentage = case
      when coalesce(v_target, 0) > 0 then round((v_total / v_target) * 100, 2)
      else 0
    end
  where id = v_assignment_id;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_recalculate_on_report_change on public.daily_reports;
create trigger trg_recalculate_on_report_change
  after insert or update or delete on public.daily_reports
  for each row execute function public.recalculate_assignment_totals();

-- ============================================================
-- TRIGGER: buat kpi_settings default saat user baru dibuat
-- ============================================================
create or replace function public.create_default_kpi_settings()
returns trigger language plpgsql as $$
begin
  insert into public.kpi_settings (user_id, quantity_weight, quality_weight)
  values (new.id, 60, 40)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists trg_create_kpi_settings_on_user on public.users;
create trigger trg_create_kpi_settings_on_user
  after insert on public.users
  for each row execute function public.create_default_kpi_settings();

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================
alter table public.departments     enable row level security;
alter table public.users           enable row level security;
alter table public.kpis            enable row level security;
alter table public.kpi_assignments enable row level security;
alter table public.monthly_scores  enable row level security;
alter table public.daily_reports   enable row level security;
alter table public.kpi_settings    enable row level security;
alter table public.feedbacks       enable row level security;
alter table public.kpi_histories   enable row level security;

-- Helper: ambil kpi_role dari tabel users (tanpa get() call)
create or replace function public.my_kpi_role()
returns text language sql stable security definer as $$
  select kpi_role from public.users where id = auth.uid();
$$;

-- DEPARTMENTS: semua user bisa baca, hanya hr/executive/developer yang bisa write
create policy "departments_read" on public.departments
  for select using (auth.uid() is not null);

create policy "departments_write" on public.departments
  for all using (public.my_kpi_role() in ('hr','executive','developer'));

-- USERS: semua bisa baca, user bisa update profil sendiri, hr/executive/developer bisa manage semua
create policy "users_read" on public.users
  for select using (auth.uid() is not null);

create policy "users_update_own" on public.users
  for update using (id = auth.uid());

create policy "users_manage_privileged" on public.users
  for all using (public.my_kpi_role() in ('hr','executive','developer'));

-- KPIS: semua bisa baca, head/hr/executive/developer bisa write
create policy "kpis_read" on public.kpis
  for select using (auth.uid() is not null);

create policy "kpis_write" on public.kpis
  for all using (public.my_kpi_role() in ('head','hr','executive','developer'));

-- KPI_ASSIGNMENTS: semua bisa baca (own dulu), head/hr/executive bisa manage
create policy "kpi_assignments_read_own" on public.kpi_assignments
  for select using (
    user_id = auth.uid()
    or public.my_kpi_role() in ('head','hr','executive','developer')
  );

create policy "kpi_assignments_write" on public.kpi_assignments
  for all using (public.my_kpi_role() in ('head','hr','executive','developer'));

-- MONTHLY_SCORES: ikut assignment access
create policy "monthly_scores_read" on public.monthly_scores
  for select using (
    exists (
      select 1 from public.kpi_assignments a
      where a.id = assignment_id
      and (a.user_id = auth.uid() or public.my_kpi_role() in ('head','hr','executive','developer'))
    )
  );

create policy "monthly_scores_write" on public.monthly_scores
  for all using (public.my_kpi_role() in ('head','hr','executive','developer'));

-- DAILY_REPORTS: user bisa read/write laporannya sendiri, head/hr/executive bisa baca semua
create policy "daily_reports_read" on public.daily_reports
  for select using (
    user_id = auth.uid()
    or public.my_kpi_role() in ('head','hr','executive','developer')
  );

create policy "daily_reports_write_own" on public.daily_reports
  for insert with check (user_id = auth.uid());

create policy "daily_reports_update_own" on public.daily_reports
  for update using (user_id = auth.uid());

create policy "daily_reports_delete_own" on public.daily_reports
  for delete using (user_id = auth.uid());

create policy "daily_reports_manage_privileged" on public.daily_reports
  for all using (public.my_kpi_role() in ('head','hr','executive','developer'));

-- KPI_SETTINGS: user hanya bisa lihat/update milik sendiri
create policy "kpi_settings_own" on public.kpi_settings
  for all using (user_id = auth.uid());

create policy "kpi_settings_read_privileged" on public.kpi_settings
  for select using (public.my_kpi_role() in ('head','hr','executive','developer'));

-- FEEDBACKS: semua bisa baca milik assignment sendiri, head/hr/executive bisa write
create policy "feedbacks_read" on public.feedbacks
  for select using (
    exists (
      select 1 from public.kpi_assignments a
      where a.id = assignment_id
      and (a.user_id = auth.uid() or public.my_kpi_role() in ('head','hr','executive','developer'))
    )
  );

create policy "feedbacks_write" on public.feedbacks
  for all using (public.my_kpi_role() in ('head','hr','executive','developer'));

-- KPI_HISTORIES: read-only untuk semua yang punya akses ke assignment
create policy "kpi_histories_read" on public.kpi_histories
  for select using (
    exists (
      select 1 from public.kpi_assignments a
      where a.id = assignment_id
      and (a.user_id = auth.uid() or public.my_kpi_role() in ('head','hr','executive','developer'))
    )
  );

create policy "kpi_histories_write" on public.kpi_histories
  for insert with check (public.my_kpi_role() in ('head','hr','executive','developer'));
