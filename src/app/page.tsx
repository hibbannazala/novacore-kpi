"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Target, Clock, ArrowRight, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function PortalPage() {
  const { user, isLoading, signOut } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!isLoading && !user) {
      router.replace("/login");
    }
  }, [user, isLoading, router]);

  if (!mounted || isLoading || !user) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-50 dark:bg-slate-900">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex flex-col items-center justify-center p-6 relative overflow-hidden">
      {/* Background decorations */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] rounded-full bg-teal-500/10 blur-[100px]" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] rounded-full bg-blue-500/10 blur-[100px]" />

      <div className="w-full max-w-4xl relative z-10 flex flex-col items-center">
        {/* Header */}
        <div className="text-center mb-12 space-y-3">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary text-white shadow-lg mb-4">
            <span className="text-3xl font-black">N</span>
          </div>
          <h1 className="text-3xl md:text-5xl font-black text-slate-800 dark:text-slate-100 tracking-tight">
            NovaCore <span className="text-primary">Hub</span>
          </h1>
          <p className="text-slate-500 dark:text-slate-400 text-sm md:text-base font-medium max-w-lg mx-auto">
            Halo <span className="font-bold text-slate-700 dark:text-slate-300">{user.name}</span>! Selamat datang di portal utama TNT Kreatif. Silakan pilih modul sistem yang ingin Anda akses.
          </p>
        </div>

        {/* Portal Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
          
          {/* Absensi Card */}
          <button
            onClick={() => router.push("/absensi/home")}
            className="group relative flex flex-col items-start p-8 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-left overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
              <Clock className="w-32 h-32" />
            </div>
            
            <div className="w-12 h-12 rounded-2xl bg-teal-100 dark:bg-teal-900/50 text-teal-600 dark:text-teal-400 flex items-center justify-center mb-6 shadow-inner">
              <Clock className="w-6 h-6" />
            </div>
            
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2 tracking-tight">
              Absensi & Cuti
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-8 leading-relaxed">
              Kelola kehadiran harian, pengajuan cuti, dan jadwal operasional dengan mudah.
            </p>
            
            <div className="mt-auto flex items-center text-teal-600 dark:text-teal-400 text-sm font-bold group-hover:gap-3 gap-2 transition-all">
              Buka Modul <ArrowRight className="w-4 h-4" />
            </div>
          </button>

          {/* KPI Card */}
          <button
            onClick={() => router.push("/dashboard")}
            className="group relative flex flex-col items-start p-8 rounded-3xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 text-left overflow-hidden"
          >
            <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity duration-300">
              <Target className="w-32 h-32" />
            </div>
            
            <div className="w-12 h-12 rounded-2xl bg-blue-100 dark:bg-blue-900/50 text-blue-600 dark:text-blue-400 flex items-center justify-center mb-6 shadow-inner">
              <Target className="w-6 h-6" />
            </div>
            
            <h2 className="text-xl font-black text-slate-800 dark:text-slate-100 mb-2 tracking-tight">
              KPI Management
            </h2>
            <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-8 leading-relaxed">
              Pantau target bulanan, input laporan harian, dan evaluasi performa kerja.
            </p>
            
            <div className="mt-auto flex items-center text-blue-600 dark:text-blue-400 text-sm font-bold group-hover:gap-3 gap-2 transition-all">
              Buka Modul <ArrowRight className="w-4 h-4" />
            </div>
          </button>

        </div>

        {/* Footer Actions */}
        <div className="mt-12 flex items-center gap-4">
          <Button 
            variant="ghost" 
            className="text-slate-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-xl"
            onClick={() => signOut()}
          >
            <LogOut className="w-4 h-4 mr-2" />
            Keluar Akun
          </Button>
        </div>

      </div>
    </div>
  );
}
