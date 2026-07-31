"use client";

import { useState, useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { id as localeId } from "date-fns/locale";
import { Banknote, Loader2, Eye, X, Download } from "lucide-react";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import { PayslipPrintView } from "@/components/absensi/PayslipPrintView";
import type { Payroll, PayrollStaffSetting, PayrollCompany } from "@/types";

interface EnrichedPayroll extends Payroll {
  setting: PayrollStaffSetting | null;
}

const MONTH_NAMES = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const COMPANY_COLORS: Record<string, string> = { TNT: "#00897B", Hype: "#E53935", Nova: "#1E88E5" };

export default function MyPayrollPage() {
  const supabase = createClient() as any;
  const { user } = useAuth();
  const [payrolls, setPayrolls] = useState<EnrichedPayroll[]>([]);
  const [loading, setLoading] = useState(true);
  const [previewPayroll, setPreviewPayroll] = useState<EnrichedPayroll | null>(null);
  const [isDownloading, setIsDownloading] = useState(false);

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (user?.id) fetchData();
  }, [user?.id]);

  async function fetchData() {
    setLoading(true);
    try {
      const [payrollsRes, settingsRes] = await Promise.all([
        supabase.from("payrolls")
          .select("*")
          .eq("user_id", user!.id)
          .eq("status", "published")
          .order("year", { ascending: false })
          .order("month", { ascending: false }),
        supabase.from("payroll_staff_settings")
          .select("*")
          .eq("user_id", user!.id)
          .single()
      ]);

      const data = (payrollsRes.data ?? []) as Payroll[];
      const setting = (settingsRes.data ?? null) as PayrollStaffSetting | null;

      const enriched = data.map(p => ({ ...p, setting }));
      setPayrolls(enriched);
    } catch (err) {
      console.error(err);
      toast.error("Gagal memuat data slip gaji.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDownloadPdf() {
    if (!printRef.current || !previewPayroll) return;
    setIsDownloading(true);
    const tid = toast.loading("Menyiapkan dokumen PDF...");
    try {
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");

      const element = printRef.current;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL("image/png");

      const pdf = new jsPDF("p", "mm", "a4");
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Slip_Gaji_${MONTH_NAMES[previewPayroll.month - 1]}_${previewPayroll.year}.pdf`);
      toast.success("PDF berhasil diunduh!", { id: tid });
    } catch (err) {
      console.error(err);
      toast.error("Gagal membuat PDF.", { id: tid });
    } finally {
      setIsDownloading(false);
    }
  }

  const formatRp = (num: number) => "Rp " + (num || 0).toLocaleString("id-ID");
  const calcTHP = (p: Partial<Payroll>) =>
    (p.base_salary || 0) + (p.mobility_allowance || 0) + (p.performance_bonus || 0) + (p.overtime_pay || 0) - (p.deductions || 0);

  return (
    <div className="space-y-6 ab-animate-fadeIn pb-24">
      <div>
        <h1 className="text-2xl font-black text-[var(--ab-text-main)] tracking-tight">Slip Gaji</h1>
        <p className="text-[10px] font-bold text-[var(--ab-text-dim)] uppercase tracking-widest mt-1">
          Daftar slip gaji Anda yang sudah diterbitkan
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {loading ? (
          <div className="col-span-full flex flex-col items-center justify-center py-20 text-[var(--ab-text-dim)]">
            <Loader2 className="h-8 w-8 animate-spin mb-4 text-[var(--ab-primary)]" />
            <p className="text-[10px] font-black uppercase tracking-widest">Mencari Data Gaji...</p>
          </div>
        ) : payrolls.length === 0 ? (
          <div className="col-span-full text-center py-20 ab-card-tactile">
            <div className="w-16 h-16 bg-[var(--ab-bg-main)] rounded-full flex items-center justify-center mx-auto mb-4 text-[var(--ab-text-dim)]">
              <Banknote size={32} />
            </div>
            <p className="text-xs font-black uppercase text-[var(--ab-text-dim)] tracking-widest">Belum ada slip gaji</p>
          </div>
        ) : (
          payrolls.map((p) => {
            const thp = calcTHP(p);
            const companyColor = COMPANY_COLORS[p.setting?.company || "Nova"] || "#1E88E5";
            const company = p.setting?.company || "Nova";

            return (
              <div key={p.id} className="ab-card-tactile relative overflow-hidden group hover:scale-[1.02] transition-transform cursor-pointer" onClick={() => setPreviewPayroll(p)}>
                {/* Brand Color Header */}
                <div className="absolute top-0 left-0 w-full h-1.5" style={{ background: companyColor }} />
                
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-sm" style={{ background: companyColor + "15", color: companyColor }}>
                      <Banknote size={20} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: companyColor }}>
                        {company}
                      </p>
                      <h3 className="text-sm font-black text-[var(--ab-text-main)]">
                        {MONTH_NAMES[p.month - 1]} {p.year}
                      </h3>
                    </div>
                  </div>
                  <span className="px-2 py-1 bg-green-500/10 text-green-500 text-[8px] font-black uppercase tracking-widest rounded-md border border-green-500/20">
                    TERKIRIM
                  </span>
                </div>

                <div className="bg-[var(--ab-bg-main)] p-4 rounded-2xl border border-[var(--ab-border)] flex justify-between items-center mb-4">
                  <span className="text-[10px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest">Take Home Pay</span>
                  <span className="text-lg font-black font-mono" style={{ color: companyColor }}>
                    {formatRp(thp)}
                  </span>
                </div>

                <button 
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-[var(--ab-text-main)] bg-[var(--ab-bg-surface)] border border-[var(--ab-border)] hover:bg-[var(--ab-bg-main)] transition-colors"
                >
                  <Eye size={14} /> Lihat Detail & Cetak
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* Preview Modal using createPortal */}
      {previewPayroll && typeof document !== "undefined" && createPortal(
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm ab-animate-fadeIn" onClick={(e) => { if(e.target === e.currentTarget) setPreviewPayroll(null); }}>
          <div className="relative w-full max-w-2xl bg-[var(--ab-bg-surface)] rounded-[30px] shadow-2xl border border-[var(--ab-border)] overflow-hidden flex flex-col max-h-[90vh]">
            
            {/* Header Modal (Hidden in Print) */}
            <div className="flex justify-between items-center p-4 border-b border-[var(--ab-border)] shrink-0 bg-[var(--ab-bg-main)] print:hidden">
              <h3 className="text-sm font-black uppercase tracking-widest text-[var(--ab-text-main)] ml-2">Slip Gaji Digital</h3>
              <button onClick={() => setPreviewPayroll(null)} className="p-2 rounded-full hover:bg-[var(--ab-bg-surface)] text-[var(--ab-text-dim)] hover:text-red-500 transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Print Area (Scrollable in UI) */}
            <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-200 dark:bg-slate-900 ab-scrollbar print:p-0 print:bg-white print:overflow-visible">
              {/* This is the actual print component */}
              <div className="print-only">
                <PayslipPrintView
                  ref={printRef}
                  employeeName={user?.name || "Karyawan"}
                  contractPosition={previewPayroll.setting?.contract_position || "Karyawan"}
                  company={(previewPayroll.setting?.company as PayrollCompany) || "Nova"}
                  month={previewPayroll.month}
                  year={previewPayroll.year}
                  baseSalary={previewPayroll.base_salary}
                  mobilityAllowance={previewPayroll.mobility_allowance}
                  performanceBonus={previewPayroll.performance_bonus}
                  overtimePay={previewPayroll.overtime_pay}
                  deductions={previewPayroll.deductions}
                  deductionNotes={previewPayroll.deduction_notes}
                />
              </div>
            </div>
            
            {/* Footer / Action (Hidden in print) */}
            <div className="p-4 border-t border-[var(--ab-border)] shrink-0 bg-[var(--ab-bg-main)] print:hidden flex justify-end">
              <button 
                onClick={handleDownloadPdf}
                disabled={isDownloading}
                className="flex items-center justify-center gap-2 px-6 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest text-white shadow-lg shadow-black/20 hover:scale-105 active:scale-95 transition-all disabled:opacity-70 disabled:hover:scale-100"
                style={{ background: COMPANY_COLORS[previewPayroll.setting?.company || "Nova"] }}
              >
                {isDownloading ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                {isDownloading ? "MEMPROSES..." : "UNDUH PDF"}
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
