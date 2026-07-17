"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import ConfirmDialog from "@/components/absensi/ConfirmDialog";
import { toast } from "sonner";
import {
  PieChart, ClipboardCheck, Users, UserX, UserMinus,
  Trash2, Settings, History, ShieldCheck, AlignJustify,
  X, Moon, Sun, LogOut, ChevronLeft, ChevronRight, TriangleAlert,
} from "lucide-react";

const MENU_GROUPS = [
  {
    group: "Menu Utama",
    items: [
      { path: "/absensi/admin/dashboard",          icon: <PieChart size={18} />,       label: "Dashboard",        badgeKey: "" },
      { path: "/absensi/admin/approvals",          icon: <ClipboardCheck size={18} />, label: "Manajemen Cuti",   badgeKey: "pendingReqs" },
      { path: "/absensi/admin/latereasons",        icon: <TriangleAlert size={18} />,  label: "Approval Telat",   badgeKey: "" },
      { path: "/absensi/admin/staff?tab=pending",  icon: <ShieldCheck size={18} />,    label: "Pendaftar Baru",   badgeKey: "pendingStaff" },
      { path: "/absensi/admin/staff",              icon: <Users size={18} />,          label: "Kelola Staf",      badgeKey: "" },
    ],
  },
  {
    group: "Arsip & Akses",
    items: [
      { path: "/absensi/admin/staff?tab=rejected", icon: <UserX size={18} />,     label: "Akun Ditolak", badgeKey: "" },
      { path: "/absensi/admin/staff?tab=resigned", icon: <UserMinus size={18} />, label: "Staf Resign",  badgeKey: "" },
      { path: "/absensi/admin/staff?tab=deleted",  icon: <Trash2 size={18} />,    label: "Akun Dihapus", badgeKey: "" },
    ],
  },
  {
    group: "Sistem",
    items: [
      { path: "/absensi/admin/settings", icon: <Settings size={18} />, label: "Pengaturan",  badgeKey: "" },
      { path: "/absensi/admin/logs",     icon: <History size={18} />,  label: "Audit Trail", badgeKey: "" },
    ],
  },
];

