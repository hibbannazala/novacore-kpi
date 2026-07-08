# DECISIONS.md — Keputusan Arsitektur NovaCore KPI

## Kenapa Next.js Static Export?

**Keputusan:** `output: "export"` di `next.config.ts` — build menghasilkan HTML/JS statis, tidak ada server.

**Alasan:**
- Hosting di Firebase Hosting yang hanya serve file statis
- Tidak perlu server-side rendering karena semua data diambil real-time dari Firestore di client
- Lebih murah (tidak perlu Cloud Run atau server)

**Trade-off:**
- Tidak bisa pakai API routes Next.js atau server components yang fetch data
- Image optimization dimatikan (`images: { unoptimized: true }`)
- Semua logika harus di client-side

---

## Kenapa Firebase / Firestore?

**Keputusan:** Firebase sebagai backend lengkap (Auth + Database + Hosting + Cloud Functions).

**Alasan:**
- Proyek ini berbagi Firebase project (`absensi-tracker-tnt`) dengan app absensi TNT
- Tidak perlu backend terpisah — Firestore SDK langsung dari browser
- Real-time updates gratis dengan onSnapshot listener
- Google Auth sudah tersedia tanpa infrastruktur tambahan
- Cloud Functions menangani logika server-side yang tidak aman di client (pace rate, monthly summary)

**Trade-off:**
- Vendor lock-in Firebase
- Firestore tidak support JOIN — data harus di-denormalize atau di-fetch terpisah
- Biaya bisa naik kalau listener banyak di waktu bersamaan

---

## Kenapa `kpiType` di-denormalize ke KpiAssignment?

**Keputusan:** Field `kpiType` disalin ke setiap `kpi_assignments` dokumen (tidak hanya di `kpis`).

**Alasan:**
- `calcWeightedScore` perlu tahu tipe setiap assignment untuk memisahkan result/activity/quality
- Kalau tidak denormalize, setiap render perlu lookup ke koleksi `kpis` → N+1 query problem
- Assignment adalah data operasional yang dibaca sangat sering

**Trade-off:**
- Kalau tipe KPI diubah setelah assignment dibuat, assignment lama tidak auto-update
- Diterima karena tipe KPI tidak berubah setelah assignment aktif

---

## Kenapa Real-time Listeners (onSnapshot) di Semua Hook?

**Keputusan:** Semua hook pakai `onSnapshot`, bukan `getDocs`.

**Alasan:**
- HR dan executive membuka halaman bersamaan dan butuh update langsung
- Saat karyawan input harian, head/HR bisa langsung lihat perubahannya
- Tidak perlu manual refresh

**Trade-off:**
- Konsumsi Firestore reads lebih tinggi (setiap perubahan trigger read)
- Listener harus di-unsubscribe di useEffect cleanup (sudah dilakukan)
- Berpotensi membengkak di skala besar — perlu evaluasi migrasi ke `getDocs` untuk halaman laporan/riwayat

---

## Kenapa Soft Delete (deletedAt) untuk KPI?

**Keputusan:** KPI tidak benar-benar dihapus, hanya set `deletedAt: Timestamp`.

**Alasan:**
- Assignment yang sudah ada masih mereferensi KPI via `kpiId`
- Menghapus KPI permanen saat assignment masih ada bisa orphan data
- Bisa dipulihkan dalam 30 hari (bisnis requirement)

**Trade-off:**
- Data menumpuk di Firestore seiring waktu
- Query harus selalu filter `where("deletedAt", "==", null)` untuk exclude yang terhapus
- Cloud Function `cleanupDeletedKpis` menghapus permanen otomatis setelah 30 hari

---

## Kenapa Soft Delete KPI Sekarang Cascade Cancel Assignment?

**Keputusan:** Saat HR soft-delete KPI, semua assignment aktif/hold otomatis di-cancel (bukan memblokir delete).

**Alasan:**
- Sebelumnya: jika ada assignment aktif, delete diblokir → HR harus cancel satu-satu
- Alur baru lebih efisien untuk kebutuhan testing/reset data
- Dialog konfirmasi tetap menampilkan jumlah assignment yang akan dibatalkan sebagai warning

**Trade-off:**
- Resiko tidak sengaja cancel assignment aktif kalau user tidak baca dialog konfirmasi
- Diterima karena ada peringatan eksplisit di dialog sebelum konfirmasi

---

## Kenapa achievementPercentage Berbasis Pace (Bukan Completion)?

