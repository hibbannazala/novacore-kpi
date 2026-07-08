"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Target,
  ClipboardList,
  BarChart3,
  Users,
  Building2,
  FileText,
  LogOut,
  ArrowLeftRight,
  Upload,
  Activity,
  MessageSquare,
  Bug,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import type { KpiRole } from "@/types";
import { useState } from "react";
import { FeedbackModal } from "@/components/FeedbackModal";

interface NavItem {
  label: string;
  href: string;
  icon: React.ElementType;
}

const navByRole: Record<Exclude<KpiRole, "developer">, NavItem[]> = {
  tim: [
    { label: "Dashboard", href: "/dashboard/tim", icon: LayoutDashboard },
    { label: "KPI Saya", href: "/dashboard/tim/kpi", icon: Target },
    { label: "Input Harian", href: "/dashboard/tim/input", icon: ClipboardList },
    { label: "Riwayat", href: "/dashboard/tim/history", icon: FileText },
  ],
  head: [
    { label: "Dashboard", href: "/dashboard/head", icon: LayoutDashboard },
    { label: "Tim Saya", href: "/dashboard/head/team", icon: Users },
    { label: "KPI Divisi", href: "/dashboard/head/kpi", icon: Target },
    { label: "Kelola KPI", href: "/dashboard/head/kpi-setup", icon: Target },
    { label: "Penugasan", href: "/dashboard/head/penugasan", icon: ClipboardList },
    { label: "Kualitas", href: "/dashboard/head/quality", icon: BarChart3 },
    { label: "Laporan", href: "/dashboard/head/reports", icon: BarChart3 },
  ],
  hr: [
    { label: "Dashboard", href: "/dashboard/hr", icon: LayoutDashboard },
    { label: "Overview Karyawan", href: "/dashboard/executive/overview", icon: BarChart3 },
    { label: "Manajemen KPI", href: "/dashboard/hr/kpi", icon: Target },
    { label: "Penugasan", href: "/dashboard/hr/assignments", icon: ClipboardList },
    { label: "Laporan", href: "/dashboard/hr/reports", icon: FileText },
    { label: "Aktivitas Harian", href: "/dashboard/hr/activity", icon: Activity },
    { label: "Kualitas", href: "/dashboard/hr/quality", icon: BarChart3 },
    { label: "Karyawan", href: "/dashboard/hr/employees", icon: Users },
    { label: "Departemen", href: "/dashboard/hr/divisions", icon: Building2 },
  ],
  executive: [
    { label: "Dashboard", href: "/dashboard/executive", icon: LayoutDashboard },
    { label: "Overview", href: "/dashboard/executive/overview", icon: BarChart3 },
    { label: "Aktivitas Harian", href: "/dashboard/executive/activity", icon: Activity },
    { label: "Divisi", href: "/dashboard/executive/divisions", icon: Building2 },
    { label: "Tim", href: "/dashboard/executive/team", icon: Users },
    { label: "Kualitas", href: "/dashboard/executive/quality", icon: BarChart3 },
    { label: "Laporan", href: "/dashboard/executive/reports", icon: FileText },
    { label: "Karyawan", href: "/dashboard/hr/employees", icon: Users },
    { label: "Manajemen KPI", href: "/dashboard/hr/kpi", icon: Target },
    { label: "Penugasan", href: "/dashboard/hr/assignments", icon: ClipboardList },
  ],
};

const roleLabel: Record<KpiRole, string> = {
  tim: "Tim",
  head: "Head",
  hr: "HR",
  executive: "Executive",
  developer: "Developer",
};

