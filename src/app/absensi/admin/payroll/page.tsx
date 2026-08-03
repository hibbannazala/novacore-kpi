"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { format, subMonths, addMonths } from "date-fns";
import { id as localeId } from "date-fns/locale";
import {
  ChevronLeft, ChevronRight, Save, Send, Loader2,
  FileText, CheckCircle2, Eye, Trash2, Search, X, Filter, ChevronDown, User as UserIcon
} from "lucide-react";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import type { Payroll, PayrollStaffSetting } from "@/types";

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

  const month = currentDate.getMonth() + 1;
  const year = currentDate.getFullYear();
  const periodLabel = format(currentDate, "MMMM yyyy", { locale: localeId });

  useEffect(() => { fetchData(); }, [month, year]);

  async function fetchData() {
    setLoading(true);
    const [usersRes, settingsRes, payrollsRes] = await Promise.all([
      supabase.from("users").select("id, name, email, department_id, departments(name)").eq("absensi_status", "active").order("name"),
      supabase.from("payroll_staff_settings").select("*"),
      supabase.from("payrolls").select("*").eq("month", month).eq("year", year),
    ]);

    const users = (usersRes.data ?? []) as any[];
    const settings = (settingsRes.data ?? []) as PayrollStaffSetting[];
    const payrolls = (payrollsRes.data ?? []) as Payroll[];

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
          deductions: existing?.deductions ?? 0,
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
        deductions: row.payroll.deductions || 0,
        deduction_notes: row.payroll.deduction_notes || "",
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
        deductions: row.payroll.deductions || 0,
        deduction_notes: row.payroll.deduction_notes || "",
        notes: row.payroll.notes || "",
        status: "published",
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
  const calcTHP = (p: Partial<Payroll>) =>
    (p.base_salary || 0) + (p.mobility_allowance || 0) + (p.performance_bonus || 0) + (p.overtime_pay || 0) - (p.deductions || 0);

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
                        { label: "Tunj. Mobilitas", field: "mobility_allowance" },
                        { label: "Bonus Performa", field: "performance_bonus" },
                        { label: "Upah Lembur", field: "overtime_pay" },
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
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-rose-400 tracking-widest">Potongan</label>
                        <input
                          type="number"
                          disabled={isPublished}
                          value={row.payroll.deductions || ""}
                          onChange={(e) => updateField(row.id, "deductions", Number(e.target.value))}
                          className="ab-input text-sm font-mono w-full py-2.5 disabled:opacity-40 border-rose-500/30"
                          placeholder="0"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black uppercase text-rose-400 tracking-widest">Ket. Potongan</label>
                        <input
                          type="text"
                          disabled={isPublished}
                          value={row.payroll.deduction_notes || ""}
                          onChange={(e) => updateField(row.id, "deduction_notes", e.target.value)}
                          className="ab-input text-sm w-full py-2.5 disabled:opacity-40"
                          placeholder="BPJS, dll"
                        />
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
                      <th className="py-2 text-left font-black uppercase text-slate-500">Uraian</th>
                      <th className="py-2 text-right font-black uppercase text-slate-500">Nominal</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[
                      { label: "Gaji Pokok", val: previewRow.payroll.base_salary || 0 },
                      { label: "Tunjangan Mobilitas", val: previewRow.payroll.mobility_allowance || 0 },
                      { label: "Bonus Performa", val: previewRow.payroll.performance_bonus || 0 },
                      { label: "Upah Lembur", val: previewRow.payroll.overtime_pay || 0 },
                    ].map((item) => (
                      <tr key={item.label} className="border-b border-slate-100">
                        <td className="py-2 font-medium">{item.label}</td>
                        <td className="py-2 text-right font-mono font-bold">{formatRp(item.val)}</td>
                      </tr>
                    ))}
                    {(previewRow.payroll.deductions || 0) > 0 && (
                      <tr className="border-b border-slate-100 text-rose-600">
                        <td className="py-2 font-medium">
                          Potongan
                          {previewRow.payroll.deduction_notes && (
                            <span className="text-[9px] text-slate-400 ml-2">({previewRow.payroll.deduction_notes})</span>
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
