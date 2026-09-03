"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, subMonths, addMonths } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, Save, Send, Loader2,
  FileText, CheckCircle2, Eye, Trash2, Search, X, Filter, ChevronDown, User as UserIcon, Plus
} from "lucide-react";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import type { Payroll, PayrollStaffSetting, DeductionType, AdditionType } from "@/types";

const MONTH_NAMES = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const COMPANY_COLORS: Record<string, string> = { TNT: "#00897B", Hype: "#E53935", Nova: "#1E88E5" };

interface StaffRow {
  id: string;
  name: string;
  email: string;
  departmentName: string | null;
  setting: PayrollStaffSetting | null;
  payroll: Partial<Payroll> & { _dirty?: boolean };
}

export default function HrPayrollPage() {
  const supabase = createClient() as any;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [rows, setRows] = useState<StaffRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [filterCompany, setFilterCompany] = useState<string>("all");
  const [previewRow, setPreviewRow] = useState<StaffRow | null>(null);
  const [confirmPublish, setConfirmPublish] = useState<StaffRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<StaffRow | null>(null);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [deductionTypes, setDeductionTypes] = useState<DeductionType[]>([]);
  const [newDeductionName, setNewDeductionName] = useState("");
  const [addingDeductionFor, setAddingDeductionFor] = useState<string | null>(null);
  const [newCustomDeduction, setNewCustomDeduction] = useState("");
  const [additionTypes, setAdditionTypes] = useState<AdditionType[]>([]);
  const [addingAdditionFor, setAddingAdditionFor] = useState<string | null>(null);
  const [newCustomAddition, setNewCustomAddition] = useState("");

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();
  const periodLabel = format(currentDate, "MMMM yyyy", { locale: localeId });

  useEffect(() => { fetchData(); }, [month, year]);

  async function fetchData() {
    setLoading(true);
    const [usersRes, settingsRes, payrollsRes, deductionTypesRes, additionTypesRes] = await Promise.all([
      supabase.from("users").select("id, name, email, department_id, departments(name)").eq("absensi_status", "active").order("name"),
      supabase.from("payroll_staff_settings").select("*"),
      supabase.from("payrolls").select("*").eq("month", month).eq("year", year),
      supabase.from("payroll_deduction_types").select("*").order("name"),
      supabase.from("payroll_addition_types").select("*").order("name"),
    ]);

    const users = (usersRes.data ?? []) as any[];
    const settings = (settingsRes.data ?? []) as PayrollStaffSetting[];
    const payrolls = (payrollsRes.data ?? []) as Payroll[];
    setDeductionTypes((deductionTypesRes.data ?? []) as DeductionType[]);
    setAdditionTypes((additionTypesRes.data ?? []) as AdditionType[]);
    

    const built: StaffRow[] = users.map((u: any) => {
      const setting = settings.find((s) => s.user_id === u.id) || null;
      const existing = payrolls.find((p) => p.user_id === u.id);
      return {
        id: u.id,
        name: u.name,
        email: u.email,
        departmentName: u.departments?.name ?? null,
        setting,
        payroll: {
          id: existing?.id,
          base_salary: existing?.base_salary ?? setting?.default_base_salary ?? 0,
          mobility_allowance: existing?.mobility_allowance ?? setting?.default_mobility_allowance ?? 0,
          performance_bonus: existing?.performance_bonus ?? 0,
          overtime_pay: existing?.overtime_pay ?? 0,
          overtime_notes: existing?.overtime_notes ?? "",
          additions_detail: existing?.additions_detail ?? [],
          deductions: existing?.deductions ?? 0,
          deductions_detail: existing?.deductions_detail ?? [],
          deduction_notes: existing?.deduction_notes ?? "",
          notes: existing?.notes ?? "",
          status: existing?.status ?? "draft",
        },
      };
    });

    setRows(built);
    setLoading(false);
  }

  function updateField(userId: string, field: string, value: number | string) {
    setRows((prev) =>
      prev.map((r) =>
        r.id === userId ? { ...r, payroll: { ...r.payroll, [field]: value, _dirty: true } } : r
      )
    );
  }

  async function saveRow(row: StaffRow) {
    const tid = toast.loading(`Menyimpan gaji ${row.name}...`);
    try {
      const payload = {
        user_id: row.id,
        month,
        year,
        base_salary: row.payroll.base_salary || 0,
        mobility_allowance: row.payroll.mobility_allowance || 0,
        performance_bonus: row.payroll.performance_bonus || 0,
        overtime_pay: row.payroll.overtime_pay || 0,
        overtime_notes: row.payroll.overtime_notes || "",
        additions_detail: row.payroll.additions_detail || [],
        deductions: row.payroll.deductions || 0,
        deductions_detail: row.payroll.deductions_detail || [],
        
        notes: row.payroll.notes || "",
        status: "draft",
      };

      if (row.payroll.id) {
        const { error } = await supabase.from("payrolls").update(payload as any).eq("id", row.payroll.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("payrolls").insert(payload as any);
        if (error) throw error;
      }

      toast.success(`Draf gaji ${row.name} berhasil disimpan.`, { id: tid });
      fetchData();
    } catch (err: unknown) {
      toast.error("Gagal: " + (err instanceof Error ? err.message : (err as any)?.message || JSON.stringify(err)), { id: tid });
    }
  }

  async function publishRow(row: StaffRow) {
    setConfirmPublish(null);
    const tid = toast.loading(`Mengirim slip gaji ${row.name}...`);
    try {
      const payload = {
        user_id: row.id,
        month,
        year,
        base_salary: row.payroll.base_salary || 0,
        mobility_allowance: row.payroll.mobility_allowance || 0,
        performance_bonus: row.payroll.performance_bonus || 0,
        overtime_pay: row.payroll.overtime_pay || 0,
        overtime_notes: row.payroll.overtime_notes || "",
        additions_detail: row.payroll.additions_detail || [],
        deductions: row.payroll.deductions || 0,
        deductions_detail: row.payroll.deductions_detail || [],
        deduction_notes: row.payroll.deduction_notes || "",
        notes: row.payroll.notes || "",
        status: "published",
        snapshot_name: row.name,
        snapshot_position: row.setting?.contract_position || null,
        snapshot_company: row.setting?.company || null,
      };

      if (row.payroll.id) {
        const { error } = await supabase.from("payrolls").update({ ...payload, status: "published" } as any).eq("id", row.payroll.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("payrolls").insert({ ...payload, status: "published" } as any);
        if (error) throw error;
      }

      toast.success(`Slip gaji ${row.name} berhasil dikirim!`, { id: tid });
      fetchData();
    } catch (err: unknown) {
      toast.error("Gagal: " + (err instanceof Error ? err.message : (err as any)?.message || JSON.stringify(err)), { id: tid });
    }
  }

  async function deleteRow(row: StaffRow) {
    setConfirmDelete(null);
    if (!row.payroll.id) { toast.info("Belum ada data untuk dihapus."); return; }
    const tid = toast.loading(`Menghapus slip gaji ${row.name}...`);
    try {
      const { error } = await supabase.from("payrolls").delete().eq("id", row.payroll.id);
      if (error) throw error;
      toast.success(`Slip gaji ${row.name} berhasil dihapus.`, { id: tid });
      fetchData();
    } catch (err: unknown) {
      toast.error("Gagal: " + (err instanceof Error ? err.message : (err as any)?.message || JSON.stringify(err)), { id: tid });
    }
  }

  const formatRp = (num: number) => "Rp " + (num || 0).toLocaleString("id-ID");
  const calcTHP = (p: Partial<Payroll>) => {
    const adds = (p.additions_detail || []).reduce((sum, item) => sum + (item.amount || 0), 0);
    return (p.base_salary || 0) + (p.mobility_allowance || 0) + (p.performance_bonus || 0) + (p.overtime_pay || 0) + adds - (p.deductions || 0);
  };

  const filtered = rows.filter((r) => {
    const matchSearch = r.name.toLowerCase().includes(search.toLowerCase());
    const matchCompany = filterCompany === "all" || r.setting?.company === filterCompany;
    return matchSearch && matchCompany;
  });

  return (
    <div className="space-y-6 ab-animate-fadeIn">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-[var(--ab-text-main)] tracking-tight">Input Gaji Bulanan</h1>
          <p className="text-[10px] font-bold text-[var(--ab-text-dim)] uppercase tracking-widest mt-1">
            Kelola komponen gaji per karyawan per bulan
          </p>
        </div>

        <div className="flex items-center gap-3 bg-[var(--ab-bg-surface)] px-4 py-2 rounded-2xl border border-[var(--ab-border)] shadow-sm">
          <button onClick={() => setCurrentDate(subMonths(currentDate, 1))} className="p-1 hover:bg-[var(--ab-bg-main)] rounded-lg text-[var(--ab-text-dim)] hover:text-[var(--ab-text-main)]">
            <ChevronLeft size={18} />
          </button>
          <span className="text-sm font-black text-[var(--ab-text-main)] uppercase tracking-widest min-w-[140px] text-center">
            {periodLabel}
          </span>
          <button onClick={() => setCurrentDate(addMonths(currentDate, 1))} className="p-1 hover:bg-[var(--ab-bg-main)] rounded-lg text-[var(--ab-text-dim)] hover:text-[var(--ab-text-main)]">
            <ChevronRight size={18} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--ab-text-dim)]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama karyawan..."
            className="ab-input w-full pl-11 text-xs font-bold"
          />
        </div>
        <div className="flex items-center gap-2 bg-[var(--ab-bg-surface)] px-3 py-2 rounded-2xl border border-[var(--ab-border)]">
          <Filter size={14} className="text-[var(--ab-text-dim)]" />
          {["all", "TNT", "Hype", "Nova"].map((c) => (
            <button
              key={c}
              onClick={() => setFilterCompany(c)}
              className="px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all"
              style={
                filterCompany === c
                  ? { background: c === "all" ? "var(--ab-text-main)" : COMPANY_COLORS[c], color: "white" }
                  : { color: "var(--ab-text-dim)" }
              }
            >
              {c === "all" ? "Semua" : c}
            </button>
          ))}
        </div>
      </div>

      {/* Accordion List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center h-40 text-[var(--ab-text-dim)]">
          <Loader2 className="h-6 w-6 animate-spin mb-2" />
          <p className="text-xs font-bold uppercase tracking-widest">Memuat Data...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-20 text-[var(--ab-text-dim)]">
          <p className="text-xs font-black uppercase tracking-widest">Tidak ada data ditemukan</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => {
            const isPublished = row.payroll.status === "published";
            const thp = calcTHP(row.payroll);
            const companyColor = COMPANY_COLORS[row.setting?.company || "Nova"] || "#1E88E5";
            const isExpanded = expandedRow === row.id;

            return (
              <div
                key={row.id}
                className="ab-card-tactile relative overflow-hidden transition-all duration-300"
              >
                {/* Company color strip */}
                <div className="absolute top-0 left-0 w-1.5 h-full" style={{ background: companyColor }} />

                {/* Accordion Header (Clickable) */}
                <div 
                  onClick={() => setExpandedRow(isExpanded ? null : row.id)}
                  className="flex justify-between items-center p-4 pl-6 cursor-pointer hover:bg-[var(--ab-bg-main)] transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full flex items-center justify-center border-2 shadow-sm" style={{ borderColor: companyColor + '50', background: companyColor + '10', color: companyColor }}>
                      <UserIcon size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-black text-[var(--ab-text-main)] tracking-tight">{row.name}</p>
                      <p className="text-[10px] font-bold text-[var(--ab-text-dim)] uppercase tracking-widest">
                        {row.setting?.contract_position || "Belum diatur"} • {row.setting?.company || "Nova"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    {isPublished ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-green-500/20 text-green-500 border border-green-500/30">
                        <CheckCircle2 size={10} /> Terkirim
                      </span>
                    ) : row.payroll.id ? (
                      <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest bg-[var(--ab-bg-main)] text-[var(--ab-text-dim)] border border-[var(--ab-border)]">
                        <FileText size={10} /> Draf
                      </span>
                    ) : null}
                    <div className="text-[var(--ab-text-dim)]">
                      <ChevronDown size={18} className={`transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`} />
                    </div>
                  </div>
                </div>

                {/* Accordion Body */}
                {isExpanded && (
                  <div className="p-4 pl-6 border-t border-[var(--ab-border)] bg-[var(--ab-bg-surface)]">
                    {/* Input Grid */}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-5">
                      {[
                        { label: "Gaji Pokok", field: "base_salary" },
                        { label: "Allowance", field: "mobility_allowance" },
                        { label: "Bonus Performa", field: "performance_bonus" },
                      ].map(({ label, field }) => (
                        <div key={field} className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest">{label}</label>
                          <input
                            type="number"
                            disabled={isPublished}
                            value={(row.payroll as any)[field] || ""}
                            onChange={(e) => updateField(row.id, field, Number(e.target.value))}
                            className="ab-input text-sm font-mono w-full py-2.5 disabled:opacity-40"
                            placeholder="0"
                          />
                        </div>
                      ))}
                      
                      {/* Overtime with Note */}
                      <div className="col-span-2 md:col-span-3 grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest">Upah Lembur</label>
                          <input
                            type="number"
                            disabled={isPublished}
                            value={row.payroll.overtime_pay || ""}
                            onChange={(e) => updateField(row.id, "overtime_pay", Number(e.target.value))}
                            className="ab-input text-sm font-mono w-full py-2.5 disabled:opacity-40"
                            placeholder="0"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest">Ket. Lembur</label>
                          <textarea
                            disabled={isPublished}
                            value={row.payroll.overtime_notes || ""}
                            onChange={(e) => updateField(row.id, "overtime_notes", e.target.value)}
                            className="ab-input text-sm w-full py-2 min-h-[50px] resize-none disabled:opacity-40 mt-2"
                            placeholder="Keterangan lembur (bisa multi baris/enter)"
                          />
                        </div>
                      </div>

                      {/* Multi-Addition UI */}
                      <div className="col-span-2 md:col-span-3 space-y-3 bg-emerald-50/50 p-4 rounded-xl border border-emerald-100">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black uppercase text-emerald-600 tracking-widest flex items-center gap-1.5">
                            Upah Tambahan Lainnya
                            <span className="text-[9px] bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded-md">Total: {formatRp((row.payroll.additions_detail || []).reduce((sum, item) => sum + (item.amount || 0), 0))}</span>
                          </label>
                        </div>
                        
                        <div className="space-y-2">
                          {(row.payroll.additions_detail || []).map((add, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                              <input
                                type="text"
                                disabled={isPublished}
                                value={add.name}
                                onChange={(e) => {
                                  const newList = [...(row.payroll.additions_detail || [])];
                                  newList[idx].name = e.target.value;
                                  setRows(prev => prev.map(r => r.id === row.id ? { ...r, payroll: { ...r.payroll, additions_detail: newList, _dirty: true } } : r));
                                }}
                                className="ab-input text-xs w-1/2 py-2 disabled:opacity-40"
                                placeholder="Nama Tambahan"
                              />
                              <input
                                type="number"
                                disabled={isPublished}
                                value={add.amount || ""}
                                onChange={(e) => {
                                  const newList = [...(row.payroll.additions_detail || [])];
                                  newList[idx].amount = Number(e.target.value);
                                  setRows(prev => prev.map(r => r.id === row.id ? { ...r, payroll: { ...r.payroll, additions_detail: newList, _dirty: true } } : r));
                                }}
                                className="ab-input text-xs font-mono w-1/2 py-2 disabled:opacity-40"
                                placeholder="0"
                              />
                              {!isPublished && (
                                <button
                                  onClick={() => {
                                    const newList = [...(row.payroll.additions_detail || [])];
                                    newList.splice(idx, 1);
                                    setRows(prev => prev.map(r => r.id === row.id ? { ...r, payroll: { ...r.payroll, additions_detail: newList, _dirty: true } } : r));
                                  }}
                                  className="text-emerald-400 hover:text-emerald-600 p-1 bg-white border border-emerald-100 hover:border-emerald-300 rounded"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        {!isPublished && (
                          <div className="flex flex-col gap-2 mt-2">
                            {addingAdditionFor === row.id ? (
                              <div className="flex gap-2 items-center">
                                <input 
                                  autoFocus
                                  type="text" 
                                  className="ab-input text-xs py-1.5 flex-1 bg-white"
                                  placeholder="Ketik nama tambahan..."
                                  value={newCustomAddition}
                                  onChange={e => setNewCustomAddition(e.target.value)}
                                  onKeyDown={async (e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      if (!newCustomAddition.trim()) return;
                                      const finalName = newCustomAddition.trim();
                                      const { data } = await supabase.from('payroll_addition_types').insert({ name: finalName }).select().single();
                                      if (data) setAdditionTypes(prev => [...prev, data]);
                                      
                                      const newList = [...(row.payroll.additions_detail || []), { name: finalName, amount: 0 }];
                                      setRows(prev => prev.map(r => r.id === row.id ? { ...r, payroll: { ...r.payroll, additions_detail: newList, _dirty: true } } : r));
                                      setAddingAdditionFor(null);
                                      setNewCustomAddition("");
                                    } else if (e.key === 'Escape') {
                                      setAddingAdditionFor(null);
                                      setNewCustomAddition("");
                                    }
                                  }}
                                />
                                <button 
                                  className="px-3 py-1.5 bg-emerald-500 text-white text-xs rounded-md font-bold hover:bg-emerald-600"
                                  onClick={async () => {
                                    if (!newCustomAddition.trim()) return;
                                    const finalName = newCustomAddition.trim();
                                    const { data } = await supabase.from('payroll_addition_types').insert({ name: finalName }).select().single();
                                    if (data) setAdditionTypes(prev => [...prev, data]);
                                    const newList = [...(row.payroll.additions_detail || []), { name: finalName, amount: 0 }];
                                    setRows(prev => prev.map(r => r.id === row.id ? { ...r, payroll: { ...r.payroll, additions_detail: newList, _dirty: true } } : r));
                                    setAddingAdditionFor(null);
                                    setNewCustomAddition("");
                                  }}
                                >OK</button>
                                <button 
                                  className="px-2 py-1.5 bg-gray-100 text-gray-500 text-xs rounded-md hover:bg-gray-200"
                                  onClick={() => {
                                    setAddingAdditionFor(null);
                                    setNewCustomAddition("");
                                  }}
                                >Batal</button>
                              </div>
                            ) : (
                              <select
                                className="ab-input text-xs py-1.5 flex-1 bg-white"
                                value=""
                                onChange={async (e) => {
                                  const val = e.target.value;
                                  if (!val) return;
                                  
                                  if (val === 'NEW') {
                                    setAddingAdditionFor(row.id);
                                    setNewCustomAddition("");
                                    return;
                                  }
  
                                  const newList = [...(row.payroll.additions_detail || []), { name: val, amount: 0 }];
                                  setRows(prev => prev.map(r => r.id === row.id ? { ...r, payroll: { ...r.payroll, additions_detail: newList, _dirty: true } } : r));
                                }}
                              >
                                <option value="">-- Tambah Upah Lainnya --</option>
                                {additionTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                <option value="NEW" className="font-bold text-emerald-600">+ Tambah Upah Baru</option>
                              </select>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Multi-Deduction UI */}
                      <div className="col-span-2 md:col-span-3 space-y-3 bg-rose-50/50 p-4 rounded-xl border border-rose-100">
                        <div className="flex justify-between items-center">
                          <label className="text-[10px] font-black uppercase text-rose-500 tracking-widest flex items-center gap-1.5">
                            Potongan
                            <span className="text-[9px] bg-rose-100 text-rose-600 px-1.5 py-0.5 rounded-md">Total: {formatRp(row.payroll.deductions || 0)}</span>
                          </label>
                        </div>
                        
                        <div className="space-y-2">
                          {(row.payroll.deductions_detail || []).map((ded, idx) => (
                            <div key={idx} className="flex gap-2 items-center">
                              <input
                                type="text"
                                disabled={isPublished}
                                value={ded.name}
                                onChange={(e) => {
                                  const newList = [...(row.payroll.deductions_detail || [])];
                                  newList[idx].name = e.target.value;
                                  const total = newList.reduce((sum, item) => sum + (item.amount || 0), 0);
                                  setRows(prev => prev.map(r => r.id === row.id ? { ...r, payroll: { ...r.payroll, deductions_detail: newList, deductions: total, _dirty: true } } : r));
                                }}
                                className="ab-input text-xs w-1/2 py-2 disabled:opacity-40"
                                placeholder="Nama Potongan"
                              />
                              <input
                                type="number"
                                disabled={isPublished}
                                value={ded.amount || ""}
                                onChange={(e) => {
                                  const newList = [...(row.payroll.deductions_detail || [])];
                                  newList[idx].amount = Number(e.target.value);
                                  const total = newList.reduce((sum, item) => sum + (item.amount || 0), 0);
                                  setRows(prev => prev.map(r => r.id === row.id ? { ...r, payroll: { ...r.payroll, deductions_detail: newList, deductions: total, _dirty: true } } : r));
                                }}
                                className="ab-input text-xs font-mono w-1/2 py-2 disabled:opacity-40"
                                placeholder="0"
                              />
                              {!isPublished && (
                                <button
                                  onClick={() => {
                                    const newList = [...(row.payroll.deductions_detail || [])];
                                    newList.splice(idx, 1);
                                    const total = newList.reduce((sum, item) => sum + (item.amount || 0), 0);
                                    setRows(prev => prev.map(r => r.id === row.id ? { ...r, payroll: { ...r.payroll, deductions_detail: newList, deductions: total, _dirty: true } } : r));
                                  }}
                                  className="text-rose-400 hover:text-rose-600 p-1 bg-white border border-rose-100 hover:border-rose-300 rounded"
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>

                        {!isPublished && (
                          <div className="flex flex-col gap-2 mt-2">
                            {addingDeductionFor === row.id ? (
                              <div className="flex gap-2 items-center">
                                <input 
                                  autoFocus
                                  type="text" 
                                  className="ab-input text-xs py-1.5 flex-1 bg-white"
                                  placeholder="Ketik nama potongan..."
                                  value={newCustomDeduction}
                                  onChange={e => setNewCustomDeduction(e.target.value)}
                                  onKeyDown={async (e) => {
                                    if (e.key === 'Enter') {
                                      e.preventDefault();
                                      if (!newCustomDeduction.trim()) return;
                                      const finalName = newCustomDeduction.trim();
                                      // Save to DB
                                      const { data } = await supabase.from('payroll_deduction_types').insert({ name: finalName }).select().single();
                                      if (data) setDeductionTypes(prev => [...prev, data]);
                                      
                                      const newList = [...(row.payroll.deductions_detail || []), { name: finalName, amount: 0 }];
                                      setRows(prev => prev.map(r => r.id === row.id ? { ...r, payroll: { ...r.payroll, deductions_detail: newList, _dirty: true } } : r));
                                      setAddingDeductionFor(null);
                                      setNewCustomDeduction("");
                                    } else if (e.key === 'Escape') {
                                      setAddingDeductionFor(null);
                                      setNewCustomDeduction("");
                                    }
                                  }}
                                />
                                <button 
                                  className="px-3 py-1.5 bg-rose-500 text-white text-xs rounded-md font-bold hover:bg-rose-600"
                                  onClick={async () => {
                                    if (!newCustomDeduction.trim()) return;
                                    const finalName = newCustomDeduction.trim();
                                    const { data } = await supabase.from('payroll_deduction_types').insert({ name: finalName }).select().single();
                                    if (data) setDeductionTypes(prev => [...prev, data]);
                                    const newList = [...(row.payroll.deductions_detail || []), { name: finalName, amount: 0 }];
                                    setRows(prev => prev.map(r => r.id === row.id ? { ...r, payroll: { ...r.payroll, deductions_detail: newList, _dirty: true } } : r));
                                    setAddingDeductionFor(null);
                                    setNewCustomDeduction("");
                                  }}
                                >OK</button>
                                <button 
                                  className="px-2 py-1.5 bg-gray-100 text-gray-500 text-xs rounded-md hover:bg-gray-200"
                                  onClick={() => {
                                    setAddingDeductionFor(null);
                                    setNewCustomDeduction("");
                                  }}
                                >Batal</button>
                              </div>
                            ) : (
                              <select
                                className="ab-input text-xs py-1.5 flex-1 bg-white"
                                value=""
                                onChange={async (e) => {
                                  const val = e.target.value;
                                  if (!val) return;
                                  
                                  if (val === 'NEW') {
                                    setAddingDeductionFor(row.id);
                                    setNewCustomDeduction("");
                                    return;
                                  }
  
                                  const newList = [...(row.payroll.deductions_detail || []), { name: val, amount: 0 }];
                                  setRows(prev => prev.map(r => r.id === row.id ? { ...r, payroll: { ...r.payroll, deductions_detail: newList, _dirty: true } } : r));
                                }}
                              >
                                <option value="">-- Tambah Potongan --</option>
                                {deductionTypes.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
                                <option value="NEW" className="font-bold text-rose-600">+ Tambah Potongan Baru</option>
                              </select>
                            )}
                          </div>
                        )}
                        
                        <div className="pt-2 border-t border-rose-200">
                          <label className="text-[9px] font-black uppercase text-rose-500 tracking-widest mb-1 block">Catatan Potongan</label>
                          <textarea
                            disabled={isPublished}
                            value={row.payroll.deduction_notes || ""}
                            onChange={(e) => updateField(row.id, "deduction_notes", e.target.value)}
                            className="ab-input text-sm w-full py-2 min-h-[50px] resize-none disabled:opacity-40"
                            placeholder="Mis: Kasbon bulan agustus (opsional)..."
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1 mb-4">
                      <label className="text-[9px] font-black uppercase tracking-widest text-[var(--ab-text-dim)]">Catatan Slip Gaji</label>
                      <textarea
                        disabled={isPublished}
                        value={row.payroll.notes || ""}
                        onChange={(e) => updateField(row.id, "notes", e.target.value)}
                        className="ab-input text-sm w-full py-2 min-h-[50px] resize-none disabled:opacity-40"
                        placeholder="Tambahkan catatan khusus untuk slip gaji ini (opsional)..."
                      />
                    </div>

                    {/* THP & Actions Container */}
                    <div className="flex flex-col md:flex-row items-center gap-4 bg-[var(--ab-bg-main)] p-4 rounded-2xl border border-[var(--ab-border)]">
                      {/* THP */}
                      <div className="flex-1 flex justify-between md:justify-start md:gap-4 items-center w-full md:w-auto border-b md:border-b-0 md:border-r border-[var(--ab-border)] pb-3 md:pb-0 md:pr-4">
                        <span className="text-[10px] font-black uppercase tracking-widest text-[var(--ab-text-dim)]">Total Diterima</span>
                        <span className="text-xl font-black font-mono" style={{ color: companyColor }}>{formatRp(thp)}</span>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex gap-2 w-full md:w-auto">
                        <button
                          onClick={() => saveRow(row)}
                          disabled={isPublished}
                          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[var(--ab-bg-surface)] text-[var(--ab-text-main)] border border-[var(--ab-border)] hover:bg-[var(--ab-border)] transition-all disabled:opacity-30 shadow-sm"
                        >
                          <Save size={14} /> Simpan
                        </button>
                        <button
                          onClick={() => setConfirmPublish(row)}
                          disabled={isPublished}
                          className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-white transition-all disabled:opacity-30 shadow-sm shadow-black/10"
                          style={{ background: companyColor }}
                        >
                          <Send size={14} /> Kirim
                        </button>
                        <button
                          onClick={() => setPreviewRow(row)}
                          className="px-3 py-2.5 rounded-xl text-[var(--ab-text-dim)] border border-[var(--ab-border)] bg-[var(--ab-bg-surface)] hover:text-[var(--ab-text-main)] transition-all"
                          title="Preview"
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          onClick={() => setConfirmDelete(row)}
                          disabled={!row.payroll.id}
                          className="px-3 py-2.5 rounded-xl text-rose-400 border border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 transition-all disabled:opacity-20"
                          title="Hapus"
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Confirm Publish Modal */}
      {confirmPublish && typeof document !== "undefined" && createPortal(
        <div className="ab-confirm-overlay" onClick={(e) => { if (e.target === e.currentTarget) setConfirmPublish(null); }}>
          <div className="w-full max-w-sm rounded-[30px] shadow-2xl overflow-hidden ab-animate-scaleIn border border-[var(--ab-border)]" style={{ background: "var(--ab-bg-surface)" }}>
            <div className="p-8 text-center">
              <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-white" style={{ background: COMPANY_COLORS[confirmPublish.setting?.company || "Nova"] }}>
                <Send size={28} />
              </div>
              <h3 className="text-xl font-black text-[var(--ab-text-main)] uppercase tracking-tight mb-2">Kirim Slip Gaji?</h3>
              <p className="text-sm text-[var(--ab-text-dim)] mb-2">
                Anda akan mengirim slip gaji <strong>{confirmPublish.name}</strong> untuk periode <strong>{periodLabel}</strong>.
              </p>
              <p className="text-lg font-black font-mono mb-6" style={{ color: COMPANY_COLORS[confirmPublish.setting?.company || "Nova"] }}>
                THP: {formatRp(calcTHP(confirmPublish.payroll))}
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmPublish(null)} className="flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest bg-[var(--ab-bg-main)] text-[var(--ab-text-dim)] border border-[var(--ab-border)]">
                  Batal
                </button>
                <button onClick={() => publishRow(confirmPublish)} className="flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-white" style={{ background: COMPANY_COLORS[confirmPublish.setting?.company || "Nova"] }}>
                  Ya, Kirim!
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Confirm Delete Modal */}
      {confirmDelete && typeof document !== "undefined" && createPortal(
        <div className="ab-confirm-overlay" onClick={(e) => { if (e.target === e.currentTarget) setConfirmDelete(null); }}>
          <div className="w-full max-w-sm rounded-[30px] shadow-2xl overflow-hidden ab-animate-scaleIn border border-[var(--ab-border)]" style={{ background: "var(--ab-bg-surface)" }}>
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-rose-500/20 rounded-full flex items-center justify-center mx-auto mb-4 text-rose-500">
                <Trash2 size={28} />
              </div>
              <h3 className="text-xl font-black text-[var(--ab-text-main)] uppercase tracking-tight mb-2">Hapus Slip Gaji?</h3>
              <p className="text-sm text-[var(--ab-text-dim)] mb-6">
                Anda akan menghapus data gaji <strong>{confirmDelete.name}</strong> untuk periode <strong>{periodLabel}</strong>. Tindakan ini tidak bisa dibatalkan.
              </p>
              <div className="flex gap-3">
                <button onClick={() => setConfirmDelete(null)} className="flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest bg-[var(--ab-bg-main)] text-[var(--ab-text-dim)] border border-[var(--ab-border)]">
                  Batal
                </button>
                <button onClick={() => deleteRow(confirmDelete)} className="flex-1 py-3 rounded-2xl text-xs font-black uppercase tracking-widest text-white bg-rose-600">
                  Ya, Hapus!
                </button>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Preview Modal */}
      {previewRow && typeof document !== "undefined" && createPortal(
        <div className="ab-confirm-overlay" onClick={(e) => { if (e.target === e.currentTarget) setPreviewRow(null); }}>
          <div className="w-full max-w-md rounded-[30px] shadow-2xl overflow-hidden ab-animate-scaleIn border border-[var(--ab-border)]" style={{ background: "var(--ab-bg-surface)" }}>
            <div className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-[var(--ab-text-main)]">Preview Slip Gaji</h3>
                <button onClick={() => setPreviewRow(null)} className="text-[var(--ab-text-dim)] hover:text-red-500">
                  <X size={20} />
                </button>
              </div>

              {/* Slip Preview */}
              <div className="bg-white text-slate-900 rounded-2xl p-6 border shadow-inner">
                <div className="flex flex-col items-center text-center mb-6 pb-4 border-b-2" style={{ borderColor: COMPANY_COLORS[previewRow.setting?.company || "Nova"] }}>
                  <img 
                    src={`/logos/${(previewRow.setting?.company || "Nova").toLowerCase()}.png`}
                    alt={previewRow.setting?.company || "Nova"}
                    className="h-12 mb-2 object-contain"
                  />
                  <div className="text-[9px] font-medium text-slate-500 mb-3 space-y-0.5">
                    {previewRow.setting?.company === "TNT" && (
                      <>
                        <p className="font-bold text-slate-700">PT TNT Kreatif Digital, MCN & TAP Agency</p>
                        <p>Official TikTok Shop Partner & MCN</p>
                        <p>Email: hr.tntmedia@gmail.com</p>
                      </>
                    )}
                    {(previewRow.setting?.company === "Nova" || !previewRow.setting?.company) && (
                      <>
                        <p className="font-bold text-slate-700">PT Synera Kreatif Grup</p>
                        <p>Official TikTok Shop Partner & MCN</p>
                      </>
                    )}
                    {previewRow.setting?.company === "Hype" && (
                      <>
                        <p className="font-bold text-slate-700">HYPE Media Indonesia</p>
                        <p>Official TikTok GO Agency Partner</p>
                        <p>Email: hypeprojectt@gmail.com</p>
                      </>
                    )}
                  </div>
                  <p className="text-lg font-black uppercase tracking-widest" style={{ color: COMPANY_COLORS[previewRow.setting?.company || "Nova"] }}>
                    SLIP GAJI
                  </p>
                </div>

                <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs mb-6">
                  <span className="font-black text-slate-500">Nama Karyawan</span>
                  <span className="font-bold">: {previewRow.name}</span>
                  <span className="font-black text-slate-500">Bulan/Tahun</span>
                  <span className="font-bold">: {MONTH_NAMES[month - 1]} {year}</span>
                  <span className="font-black text-slate-500">Jabatan</span>
                  <span className="font-bold">: {previewRow.setting?.contract_position || "-"}</span>
                </div>

                <table className="w-full text-xs border-collapse mb-6">
                  <thead>
                    <tr className="border-y-2" style={{ borderColor: COMPANY_COLORS[previewRow.setting?.company || "Nova"] }}>
                      <th className="py-2 text-left font-black uppercase text-slate-500">Rincian</th>
                      <th className="py-2 text-right font-black uppercase text-slate-500">Nominal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "Gaji Pokok", val: previewRow.payroll.base_salary || 0 },
                      { label: "Allowance", val: previewRow.payroll.mobility_allowance || 0 },
                      { label: "Bonus Performa", val: previewRow.payroll.performance_bonus || 0 },
                      { label: "Upah Lembur" + (previewRow.payroll.overtime_notes ? `\n(${previewRow.payroll.overtime_notes})` : ""), val: previewRow.payroll.overtime_pay || 0 },
                    ].map((item) => (
                      <tr key={item.label} className="border-b border-slate-100">
                        <td className="py-2 whitespace-pre-wrap leading-tight">{item.label}</td>
                        <td className="py-2 text-right font-mono font-bold">{formatRp(item.val)}</td>
                      </tr>
                    ))}
                    {previewRow.payroll.additions_detail && previewRow.payroll.additions_detail.length > 0 && (
                      <tr className="border-b border-slate-100">
                        <td className="py-2 leading-tight">
                          <span className="font-medium block">Upah Tambahan Lainnya</span>
                          {(previewRow.payroll.additions_detail || []).map((add, i) => (
                             <span key={"a-"+i} className="text-xs block ml-2">- {add.name}</span>
                          ))}
                        </td>
                        <td className="py-2 text-right font-mono font-bold">{formatRp((previewRow.payroll.additions_detail || []).reduce((sum, a) => sum + (a.amount || 0), 0))}</td>
                      </tr>
                    )}
                    {(previewRow.payroll.deductions || 0) > 0 && (
                      <tr className="border-b border-slate-100 text-rose-600">
                        <td className="py-2 leading-tight">
                          <span className="font-medium block">Potongan</span>
                          {(previewRow.payroll.deductions_detail || []).map((ded, i) => (
                             <span key={"d-"+i} className="text-xs block ml-2 text-rose-500">- {ded.name}</span>
                          ))}
                          {previewRow.payroll.deduction_notes && (
                            <span className="text-[10px] text-slate-500 italic block mt-1 whitespace-pre-wrap">{previewRow.payroll.deduction_notes}</span>
                          )}
                        </td>
                        <td className="py-2 text-right font-mono font-bold">({formatRp(previewRow.payroll.deductions || 0)})</td>
                      </tr>
                    )}
                  </tbody>
                  <tfoot>
                    {previewRow.payroll.notes && (
                      <tr>
                        <td colSpan={2} className="py-3 px-3 italic text-slate-600 bg-slate-50 text-sm whitespace-pre-wrap rounded-md mb-2">
                          <span className="font-semibold block mb-1 not-italic text-slate-800">Catatan:</span>
                          {previewRow.payroll.notes}
                        </td>
                      </tr>
                    )}
                    <tr className="border-t-2" style={{ borderColor: COMPANY_COLORS[previewRow.setting?.company || "Nova"] }}>
                      <td className="py-3 font-black uppercase">Total Diterima</td>
                      <td className="py-3 text-right font-black font-mono text-lg" style={{ color: COMPANY_COLORS[previewRow.setting?.company || "Nova"] }}>
                        {formatRp(calcTHP(previewRow.payroll))}
                      </td>
                    </tr>
                  </tfoot>
                </table>

                <div className="text-center mt-8 pt-4 border-t border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-4">Penerima,</p>
                  <p className="font-black text-sm mt-8">{previewRow.name}</p>
                  <p className="text-[10px] text-slate-500">{previewRow.setting?.contract_position || "-"}</p>
                </div>
              </div>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
