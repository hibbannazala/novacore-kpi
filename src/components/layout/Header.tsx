"use client";

import { usePathname } from "next/navigation";
import { monthName } from "@/lib/utils";

const pageTitles: Record<string, string> = {
  "/dashboard/tim": "Dashboard",
  "/dashboard/tim/kpi": "KPI Saya",
  "/dashboard/tim/input": "Input Harian",
  "/dashboard/tim/history": "Riwayat",
  "/dashboard/head": "Dashboard",
  "/dashboard/head/team": "Tim Saya",
  "/dashboard/head/kpi": "KPI Divisi",
  "/dashboard/head/reports": "Laporan",
  "/dashboard/hr": "Dashboard",
  "/dashboard/hr/kpi": "Manajemen KPI",
  "/dashboard/hr/assignments": "Penugasan KPI",
  "/dashboard/hr/quality": "KPI Kualitas",
  "/dashboard/hr/employees": "Karyawan",
  "/dashboard/hr/divisions": "Divisi",
  "/dashboard/executive": "Dashboard",
  "/dashboard/executive/overview": "Overview Perusahaan",
  "/dashboard/executive/divisions": "Divisi",
  "/dashboard/executive/team": "Tim",
  "/dashboard/executive/reports": "Laporan",
};

export function Header() {
  const pathname = usePathname();
  const now = new Date();
  const title = pageTitles[pathname] ?? "NovaCore KPI";

  return (
    <div className="px-6 pt-4 pb-2">
      <header className="flex h-16 items-center justify-between ab-glass rounded-[25px] px-6 shadow-sm border border-[var(--ab-border)] z-40 relative">
        <h1 className="text-sm font-black uppercase tracking-widest text-[var(--ab-text-main)]">{title}</h1>
        <div className="flex items-center gap-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-[var(--ab-text-dim)]">
            {monthName(now.getMonth() + 1)} {now.getFullYear()}
          </span>
        </div>
      </header>
    </div>
  );
}
