# GEMINI.md — Panduan AI Agent untuk NovaCore KPI

## Ringkasan Proyek

NovaCore KPI adalah sistem manajemen KPI internal berbasis web untuk perusahaan TNT/NovaCore.
Dibangun dengan Next.js 15 (static export) + Firebase (Auth + Firestore + Cloud Functions) + TypeScript + Tailwind CSS.

**URL Produksi:** https://tnt-operational-system.web.app
**Firebase Project:** `absensi-tracker-tnt`
**Bahasa UI:** Bahasa Indonesia

### Struktur Role
```
executive → hr → head → tim
developer (special: bisa toggle antara tim dan executive view)
```

### Firestore Collections Utama
- `users` — profil karyawan
- `kpis` — definisi KPI master
- `kpi_assignments` — penugasan KPI per orang
- `daily_reports` — input harian karyawan
- `kpi_settings` — bobot skor per karyawan

---

## Aturan Saat Menambah Fitur

1. **Gunakan hooks yang sudah ada** — cek `src/hooks/` sebelum buat query Firestore baru
2. **Ikuti pola komponen** — lihat komponen serupa untuk struktur, naming, dan styling
3. **Tambah guard role** — setiap halaman baru wajib cek `kpiRole` user
4. **Timestamps wajib** — setiap write ke Firestore harus sertakan `updatedAt: Timestamp.now()`
5. **Filter deletedAt** — query koleksi `kpis` harus selalu `where("deletedAt", "==", null)`
6. **Gunakan `cn()` untuk classes** — jangan string concatenation biasa untuk Tailwind
7. **Error handling** — tangkap error di try/catch, tampilkan ke user via state `error`
8. **Bahasa UI** — semua teks yang tampil ke user dalam Bahasa Indonesia
9. **Build check** — setelah modifikasi, jalankan `npm run build` untuk memastikan 0 TypeScript error
10. **Deploy** — `firebase deploy --only hosting` dari folder `D:\Task-Management-NovaCore`

---

## Aturan Saat Fix Bug

1. **Cari root cause dulu** — baca file yang relevan sebelum ubah kode
2. **Jangan ubah type di `src/types/index.ts` sembarangan** — perubahan cascade ke seluruh codebase
3. **Jangan ganti nama koleksi Firestore** — data produksi sudah ada di sana
4. **Jangan ubah `calcWeightedScore`** — dipakai di 10+ tempat, perubahan berdampak luas
5. **Perhatikan `kpi.monthlyTarget` vs `assignment.monthlyTarget`** — artinya berbeda (total vs per-orang)
6. **Non-null assertion** — gunakan `user!.id` hanya setelah guard auth memastikan user tidak null
7. **Jangan tampilkan `achievementPercentage` langsung sebagai "Pencapaian"** — nilai itu adalah pace rate dari Cloud Function; tampilkan `actualTotal / monthlyTarget × 100` sebagai completion rate

---

## HAL-HAL YANG DILARANG DIUBAH

| Yang Dilarang | Alasan |
|---|---|
| Nama koleksi Firestore di `collections.ts` | Data produksi sudah ada di sana |
| `output: "export"` di `next.config.ts` | Wajib untuk Firebase Hosting static |
| Firebase project ID (`absensi-tracker-tnt`) | Satu project dengan app absensi |
| Guard auth di `src/app/dashboard/layout.tsx` | Semua halaman dashboard harus terproteksi |
| Tipe enum `KpiRole`, `KpiType`, `KpiUnit`, `KpiPeriod` | Data Firestore sudah pakai nilai ini |
| `calcWeightedScore` signature di `utils.ts` | Dipanggil dari banyak tempat |
| Formula pace rate di `functions/src/index.ts` | Dipakai untuk `performanceCategory` dan monthly summary |

---

## Konteks Tambahan Penting

