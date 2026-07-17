"use client";

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { createClient } from "@/lib/supabase/client";
import ConfirmDialog from "@/components/absensi/ConfirmDialog";
import { toast } from "sonner";
import {
  Home, FilePen, CalendarDays, TrendingUp,
  Briefcase, Sun, Moon, UserCog, LogOut, Clock,
} from "lucide-react";

const NAV_ITEMS = [
  { path: "/absensi/home",     icon: <Home size={24} />,        label: "Beranda"  },
  { path: "/absensi/requests", icon: <FilePen size={24} />,     label: "Cuti/WFA" },
  { path: "/absensi/team",     icon: <CalendarDays size={24} />, label: "Kalender" },
  { path: "/absensi/kpi",      icon: <TrendingUp size={24} />,  label: "KPI"      },
];

export default function AbsensiStaffLayout({ children }: { children: React.ReactNode }) {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const [currentTime, setCurrentTime] = useState(new Date());
  const [isDark, setIsDark] = useState(false);
  const [workHours, setWorkHours] = useState({ start: "08:00", end: "18:00" });
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  useEffect(() => {
    const t = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  useEffect(() => {
    const supabase = createClient();
    supabase
      .from("absensi_settings")
      .select("work_start, work_end")
      .eq("id", 1)
      .single()
      .then(({ data }) => {
        if (data) setWorkHours({ start: (data.work_start as string) ?? "08:00", end: (data.work_end as string) ?? "18:00" });
      });
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

  const activeIndex = NAV_ITEMS.findIndex((i) => i.path === pathname);

  return (
    <div className="ab-mobile-container pb-20 flex flex-col h-screen overflow-hidden ab-animate-fadeIn">
      <div className="flex-1 overflow-y-auto overflow-x-hidden">
        {/* Header */}
        <div
          className="text-white p-6 pt-9 rounded-b-[45px] shrink-0 relative overflow-hidden"
          style={{ background: "var(--ab-primary)", boxShadow: "0 20px 40px var(--ab-primary-glow)" }}
        >
          <div className="absolute top-0 right-0 -mr-12 -mt-12 opacity-5 rotate-12 pointer-events-none">
            <Briefcase size={200} />
          </div>

          <div className="flex justify-between items-start mb-8 relative z-10">
            <div>
              <p className="text-[10px] text-teal-100 font-black uppercase tracking-[0.2em] mb-1 opacity-80">
                Performance Hub
              </p>
              <h2 className="text-2xl font-black tracking-tight leading-none">
                {user?.name ?? "Staf NovaCore"}
              </h2>
              <div className="flex items-center gap-2 mt-2">
                <span className="text-[9px] bg-white/20 px-3 py-1 rounded-full font-black uppercase tracking-wider border border-white/10 backdrop-blur-md">
                  {user?.department ?? "DIVISI"}
                </span>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={toggleDarkMode}
                className="bg-white/15 h-11 w-11 rounded-2xl flex items-center justify-center border border-white/20 shadow-lg active:scale-90 transition-all hover:bg-white/25 backdrop-blur-sm"
              >
                {isDark ? <Sun size={16} /> : <Moon size={16} />}
              </button>
              {user?.absensiRole === "admin" && (
                <button
                  onClick={() => router.push("/absensi/admin/dashboard")}
                  className="bg-white/15 h-11 w-11 rounded-2xl flex items-center justify-center border border-white/20 shadow-lg active:scale-90 transition-all hover:bg-white/25 backdrop-blur-sm"
                >
                  <UserCog size={16} />
                </button>
              )}
              <button
                onClick={() => setShowLogoutConfirm(true)}
                className="bg-red-500/90 h-11 w-11 rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all border border-red-400 group"
              >
                <LogOut size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </button>
            </div>
          </div>

          {/* Clock + Work Hours */}
          <div className="bg-white/10 p-6 rounded-[35px] backdrop-blur-2xl border border-white/25 shadow-[inset_0_1px_1px_rgba(255,255,255,0.3)] relative z-10">
            <div className="flex flex-col items-center">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-2 text-center">
                {currentTime.toLocaleDateString("id-ID", {
                  weekday: "long", day: "numeric", month: "long", year: "numeric",
                })}
              </p>
              <h1 className="text-5xl font-black tracking-widest font-mono drop-shadow-[0_5px_15px_rgba(0,0,0,0.2)]">
                {currentTime
                  .toLocaleTimeString("id-ID", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" })
                  .replace(/\./g, ":")}
              </h1>
              <div className="mt-5 w-full flex items-center justify-center gap-4 bg-black/10 py-3 px-5 rounded-[22px] border border-white/10">
                <Clock size={18} className="text-teal-200 animate-pulse" />
                <div className="flex flex-col">
                  <span className="text-[8px] font-black uppercase tracking-[0.2em] leading-none opacity-50 mb-0.5">
                    Official Work Hours
                  </span>
                  <span className="text-[13px] font-black tracking-tight">
                    {workHours.start} — {workHours.end}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="p-5 pb-[120px]">{children}</div>
      </div>

      {/* Bottom Nav */}
      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] ab-glass p-5 pb-10 z-30 rounded-t-[45px] shadow-[0_-20px_50px_rgba(0,0,0,0.1)] transition-all">
        <div className="flex justify-around relative">
          <div
            className="absolute h-full ab-nm-button rounded-[22px] transition-all duration-500"
            style={{ width: "23%", left: `${activeIndex * 25 + 1}%`, opacity: activeIndex >= 0 ? 1 : 0 }}
          />
          {NAV_ITEMS.map((item) => {
            const active = pathname === item.path;
            return (
              <button
                key={item.path}
                onClick={() => router.push(item.path)}
                className="relative flex flex-col items-center w-1/4 py-3 rounded-2xl transition-all duration-300 z-10"
                style={{
                  color: active ? "var(--ab-primary)" : "#94a3b8",
                  transform: active ? "scale(1.1)" : "scale(1)",
                  filter: active ? "drop-shadow(0 0 12px var(--ab-primary-glow))" : "none",
                }}
              >
                <span className="mb-1.5">{item.icon}</span>
                <span className="text-[9px] font-black uppercase tracking-widest leading-none">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <ConfirmDialog
        isOpen={showLogoutConfirm}
        title="Konfirmasi Keluar"
        message="Yakin ingin keluar dari sistem?"
        onConfirm={handleLogout}
        onCancel={() => setShowLogoutConfirm(false)}
        type="danger"
      />
    </div>
  );
}