export default function AbsensiAdminLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isCollapsed, setIsCollapsed]     = useState(false);
  const [isDark, setIsDark]               = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [pendingReqs, setPendingReqs]   = useState(0);
  const [pendingStaff, setPendingStaff] = useState(0);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    const supabase = createClient();

    const reqCh = supabase.channel("absensi_admin_pending_reqs")
      .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, () => {
        supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
          .then(({ count }) => setPendingReqs(count ?? 0));
      })
      .subscribe();

    const staffCh = supabase.channel("absensi_admin_pending_staff")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, () => {
        supabase.from("users").select("id", { count: "exact", head: true }).eq("absensi_status", "pending")
          .then(({ count }) => setPendingStaff(count ?? 0));
      })
      .subscribe();

    supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending")
      .then(({ count }) => setPendingReqs(count ?? 0));
    supabase.from("users").select("id", { count: "exact", head: true }).eq("absensi_status", "pending")
      .then(({ count }) => setPendingStaff(count ?? 0));

    return () => { reqCh.unsubscribe(); staffCh.unsubscribe(); };
  }, []);

  function toggleDarkMode() {
    const html = document.documentElement;
    if (html.classList.contains("dark")) {
      html.classList.remove("dark");
      localStorage.setItem("theme", "light");
      setIsDark(false);
    } else {
      html.classList.add("dark");
      localStorage.setItem("theme", "dark");
      setIsDark(true);
    }
  }

  async function handleLogout() {
    await signOut();
    toast.success("Berhasil keluar");
    router.replace("/login");
  }

  const badges: Record<string, number> = { pendingReqs, pendingStaff };

  return (
    <div className="flex h-screen overflow-hidden w-full relative" style={{ background: "var(--ab-bg-main)", color: "var(--ab-text-main)" }}>
      {isSidebarOpen && (
        <div onClick={() => setIsSidebarOpen(false)} className="fixed inset-0 bg-slate-900/40 z-[90] md:hidden backdrop-blur-md ab-animate-fadeIn" />
      )}

      {/* Sidebar */}
      <div
        className={`fixed md:relative ${isCollapsed ? "md:w-20" : "md:w-72"} w-72 flex flex-col shrink-0 z-[100] shadow-2xl md:shadow-none h-full transition-all duration-500 ${isSidebarOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"}`}
        style={{ background: "var(--ab-bg-main)", borderRight: "1px solid var(--ab-border)" }}
      >
        {/* Collapse toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="hidden md:flex absolute -right-3 top-10 w-6 h-6 text-white rounded-full items-center justify-center shadow-lg hover:scale-110 active:scale-95 transition-all z-[110]"
          style={{ background: "var(--ab-primary)" }}
        >
          {isCollapsed ? <ChevronRight size={10} /> : <ChevronLeft size={10} />}
        </button>

        {/* Logo */}
        <div className={`p-8 flex flex-row items-center ${isCollapsed ? "justify-center" : "justify-between"} gap-3 overflow-hidden`}>
          <div className="flex items-center gap-4 shrink-0">
            <div className="w-12 h-12 flex items-center justify-center rounded-2xl shadow-lg shrink-0 text-white" style={{ background: "var(--ab-primary)" }}>
              <ShieldCheck size={20} />
            </div>
            {!isCollapsed && (
              <div className="ab-animate-fadeIn">
                <h1 className="font-black text-lg tracking-tight leading-none mb-1 whitespace-nowrap" style={{ color: "var(--ab-text-main)" }}>
                  NovaCore Admin
                </h1>
                <p className="text-[9px] font-black uppercase tracking-[0.2em] whitespace-nowrap" style={{ color: "var(--ab-text-dim)" }}>
                  Enterprise Panel
                </p>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <button
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden p-3 rounded-2xl text-[var(--ab-text-dim)] hover:text-red-500 transition-all active:scale-90"
              style={{ background: "var(--ab-bg-surface)", border: "1px solid var(--ab-border)" }}
            >
              <X size={18} />
            </button>
          )}
        </div>

        {/* Menu */}
        <div className="flex-1 overflow-y-auto py-4 overflow-x-hidden ab-scrollbar">
          <ul className={`space-y-1 ${isCollapsed ? "px-2" : "px-4"}`}>
            {MENU_GROUPS.map((group, gIdx) => (
              <div key={gIdx}>
                {!isCollapsed && (
                  <li className="pt-4 pb-1 px-2 ab-animate-fadeIn">
                    <p className="text-[9px] font-black uppercase tracking-widest leading-none" style={{ color: "var(--ab-text-dim)" }}>
                      {group.group}
                    </p>
                  </li>
                )}
                {group.items.map((item) => {
                  const basePath = item.path.split("?")[0];
                  const active = pathname === basePath || (basePath !== "/absensi/admin/staff" && pathname.startsWith(basePath));
                  const badge = item.badgeKey ? (badges[item.badgeKey] ?? 0) : 0;
                  return (
                    <li key={item.path}>
                      <Link
                        href={item.path}
                        title={isCollapsed ? item.label : ""}
                        onClick={() => { if (typeof window !== "undefined" && window.innerWidth < 768) setIsSidebarOpen(false); }}
                        className={`w-full flex items-center ${isCollapsed ? "justify-center p-3" : "justify-between px-5 py-3"} rounded-2xl font-black text-[13px] transition-all duration-300 group`}
                        style={{
                          background: active ? "var(--ab-primary)" : "transparent",
                          color: active ? "white" : "var(--ab-text-dim)",
                          transform: active ? "scale(1.02)" : "scale(1)",
                        }}
                      >
                        <div className="flex items-center gap-4">
                          <span className={`transition-transform duration-300 ${active ? "scale-110" : "group-hover:scale-110"}`}>
                            {item.icon}
                          </span>
                          {!isCollapsed && <span className="tracking-tight whitespace-nowrap">{item.label}</span>}
                        </div>
                        {!isCollapsed && badge > 0 && (
                          <span
                            className={`text-[9px] min-w-[20px] h-[20px] rounded-full flex items-center justify-center px-1 font-black ${active ? "bg-white" : "bg-red-500 text-white"}`}
                            style={active ? { color: "var(--ab-primary)" } : {}}
                          >
                            {badge}
                          </span>
                        )}
                      </Link>
                    </li>
                  );
                })}
              </div>
            ))}
          </ul>
        </div>

        {/* Footer */}
        <div
          className={`${isCollapsed ? "p-2" : "p-6"} border-t space-y-5 transition-all`}
          style={{ borderColor: "var(--ab-border)", background: "color-mix(in srgb, var(--ab-bg-surface), transparent 80%)" }}
        >
          <div className="flex flex-col gap-3">
            <div className={`flex ${isCollapsed ? "flex-col" : "flex-row"} gap-3`}>
              <button
                onClick={toggleDarkMode}
                className="flex-1 flex items-center justify-center gap-2.5 p-3 ab-nm-button rounded-2xl transition-all group"
                style={{ color: "var(--ab-text-dim)" }}
              >
                {isDark
                  ? <Sun size={14} className="text-orange-400 group-hover:rotate-45 transition-transform" />
                  : <Moon size={14} className="group-hover:-rotate-12 transition-transform" style={{ color: "var(--ab-primary)" }} />}
                {!isCollapsed && (
                  <span className="text-[10px] font-black uppercase tracking-[0.1em]">{isDark ? "Light" : "Dark"}</span>
                )}
              </button>
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="p-5 ab-nm-button rounded-2xl text-red-500 transition-all active:scale-95 flex items-center justify-center"
              >
                <LogOut size={16} />
              </button>
            </div>
            {!isCollapsed && (
              <button
                onClick={() => router.push("/absensi/home")}
                className="w-full flex items-center justify-center gap-3 p-4 ab-nm-button rounded-2xl font-black text-[10px] uppercase tracking-widest ab-animate-fadeIn"
                style={{ color: "var(--ab-primary)" }}
              >
                <Users size={14} /> Kembali Ke Mode Staf
              </button>
            )}
          </div>

          {/* User info */}
          <div
            className={`flex items-center ${isCollapsed ? "justify-center" : "gap-3"} p-4 rounded-3xl overflow-hidden`}
            style={{ background: "color-mix(in srgb, var(--ab-bg-surface), transparent 20%)", border: "1px solid var(--ab-border)" }}
          >
            <div className="w-12 h-12 text-white rounded-2xl flex items-center justify-center font-black text-lg shadow-lg shrink-0" style={{ background: "var(--ab-primary)" }}>
              {user?.name?.charAt(0)?.toUpperCase() ?? "A"}
            </div>
            {!isCollapsed && (
              <div className="min-w-0 flex-1 ab-animate-fadeIn">
                <p className="text-[13px] font-black truncate leading-tight mb-0.5" style={{ color: "var(--ab-text-main)" }}>
                  {user?.name ?? "Admin"}
                </p>
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "var(--ab-secondary)" }} />
                  <span className="text-[8px] font-black uppercase tracking-[0.1em]" style={{ color: "var(--ab-text-dim)" }}>
                    Administrator
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>

        <ConfirmDialog
          isOpen={showLogoutConfirm}
          title="Konfirmasi Keluar"
          message="Yakin ingin keluar dari panel admin?"
          onConfirm={handleLogout}
          onCancel={() => setShowLogoutConfirm(false)}
          type="danger"
        />
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col h-screen overflow-hidden w-full relative">
        {/* Mobile topbar */}
        <div className="md:hidden border-b p-4 flex justify-between items-center shrink-0 z-30 shadow-sm"
          style={{ background: "var(--ab-bg-main)", borderColor: "var(--ab-border)" }}>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 flex items-center justify-center rounded-lg text-white" style={{ background: "var(--ab-primary)" }}>
              <ShieldCheck size={16} />
            </div>
            <h1 className="font-bold text-md whitespace-nowrap" style={{ color: "var(--ab-text-main)" }}>
              Enterprise Panel
            </h1>
          </div>
          <button
            onClick={() => setIsSidebarOpen(true)}
            className="p-2.5 rounded-xl border hover:scale-105 active:scale-95 transition-all"
            style={{ background: "var(--ab-bg-surface)", borderColor: "var(--ab-border)", color: "var(--ab-text-main)" }}
          >
            <AlignJustify size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto w-full p-5 md:p-8 ab-scrollbar">
          <div className="max-w-6xl mx-auto">{children}</div>
        </div>
      </div>
    </div>
  );
}
