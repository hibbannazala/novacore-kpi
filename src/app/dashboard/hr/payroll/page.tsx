"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, subMonths, addMonths } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Save, Send, Loader2, FileText, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { Payroll, User } from "@/types";

export default function HrPayrollPage() {
  const supabase = createClient() as any;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [users, setUsers] = useState<User[]>([]);
  const [payrolls, setPayrolls] = useState<Payroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state maps userId -> payroll form data
  const [formData, setFormData] = useState<Record<string, Partial<Payroll>>>({});

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();

  useEffect(() => {
    fetchData();
  }, [month, year]);

  async function fetchData() {
    setLoading(true);
    
    // Fetch all active users
    const { data: uData } = await supabase.from("users").select("*").order("name");
    
    // Fetch payrolls for this month
    const { data: pData } = await supabase
      .from("payrolls")
      .select("*")
      .eq("month", month)
      .eq("year", year);

    if (uData) setUsers(uData as User[]);
    if (pData) setPayrolls(pData as Payroll[]);

    // Initialize form data
    const initialForm: Record<string, Partial<Payroll>> = {};
    if (uData) {
      uData.forEach(u => {
        const existing = pData?.find(p => p.user_id === u.id);
        initialForm[u.id] = {
          base_salary: existing?.base_salary ?? 0,
          mobility_allowance: existing?.mobility_allowance ?? 0,
          performance_bonus: existing?.performance_bonus ?? 0,
          overtime_pay: existing?.overtime_pay ?? 0,
          status: existing?.status ?? "draft",
        };
      });
    }
    setFormData(initialForm);
    setLoading(false);
  }

  function handleUpdate(userId: string, field: keyof Payroll, value: number) {
    setFormData(prev => ({
      ...prev,
      [userId]: {
        ...prev[userId],
        [field]: value
      }
    }));
  }

  async function handleSave(publish: boolean) {
    setSaving(true);
    try {
      const upserts = users.map(u => {
        const d = formData[u.id];
        const existing = payrolls.find(p => p.user_id === u.id);
        return {
          id: existing?.id,
          user_id: u.id,
          month,
          year,
          base_salary: d.base_salary || 0,
          mobility_allowance: d.mobility_allowance || 0,
          performance_bonus: d.performance_bonus || 0,
          overtime_pay: d.overtime_pay || 0,
          status: publish ? 'published' : (d.status || 'draft')
        };
      });

      // Upsert payrolls
      const { error } = await supabase.from("payrolls").upsert(upserts, { onConflict: "id" });
      if (error) {
        // If there's an issue with ID, maybe trying to upsert without id for new rows is better done without `onConflict: id`.
        // Let's just insert/update individually or let Supabase handle it.
        for (const up of upserts) {
           if (up.id) {
             await supabase.from("payrolls").update(up).eq("id", up.id);
           } else {
             await supabase.from("payrolls").insert(up);
           }
        }
      }

      toast.success(publish ? "Slip gaji berhasil dipublish ke staf!" : "Draf penggajian berhasil disimpan!");
      fetchData();
    } catch (err: any) {
      toast.error(err.message || "Gagal menyimpan data");
    } finally {
      setSaving(false);
    }
  }

  const formatRp = (num: number) => "Rp " + (num || 0).toLocaleString("id-ID");

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">Penggajian Bulanan</h1>
          <p className="text-sm text-slate-500 mt-1">Kelola slip gaji dan komponen pendapatan karyawan.</p>
        </div>
        
        <div className="flex items-center gap-3 bg-white px-4 py-2 rounded-2xl border border-slate-200 shadow-sm">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-black text-slate-700 uppercase tracking-widest min-w-[120px] text-center">
            {format(currentDate, "MMMM yyyy", { locale: localeId })}
          </span>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1 hover:bg-slate-100 rounded-lg text-slate-400 hover:text-slate-700">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden flex flex-col h-[calc(100vh-200px)]">
        <div className="flex-1 overflow-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center h-full text-slate-400">
              <Loader2 className="h-6 w-6 animate-spin mb-2" />
              <p className="text-xs font-bold uppercase tracking-widest">Memuat Data...</p>
            </div>
          ) : (
            <table className="w-full text-left border-collapse min-w-[1000px]">
              <thead className="bg-slate-50 sticky top-0 z-10 shadow-sm">
                <tr>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Karyawan</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Gaji Pokok</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Tunj. Mobilitas</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Bonus Performa</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400">Upah Lembur</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-right">THP</th>
                  <th className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-slate-400 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => {
                  const d = formData[u.id] || {};
                  const isPublished = d.status === "published";
                  const total = (d.base_salary || 0) + (d.mobility_allowance || 0) + (d.performance_bonus || 0) + (d.overtime_pay || 0);
                  
                  return (
                    <tr key={u.id} className="border-t border-slate-100 hover:bg-slate-50/50 transition-colors">
                      <td className="px-4 py-3">
                        <p className="text-sm font-bold text-slate-800">{u.name}</p>
                        <p className="text-[10px] text-slate-500 uppercase tracking-widest">{u.department || "-"} / {u.role}</p>
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="number" 
                          disabled={isPublished}
                          value={d.base_salary || ""} 
                          onChange={(e) => handleUpdate(u.id, "base_salary", Number(e.target.value))}
                          className="w-28 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-mono disabled:opacity-50 disabled:bg-slate-50"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="number" 
                          disabled={isPublished}
                          value={d.mobility_allowance || ""} 
                          onChange={(e) => handleUpdate(u.id, "mobility_allowance", Number(e.target.value))}
                          className="w-28 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-mono disabled:opacity-50 disabled:bg-slate-50"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="number" 
                          disabled={isPublished}
                          value={d.performance_bonus || ""} 
                          onChange={(e) => handleUpdate(u.id, "performance_bonus", Number(e.target.value))}
                          className="w-28 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-mono disabled:opacity-50 disabled:bg-slate-50"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <input 
                          type="number" 
                          disabled={isPublished}
                          value={d.overtime_pay || ""} 
                          onChange={(e) => handleUpdate(u.id, "overtime_pay", Number(e.target.value))}
                          className="w-28 bg-white border border-slate-200 rounded-lg px-2 py-1.5 text-sm font-mono disabled:opacity-50 disabled:bg-slate-50"
                        />
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-sm font-black font-mono text-teal-600">{formatRp(total)}</span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        {isPublished ? (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest bg-green-100 text-green-700">
                            <CheckCircle2 size={12} /> Terkirim
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[9px] font-black uppercase tracking-widest bg-slate-100 text-slate-500">
                            <FileText size={12} /> Draf
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        
        <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 shrink-0">
          <button 
            disabled={loading || saving}
            onClick={() => handleSave(false)}
            className="flex items-center gap-2 px-6 py-2.5 bg-white border border-slate-200 text-slate-700 rounded-xl text-sm font-bold hover:bg-slate-100 transition-all shadow-sm disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save size={16} />}
            Simpan Draf
          </button>
          <button 
            disabled={loading || saving}
            onClick={() => handleSave(true)}
            className="flex items-center gap-2 px-6 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-bold hover:bg-primary/90 transition-all shadow-sm shadow-primary/20 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send size={16} />}
            Berikan ke Staf
          </button>
        </div>
      </div>
    </div>
  );
}
