# Tech Spec: Migrasi NovaCore KPI — Firebase → Supabase + Vercel

**Versi:** 1.0  
**Tanggal:** 2026-07-08  
**Stack Baru:** Next.js 15 + Supabase (PostgreSQL + Auth + Realtime) + Vercel  
**GitHub Account:** hibbannazala.hn@gmail.com

---

## 1. Ringkasan Perubahan

| Komponen | Sebelum | Sesudah |
|---|---|---|
| Database | Firestore (NoSQL) | PostgreSQL (Supabase) |
| Auth | Firebase Auth (Google OAuth) | Supabase Auth (Google OAuth) |
| Realtime | Firestore onSnapshot | Supabase Realtime |
| Backend logic | Firebase Cloud Functions | PostgreSQL Triggers + Supabase Edge Functions |
| Hosting | Firebase Hosting (static export) | Vercel (full SSR) |
| Mode render | Static Export (`output: "export"`) | Full SSR (App Router) |

---

## 2. PostgreSQL Schema (9 Tabel)

### 2.1 `departments`
Menggantikan `system/divisions` (single Firestore document dengan field `list: string[]`).

```sql
CREATE TABLE departments (
  id   SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.2 `users`
Extends Supabase `auth.users`. Menggantikan Firestore `users` collection.  
Field `role` (absensi: admin/staff) dihapus karena KPI app tidak pakai.

```sql
CREATE TABLE users (
  id                  UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name                TEXT NOT NULL,
  email               TEXT NOT NULL,
  department          TEXT,
  kpi_role            TEXT NOT NULL DEFAULT 'tim'
                        CHECK (kpi_role IN ('tim', 'head', 'hr', 'executive', 'developer')),
  managed_departments TEXT[] DEFAULT '{}',
  created_at          TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.3 `kpis`
Menggantikan Firestore `kpis` collection.

```sql
CREATE TABLE kpis (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title          TEXT NOT NULL,
  description    TEXT,
  type           TEXT NOT NULL CHECK (type IN ('result', 'activity', 'quality')),
  unit           TEXT NOT NULL DEFAULT 'number'
                   CHECK (unit IN ('number', 'currency', 'percentage')),
  department     TEXT,
  brand          TEXT,
  year           INT NOT NULL,
  month          INT CHECK (month BETWEEN 1 AND 12),
  monthly_target NUMERIC NOT NULL DEFAULT 0,
  period         TEXT CHECK (period IN ('monthly', 'quarterly', 'yearly')),
  status         TEXT NOT NULL DEFAULT 'draft'
                   CHECK (status IN ('draft','active','completed','cancelled','hold','archived')),
  created_by     UUID REFERENCES users(id),
  created_at     TIMESTAMPTZ DEFAULT NOW(),
  updated_at     TIMESTAMPTZ DEFAULT NOW(),
  deleted_at     TIMESTAMPTZ  -- soft delete, NULL = tidak dihapus
);
```

### 2.4 `kpi_assignments`
Menggantikan Firestore `kpi_assignments` collection.  
Field `monthlyScores` (nested map) dipindah ke tabel `monthly_scores` terpisah.

```sql
CREATE TABLE kpi_assignments (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kpi_id                 UUID NOT NULL REFERENCES kpis(id),
  user_id                UUID NOT NULL REFERENCES users(id),
  department             TEXT,
  kpi_type               TEXT CHECK (kpi_type IN ('result', 'activity', 'quality')),
  year                   INT NOT NULL,
  month                  INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  monthly_target         NUMERIC NOT NULL DEFAULT 0,
  actual_total           NUMERIC DEFAULT 0,        -- dihitung oleh trigger
  expected_total         NUMERIC DEFAULT 0,        -- dihitung oleh cron
  achievement_percentage NUMERIC DEFAULT 0,        -- dihitung oleh trigger
  performance_category   TEXT DEFAULT 'Critical',  -- dihitung oleh trigger
  current_daily_target   NUMERIC DEFAULT 0,        -- dihitung oleh cron
  working_days_total     INT DEFAULT 0,
  working_days_elapsed   INT DEFAULT 0,
  working_days_remaining INT DEFAULT 0,
  quality_notes          TEXT,
  status                 TEXT NOT NULL DEFAULT 'active'
                           CHECK (status IN ('active','completed','cancelled','hold')),
  created_by             UUID REFERENCES users(id),
  created_at             TIMESTAMPTZ DEFAULT NOW(),
  updated_at             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(kpi_id, user_id, year, month)
);
```

### 2.5 `monthly_scores`
**BARU** — menggantikan field `monthlyScores: Record<"YYYY-M", QualityMonthScore>` yang ada di dalam dokumen Firestore.  
Dulu nested map di dalam assignment, sekarang tabel terpisah dengan relasi proper.

```sql
CREATE TABLE monthly_scores (
  id                     SERIAL PRIMARY KEY,
  assignment_id          UUID NOT NULL REFERENCES kpi_assignments(id) ON DELETE CASCADE,
  year                   INT NOT NULL,
  month                  INT NOT NULL CHECK (month BETWEEN 1 AND 12),
  actual_total           NUMERIC DEFAULT 0,
  achievement_percentage NUMERIC DEFAULT 0,
  performance_category   TEXT DEFAULT 'Critical',
  quality_notes          TEXT,
  updated_at             TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(assignment_id, year, month)
);
```

### 2.6 `daily_reports`
Menggantikan Firestore `daily_reports` collection.  
Field `date` tetap sebagai `DATE` (bukan Timestamp), konsisten dengan Firestore.

```sql
CREATE TABLE daily_reports (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id       UUID NOT NULL REFERENCES kpi_assignments(id),
  kpi_id              UUID NOT NULL REFERENCES kpis(id),
  user_id             UUID NOT NULL REFERENCES users(id),
  date                DATE NOT NULL,
  actual_value        NUMERIC NOT NULL DEFAULT 0,
  notes               TEXT,
  is_holiday_rollover BOOLEAN DEFAULT FALSE,
  created_at          TIMESTAMPTZ DEFAULT NOW(),
  updated_at          TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.7 `kpi_settings`
Menggantikan Firestore `kpi_settings` collection.

```sql
CREATE TABLE kpi_settings (
  user_id         UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  result_weight   INT NOT NULL DEFAULT 40,
  activity_weight INT NOT NULL DEFAULT 30,
  quality_weight  INT NOT NULL DEFAULT 30,
  updated_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_by      UUID REFERENCES users(id),
  CHECK (result_weight + activity_weight + quality_weight = 100)
);
```

### 2.8 `feedbacks`
Menggantikan Firestore `feedbacks` collection.

```sql
CREATE TABLE feedbacks (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id),
  content    TEXT NOT NULL,
  type       TEXT DEFAULT 'general',
  status     TEXT DEFAULT 'open',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
```

### 2.9 `kpi_histories`
Menggantikan Firestore `kpi_histories` (append-only audit log).

```sql
CREATE TABLE kpi_histories (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type    TEXT NOT NULL,
  assignment_id UUID REFERENCES kpi_assignments(id),
  kpi_id        UUID REFERENCES kpis(id),
  user_id       UUID REFERENCES users(id),
  data          JSONB,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 3. Indexes

```sql
-- kpi_assignments: query utama
CREATE INDEX idx_assignments_user_year_month   ON kpi_assignments(user_id, year, month);
CREATE INDEX idx_assignments_dept_year_month   ON kpi_assignments(department, year, month);
CREATE INDEX idx_assignments_kpi_id            ON kpi_assignments(kpi_id);
CREATE INDEX idx_assignments_year_month_status ON kpi_assignments(year, month, status);

-- daily_reports: query utama
CREATE INDEX idx_daily_reports_assignment_id   ON daily_reports(assignment_id);
CREATE INDEX idx_daily_reports_user_date       ON daily_reports(user_id, date);
CREATE INDEX idx_daily_reports_date            ON daily_reports(date);

-- kpis
CREATE INDEX idx_kpis_year_month   ON kpis(year, month);
CREATE INDEX idx_kpis_department   ON kpis(department);
CREATE INDEX idx_kpis_deleted_at   ON kpis(deleted_at) WHERE deleted_at IS NOT NULL;

-- monthly_scores
CREATE INDEX idx_monthly_scores_assignment ON monthly_scores(assignment_id);
```

---

## 4. PostgreSQL Triggers (menggantikan Cloud Functions)

### 4.1 Auto-update `actual_total` setelah daily_report INSERT/UPDATE/DELETE

```sql
CREATE OR REPLACE FUNCTION recalculate_assignment_totals()
RETURNS TRIGGER AS $$
DECLARE
  v_assignment_id UUID;
  v_total         NUMERIC;
  v_target        NUMERIC;
  v_pct           NUMERIC;
  v_category      TEXT;
BEGIN
  v_assignment_id := COALESCE(NEW.assignment_id, OLD.assignment_id);

  SELECT COALESCE(SUM(actual_value), 0), monthly_target
  INTO v_total, v_target
  FROM daily_reports dr
  JOIN kpi_assignments ka ON ka.id = dr.assignment_id
  WHERE dr.assignment_id = v_assignment_id
  GROUP BY ka.monthly_target;

  v_pct := CASE WHEN v_target > 0 THEN (v_total / v_target * 100) ELSE 0 END;

  v_category := CASE
    WHEN v_pct >= 100 THEN 'Excellent'
    WHEN v_pct >= 85  THEN 'Good'
    WHEN v_pct >= 70  THEN 'Warning'
    ELSE 'Critical'
  END;

  UPDATE kpi_assignments
  SET actual_total           = v_total,
      achievement_percentage = v_pct,
      performance_category   = v_category,
      updated_at             = NOW()
  WHERE id = v_assignment_id;

  INSERT INTO kpi_histories (event_type, assignment_id, user_id, data)
  VALUES (
    CASE TG_OP
      WHEN 'INSERT' THEN 'daily_report_submitted'
      WHEN 'UPDATE' THEN 'daily_report_updated'
      WHEN 'DELETE' THEN 'daily_report_deleted'
    END,
    v_assignment_id,
    COALESCE(NEW.user_id, OLD.user_id),
    jsonb_build_object(
      'actual_value', COALESCE(NEW.actual_value, OLD.actual_value),
      'date', COALESCE(NEW.date, OLD.date),
      'new_total', v_total
    )
  );

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_daily_report_changes
  AFTER INSERT OR UPDATE OR DELETE ON daily_reports
  FOR EACH ROW EXECUTE FUNCTION recalculate_assignment_totals();
```

### 4.2 Auto-create `kpi_settings` default saat user baru

```sql
CREATE OR REPLACE FUNCTION create_default_kpi_settings()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO kpi_settings (user_id) VALUES (NEW.id)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_user_kpi_settings
  AFTER INSERT ON users
  FOR EACH ROW EXECUTE FUNCTION create_default_kpi_settings();
```

### 4.3 Auto-update `updated_at` (semua tabel)

```sql
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_kpis_updated_at
  BEFORE UPDATE ON kpis FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_assignments_updated_at
  BEFORE UPDATE ON kpi_assignments FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_daily_reports_updated_at
  BEFORE UPDATE ON daily_reports FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

---

## 5. Row Level Security (menggantikan firestore.rules)

```sql
-- Enable RLS semua tabel
ALTER TABLE users          ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpis           ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_reports  ENABLE ROW LEVEL SECURITY;
ALTER TABLE monthly_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_settings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE feedbacks      ENABLE ROW LEVEL SECURITY;
ALTER TABLE kpi_histories  ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments    ENABLE ROW LEVEL SECURITY;

-- Semua operasi: harus login
-- Read: semua yang login bisa baca
CREATE POLICY "authenticated_read" ON users          FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_read" ON kpis           FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_read" ON kpi_assignments FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_read" ON daily_reports  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_read" ON monthly_scores FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_read" ON kpi_settings   FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_read" ON feedbacks      FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_read" ON kpi_histories  FOR SELECT USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_read" ON departments    FOR SELECT USING (auth.uid() IS NOT NULL);

-- Write: authenticated (role enforcement di UI layer, sama seperti sebelumnya)
CREATE POLICY "authenticated_write" ON kpis            FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_write" ON kpi_assignments FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_write" ON monthly_scores  FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_write" ON kpi_settings    FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_write" ON feedbacks       FOR ALL USING (auth.uid() IS NOT NULL);
CREATE POLICY "authenticated_write" ON departments     FOR ALL USING (auth.uid() IS NOT NULL);

-- Daily reports: punya sendiri bisa update, punya orang lain bisa update kecuali identity fields
CREATE POLICY "daily_reports_write" ON daily_reports FOR ALL USING (auth.uid() IS NOT NULL);

-- Users: tidak bisa ganti role sendiri (cegah self-promotion)
CREATE POLICY "users_update" ON users FOR UPDATE USING (auth.uid() IS NOT NULL);

-- kpi_histories: insert only (no update/delete)
CREATE POLICY "histories_insert" ON kpi_histories FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "histories_read"   ON kpi_histories FOR SELECT USING (auth.uid() IS NOT NULL);
```

---

## 6. Cron Jobs (Supabase pg_cron — menggantikan Cloud Functions cron)

```sql
-- Harian 00:05 WIB (17:05 UTC): update working day metrics semua assignment aktif
SELECT cron.schedule(
  'daily-recalculate-assignments',
  '5 17 * * *',  -- 00:05 WIB = 17:05 UTC
  $$
  UPDATE kpi_assignments
  SET
    working_days_elapsed   = (/* hitung hari kerja yang sudah lewat bulan ini */),
    working_days_remaining = working_days_total - working_days_elapsed,
    current_daily_target   = CASE
      WHEN working_days_remaining > 0
      THEN GREATEST(0, monthly_target - actual_total) / working_days_remaining
      ELSE 0
    END,
    expected_total = (monthly_target / NULLIF(working_days_total, 0)) * working_days_elapsed,
    updated_at = NOW()
  WHERE status = 'active' AND year = EXTRACT(YEAR FROM NOW()) AND month = EXTRACT(MONTH FROM NOW());
  $$
);

-- Harian 02:00 WIB (19:00 UTC): hapus KPI yang deleted_at > 30 hari
SELECT cron.schedule(
  'cleanup-deleted-kpis',
  '0 19 * * *',
  $$
  DELETE FROM kpis WHERE deleted_at IS NOT NULL AND deleted_at < NOW() - INTERVAL '30 days';
  $$
);

-- Akhir bulan 23:00 WIB (16:00 UTC), hari 28-31: generate monthly summary
SELECT cron.schedule(
  'monthly-summary',
  '0 16 28-31 * *',
  $$
  -- Mark assignments completed dan catat summary
  UPDATE kpi_assignments
  SET status = 'completed', updated_at = NOW()
  WHERE status = 'active'
    AND year = EXTRACT(YEAR FROM NOW())
    AND month = EXTRACT(MONTH FROM NOW())
    AND NOW() = DATE_TRUNC('month', NOW()) + INTERVAL '1 month' - INTERVAL '1 day';
  $$
);
```

---

## 7. Environment Variables Baru

Hapus semua `NEXT_PUBLIC_FIREBASE_*`, ganti dengan:

```env
# Supabase (public — aman di client)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIs...

# Supabase (server-only — untuk Edge Functions / middleware)
SUPABASE_SERVICE_ROLE_KEY=eyJhbGciOiJIUzI1NiIs...
```

---

## 8. Perubahan Kode — File per File

### 8.1 `next.config.ts` — HAPUS static export

```typescript
// BEFORE (Firebase Hosting = static export wajib)
const nextConfig: NextConfig = {
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  webpack: (config, { isServer }) => { /* Firebase aliases */ }
};

// AFTER (Vercel = full SSR, semua fitur Next.js tersedia)
const nextConfig: NextConfig = {
  // Tidak ada output: "export"
  // Tidak ada Firebase webpack aliases
};
```

### 8.2 `src/lib/supabase/client.ts` — BARU (gantikan firebase/client.ts)

```typescript
import { createBrowserClient } from '@supabase/ssr'
import type { Database } from './database.types'  // generated dari Supabase

export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
```

### 8.3 `src/lib/supabase/server.ts` — BARU (untuk Server Components & middleware)

```typescript
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './database.types'

export async function createServerSupabaseClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) } }
  )
}
```

### 8.4 `middleware.ts` — BARU (session refresh otomatis)

```typescript
import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => request.cookies.getAll(), setAll: (c) => c.forEach(({ name, value, options }) => response.cookies.set(name, value, options)) } }
  )
  await supabase.auth.getUser()
  return response
}

