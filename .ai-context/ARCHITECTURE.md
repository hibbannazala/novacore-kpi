# ARCHITECTURE.md — NovaCore KPI System

## Stack Teknologi

| Layer | Teknologi | Versi |
|---|---|---|
| Framework | Next.js (App Router, static export) | 15.5.16 |
| UI Library | React | 19 |
| Language | TypeScript | 5 |
| Styling | Tailwind CSS | 3.4.1 |
| Component Library | Shadcn/ui (Radix UI primitives) | — |
| Form Validation | React Hook Form + Zod | 7.54.2 / 3.24.1 |
| Charts | Recharts | 2.15.0 |
| Icons | Lucide React | 0.468.0 |
| Auth | Firebase Authentication (Google OAuth) | 11 |
| Database | Firebase Firestore | 11 |
| Cloud Functions | Firebase Functions v2 (Node.js) | — |
| Hosting | Firebase Hosting (`tnt-operational-system`) | — |
| Build | `next build` → static export ke folder `out/` | — |

**Firebase Project:** `absensi-tracker-tnt`
**Hosting URL:** `https://tnt-operational-system.web.app`

> Proyek ini berbagi Firebase project dengan app absensi TNT di
> `https://absensi-tracker-tnt.web.app`. Kedua app baca koleksi Firestore yang sama.

---

## Struktur Folder

```
D:\Task-Management-NovaCore\
├── src/
│   ├── app/                      # Next.js App Router (semua halaman)
│   │   ├── layout.tsx            # Root layout — inject AuthProvider
│   │   ├── page.tsx              # Redirect ke dashboard sesuai role
│   │   ├── globals.css           # CSS global + Tailwind directives
│   │   ├── login/page.tsx        # Halaman login (Google OAuth)
│   │   └── dashboard/
│   │       ├── layout.tsx        # Protected layout — cek auth + render Sidebar
│   │       ├── tim/              # Dashboard karyawan (role: tim)
│   │       ├── head/             # Dashboard kepala divisi (role: head)
│   │       ├── hr/               # Dashboard HR (role: hr)
│   │       ├── executive/        # Dashboard eksekutif (role: executive)
│   │       └── developer/        # Developer tools (role: developer)
│   ├── components/
│   │   ├── layout/               # Sidebar, Header
│   │   ├── kpi/                  # Komponen tampilan KPI & performa
│   │   ├── hr/                   # Form khusus HR (CreateKpiForm)
│   │   └── ui/                   # Shadcn/ui components (11 file)
│   ├── contexts/
│   │   └── AuthContext.tsx       # Global auth state + user Firestore doc
│   ├── hooks/                    # Custom hooks (semua pakai onSnapshot)
│   ├── lib/
│   │   ├── firebase/
│   │   │   ├── client.ts         # Inisialisasi Firebase app (singleton)
│   │   │   └── collections.ts    # Semua Firestore collection refs
│   │   └── utils.ts              # Format, kalkulasi, utility murni
│   └── types/
│       └── index.ts              # Semua TypeScript types & interfaces
├── out/                          # Output build (static HTML/JS/CSS)
├── public/                       # Static assets
├── functions/
│   └── src/
│       ├── index.ts              # Cloud Functions (onDailyReport, summaries, cleanup)
│       └── utils/workingDays.ts  # Helper hari kerja untuk Cloud Functions
├── next.config.ts                # Next.js config (static export, CJS aliases)
├── tailwind.config.ts            # Tailwind config (design tokens, dark mode)
├── tsconfig.json                 # TypeScript config (strict, path alias @/*)
├── firebase.json                 # Firebase hosting & functions config
├── firestore.rules               # Firestore security rules
└── .env.local                    # Firebase env vars (tidak di-commit)
```

---

## Koleksi Firestore

