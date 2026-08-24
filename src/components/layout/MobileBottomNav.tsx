"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { LayoutDashboard, Target, Clock, FilePen, Menu, X } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { navByRole } from "./Sidebar";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function MobileBottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const { kpiRole, user, devMode } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (!user || !kpiRole) return null;

  const effectiveRole =
    kpiRole === "developer"
      ? devMode === "employee"
        ? "tim"
        : "executive"
      : kpiRole;

  const baseDash = effectiveRole === "tim" ? "/dashboard/tim" : `/dashboard/${effectiveRole}`;

  const NAV_ITEMS = [
    { path: baseDash, icon: <LayoutDashboard size={24} />, label: "Home" },
    { path: "/dashboard/tim", icon: <Clock size={24} />, label: "Absen" },
    { path: "/dashboard/tim/kpi", icon: <Target size={24} />, label: "KPI" },
    { path: "/absensi/requests", icon: <FilePen size={24} />, label: "Cuti" },
    { path: "#menu", icon: <Menu size={24} />, label: "Menu" },
  ];

  const activeIndex = NAV_ITEMS.findIndex(
    (i) => i.path === pathname || (pathname.startsWith(i.path) && i.path !== "/dashboard/tim" && i.path !== baseDash)
  );
  const exactActiveIndex = NAV_ITEMS.findIndex((i) => i.path === pathname);
  const finalIndex = isMenuOpen ? 4 : exactActiveIndex >= 0 ? exactActiveIndex : activeIndex;

  const fullNavItems = navByRole[effectiveRole] || [];

  return (
    <>
      {/* FULL SCREEN MOBILE MENU (DRAWER) */}
      {isMenuOpen && (
        <div className="md:hidden fixed inset-0 z-[90] bg-[var(--ab-bg-main)] flex flex-col animate-in fade-in zoom-in-95 duration-200">
          <div className="flex items-center justify-between p-6 border-b border-[var(--ab-border)] bg-[var(--ab-bg-surface)]">
            <div className="flex items-center gap-3">
              <img
                src="/logos/logo-nova-core-app-512px.webp"
                alt="NovaCore Logo"
                className="w-10 h-10 rounded-xl shrink-0"
                style={{ boxShadow: "0 5px 15px -3px var(--ab-primary-glow)" }}
              />
              <h1 className="text-lg font-black text-[var(--ab-text-main)] tracking-tight leading-none">NovaCore</h1>
            </div>
            <button
              onClick={() => setIsMenuOpen(false)}
              className="p-2 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 hover:text-slate-900 dark:hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-4 pb-32">
            <ul className="space-y-1">
              {fullNavItems.map((item, index) => {
                const Icon = item.icon;
                const isActive = pathname === item.href || (item.href !== baseDash && pathname.startsWith(item.href));
                const prevItem = index > 0 ? fullNavItems[index - 1] : null;
                const showGroup = item.group && (!prevItem || prevItem.group !== item.group);

                return (
                  <li key={item.href}>
                    {showGroup && (
                      <div className="pt-6 pb-2 px-3">
                        <p className="text-[10px] font-black uppercase tracking-widest leading-none text-slate-400 dark:text-slate-500">
                          {item.group}
                        </p>
                      </div>
                    )}
                    <Link
                      href={item.href}
                      onClick={() => setIsMenuOpen(false)}
                      className={cn(
                        "flex items-center gap-4 rounded-2xl px-5 py-3.5 text-[13px] font-black transition-all duration-300 mt-1",
                        isActive ? "text-white" : "text-[var(--ab-text-dim)] hover:text-[var(--ab-text-main)] bg-[var(--ab-bg-surface)]"
                      )}
                      style={isActive ? { background: "var(--ab-primary)", boxShadow: "0 10px 25px -5px var(--ab-primary-glow)" } : {}}
                    >
                      <Icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "scale-110" : "")} />
                      <span className="tracking-tight whitespace-nowrap">{item.label}</span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      )}

      {/* BOTTOM NAVIGATION BAR */}
      <div className="md:hidden fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-[480px] p-4 pb-8 z-[100] rounded-t-[40px] shadow-[0_-20px_50px_rgba(0,0,0,0.1)] transition-all bg-white/80 dark:bg-slate-900/80 backdrop-blur-2xl border-t border-slate-200/50 dark:border-slate-800/50">
        <div className="flex justify-around relative items-center">
          <div
            className="absolute h-14 rounded-2xl transition-all duration-500 bg-black/5 dark:bg-white/10 shadow-sm"
            style={{ width: "18%", left: `${finalIndex * 20 + 1}%`, opacity: finalIndex >= 0 ? 1 : 0 }}
          />
          {NAV_ITEMS.map((item) => {
            const active = item.path === "#menu" ? isMenuOpen : pathname === item.path || (pathname.startsWith(item.path) && item.path !== "/dashboard/tim" && item.path !== baseDash && !isMenuOpen);
            return (
              <button
                key={item.label}
                onClick={() => {
                  if (item.path === "#menu") {
                    setIsMenuOpen(!isMenuOpen);
                  } else {
                    setIsMenuOpen(false);
                    router.push(item.path);
                  }
                }}
                className="relative flex flex-col items-center w-1/5 py-2.5 rounded-2xl transition-all duration-300 z-10 group"
                style={{
                  color: active ? "var(--ab-primary)" : "var(--ab-text-dim)",
                  transform: active ? "scale(1.05)" : "scale(1)",
                  filter: active ? "drop-shadow(0 0 8px var(--ab-primary-glow))" : "none",
                }}
              >
                <span className={`mb-1 transition-transform duration-300 ${active ? "scale-110" : "group-hover:scale-110"}`}>{item.icon}</span>
                <span className="text-[9px] font-black uppercase tracking-widest leading-none">
                  {item.label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}