export const config = {
  matcher: ['/dashboard/:path*']
}
```

### 8.5 `src/contexts/AuthContext.tsx` — REWRITE

```typescript
// Ganti:
// - Firebase Auth → Supabase Auth
// - onSnapshot(users/{uid}) → supabase.from('users').select().eq('id', uid) + channel realtime
// - signInWithPopup → supabase.auth.signInWithOAuth({ provider: 'google' })
// - signOut → supabase.auth.signOut()

// Interface tetap sama persis → komponen lain TIDAK PERLU diubah
interface AuthContextValue {
  user: User | null;           // sama
  kpiRole: KpiRole | null;     // sama
  isLoading: boolean;          // sama
  devMode: DevMode;            // sama
  toggleDevMode: () => void;   // sama
  signInWithGoogle: () => Promise<void>;  // sama
  signOut: () => Promise<void>;           // sama
}
```

### 8.6 `src/lib/firebase/` → `src/lib/supabase/` — REWRITE semua hooks

Setiap hook Firestore dikonversi ke Supabase query:

| Hook Lama | Firestore Query | Supabase Equivalent |
|---|---|---|
| `useAllUsers` | `onSnapshot(query(usersRef, where("status","==","active")))` | `supabase.from('users').select('*').channel('users').on('postgres_changes', ...)` |
| `useMyAssignments` | `onSnapshot(query(..., where("userId","==",uid), where("year","==",y)))` | `supabase.from('kpi_assignments').select('*, kpis(*)').eq('user_id', uid).eq('year', y)` |
| `useAssignmentsForPeriod` | 10+ parallel getDocs dengan chunking | `supabase.from('kpi_assignments').select('*, kpis(*), monthly_scores(*), daily_reports(*)').eq('year', y).in('month', months)` |
| `useDailyReportsInRange` | `onSnapshot(query(..., where("date",">=",start), where("date","<=",end)))` | `supabase.from('daily_reports').select('*').gte('date', start).lte('date', end)` |
| `useAllKpiSettings` | `onSnapshot(query(kpiSettingsRef()))` | `supabase.from('kpi_settings').select('*')` |

**Eliminasi chunking**: Tidak ada lagi `chunkArray(..., 10)` karena PostgreSQL tidak punya limit `in` 10 items.

**Eliminasi client-side join**: `useMyAssignments` tidak perlu lagi fetch KPI docs secara terpisah — cukup `.select('*, kpis(*)')`.

### 8.7 `src/lib/firebase/collections.ts` — HAPUS

Tidak diperlukan. Supabase menggunakan nama tabel langsung.

### 8.8 `firestore.rules` — HAPUS

Digantikan oleh RLS policies di Supabase (lihat section 5).

### 8.9 `functions/` folder — HAPUS

Cloud Functions digantikan oleh PostgreSQL triggers (section 4) dan Supabase pg_cron (section 6).

---

## 9. Supabase Auth — Google OAuth Setup

1. Di Supabase Dashboard → Authentication → Providers → Google → Enable
2. Masukkan Google Client ID dan Secret (dari Google Cloud Console, project yang sama)
3. Tambahkan callback URL: `https://xxxxxxxxxxxx.supabase.co/auth/v1/callback`
4. Di Google Cloud Console → tambahkan URL callback Supabase ke Authorized redirect URIs
5. Di Supabase → Authentication → URL Configuration:
   - Site URL: `https://novacore-kpi.vercel.app` (URL Vercel nanti)
   - Redirect URLs: tambahkan URL Vercel

