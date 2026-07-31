"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Banknote, Settings2 } from "lucide-react";

export default function PayrollAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="shrink-0 px-6 py-4 border-b bg-white dark:bg-[#020817]" style={{ borderColor: 'var(--ab-border)' }}>
        <h1 className="text-xl font-black tracking-widest uppercase mb-4" style={{ color: 'var(--ab-text-main)' }}>
          Kelola Gaji
        </h1>
        <div className="flex space-x-2">
          <Link
            href="/absensi/admin/payroll"
            className={cn(
              "px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors",
              pathname === "/absensi/admin/payroll"
                ? "bg-emerald-500 text-white"
                : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <Banknote size={16} /> Input Gaji
          </Link>
          <Link
            href="/absensi/admin/payroll/settings"
            className={cn(
              "px-4 py-2 rounded-lg flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors",
              pathname.includes("/settings")
                ? "bg-emerald-500 text-white"
                : "text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            )}
          >
            <Settings2 size={16} /> Pengaturan
          </Link>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto ab-scrollbar p-6 bg-[#f8fafc] dark:bg-[#0f172a]">
        {children}
      </div>
    </div>
  );
}