export function Sidebar() {
  const pathname = usePathname();
  const { user, kpiRole, devMode, toggleDevMode, signOut } = useAuth();
  const [feedbackOpen, setFeedbackOpen] = useState(false);

  if (!user || !kpiRole) return null;

  const effectiveRole: Exclude<KpiRole, "developer"> =
    kpiRole === "developer"
      ? devMode === "employee" ? "tim" : "executive"
      : kpiRole;

  const navItems = navByRole[effectiveRole];

  return (
    <aside className="flex h-screen w-64 flex-col border-r border-white/30 bg-white/40 backdrop-blur-xl">
      {/* Brand */}
      <div className="flex h-24 items-center gap-3 px-6 mt-2">
        <div className="w-10 h-10 bg-primary/10 rounded-[14px] flex items-center justify-center shadow-inner border border-primary/20 shrink-0">
          <span className="text-primary font-black text-xl">N</span>
        </div>
        <div>
          <h1 className="text-lg font-black text-slate-800 tracking-tight leading-none">NovaCore</h1>
          <p className="text-[9px] font-bold text-primary uppercase tracking-widest mt-1">KPI Management</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-4 py-2">
        <ul className="space-y-1.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const basePath = `/dashboard/${effectiveRole}`;
            const isActive =
              pathname === item.href ||
              (item.href !== basePath && pathname.startsWith(item.href));
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold transition-all duration-200",
                    isActive
                      ? "bg-primary text-primary-foreground shadow-lg shadow-primary/30 scale-[0.98]"
                      : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* User footer */}
      <div className="border-t border-white/30 p-4 space-y-2">
        <div className="px-2 mb-2">
          <p className="truncate text-sm font-semibold text-slate-800">{user.name}</p>
          <p className="text-xs font-medium text-teal-600">{roleLabel[kpiRole]}</p>
        </div>

        {/* Akun Saya — KPI pribadi (untuk role manajer: HR, Executive, Head) */}
        {(kpiRole === "hr" || kpiRole === "executive" || kpiRole === "head") && (
          <>
            <Link
              href="/dashboard/tim/kpi"
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all",
                pathname === "/dashboard/tim/kpi"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Target className="h-3.5 w-3.5 shrink-0" />
              KPI Saya
            </Link>
            <Link
              href="/dashboard/tim/input"
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all",
                pathname === "/dashboard/tim/input"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <ClipboardList className="h-3.5 w-3.5 shrink-0" />
              Input Harian Saya
            </Link>
          </>
        )}

        {/* Developer tools */}
        {kpiRole === "developer" && (
          <>
            <Link
              href="/dashboard/developer/import"
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all",
                pathname === "/dashboard/developer/import"
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <Upload className="h-3.5 w-3.5 shrink-0" />
              Import KPI
            </Link>
            <Link
              href="/dashboard/developer/feedbacks"
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all",
                pathname.startsWith("/dashboard/developer/feedbacks")
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-slate-500 hover:bg-slate-100 hover:text-slate-900"
              )}
            >
              <MessageSquare className="h-3.5 w-3.5 shrink-0" />
              Laporan Bug & Fitur
            </Link>
          </>
        )}

        {/* Developer mode toggle */}
        {kpiRole === "developer" && (
          <button
            onClick={toggleDevMode}
            className={cn(
              "flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all",
              devMode === "management"
                ? "bg-blue-100 text-blue-800 hover:bg-blue-200"
                : "bg-primary/10 text-primary hover:bg-primary/20"
            )}
          >
            <ArrowLeftRight className="h-3.5 w-3.5 shrink-0" />
            {devMode === "management" ? "Mode Management" : "Mode Karyawan"}
          </button>
        )}

        {/* Global Feedback Button for all roles */}
        <button
          onClick={() => setFeedbackOpen(true)}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-2.5 text-xs font-bold text-amber-600 transition-all hover:bg-amber-50 hover:text-amber-700 mt-1"
        >
          <Bug className="h-3.5 w-3.5 shrink-0" />
          Lapor Bug / Fitur
        </button>

        <button
          onClick={signOut}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm font-bold text-slate-500 transition-all hover:bg-red-50 hover:text-red-600 mt-2"
        >
          <LogOut className="h-4 w-4 shrink-0" />
          Keluar
        </button>
      </div>
      <FeedbackModal open={feedbackOpen} onClose={() => setFeedbackOpen(false)} />
    </aside>
  );
}