### Dua App, Satu Firebase Project
App ini berbagi Firebase project dengan app absensi TNT (`https://absensi-tracker-tnt.web.app`).
Koleksi `users` dibaca oleh kedua app. Jangan hapus atau rename field yang mungkin dipakai app absensi.

### CSV Import — 4 Langkah
1. **Upload** — pilih file CSV, auto-deteksi delimiter (`;` vs `,`)
2. **Mapping** — cocokkan kolom CSV ke field sistem (ada auto-detect dari nama header + bisa manual adjust)
3. **Preview** — lihat baris yang akan diimport, edit target per baris
4. **Done** — ringkasan hasil import

Parser menggunakan `ColumnMapping = Record<FieldKey, number>` (indeks kolom per field), bukan positional index tetap. `autoDetectMapping()` menormalkan nama header (lowercase, strip non-alpha) dan mencocokkan dengan alias per field.

- Baris yang dimulai `#` di-skip otomatis (baris contoh di template)
- `monthlyTarget` di CSV = target **per orang** (bukan total)
- KPI doc `monthlyTarget` = sum semua target individu dalam satu KPI group

### achievementPercentage vs Completion Rate
Ada dua "persentase" yang berbeda di sistem ini:

| Field | Nilai | Dipakai untuk |
|---|---|---|
| `assignment.achievementPercentage` | **Pace rate** — `(actualTotal / expectedByNow) × 100` | Badge performa, weighted score, monthly summary |
| Tampilan "Pencapaian" di KpiCard | **Completion rate** — `(actualTotal / monthlyTarget) × 100` | Ditampilkan ke user agar intuitif |

Pace rate dihitung oleh Cloud Function `onDailyReportCreated`. Completion rate dihitung lokal di `KpiCard.tsx`.

### Weighted Score
- Default bobot jika settings kosong: result=33, activity=33, quality=34
- Skor = (resultAvg × rWeight + activityAvg × aWeight + qualityAvg × qWeight) / 100
- Kategori: excellent ≥100%, good ≥80%, warning ≥50%, critical <50%

### Soft Delete Flow (KPI)
1. Klik trash → query assignment aktif/hold (hitung jumlah)
2. Tampil dialog konfirmasi dengan warning jumlah assignment yang akan dibatalkan
3. Konfirmasi → cancel semua assignment (`status: "cancelled"`) → set `kpi.deletedAt`
4. Bisa dipulihkan dari tab "Sampah" dalam 30 hari
5. **Hapus Permanen** tersedia untuk HR dan Executive (`isKpiHROrExecutive()` di Firestore rules)

### Dialog Penugasan KPI (HR)
Flow baru (bukan lagi "pilih KPI → pilih staff"):
1. Pilih satu staff dari list (semua `status: "active" && !isHidden`, bukan hanya role "tim")
2. Setelah staff dipilih, muncul daftar KPI aktif yang difilter berdasarkan departemen staff
3. Centang KPI yang mau ditugaskan, isi target per KPI
4. Submit → buat assignment terpisah per KPI yang dicentang

---

## Path File Penting untuk Referensi Cepat

```
src/types/index.ts                           — semua types
src/lib/utils.ts                             — calcWeightedScore, formatting
src/lib/firebase/collections.ts             — nama koleksi & refs
src/contexts/AuthContext.tsx                 — auth + kpiRole
src/hooks/useAssignments.ts                  — assignment queries
src/hooks/useKpis.ts                         — KPI queries
src/app/dashboard/hr/assignments/page.tsx    — manual assign
src/app/dashboard/hr/kpi/page.tsx            — KPI CRUD + cascade delete
src/app/dashboard/developer/import/page.tsx  — CSV import (4 langkah)
src/components/kpi/KpiCard.tsx               — tampilan KPI card (completion rate)
src/components/layout/Sidebar.tsx            — navigasi
functions/src/index.ts                       — Cloud Functions (pace rate, summaries)
firestore.rules                              — security rules
```