**Trigger auto-create user profile:**
```sql
-- Saat user pertama kali login Google, otomatis buat row di public.users
CREATE OR REPLACE FUNCTION handle_new_auth_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, name, email, kpi_role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    NEW.email,
    'tim'  -- default role
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_auth_user();
```

---

## 10. Data Migration (Firestore → PostgreSQL)

### Script migrasi (Node.js, jalankan sekali)

Urutan migrasi penting — ikuti urutan foreign key:

```
1. departments     (dari system/divisions)
2. users           (dari Firestore users — mapping Firebase UID → Supabase UUID)
3. kpi_settings    (dari Firestore kpi_settings)
4. kpis            (dari Firestore kpis)
5. kpi_assignments (dari Firestore kpi_assignments — extract monthlyScores juga)
6. monthly_scores  (dari monthlyScores nested di kpi_assignments)
7. daily_reports   (dari Firestore daily_reports)
8. feedbacks       (dari Firestore feedbacks)
```

### Masalah UID: Firebase UID → Supabase UUID

Firebase UIDs adalah string alfanumerik (`abc123xyz`), Supabase Auth UIDs adalah UUID (`uuid-v4`).

**Solusi**: Gunakan Supabase Admin API untuk create users dengan metadata yang menyimpan Firebase UID lama:
```javascript
// Untuk setiap user di Firestore:
const { data } = await supabase.auth.admin.createUser({
  email: firestoreUser.email,
  user_metadata: { 
    full_name: firestoreUser.name,
    firebase_uid: firestoreUser.id  // simpan UID lama untuk referensi
  },
  email_confirm: true
})
// Simpan mapping: firebaseUID → supabaseUUID
const uidMap[firestoreUser.id] = data.user.id
```

