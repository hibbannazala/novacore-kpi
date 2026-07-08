"use client";

import { useEffect, useCallback } from "react";
import { driver } from "driver.js";
import "driver.js/dist/driver.css";

interface StaffTourProps {
  onFinish?: () => void;
  onOpenForm?: () => void;
  onCloseForm?: () => void;
}

export function StaffTour({ onFinish, onOpenForm, onCloseForm }: StaffTourProps) {
  const startTour = useCallback(() => {
    const driverObj = driver({
      showProgress: true,
      animate: true,
      smoothScroll: true,
      allowClose: true,
      overlayOpacity: 0.75,
      stagePadding: 8,
      stageRadius: 12,
      progressText: "Langkah {{current}} dari {{total}}",
      nextBtnText: "Berikutnya →",
      prevBtnText: "← Sebelumnya",
      doneBtnText: "Selesai ✓",
      onDestroyStarted: () => {
        onCloseForm?.();
        driverObj.destroy();
        onFinish?.();
      },
      steps: [
        // ── LANGKAH 1: Selamat Datang ──────────────────────────────────
        {
          popover: {
            title: "👋 Selamat Datang di NovaCore KPI!",
            description:
              "Halo! Tutorial ini akan memandu kamu memahami <strong>semua fitur</strong> di halaman ini, " +
              "termasuk cara mengisi laporan harian secara langsung.<br><br>" +
              "💡 <em>Total ada 14 langkah. Ada tombol Skip untuk keluar kapan saja!</em>",
            side: "over",
            align: "center",
          },
        },

        // ── LANGKAH 2: Nama / Greeting ─────────────────────────────────
        {
          element: "#tour-greeting",
          popover: {
            title: "👤 Identitasmu",
            description:
              "Di sini tampil nama dan inisial kamu. Jika nama yang muncul <strong>salah</strong>, " +
              "segera hubungi HR — semua laporan yang kamu submit tercatat atas nama ini.",
            side: "bottom",
            align: "start",
          },
        },

        // ── LANGKAH 3: Period Picker ────────────────────────────────────
        {
          element: "#tour-period-picker",
          popover: {
            title: "📅 Pilih Periode Laporan",
            description:
              "Tombol ini untuk <strong>memilih rentang waktu</strong> yang ingin kamu lihat datanya.<br><br>" +
              "• <strong>Bulan Ini (default)</strong> = Progres keseluruhan bulan berjalan.<br>" +
              "• <strong>Pilih Rentang</strong> = Pilih tanggal awal & akhir, misal hanya ingin lihat data minggu ini.<br><br>" +
              "💡 Jika pilih hanya 1 hari, semua kartu KPI akan memfilter data di tanggal itu saja.",
            side: "bottom",
            align: "end",
          },
        },

        // ── LANGKAH 4: Weighted Score ───────────────────────────────────
        {
          element: "#tour-weighted-score",
          popover: {
            title: "🏆 Skor Kinerja Gabungan (Weighted Score)",
            description:
              "Ini adalah <strong>nilai akhir kinerja kamu bulan ini</strong>, dihitung otomatis dari seluruh KPI.<br><br>" +
              "Cara membacanya:<br>" +
              "• <strong>Result</strong> (Biru) = Rata-rata pencapaian KPI bertipe Result.<br>" +
              "• <strong>Activity</strong> (Kuning) = Rata-rata KPI bertipe Activity.<br>" +
              "• <strong>Quality</strong> (Ungu) = Nilai dari atasan, bukan inputanmu.<br>" +
              "• Angka <em>persentase bobot</em> (misal 60%) = seberapa besar pengaruh kategori itu ke skor akhir.<br><br>" +
              "📊 Angka <em>Total Weighted Score</em> = nilai final yang dilaporkan ke atasan.",
            side: "bottom",
            align: "center",
          },
        },

        // ── LANGKAH 5: Quick Prompt Banner ──────────────────────────────
        {
          element: "#tour-quick-prompt",
          popover: {
            title: "💬 Banner Pengingat Harian",
            description:
              "Pengingat bahwa laporan harianmu <strong>harus diisi setiap hari kerja</strong>.<br><br>" +
              "Link <strong>\"Ada yang salah input? Edit Riwayat →\"</strong> di sebelah kanan berguna " +
              "untuk memperbaiki angka yang salah tanpa perlu minta bantuan HR!",
            side: "bottom",
            align: "center",
          },
        },

        // ── LANGKAH 6: Pencarian ────────────────────────────────────────
        {
          element: "#tour-search",
          popover: {
            title: "🔍 Cari KPI dengan Cepat",
            description:
              "Punya banyak KPI? Ketik sebagian judul di kolom ini untuk menyaring kartu KPI yang relevan secara real-time.<br><br>" +
              "Contoh: ketik <em>\"posting\"</em> untuk langsung menemukan KPI terkait posting konten.",
            side: "bottom",
            align: "start",
          },
        },

        // ── LANGKAH 7: KPI Card — Label & Judul ────────────────────────
        {
          element: "#tour-kpi-card",
          popover: {
            title: "📋 Kartu KPI — Cara Membaca Label",
            description:
              "Setiap kartu = 1 target kerja bulananmu.<br><br>" +
              "🏷️ <strong>Label warna di atas nama KPI:</strong><br>" +
              "• <em>Label Brand</em> (misal TNT, HYPE) = KPI ini milik brand mana.<br>" +
              "• <strong>Biru = Result</strong>: Fokus ke hasil nyata (penjualan, closing, dll).<br>" +
              "• <strong>Kuning = Activity</strong>: Fokus ke jumlah aktivitas (follow up, posting, dll).<br>" +
              "• <strong>Ungu = Quality</strong>: Dinilai atasan langsung, <strong>tidak perlu kamu isi</strong>.<br><br>" +
              "Badge pojok kanan (Excellent/Warning/Critical) = status performa kamu saat ini.",
            side: "right",
            align: "start",
          },
        },

        // ── LANGKAH 8: KPI Card — Progress & Target Harian ─────────────
        {
          element: "#tour-kpi-card",
          popover: {
            title: "📈 Persentase, Progress Bar & Target Harian",
            description:
              "Angka besar (misal <strong>65.0%</strong>) = pencapaian target bulanmu sejauh ini.<br><br>" +
              "Progress bar di bawahnya:<br>" +
              "• <strong>Bar berwarna</strong> = posisi pencapaianmu sekarang.<br>" +
              "• <strong>Garis kecil putih</strong> di bar = penanda <em>\"seharusnya kamu sudah di sini\"</em> berdasarkan hari ini.<br><br>" +
              "Di bawah progress bar:<br>" +
              "• <strong>Tgt Harian</strong> = Target minimal hari ini. Dihitung ulang otomatis setiap hari! Jika kemarin kosong, hari ini lebih besar.<br>" +
              "• <strong>Sisa X hari</strong> = Hari kerja tersisa bulan ini (Sabtu & Minggu tidak dihitung).",
            side: "left",
            align: "center",
          },
        },

        // ── LANGKAH 9: Klik KPI → Buka Form (trigger) ──────────────────
        {
          element: "#tour-kpi-card",
          popover: {
            title: "✏️ Cara Mengisi Laporan Harian",
            description:
              "<strong>Klik kartu KPI</strong> mana saja untuk membuka formulir input laporan harian.<br><br>" +
              "Sekarang kita akan membuka formulirnya secara otomatis. " +
              "Klik <strong>Berikutnya</strong> dan formulir akan terbuka!",
            side: "left",
            align: "center",
            onNextClick: () => {
              onOpenForm?.();
              // Tunggu lebih lama agar dialog Radix UI selesai render
              setTimeout(() => {
                driverObj.moveNext();
              }, 1200);
            },
          },
        },

        // ── LANGKAH 10: Form — Kolom Tanggal ───────────────────────────
        {
          element: "#input-date",
          popover: {
            title: "📅 Kolom Tanggal",
            description:
              "Secara default sudah terisi <strong>hari ini</strong> secara otomatis.<br><br>" +
              "Kamu bisa mengubahnya ke tanggal lalu jika lupa mengisi (<em>input mundur/backdate</em>). " +
              "Sistem hanya mengizinkan input dari tanggal 1 bulan ini hingga hari ini.<br><br>" +
              "⚠️ Jika kamu mengubah tanggal, akan muncul peringatan kuning. Itu normal dan aman!",
            side: "bottom",
            align: "start",
          },
        },

        // ── LANGKAH 11: Form — Info Target ─────────────────────────────
        {
          element: "#tour-form-target",
          popover: {
            title: "🎯 Info Target Harian",
            description:
              "Kotak abu-abu ini menampilkan <strong>target minimal hari ini</strong> untuk KPI ini.<br><br>" +
              "Jadikan ini <em>acuan minimum</em> saat mengisi realisasi. " +
              "Angka ini dihitung ulang otomatis berdasarkan sisa hari kerja dan target bulan yang belum tercapai.",
            side: "top",
            align: "center",
          },
        },

        // ── LANGKAH 12: Form — Realisasi ───────────────────────────────
        {
          element: "#actual-value",
          popover: {
            title: "✏️ Kolom Realisasi (WAJIB diisi!)",
            description:
              "Isi dengan <strong>angka capaian kamu hari ini</strong>.<br><br>" +
              "Contoh nyata:<br>" +
              "• Berhasil follow up 15 lead? → isi <strong>15</strong><br>" +
              "• Closing Rp 5.000.000? → isi <strong>5000000</strong><br>" +
              "• Upload 3 konten? → isi <strong>3</strong><br><br>" +
              "💡 Lihat petunjuk satuan kecil di samping label (angka / Rp / %) untuk tahu format yang benar.",
            side: "top",
            align: "center",
          },
        },

        // ── LANGKAH 13: Form — Catatan ─────────────────────────────────
        {
          element: "#notes",
          popover: {
            title: "📝 Kolom Catatan (Opsional tapi sangat dianjurkan!)",
            description:
              "Tambahkan <strong>konteks singkat</strong> di balik angka yang kamu isi.<br><br>" +
              "Contoh catatan yang bagus:<br>" +
              "• <em>\"3 dari 10 lead sudah deal, 7 masih follow up\"</em><br>" +
              "• <em>\"Posting terlambat karena revisi dari klien\"</em><br>" +
              "• <em>\"Meeting internal hari ini, aktivitas luar terbatas\"</em><br><br>" +
              "⭐ Catatan ini akan dibaca langsung oleh HR dan atasanmu. Semakin jelas, semakin baik!",
            side: "top",
            align: "center",
          },
        },

        // ── LANGKAH 14: Form — Tombol & Penutup ────────────────────────
        {
          element: "#tour-form-footer",
          popover: {
            title: "💾 Tombol Aksi di Formulir",
            description:
              "Tiga tombol penting di bawah formulir:<br><br>" +
              "• <strong>Simpan / Update</strong> (biru) = Simpan laporan. Jika laporan tanggal itu sudah ada, otomatis jadi 'Update'.<br>" +
              "• <strong>Batal</strong> (putih) = Tutup formulir tanpa menyimpan apapun.<br>" +
              "• <strong>Hapus</strong> (merah) = Hanya muncul jika laporan sudah ada sebelumnya — gunakan untuk menghapus entri yang salah total.<br><br>" +
              "🎉 <strong>Selesai! Kamu sudah paham cara menggunakan NovaCore KPI sepenuhnya.</strong> Semangat mencapai target! 💪",
            side: "top",
            align: "center",
            onNextClick: () => {
              onCloseForm?.();
              driverObj.destroy();
              onFinish?.();
            },
          },
        },
      ],
    });

    driverObj.drive();
  }, [onFinish, onOpenForm, onCloseForm]);

  useEffect(() => {
    const t = setTimeout(startTour, 400);
    return () => clearTimeout(t);
  }, [startTour]);

  return null;
}
