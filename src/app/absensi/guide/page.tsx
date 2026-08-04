"use client";

import Link from "next/link";
import { 
  Clock, 
  Target, 
  ClipboardList, 
  FileText, 
  Banknote, 
  CalendarDays, 
  HelpCircle,
  ArrowRight,
  Compass
} from "lucide-react";

export default function AbsensiGuidePage() {
  const guideItems = [
    {
      title: "Presensi Harian",
      description: "Lakukan Check-In masuk kerja dan Check-Out pulang harian.",
      href: "/dashboard/tim",
      color: "bg-emerald-500",
      icon: Clock,
      label: "Buka Presensi",
    },
    {
      title: "Isi KPI Harian",
      description: "Laporkan hasil kerja harian Anda untuk perhitungan KPI.",
      href: "/dashboard/tim/input",
      color: "bg-blue-500",
      icon: ClipboardList,
      label: "Input KPI",
    },
    {
      title: "Dashboard KPI",
      description: "Pantau pencapaian KPI bulanan dan persentase tim Anda.",
      href: "/dashboard/tim/kpi",
      color: "bg-purple-500",
      icon: Target,
      label: "Buka KPI",
    },
    {
      title: "Pengajuan Cuti / Izin",
      description: "Ajukan izin cuti tahunan, sakit, atau izin WFA.",
      href: "/absensi/requests",
      color: "bg-orange-500",
      icon: CalendarDays,
      label: "Ajukan Cuti",
    },
    {
      title: "Slip Gaji",
      description: "Lihat dan unduh slip gaji bulanan Anda secara mandiri.",
      href: "/absensi/payroll",
      color: "bg-rose-500",
      icon: Banknote,
      label: "Lihat Slip Gaji",
    },
    {
      title: "Kalender Tim",
      description: "Pantau jadwal kehadiran, WFA, dan cuti rekan satu divisi.",
      href: "/absensi/team",
      color: "bg-cyan-500",
      icon: FileText,
      label: "Buka Kalender",
    },
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 py-6">
      {/* Header */}
      <div className="text-center md:text-left flex flex-col md:flex-row items-center gap-4 border-b border-[var(--ab-border)] pb-6">
        <div className="w-16 h-16 bg-[var(--ab-bg-surface)] rounded-3xl flex items-center justify-center shadow-lg border border-[var(--ab-border)] text-[var(--ab-primary)]">
          <Compass size={32} className="animate-spin-slow" />
        </div>
        <div>
          <h1 className="text-3xl font-black text-[var(--ab-text-main)] tracking-tighter">Pusat Navigasi Portal</h1>
          <p className="text-xs font-bold text-[var(--ab-text-dim)] uppercase tracking-widest mt-1">
            Klik tombol di bawah ini sesuai dengan menu yang ingin Anda akses
          </p>
        </div>
      </div>

      {/* Info Card */}
      <div className="bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30 rounded-3xl p-6 flex gap-4 items-start shadow-sm">
        <HelpCircle className="text-amber-500 shrink-0 mt-0.5" size={20} />
        <div className="space-y-1">
          <h4 className="text-sm font-black text-amber-800 dark:text-amber-300 uppercase tracking-wider">Bingung dengan Tampilan Baru?</h4>
          <p className="text-xs text-amber-700/80 dark:text-amber-400/80 font-medium leading-relaxed">
            Halaman lama kini sudah digabung ke portal terpadu. Untuk memudahkan Anda, silakan gunakan tombol pintasan di bawah ini untuk langsung menuju ke halaman tujuan Anda.
          </p>
        </div>
      </div>

      {/* Grid Menu */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {guideItems.map((item) => {
          const Icon = item.icon;
          return (
            <div 
              key={item.href}
              className="bg-[var(--ab-bg-surface)] rounded-[30px] border border-[var(--ab-border)] p-6 shadow-sm hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 flex flex-col justify-between"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className={`${item.color} text-white p-3 rounded-2xl`}>
                    <Icon size={20} />
                  </div>
                  <h3 className="font-black text-[var(--ab-text-main)] text-lg tracking-tight">
                    {item.title}
                  </h3>
                </div>
                <p className="text-xs font-medium text-[var(--ab-text-dim)] leading-relaxed">
                  {item.description}
                </p>
              </div>
              <div className="mt-6 pt-4 border-t border-[var(--ab-border)]">
                <Link
                  href={item.href}
                  className="w-full flex items-center justify-between bg-[var(--ab-bg-main)] hover:bg-[var(--ab-primary)] hover:text-white text-[var(--ab-text-main)] px-5 py-3 rounded-2xl text-xs font-black transition-all active:scale-[0.98] group"
                >
                  <span className="uppercase tracking-widest">{item.label}</span>
                  <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
