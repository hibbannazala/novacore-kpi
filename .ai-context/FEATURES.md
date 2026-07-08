# FEATURES.md — Status Fitur NovaCore KPI

## Autentikasi & Akses

| Fitur | Status | Lokasi |
|---|---|---|
| Login dengan Google | ✅ Done | `/login` |
| Redirect otomatis ke dashboard sesuai role | ✅ Done | `src/app/page.tsx` |
| Guard auth di semua halaman dashboard | ✅ Done | `src/app/dashboard/layout.tsx` |
| Logout | ✅ Done | Sidebar footer |
| Developer mode toggle (employee ↔ management view) | ✅ Done | Sidebar, `AuthContext` |

---

## Role: Tim (Karyawan)

| Fitur | Status | Lokasi |
|---|---|---|
| Dashboard dengan weighted score + breakdown | ✅ Done | `/dashboard/tim` |
| Daftar KPI aktif bulan ini | ✅ Done | `/dashboard/tim/kpi` |
| Input nilai KPI harian | ✅ Done | `/dashboard/tim/input` |
| Riwayat perubahan KPI (audit log) | ✅ Done | `/dashboard/tim/history` |

---

## Role: Head (Kepala Divisi)

| Fitur | Status | Lokasi |
|---|---|---|
| Dashboard overview divisi (rata-rata, count per kategori) | ✅ Done | `/dashboard/head` |
| Grid performa anggota tim (expandable per KPI) | ✅ Done | `/dashboard/head` |
| Manajemen KPI divisi | ✅ Done | `/dashboard/head/kpi` |
| Laporan performa divisi | ✅ Done | `/dashboard/head/reports` |
| Detail performa per anggota | ✅ Done | `/dashboard/head/team` |

---

## Role: HR

| Fitur | Status | Lokasi |
|---|---|---|
| Dashboard HR (statistik KPI perusahaan) | ✅ Done | `/dashboard/hr` |
| Buat/edit/hapus KPI master | ✅ Done | `/dashboard/hr/kpi` |
| Soft delete KPI (trash + restore + permanent delete) | ✅ Done | `/dashboard/hr/kpi` |
| Hapus KPI dengan cascade cancel semua assignment | ✅ Done | `/dashboard/hr/kpi` |
| Assign KPI ke karyawan — pilih staff → KPI per divisi (checklist) | ✅ Done | `/dashboard/hr/assignments` |
| Edit target per orang setelah assignment dibuat | ✅ Done | `/dashboard/hr/assignments` |
| Hold / aktifkan / batalkan assignment | ✅ Done | `/dashboard/hr/assignments` |
| Dashboard kualitas KPI | ✅ Done | `/dashboard/hr/quality` |
| Manajemen karyawan (assign kpiRole, catatan, status) | ✅ Done | `/dashboard/hr/employees` |
| Manajemen divisi/departemen | ✅ Done | `/dashboard/hr/divisions` |

---

## Role: Executive

| Fitur | Status | Lokasi |
|---|---|---|
| Dashboard eksekutif (overview seluruh perusahaan) | ✅ Done | `/dashboard/executive` |
| Overview expandable per divisi → per karyawan | ✅ Done | `/dashboard/executive/overview` |
| Perbandingan performa antar divisi | ✅ Done | `/dashboard/executive/divisions` |
| Performa semua karyawan | ✅ Done | `/dashboard/executive/team` |
| Laporan eksekutif | ✅ Done | `/dashboard/executive/reports` |
| Akses HR: daftar karyawan & manajemen KPI | ✅ Done | Link dari Sidebar executive |

---

## Role: Developer

