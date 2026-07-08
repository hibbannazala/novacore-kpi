# CODEBASE.md — NovaCore KPI System

## Types & Interfaces (`src/types/index.ts`)

### KPI Roles
```typescript
type KpiRole = "executive" | "hr" | "head" | "tim" | "developer"
```
- `tim` — karyawan biasa (input KPI harian)
- `head` — kepala divisi (lihat performa tim)
- `hr` — HR (kelola KPI, assignment, karyawan)
- `executive` — eksekutif/CEO (overview seluruh perusahaan)
- `developer` — developer/admin (semua akses + tools import)

### Enum Values Penting
```typescript
KpiType:     "result" | "activity" | "quality"
KpiUnit:     "number" | "currency" | "percentage"
KpiPeriod:   "daily" | "weekly" | "monthly"
KpiStatus:   "draft" | "active" | "adjusted" | "hold" | "cancelled" | "completed" | "archived"
AssignmentStatus: "active" | "hold" | "cancelled" | "completed"
PerformanceCategory: "excellent" | "good" | "warning" | "critical"
```

### Entity Utama

**User**
```typescript
interface User {
  id: string;
  name: string;
  email: string;
  role: string;           // dari absensi app ("admin" | "staff")
  kpiRole?: KpiRole;      // role di sistem KPI ini (optional)
  department: string;
  status: string;         // "active" | "pending"
  isHidden?: boolean;     // true = sembunyi dari semua list user
  points?: number;
  createdAt: Timestamp;
}
```