**Keputusan:** Field `achievementPercentage` di Firestore menyimpan **pace rate**, bukan completion rate.
Formula: `(actualTotal / expectedByNow) × 100`, dimana `expectedByNow = (monthlyTarget / workingDaysTotal) × workingDaysElapsed`.

**Alasan:**
- Memberikan sinyal lebih dini: apakah karyawan ON TRACK untuk menyelesaikan target bulan ini?
- Completion rate (actual/target) tidak informatif di awal bulan — semua orang akan kelihatan rendah
- `performanceCategory` (Excellent/Good/Warning/Critical) berbasis pace rate sehingga early warning bisa diberikan
- Monthly summary di akhir bulan: pace rate = completion rate (data konsisten)

**Konsekuensi di UI:**
- `KpiCard.tsx` **TIDAK** menampilkan `achievementPercentage` langsung
- KpiCard menghitung `completionPct = (actualTotal / monthlyTarget) × 100` secara lokal untuk label "Pencapaian" yang intuitif
- Badge performa (Excellent/Good/Warning/Critical) tetap dari `performanceCategory` (pace-based)

**Trade-off:**
- Dua metric "persentase" yang berbeda bisa membingungkan developer baru
- `calcWeightedScore` menggunakan pace rate — skor tertimbang bisa >100% jika orang jauh ahead of pace

---

## Kenapa Tidak Ada Global State Management (Redux/Zustand)?

**Keputusan:** Hanya pakai React Context (AuthContext) untuk global state.

**Alasan:**
- Satu-satunya global state yang benar-benar perlu di-share adalah auth + user info
- Data KPI/assignment sudah di-manage oleh hooks per komponen
- Menambah Zustand/Redux menambah kompleksitas tanpa manfaat nyata untuk skala ini

**Trade-off:**
- Jika dua komponen butuh data yang sama, mereka masing-masing punya listener sendiri
- Ini bisa dioptimasi dengan lift state ke parent kalau diperlukan

---

## Kenapa KPI Settings (Bobot) Disimpan Per User?

**Keputusan:** `kpi_settings/{userId}` — satu dokumen per karyawan untuk bobot result/activity/quality.

**Alasan:**
- Setiap karyawan bisa punya bobot berbeda sesuai posisi/divisi
- Head marketing mungkin lebih banyak result, HR lebih banyak quality, dll.

**Trade-off:**
- Default bobot harus di-set manual per karyawan (bisa dikembangkan dengan auto-assign per divisi)
- Jika settings kosong, `calcWeightedScore` menggunakan bobot default (33/33/34)

---

## Kenapa Import CSV Hanya untuk Role Developer?

**Keputusan:** Halaman `/dashboard/developer/import` diakses guard oleh role check `getKpiRole(user) !== "developer"`.

**Alasan:**
- Import CSV adalah operasi bulk yang bisa membuat banyak data sekaligus
- Kalau salah, bisa pollute data produksi
- Developer yang tahu konsekuensi teknis harus yang mengoperasikannya

**Trade-off:**
- HR tidak bisa bulk import mandiri — harus minta developer
- Bisa dikembangkan ke HR dengan tambahan validasi lebih ketat

---

## Kenapa CSV Import Pakai Header Mapping (Bukan Positional)?

**Keputusan:** Import CSV menggunakan `ColumnMapping = Record<FieldKey, number>` — kolom dikenali berdasarkan nama header, bukan urutan posisi.

**Alasan:**
- Excel Indonesia mengekspor CSV dengan delimiter `;` bukan `,` — auto-deteksi delimiter wajib
- User bisa upload file dengan urutan kolom berbeda; mapping manual menghilangkan ambiguitas
- `autoDetectMapping()` memberikan default cerdas berdasarkan nama header yang di-normalize

**Trade-off:**
- Butuh satu langkah tambahan (mapping step) sebelum preview
- Lebih robust dibanding positional yang akan salah parse jika user reorder kolom

---

## Kenapa Dua App Terpisah (NovaCore + TNT Absensi)?

**Keputusan:** Sistem KPI dan sistem absensi dipisah jadi dua aplikasi hosting.

**Alasan:**
- Sistem absensi sudah stabil dan production — tidak mau risiko bug baru dari KPI
- Codebase terpisah memudahkan iterasi cepat di KPI tanpa takut break absensi
- Keduanya tetap pakai Firebase project yang sama — data user di-share

**Trade-off:**
- Karyawan perlu login dua kali (session per origin)
- Tab KPI di app absensi hanya menampilkan summary + deep link ke NovaCore