Semua field `userId` di Firestore documents di-remap menggunakan `uidMap`.

---

## 11. Vercel Deployment

### `vercel.json`
```json
{
  "framework": "nextjs",
  "buildCommand": "npm run build",
  "outputDirectory": ".next"
}
```

### Environment Variables di Vercel Dashboard
```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
```

### Domain
- Preview: `novacore-kpi-git-main-hibbannazala.vercel.app` (auto)
- Production: custom domain bisa ditambah nanti

---

## 12. Urutan Implementasi

### Fase 1: Setup (1-2 hari)
- [ ] Buat Supabase project baru
- [ ] Jalankan semua SQL schema (sections 2-6)
- [ ] Setup Google OAuth di Supabase
- [ ] Buat Vercel project, connect ke GitHub
- [ ] Setup environment variables

### Fase 2: Core infrastructure (2-3 hari)
- [ ] Install `@supabase/supabase-js` dan `@supabase/ssr`
- [ ] Hapus `output: "export"` dari `next.config.ts`
- [ ] Buat `src/lib/supabase/client.ts`, `server.ts`
- [ ] Generate TypeScript types dari Supabase: `supabase gen types typescript`
- [ ] Buat `middleware.ts` untuk session management
- [ ] Rewrite `AuthContext.tsx`