**KPI**
```typescript
interface KPI {
  id: string;
  title: string;
  description: string;
  type: KpiType;
  unit: KpiUnit;
  period: KpiPeriod;
  department: string;
  monthlyTarget: number;   // total target untuk KPI ini (sum semua assignee)
  year: number;
  month: number;           // 1-12
  status: KpiStatus;
  createdBy: string;       // userId
  deletedAt: Timestamp | null;  // null = aktif, isi = soft-deleted
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

**KpiAssignment**
```typescript
interface KpiAssignment {
  id: string;
  kpiId: string;
  kpiType: KpiType;        // denormalized dari KPI
  userId: string;
  department: string;
  status: AssignmentStatus;
  monthlyTarget: number;   // target per orang (bisa berbeda antar assignee)
  currentDailyTarget: number;
  actualTotal: number;
  expectedTotal: number;
  achievementPercentage: number;  // PACE RATE — (actual/expectedByNow)×100, bukan completion
  performanceCategory: PerformanceCategory;
  workingDaysTotal: number;
  workingDaysElapsed: number;
  workingDaysRemaining: number;
  activeDays: number;
  year: number;
  month: number;
  heldAt: Timestamp | null;
  cancelledAt: Timestamp | null;
  completedAt: Timestamp | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
```

---

## Custom Hooks (`src/hooks/`)

Semua hook menggunakan `onSnapshot` (real-time listener). Format return: `{ data, isLoading }`.

| Hook | File | Query |
|---|---|---|
| `useAllUsers()` | useUsers.ts | `users` where status=active |
| `useDivisionMembers(dept)` | useUsers.ts | `users` where department=dept AND status=active |
| `useKpis(year, month)` | useKpis.ts | `kpis` where year=y AND month=m |
| `useDepartmentKpis(dept, year, month)` | useKpis.ts | `kpis` where dept AND year AND month |
| `useDepartments()` | useDivisions.ts | `system/divisions` (single doc) |
| `useMyAssignments(userId, year, month)` | useAssignments.ts | `kpi_assignments` where userId AND year AND month AND status=active; kemudian fetch KPI docs |
| `useAllAssignments(year, month)` | useAssignments.ts | `kpi_assignments` where year AND month |
| `useDivisionAssignments(dept, year, month)` | useAssignments.ts | `kpi_assignments` where department AND year AND month |
| `useKpiSettings(userId)` | useKpiSettings.ts | `kpi_settings/{userId}` (single doc) |
| `useAllKpiSettings()` | useKpiSettings.ts | `kpi_settings` (full collection) |

---

## Utility Functions (`src/lib/utils.ts`)

### Formatting
```typescript
cn(...classes)                           // merge Tailwind classes
formatCurrency(value)                    // → "Rp 5.000.000"
formatNumber(value)                      // → "5.000"
formatPercentage(value, decimals=1)      // → "85,0%"
formatDateDisplay(isoDate)               // → "Senin, 12 Mei 2026"
monthName(month: number)                 // → "Mei"
```

### Performance
```typescript
getPerformanceCategory(pct: number): PerformanceCategory
// ≥100 → "excellent", ≥80 → "good", ≥50 → "warning", <50 → "critical"

performanceCategoryLabel(cat)    // → "Excellent" | "Good" | "Warning" | "Critical"
performanceCategoryColor(cat)    // → Tailwind color class string
```

### Working Days
```typescript
getWorkingDaysInMonth(year, month): number   // total hari kerja (Senin–Jumat)
getWorkingDaysElapsed(year, month, upToDay): number
getNextWorkingDay(date: Date): Date
isWeekend(date: Date): boolean
todayISODate(): string                       // → "2026-05-12"
```

### Weighted Score (Kalkulasi Utama)
```typescript
calcWeightedScore(
  assignments: KpiAssignment[],
  weights: { resultWeight, activityWeight, qualityWeight }
): WeightedScore

// WeightedScore = {
//   total: number,          ← skor akhir tertimbang (0–100+)
//   category: PerformanceCategory,
//   resultAvg, activityAvg, qualityAvg,
//   resultCount, activityCount, qualityCount,
//   resultWeight, activityWeight, qualityWeight
// }
// Catatan: uses achievementPercentage (pace rate) per assignment
```

---

## Komponen Penting (`src/components/`)

### Layout
- **`Sidebar`** — navigasi kiri, role-aware, tombol devMode toggle untuk developer
- **`Header`** — judul halaman + bulan/tahun aktif

### KPI Display
- **`KpiCard`** — satu assignment sebagai card. Menampilkan "Pencapaian" sebagai **completion rate** (`actualTotal / monthlyTarget × 100`), bukan pace rate. Badge performa dari `performanceCategory` (pace-based dari Cloud Function).
- **`WeightedScoreCard`** — breakdown skor tertimbang per tipe (result/activity/quality)
- **`MemberPerformanceRow`** — satu baris karyawan dengan semua KPI-nya (expandable)
- **`ExpandableStaffGrid`** — grid karyawan dengan expand/collapse individual atau semua sekaligus

### Form
- **`DailyInputForm`** — dialog input nilai harian untuk satu assignment (hanya buat `daily_report` doc; Cloud Function yang update assignment)
- **`CreateKpiForm`** — dialog buat atau edit KPI (dipakai di HR > Manajemen KPI)

### UI (Shadcn — jangan modifikasi struktur)
`button`, `input`, `label`, `card`, `badge`, `select`, `dialog`, `separator`, `textarea`, `progress`, `dropdown-menu`

**Catatan:** `SelectContent` menggunakan `z-[200]` (bukan default `z-50`) agar dropdown tidak tertimpa oleh Dialog saat dipakai di dalam modal.

---

## Firebase Collections Refs (`src/lib/firebase/collections.ts`)

```typescript
COLLECTIONS = {
  USERS: "users",
  KPIS: "kpis",
  KPI_ASSIGNMENTS: "kpi_assignments",
  DAILY_REPORTS: "daily_reports",
  KPI_HISTORIES: "kpi_histories",
  NOTES: "notes",
  PERFORMANCE_SUMMARIES: "performance_summaries",
  KPI_SETTINGS: "kpi_settings",
}

// Helper refs:
kpisRef()              // collection(db, COLLECTIONS.KPIS)
kpiAssignmentsRef()    // collection(db, COLLECTIONS.KPI_ASSIGNMENTS)
usersRef()             // collection(db, COLLECTIONS.USERS)
// dst.
```

---

## Cloud Functions (`functions/src/index.ts`)

| Fungsi | Trigger | Yang Dilakukan |
|---|---|---|
| `onDailyReportCreated` | Firestore onCreate `daily_reports/{id}` | Update `actualTotal`, `expectedTotal`, `achievementPercentage` (pace), `currentDailyTarget`, `workingDaysElapsed`, `performanceCategory`. Tulis ke `kpi_histories`. |
| `generateMonthlySummaries` | Cron `0 23 28-31 * *` | Buat dokumen `performance_summaries`, mark assignment `completed`. |
| `cleanupDeletedKpis` | Cron `0 2 * * *` | Hapus permanen KPI di trash > 30 hari. |
| `recalculateDailyTarget` | Callable HTTPS | Recalculate `currentDailyTarget` berdasarkan sisa hari kerja. |
| `updateAssignmentStatus` | Callable HTTPS | Hold/cancel assignment, tulis ke `kpi_histories`. |

**Formula pace rate (`achievementPercentage`) di Cloud Function:**
```typescript
const expectedTotal = (monthlyTarget / workingDaysTotal) * workingDaysElapsed;
const achievementPct = expectedTotal > 0 ? (newActualTotal / expectedTotal) * 100 : 0;
```

---

## File Kritis — Jangan Diubah Sembarangan

| File | Alasan |
|---|---|
| `src/types/index.ts` | Semua type dipakai di seluruh codebase |
| `src/lib/firebase/client.ts` | Singleton — duplicate init merusak koneksi |
| `src/lib/firebase/collections.ts` | Nama koleksi Firestore yang sudah ada datanya |
| `src/lib/utils.ts` `calcWeightedScore` | Logika scoring utama, dipakai di 10+ tempat |
| `src/contexts/AuthContext.tsx` | Auth + role derivation untuk seluruh app |
| `src/app/dashboard/layout.tsx` | Guard auth — jangan hapus proteksi |
| `firestore.rules` | Security rules Firestore |
| `next.config.ts` | Static export config — ubah bisa break build |
| `functions/src/index.ts` | Cloud Functions — formula pace rate dan monthly summary |

---

## Pola Auth & Role Guard

```typescript
// Di setiap halaman yang butuh role check:
const { user } = useAuth();
if (!user || getKpiRole(user) !== "developer") {
  return <p>Akses tidak diizinkan.</p>;
}

// getKpiRole(user) — fungsi helper di src/types/index.ts
// Mengembalikan kpiRole dari user.kpiRole atau mapping dari user.role
```

---

## Relasi Data KPI

```
KPI (master)
  └─ KpiAssignment × N (satu per karyawan)
       └─ DailyReport × banyak (input harian → Cloud Function update assignment)
       └─ KpiHistory × banyak (audit log)

KpiSettings (per user)
  └─ dipakai oleh calcWeightedScore()

User
  └─ terhubung ke KpiAssignment via userId
  └─ terhubung ke KpiSettings via id (userId = settings doc id)
```

### Aturan Target
- `kpi.monthlyTarget` = **total** target KPI (sum semua assignee non-cancelled)
- `assignment.monthlyTarget` = target **per orang** (bisa berbeda antar assignee)
- Alur assign manual HR: pilih staff → KPI difilter per divisi → target per KPI diisi sendiri
- Saat import CSV: setiap baris tentukan target per orang masing-masing
- Saat edit target per orang: KPI doc `monthlyTarget` direcalculate (sum non-cancelled assignments)
