"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Banknote, Loader2, Download, Eye } from "lucide-react";
import type { Payroll } from "@/types";

export default function MyPayrollPage() {
  const supabase = createClient() as any;
  const { user } = useAuth();
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) fetchData();
  }, [user?.id]);

  async function fetchData() {
    setLoading(true);
    const { data } = await supabase
      .from("payrolls")
      .select("*")
      .eq("user_id", user!.id)
      .eq("status", "published")
      .order("year", { ascending: false })
      .order("month", { ascending: false });

    if (data) setPayrolls(data as Payroll[]);
    setLoading(false);
  }

  function handleDownload(payroll: Payroll) {
    alert(`Mendownload slip gaji bulan ${payroll.month}/${payroll.year}\n\nFitur PDF Generator akan segera hadir.`);
  }

  const formatRp = (num: number) => "Rp " + (num || 0).toLocaleString("id-ID");
  const getMonthName = (m: number) => format(new Date(2000, m - 1, 1), "MMMM", { locale: localeId });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">Slip Gaji</h1>
        <p className="text-sm text-slate-500 mt-1">Daftar slip gaji Anda yang sudah dipublish oleh HR.</p>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-200px)]">
        <div className="flex-1 overflow-auto p-4">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin mb-2" />
              <p className="text-xs font-bold uppercase tracking-widest">Memuat Data...</p>
            </div>
          ) : payrolls.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-slate-400">
              <p className="text-xs font-bold uppercase tracking-widest">Belum ada slip gaji</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {payrolls.map((p) => {
                const total = p.base_salary + p.mobility_allowance + p.performance_bonus + p.overtime_pay;
                
                return (
                  <div key={p.id} className="p-4 rounded-2xl border border-slate-100 bg-slate-50 hover:bg-white transition-all hover:shadow-md flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group">
                    <div className="flex items-start gap-4">
                      <div className="w-10 h-10 rounded-xl bg-teal-100 text-teal-600 flex items-center justify-center shrink-0">
                        <Banknote size={20} />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 rounded text-[10px] font-black tracking-widest uppercase bg-teal-100 text-teal-700">
                            TERKIRIM
                          </span>
                        </div>
                        <p className="text-lg font-black text-slate-900 tracking-tight">
                          Periode {getMonthName(p.month)} {p.year}
                        </p>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-sm font-black font-mono text-teal-600">{formatRp(total)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 w-full sm:w-auto">
                      <button 
                        onClick={() => handleDownload(p)}
                        className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all shadow-sm group-hover:shadow"
                      >
                        <Download size={16} />
                        <span className="hidden sm:inline">Unduh PDF</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