### Fase 3: Hooks & queries (3-5 hari)
- [ ] Rewrite semua hooks di `src/hooks/` (11 hooks)
- [ ] Hapus `src/lib/firebase/` folder
- [ ] Test setiap hook dengan Supabase

### Fase 4: Pages & components (2-3 hari)
- [ ] Test semua pages — sebagian besar tidak perlu diubah
- [ ] Fix komponen yang langsung pakai Firebase (DailyInputForm, KPI pages)
- [ ] Test realtime subscriptions

### Fase 5: Data migration (1-2 hari)
- [ ] Tulis dan test migration script dengan data sample
- [ ] Jalankan migration ke Supabase
- [ ] Verifikasi data integrity

### Fase 6: Deploy & testing (1-2 hari)
- [ ] Deploy ke Vercel
- [ ] Test semua role (tim, head, hr, executive, developer)
- [ ] Test realtime features
- [ ] Parallel test dengan Firebase app lama

**Total estimasi: 10-17 hari**

---

## 13. Packages yang Berubah

```bash
# Hapus
npm uninstall firebase

# Tambah
npm install @supabase/supabase-js @supabase/ssr

# Tambah (dev) — untuk generate types
npm install -D supabase
```

---

## 14. Yang TIDAK Berubah

- Semua komponen UI (`src/components/`) — **tidak perlu disentuh**
- Semua page layouts dan struktur routing
- Tailwind config, shadcn/ui components
- TypeScript types di `src/types/index.ts` (minor update untuk hapus Firestore Timestamp)
- Logic kalkulasi di `src/lib/utils.ts` (`calcWeightedScore`, dll.)
- Sidebar navigation, role-based routing