| Fitur | Status | Lokasi |
|---|---|---|
| Import KPI bulk via CSV (4 langkah: upload → mapping → preview → done) | ✅ Done | `/dashboard/developer/import` |
| Auto-deteksi delimiter CSV (`;` vs `,`) | ✅ Done | `detectDelimiter()` di import page |
| Header mapping UI (cocokkan kolom CSV ke field sistem) | ✅ Done | Step "mapping" di import page |
| Download template CSV (otomatis isi nama staff + divisi) | ✅ Done | `handleDownloadTemplate` |
| Baris contoh di template (dimulai `#`, di-skip saat import) | ✅ Done | `buildRows()` |
| Validasi baris CSV (resolving nama, tipe, unit, period) | ✅ Done | `buildRows()` |
| Preview konfirmasi sebelum import | ✅ Done | Step "preview" |
| Edit target per baris di preview sebelum submit | ✅ Done | Input inline di preview table |
| Deduplication KPI (1 KPI doc per title+type+unit+period+dept+year+month) | ✅ Done | `handleImport()` |
| Target per orang bisa berbeda dalam 1 KPI | ✅ Done | Key tanpa monthlyTarget |
| KPI doc total = sum semua target individu | ✅ Done | `kpiTargetSum` map |
| Mode toggle (lihat sebagai employee atau management) | ✅ Done | Sidebar + AuthContext |

---

## Integrasi dengan App Absensi TNT

| Fitur | Status | Lokasi |
|---|---|---|
| Tab KPI di app absensi menampilkan summary dari kpi_assignments | ✅ Done | `D:\NOVA-CORE-SYSTEM\TNT app React\src\pages\staff\StaffKpi.jsx` |
| Deep link dari absensi ke NovaCore (dashboard, input, riwayat) | ✅ Done | StaffKpi.jsx (3 tombol CTA) |
| Label tab diubah dari "Rapor KPI" ke "KPI" | ✅ Done | StaffLayout.jsx |

---

## Cloud Functions (`functions/src/index.ts`)

| Fungsi | Status | Trigger |
|---|---|---|
| `onDailyReportCreated` — update assignment saat laporan harian masuk | ✅ Done | Firestore: `daily_reports/{id}` onCreate |
| `generateMonthlySummaries` — buat ringkasan bulanan + complete assignment | ✅ Done | Cron: `0 23 28-31 * *` (Asia/Jakarta) |
| `cleanupDeletedKpis` — hapus permanen KPI di trash > 30 hari | ✅ Done | Cron: `0 2 * * *` (Asia/Jakarta) |
| `recalculateDailyTarget` — recalculate target harian assignment | ✅ Done | Callable HTTPS |
| `updateAssignmentStatus` — hold/cancel assignment via Cloud Function | ✅ Done | Callable HTTPS |

---

## Sistem Scoring & Kalkulasi

| Fitur | Status | Lokasi |
|---|---|---|
| Weighted score (result/activity/quality dengan bobot custom) | ✅ Done | `calcWeightedScore()` di utils.ts |
| Konfigurasi bobot per karyawan | ✅ Done | `kpi_settings` collection |
| Kategori performa (excellent/good/warning/critical) | ✅ Done | `getPerformanceCategory()` |
| Kalkulasi hari kerja per bulan | ✅ Done | `getWorkingDaysInMonth()` |
| Auto-update assignment saat karyawan submit laporan harian | ✅ Done | Cloud Function `onDailyReportCreated` |
| `achievementPercentage` = pace rate (actual vs expected by now) | ✅ Done | Cloud Function formula |
| KPI card "Pencapaian" = completion rate (actual/target bulanan) | ✅ Done | `KpiCard.tsx` — dihitung lokal |

---

## Fitur yang Belum Ada / Potensial Dikembangkan

| Fitur | Catatan |
|---|---|
| Notifikasi / push notification | Belum ada |
| Export laporan ke PDF/Excel | Belum ada |
| Bobot default per divisi (bukan per orang) | Saat ini manual per orang |
| Bulk import history / rollback import | Saat ini delete manual via HR KPI page |
| Import CSV untuk HR (bukan hanya developer) | Saat ini developer-only |