| Koleksi | Isi | Key Fields |
|---|---|---|
| `users` | Profil karyawan | id, name, email, role, kpiRole, department, status, isHidden |
| `kpis` | Definisi KPI master | id, title, type, unit, period, department, monthlyTarget, year, month, status, deletedAt |
| `kpi_assignments` | KPI yang ditugaskan ke user | id, kpiId, userId, monthlyTarget, achievementPercentage (pace), performanceCategory, status, year, month |
| `daily_reports` | Input harian dari karyawan | id, assignmentId, kpiId, userId, date, actualValue |
| `kpi_histories` | Audit log perubahan KPI | id, assignmentId, eventType, previousValue, newValue, triggeredBy |
| `notes` | Catatan performa karyawan | id, type, authorId, targetUserId, isPrivate |
| `performance_summaries` | Ringkasan bulanan (dibuat Cloud Function) | id, userId, year, month, averageAchievement, overallCategory |
| `kpi_settings` | Bobot skor per user | id (= userId), resultWeight, activityWeight, qualityWeight |
| `system/settings` | Setting sistem (jam kerja, dll) | workStart, workEnd |
| `system/divisions` | Daftar divisi/departemen | divisions: string[] |

---

## Alur Data (Data Flow)

```
User Action
    │
    ▼
React Component (useState, event handler)
    │
    ├─── Read  ──► Custom Hook (useXxx)
    │               │
    │               ▼
    │           Firestore onSnapshot
    │               │
    │               ▼
    │           State update → re-render
    │
    └─── Write ──► Direct Firestore call (addDoc/updateDoc)
                    │
                    ├─► Firestore → triggers onSnapshot → state update
                    │
                    └─► (jika daily_report) Cloud Function triggered
                            │
                            ▼
                        Update kpi_assignment (pace rate, daily target)
                        Write kpi_history (audit log)
```

**Auth Flow:**
```
App load
    │
    ▼
AuthContext — onAuthStateChanged listener
    │
    ├─ No user → redirect ke /login
    └─ User found → getDoc(users/{uid})
                        │
                        ▼
                    Derive kpiRole from user.kpiRole
                        │
                        ▼
                    Redirect ke /dashboard/{role}
```

---

## Cloud Functions (Aktif di Produksi)

| Fungsi | Trigger | Deskripsi |
|---|---|---|
| `onDailyReportCreated` | Firestore onCreate `daily_reports/{id}` | Update `actualTotal`, pace rate, `currentDailyTarget`, tulis history |
| `generateMonthlySummaries` | Cron: akhir bulan | Buat `performance_summaries`, mark assignment `completed` |
| `cleanupDeletedKpis` | Cron: setiap hari jam 02.00 WIB | Hapus permanen KPI yang sudah di trash > 30 hari |
| `recalculateDailyTarget` | HTTPS Callable | Recalculate `currentDailyTarget` on demand |
| `updateAssignmentStatus` | HTTPS Callable | Hold/cancel assignment dengan validasi role server-side |

---

## Firestore Security Rules Ringkasan

File: `firestore.rules`

| Koleksi | Read | Write |
|---|---|---|
| `users` | Self, admin, atau active user | Admin, atau self (field terbatas), atau HR/Executive (field kpiRole saja) |
| `kpis` | Semua signed-in user | Create/Update: HR/Executive/Developer; **Delete: HR/Executive/Developer** |
| `kpi_assignments` | Tim (milik sendiri), Head (divisinya), HR/Executive (semua) | Create/Update: HR/Executive; Delete: Executive only |
| `daily_reports` | Tim/Developer (milik sendiri), Head (divisinya), HR/Executive (semua) | Create: Tim/Developer (milik sendiri), HR; Update/Delete: false (immutable) |
| `kpi_settings` | Head ke atas + self | HR/Executive/Developer |
| `kpi_histories` | Head ke atas + Tim (milik sendiri) | false (Cloud Functions only) |
| `performance_summaries` | Tim (milik sendiri), Head (divisinya), HR/Executive | false (Cloud Functions only) |

---

## Service Eksternal

| Service | Kegunaan |
|---|---|
| Firebase Authentication | Google OAuth sign-in/sign-out |
| Firebase Firestore | Database utama (real-time, NoSQL) |
| Firebase Hosting | Serve static build |
| Firebase Cloud Functions | Kalkulasi server-side (pace rate, monthly summary, cleanup) |
| Firebase Emulator Suite | Dev/testing lokal (Auth, Firestore, Functions, Hosting) |

---

## Deployment

1. `npm run build` → menghasilkan folder `out/` (static export)
2. `firebase deploy --only hosting` → upload `out/` ke Firebase Hosting
3. `firebase deploy --only firestore:rules` → update security rules
4. `firebase deploy --only functions` → update Cloud Functions
5. Tidak ada server/API route — 100% client-side dengan Firestore SDK + Cloud Functions untuk server-side logic