---

## 15. Queries SQL Contoh (yang tidak bisa dilakukan di Firestore)

```sql
-- Overview semua karyawan dengan weighted score dalam SATU query
SELECT
  u.id, u.name, u.department,
  ROUND(
    SUM(ka.achievement_percentage *
      CASE ka.kpi_type
        WHEN 'result'   THEN ks.result_weight
        WHEN 'activity' THEN ks.activity_weight
        WHEN 'quality'  THEN ks.quality_weight
      END
    ) / NULLIF(SUM(
      CASE ka.kpi_type
        WHEN 'result'   THEN ks.result_weight
        WHEN 'activity' THEN ks.activity_weight
        WHEN 'quality'  THEN ks.quality_weight
      END
    ), 0)
  , 2) AS weighted_score
FROM users u
JOIN kpi_assignments ka ON ka.user_id = u.id
JOIN kpi_settings ks ON ks.user_id = u.id
WHERE ka.year = 2026 AND ka.month = 6 AND ka.status = 'active'
GROUP BY u.id, u.name, u.department
ORDER BY weighted_score DESC;
```

```sql
-- Daily reports untuk satu assignment dengan total
SELECT
  date,
  actual_value,
  SUM(actual_value) OVER (ORDER BY date) AS running_total,
  notes
FROM daily_reports
WHERE assignment_id = 'uuid-here'
ORDER BY date DESC;
```

---

*Tech spec ini mencakup semua yang diperlukan untuk migrasi penuh dari Firebase ke Supabase + Vercel. Firebase app lama tetap berjalan selama proses migrasi.*
