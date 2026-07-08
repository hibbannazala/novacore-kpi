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
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-6">
      <h1 className="text-sm font-semibold">{title}</h1>
      <span className="text-xs text-muted-foreground">
        {monthName(now.getMonth() + 1)} {now.getFullYear()}
      </span>
    </header>
  );
}
