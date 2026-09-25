"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMyLeaveRequests } from "@/hooks/absensi/useLeaveRequests";
import { useAbsensiSettings } from "@/hooks/absensi/useAbsensiSettings";
import { useHolidays } from "@/hooks/absensi/useHolidays";
import type { LeaveRequest, LeaveRequestType } from "@/types/absensi";
import ConfirmDialog from "@/components/absensi/ConfirmDialog";
import PromptDialog from "@/components/absensi/PromptDialog";
import { OvertimeStaffSection } from "@/components/absensi/OvertimeStaffSection";
import {
  CalendarPlus, CalendarDays, History, X, Info,
  FileEdit, Smile, Clock, Shield, Sparkles, CheckCircle2, XCircle, Check
} from "lucide-react";
import { toast } from "sonner";

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

type ConfirmCfg = {
  title: string;
  message: string;
  confirmLabel: string;
  type: "info" | "warning" | "danger";
};

export default function StaffRequestsPage() {
  const { user } = useAuth();
  const [mainTab, setMainTab] = useState<"leave" | "overtime">("leave");
  const [globalRequests, setGlobalRequests] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Fetch ALL leave requests for global team history
  useEffect(() => {
    const supabase = createClient();
    const fetchAll = async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*, users!user_id(name, department_id, departments(name))")
        .order("created_at", { ascending: false });
      
      setGlobalRequests(data ?? []);
      setIsLoading(false);
    };
    fetchAll();

    const ch = supabase.channel("global_leave_reqs")
      .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, fetchAll)
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, []);

  const { settings } = useAbsensiSettings();
  const { holidayDates } = useHolidays();

  const [reqType, setReqType] = useState<LeaveRequestType>("leave");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [reason, setReason] = useState("");
  const [selectedDates, setSelectedDates] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // dialogs
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmCfg, setConfirmCfg] = useState<ConfirmCfg | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  const [cancelTargetId, setCancelTargetId] = useState<string | null>(null);
  const [cancelPrompt, setCancelPrompt] = useState<{ show: boolean; reqId: string | null }>({ show: false, reqId: null });

  // ─ Date range selection ──────────────────────────────────────────────────────
  const addDateRange = () => {
    if (!startDate) { toast.error("Pilih tanggal mulai."); return; }
    const end = endDate || startDate;
    if (startDate > end) { toast.error("Tanggal mulai tidak boleh lebih dari selesai."); return; }

    const cur = new Date(startDate);
    const endObj = new Date(end);
    const temp = [...selectedDates];
    let added = 0, holidayFound = 0;

    while (cur <= endObj) {
      const s = `${cur.getFullYear()}-${String(cur.getMonth() + 1).padStart(2, "0")}-${String(cur.getDate()).padStart(2, "0")}`;
      const dow = cur.getDay();
      const isHol = holidayDates.includes(s);
      if (dow !== 0 && dow !== 6 && !isHol) {
        if (!temp.includes(s)) { temp.push(s); added++; }
      } else if (isHol) { holidayFound++; }
      cur.setDate(cur.getDate() + 1);
    }

    if (added === 0) {
      toast.error(holidayFound > 0 ? "Gagal: Tanggal tersebut adalah Hari Libur." : "Tanggal sudah ada atau merupakan hari libur/akhir pekan.");
    } else {
      toast.success(`${added} tanggal berhasil ditambahkan.`);
    }
    temp.sort();
    setSelectedDates(temp);
    setStartDate("");
    setEndDate("");
  };

  const removeDate = (d: string) => setSelectedDates((prev) => prev.filter((x) => x !== d));

  // ─ Submit ─────────────────────────────────────────────────────────────────────
  const submitRequest = async () => {
    if (isSubmitting || !user) return;
    if (!selectedDates.length) { toast.error("Pilih minimal 1 tanggal."); return; }
    if (!reason.trim()) { toast.error("Alasan wajib diisi."); return; }

    const today = getToday();
    if (selectedDates.includes(today)) {
      const timeLimitStr =
        reqType === "sick"  ? settings.maxTimeSick  :
        reqType === "leave" ? settings.maxTimeLeave :
                              settings.maxTimeWfa;
      if (timeLimitStr) {
        const [h, m] = timeLimitStr.split(":").map(Number);
        const limit = new Date(); limit.setHours(h, m, 0, 0);
        if (new Date() > limit) {
          toast.error(`Batas pengajuan ${reqType.toUpperCase()} hari ini adalah jam ${timeLimitStr}.`);
          return;
        }
      }
    }

    const reqDays    = selectedDates.length;
    const curSick    = user.sickQuota    ?? 0;
    const curLeave   = user.leaveQuota   ?? 0;
    let cfg: ConfirmCfg = {
      title: "Konfirmasi Pengajuan",
      message: `Yakin ingin mengirim pengajuan ${reqType.toUpperCase()} ini? Pastikan tanggal dan alasan sudah sesuai.`,
      confirmLabel: "Ya, Lanjut",
      type: "info",
    };

    if (reqType === "sick") {
      if (curSick < reqDays) {
        if (curLeave < reqDays - curSick) {
          cfg = {
            title: "Peringatan Unpaid Leave!",
            message: `Kuota Cuti Sakit Anda habis dan Kuota Cuti Tahunan juga tidak mencukupi. Apakah Anda sudah menghubungi HR? Jika tetap dilanjutkan, kehadiran ini berpotensi diproses sebagai Unpaid Leave.`,
            confirmLabel: "Ya, Lanjut",
            type: "danger",
          };
        } else {
          cfg = {
            title: "Potong Cuti Tahunan",
            message: `Kuota Cuti Sakit Anda kurang (Sisa: ${Math.max(curSick, 0)} hari). Sisa hari akan memotong Kuota Cuti Tahunan Anda. Tetap ajukan?`,
            confirmLabel: "Ya, Lanjut",
            type: "warning",
          };
        }
      }
    } else if (reqType === "leave" && curLeave < reqDays) {
      cfg = {
        title: "Peringatan Unpaid Leave!",
        message: `Kuota Cuti Tahunan Anda habis atau kurang. Apakah Anda sudah menghubungi HR? Jika tetap dilanjutkan, kuota cuti Anda akan memotong ke angka minus.`,
        confirmLabel: "Ya, Lanjut",
        type: "danger",
      };
    }

    // ── Validation: Divisi Limit (Max 2 concurrent approved leaves if size >= 3)
    if (user.departmentId && reqType === "leave") {
      setIsSubmitting(true);
      const tid = toast.loading("Memvalidasi kuota cuti divisi...");
      try {
        const supabase = createClient();
        
        const { count, error: countErr } = await supabase
          .from("users")
          .select("id", { count: "exact", head: true })
          .eq("department_id", user.departmentId)
          .eq("absensi_status", "active");
          
        if (countErr) throw countErr;
        
        const deptSize = count || 0;
        
        if (deptSize >= 3) {
          const { data: deptLeavesJoined, error: leavesJoinedErr } = await supabase
            .from("leave_requests")
            .select("user_id, dates, users!user_id!inner(name, department_id)")
            .eq("status", "approved")
            .eq("users.department_id", user.departmentId)
            .neq("user_id", user.id);
            
          if (leavesJoinedErr) throw leavesJoinedErr;
          
          let blockedDate = "";
          let blockedNames: string[] = [];
          
          for (const sDate of selectedDates) {
            const usersOnLeave = new Map<string, string>();
            for (const r of (deptLeavesJoined || [])) {
              if ((r.dates as string[]).includes(sDate)) {
                usersOnLeave.set(r.user_id, (r.users as any).name);
              }
            }
            if (usersOnLeave.size >= 2) {
              blockedDate = sDate;
              blockedNames = Array.from(usersOnLeave.values());
              break;
            }
          }
          
          if (blockedDate) {
            toast.error(`Jika Anda memaksakan mengajukan cuti maka sudah pasti akan ditolak karena sudah ada ${blockedNames.length} orang yang cuti di hari yang Anda pilih (${blockedDate}) yaitu ${blockedNames.join(" dan ")}`, { id: tid, duration: 10000 });
            setIsSubmitting(false);
            return;
          }
        }
        
        toast.dismiss(tid);
      } catch (err: any) {
        toast.error("Gagal validasi divisi: " + err.message, { id: tid });
        setIsSubmitting(false);
        return;
      }
      setIsSubmitting(false);
    }

    setConfirmCfg(cfg);
    setShowConfirm(true);
  };

  const handleConfirmSubmit = async () => {
    if (isSubmitting || !user) return;
    setShowConfirm(false);
    setIsSubmitting(true);
    const tid = toast.loading("Mengirim pengajuan...");
    try {
      const supabase = createClient();

      // Duplicate check
      const { data: existing } = await supabase
        .from("leave_requests")
        .select("dates, type")
        .eq("user_id", user.id)
        .eq("status", "pending");

      const isDupe = (existing ?? []).some(
        (r) =>
          r.type === reqType &&
          JSON.stringify([...(r.dates as string[])].sort()) === JSON.stringify([...selectedDates].sort())
      );
      if (isDupe) {
        toast.error("Pengajuan serupa sedang diproses (Pending).", { id: tid });
        setIsSubmitting(false);
        return;
      }

      const { error } = await supabase.from("leave_requests").insert({
        user_id: user.id,
        type: reqType,
        dates: selectedDates,
        reason: reason.trim(),
        status: "pending",
      });

      if (error) throw error;
      toast.success("Pengajuan berhasil dikirim!", { id: tid });
      setSelectedDates([]);
      setReason("");
    } catch (err: unknown) {
      toast.error("Gagal: " + (err instanceof Error ? err.message : "Unknown error"), { id: tid });
    } finally {
      setIsSubmitting(false);
    }
  };

  const cancelRequest = async (id: string) => {
    const tid = toast.loading("Membatalkan pengajuan...");
    try {
      const supabase = createClient();
      const { error } = await supabase.from("leave_requests").update({ status: "cancelled" }).eq("id", id);
      if (error) throw error;
      toast.success("Pengajuan berhasil dibatalkan.", { id: tid });
    } catch (err: unknown) {
      toast.error("Gagal: " + (err instanceof Error ? err.message : "Unknown error"), { id: tid });
    }
  };

  const submitCancellation = async (cancelReason: string) => {
    if (!cancelReason.trim()) { toast.error("Alasan pembatalan wajib diisi."); return; }
    const tid = toast.loading("Mengajukan pembatalan...");
    try {
      const supabase = createClient();
      const { error } = await supabase.from("leave_requests")
        .update({ cancellation_requested: true, cancellation_reason: cancelReason.trim() })
        .eq("id", cancelPrompt.reqId!);
      if (error) throw error;
      toast.success("Pengajuan pembatalan berhasil dikirim.", { id: tid });
      setCancelPrompt({ show: false, reqId: null });
    } catch (err: unknown) {
      toast.error("Gagal: " + (err instanceof Error ? err.message : "Unknown error"), { id: tid });
    }
  };

  const handleCancelClick = (req: LeaveRequest) => {
    if (req.status === "pending") {
      setCancelTargetId(req.id);
      setShowCancelConfirm(true);
    } else if (req.status === "approved") {
      setCancelPrompt({ show: true, reqId: req.id });
    }
  };

  // ─ Render ─────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-6 pb-24 ab-animate-fadeIn">
      {/* Header Card */}
      <div className="bg-[var(--ab-bg-surface)] p-6 rounded-[35px] border border-[var(--ab-border)] shadow-xl flex flex-col items-center text-center relative overflow-hidden">
        {/* Subtle glow background */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-32 bg-[var(--ab-primary)] opacity-10 blur-3xl rounded-full pointer-events-none" />
        
        <div
          className="w-14 h-14 text-white rounded-[22px] flex items-center justify-center shadow-lg mb-4 z-10"
          style={{ background: "var(--ab-primary)", boxShadow: "0 8px 25px -5px var(--ab-primary-glow)" }}
        >
          <FileEdit size={24} />
        </div>
        <div className="z-10">
          <h2 className="text-2xl font-black text-[var(--ab-text-main)] uppercase tracking-tight leading-none mb-2">
            Pengajuan Staf
          </h2>
          <p className="text-[10px] font-bold text-[var(--ab-text-dim)] uppercase tracking-[0.3em]">
            Cuti • Sakit • WFA
          </p>
        </div>
        {settings && (
          <div
            className="mt-6 flex items-center gap-2 px-4 py-2 rounded-full border z-10"
            style={{ background: "color-mix(in srgb, var(--ab-primary), transparent 90%)", borderColor: "var(--ab-primary-glow)" }}
          >
            <Info size={14} style={{ color: "var(--ab-primary)" }} />
            <span className="text-[10px] font-black uppercase tracking-widest" style={{ color: "var(--ab-primary)" }}>
              Sakit H-0: {settings.maxTimeSick}
            </span>
          </div>
        )}
      </div>

      {/* Main Mode Tabs (Cuti / Izin vs Lembur) */}
      <div className="flex bg-[var(--ab-bg-surface)] p-2 rounded-2xl border border-[var(--ab-border)] shadow-md">
        <button
          onClick={() => setMainTab("leave")}
          className={`flex-1 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
            mainTab === "leave"
              ? "bg-[var(--ab-primary)] text-white shadow-lg"
              : "text-[var(--ab-text-dim)] hover:text-[var(--ab-text-main)]"
          }`}
        >
          <CalendarDays size={16} /> Cuti, Sakit & WFA
        </button>
        <button
          onClick={() => setMainTab("overtime")}
          className={`flex-1 py-3.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${
            mainTab === "overtime"
              ? "bg-amber-500 text-white shadow-lg shadow-amber-500/30"
              : "text-[var(--ab-text-dim)] hover:text-[var(--ab-text-main)]"
          }`}
        >
          <Clock size={16} /> Pengajuan Lembur (Overtime)
        </button>
      </div>

      {mainTab === "overtime" ? (
        <OvertimeStaffSection />
      ) : (
        <>
          {/* Form Card */}
      <div className="ab-card-tactile space-y-6">
        {/* Type Selector */}
        <div>
          <label className="block text-[11px] font-black text-[var(--ab-text-dim)] uppercase mb-3 tracking-[0.2em] pl-1">
            Pilih Jenis Pengajuan
          </label>
          <div className="flex bg-[var(--ab-bg-main)] p-2 rounded-[24px] border border-[var(--ab-border)] shadow-inner">
            {(["leave", "sick", "wfa"] as LeaveRequestType[]).map((t) => (
              <button
                key={t}
                onClick={() => setReqType(t)}
                className="flex-1 py-4 rounded-[18px] text-xs font-black uppercase tracking-widest transition-all duration-300"
                style={reqType === t ? {
                  background: "var(--ab-bg-surface)",
                  color: t === "leave" ? "#10b981" : t === "sick" ? "#f43f5e" : "#3b82f6",
                  boxShadow: "0 8px 20px -6px rgba(0,0,0,0.15)",
                  border: "1px solid var(--ab-border)",
                } : { color: "var(--ab-text-dim)" }}
              >
                {t === "leave" ? "🏡 Cuti" : t === "sick" ? "🤒 Sakit" : "💻 WFA"}
              </button>
            ))}
          </div>
        </div>

        {/* Date Range */}
        <div>
          <label className="block text-[11px] font-black text-[var(--ab-text-dim)] uppercase mb-3 tracking-[0.2em] pl-1">
            Rentang Tanggal
          </label>
          <div className="grid grid-cols-2 gap-4 mb-5">
            <div className="space-y-2">
              <span className="text-[9px] font-black text-[var(--ab-text-dim)] uppercase tracking-widest ml-1">Mulai</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="ab-input text-xs font-black py-4 px-5 rounded-[20px] text-center"
              />
            </div>
            <div className="space-y-2">
              <span className="text-[9px] font-black text-[var(--ab-text-dim)] uppercase tracking-widest ml-1">Selesai (Opsional)</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="ab-input text-xs font-black py-4 px-5 rounded-[20px] text-center"
              />
            </div>
          </div>
          <button
            onClick={addDateRange}
            className="w-full py-4 rounded-[20px] text-[10px] font-black tracking-[0.25em] flex justify-center items-center gap-3 transition-transform active:scale-95 text-white bg-emerald-600 hover:bg-emerald-700 shadow-[0_8px_20px_-6px_rgba(5,150,105,0.5)]"
          >
            <CalendarPlus size={16} /> TAMBAHKAN KE DAFTAR
          </button>

          {/* Selected Dates */}
          <div className="mt-5 flex flex-wrap gap-2 p-6 bg-slate-50 dark:bg-slate-900/50 rounded-[24px] border border-slate-200 dark:border-slate-800 min-h-[90px] items-center justify-center">
            {selectedDates.length === 0 ? (
              <p className="text-center w-full text-[10px] text-slate-400 dark:text-slate-500 font-black uppercase tracking-[0.3em] italic">
                Daftar Tanggal Masih Kosong
              </p>
            ) : (
              selectedDates.map((d) => (
                <div
                  key={d}
                  className="bg-white dark:bg-slate-800 text-xs font-black px-4 py-2.5 rounded-xl flex items-center gap-2 border border-slate-200 dark:border-slate-700 shadow-sm text-emerald-600 dark:text-emerald-400"
                >
                  <CalendarDays size={12} className="opacity-60" />
                  {d}
                  <button
                    onClick={() => removeDate(d)}
                    className="text-slate-400 hover:text-red-500 transition ml-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-md"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-[11px] font-black text-[var(--ab-text-dim)] uppercase mb-3 tracking-[0.2em] pl-1">
            Alasan / Keterangan
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={4}
            className="ab-input resize-none text-xs font-medium py-4 px-5 rounded-[24px]"
            placeholder="Berikan alasan yang jelas untuk mempercepat approval..."
          />
        </div>

        <button
          onClick={submitRequest}
          disabled={isSubmitting}
          className="w-full py-5 rounded-[24px] font-black uppercase text-sm tracking-[0.2em] shadow-[0_10px_30px_-10px_rgba(15,23,42,0.8)] disabled:opacity-50 active:scale-[0.98] transition-all text-white bg-slate-900 dark:bg-black border border-slate-800 dark:border-slate-800 mt-2"
        >
          {isSubmitting ? "MENGIRIM DATA..." : "KIRIM PENGAJUAN FORM"}
        </button>
      </div>

      {/* History Area with Dotted Pattern Background */}
      <div className="relative mt-8 pt-8 px-4 rounded-[40px]" style={{
        backgroundImage: "radial-gradient(var(--ab-border) 2px, transparent 2px)",
        backgroundSize: "20px 20px"
      }}>
        {/* History Header */}
        <div className="flex items-center gap-3 mb-6 bg-[var(--ab-bg-surface)] p-4 rounded-2xl border border-[var(--ab-border)] shadow-sm w-fit mx-auto">
          <History size={16} className="text-slate-500" />
          <h3 className="font-black text-[var(--ab-text-main)] uppercase text-[10px] tracking-[0.2em]">
            Riwayat & Status
          </h3>
        </div>

      {/* Requests List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 bg-[var(--ab-bg-surface)] rounded-[30px] border border-[var(--ab-border)] animate-pulse" />
          ))}
        </div>
      ) : globalRequests.length === 0 ? (
        <div className="p-16 text-center ab-animate-scaleIn">
          <div className="w-20 h-20 bg-white dark:bg-slate-800 rounded-[24px] flex items-center justify-center mx-auto mb-6 text-slate-300 dark:text-slate-600 shadow-sm border border-slate-100 dark:border-slate-700">
            <Smile size={36} />
          </div>
          <h4 className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500 tracking-[0.3em] italic">
            Belum Ada Histori Pengajuan
          </h4>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {globalRequests.map((req) => (
            <RequestCard
              key={req.id}
              req={req}
              isMine={req.user_id === user?.id}
              onCancel={handleCancelClick}
            />
          ))}
        </div>
      )}
      </div>
      </>
      )}

      {/* Dialogs */}
      <ConfirmDialog
        isOpen={showConfirm}
        title={confirmCfg?.title ?? "Konfirmasi"}
        message={confirmCfg?.message ?? ""}
        confirmLabel={confirmCfg?.confirmLabel ?? "Ya, Lanjut"}
        type={confirmCfg?.type ?? "info"}
        onConfirm={handleConfirmSubmit}
        onCancel={() => setShowConfirm(false)}
      />
      <ConfirmDialog
        isOpen={showCancelConfirm}
        title="Batalkan Pengajuan"
        message="Yakin ingin membatalkan pengajuan ini?"
        confirmLabel="Ya, Batalkan"
        cancelLabel="Tidak"
        type="danger"
        onConfirm={() => {
          setShowCancelConfirm(false);
          if (cancelTargetId) cancelRequest(cancelTargetId);
          setCancelTargetId(null);
        }}
        onCancel={() => { setShowCancelConfirm(false); setCancelTargetId(null); }}
      />
      <PromptDialog
        isOpen={cancelPrompt.show}
        title="Batalkan Cuti/Izin"
        message="Pengajuan Anda sudah di-approve. Silakan masukkan alasan mengapa Anda ingin membatalkan:"
        placeholder="Misal: Acara keluarga dibatalkan, sudah sembuh, dll..."
        onConfirm={submitCancellation}
        onCancel={() => setCancelPrompt({ show: false, reqId: null })}
      />
    </div>
  );
}

// ─ Request Card ───────────────────────────────────────────────────────────────
function RequestCard({ req, isMine, onCancel }: { req: any; isMine: boolean; onCancel: (req: any) => void }) {
  const isApproved = req.status === "approved";
  const isPendingExecutive = req.status === "pending";
  const isPendingHR = req.status === "approved_executive";
  const isRejected = req.status === "rejected";
  const isCancelled = req.status === "cancelled";

  const statusColor =
    isApproved ? "#10b981" :
    isPendingHR ? "#3b82f6" :
    isPendingExecutive ? "#f59e0b" :
    isCancelled ? "#94a3b8" : "#ef4444";

  const typeStyle =
    req.type === "leave"  ? "bg-emerald-50 text-[#00897B] border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400" :
    req.type === "sick"   ? "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-400" :
                            "bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-400";

  const statusBadgeStyle =
    isApproved ? "bg-emerald-500 text-white shadow-emerald-500/20 shadow-md" :
    isPendingHR ? "bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40" :
    isPendingExecutive ? "bg-amber-50 text-amber-600 dark:bg-amber-950/40 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40" :
    isCancelled ? "bg-[var(--ab-bg-main)] text-[var(--ab-text-dim)] border border-[var(--ab-border)]" :
                  "bg-rose-500 text-white shadow-rose-500/20 shadow-md";

  const statusLabel =
    isApproved ? "DISETUJUI FINAL" :
    isPendingHR ? "MENUNGGU HR (FINAL)" :
    isPendingExecutive ? "MENUNGGU EXECUTIVE" :
    isCancelled ? "DIBATALKAN" : "DITOLAK";

  const formatDate = (d?: string | null) => {
    if (!d) return "-";
    return new Date(d).toLocaleString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    }).replace(/\./g, ":");
  };

  return (
    <div className="bg-[var(--ab-bg-surface)] p-5 sm:p-6 rounded-[32px] border border-[var(--ab-border)] shadow-sm relative overflow-hidden flex flex-col justify-between gap-4">
      <div
        className="absolute top-0 right-0 w-2.5 h-full"
        style={{ background: statusColor }}
      />
      
      <div className="space-y-4">
        {/* Top Header */}
        <div className="flex justify-between items-start gap-2 pr-2">
          <span className={`text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm border ${typeStyle}`}>
            {req.type === "leave" ? "🏡 Cuti" : req.type === "sick" ? "🤒 Sakit" : "💻 WFA"}
          </span>
          <div className="flex flex-col items-end gap-1.5">
            <span className={`text-[9px] font-black px-3.5 py-1 rounded-full uppercase tracking-wider ${statusBadgeStyle}`}>
              {statusLabel}
            </span>
            {isMine && (isPendingExecutive || (isApproved && !req.cancellation_requested)) && (
              <button
                onClick={() => onCancel(req)}
                className="text-[8px] font-black uppercase tracking-widest text-red-400 hover:text-white hover:bg-red-500 px-3 py-1.5 rounded-lg border border-red-200 dark:border-red-900 transition-all active:scale-95"
              >
                {isPendingExecutive ? "Batalkan" : "Pengajuan Batal"}
              </button>
            )}
            {req.cancellation_requested && (
              <span className="text-[8px] font-black uppercase tracking-widest text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-2.5 py-1 rounded-md border border-orange-200 dark:border-orange-800">
                Menunggu Batal
              </span>
            )}
          </div>
        </div>
        
        {/* Name, Department, Submitted At */}
        <div className="flex flex-col border-b border-[var(--ab-border)] pb-3">
          <span className="text-[15px] font-black text-[var(--ab-text-main)] tracking-tight">{req.users?.name ?? "Unknown"}</span>
          <div className="flex justify-between items-center mt-1">
            <span className="text-[10px] font-bold text-[var(--ab-text-dim)] uppercase tracking-widest">
              {req.users?.departments?.name ?? "Umum"}
            </span>
            {req.created_at && (
              <span className="text-[9px] font-bold text-[var(--ab-text-dim)]/80 uppercase tracking-widest flex items-center gap-1">
                <Clock size={10} />
                {formatDate(req.created_at)}
              </span>
            )}
          </div>
        </div>

        {/* Selected Dates */}
        <div className="flex flex-wrap gap-2">
          {req.dates?.map((d: string) => (
            <span
              key={d}
              className="text-[10px] font-black text-[var(--ab-text-main)] bg-[var(--ab-bg-main)] px-3 py-1 rounded-lg border border-[var(--ab-border)]"
            >
              {d}
            </span>
          ))}
        </div>

        {/* Reason */}
        <div className="bg-[var(--ab-bg-main)] p-3.5 rounded-2xl border border-[var(--ab-border)]">
          <p className="text-xs text-[var(--ab-text-dim)] font-bold leading-relaxed italic">
            &ldquo;{req.reason}&rdquo;
          </p>
        </div>

        {/* ─── 3-STEP FUNNEL TRACKER ────────────────────────────────────────── */}
        <div className="p-4 bg-[var(--ab-bg-main)]/70 rounded-2xl border border-[var(--ab-border)] space-y-3">
          <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-[var(--ab-text-dim)] pb-1.5 border-b border-[var(--ab-border)]">
            <span className="flex items-center gap-1">
              <History size={11} /> Progres Persetujuan (Funnel)
            </span>
            <span className="text-[8px] font-bold opacity-75">2-Layer Approval</span>
          </div>

          <div className="space-y-2.5 text-xs">
            {/* Step 1: Diajukan */}
            <div className="flex items-start gap-2.5">
              <div className="w-5 h-5 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0 mt-0.5 shadow-sm">
                <Check size={11} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-black text-[11px] text-[var(--ab-text-main)]">1. Pengajuan Diajukan</span>
                  <span className="text-[9px] text-[var(--ab-text-dim)] font-bold">{formatDate(req.created_at)}</span>
                </div>
                <p className="text-[10px] text-[var(--ab-text-dim)] font-medium">Pengajuan formulir staf</p>
              </div>
            </div>

            {/* Step 2: Persetujuan Executive */}
            <div className="flex items-start gap-2.5">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-sm ${
                req.executive_status === "approved" || isPendingHR || isApproved
                  ? "bg-emerald-500 text-white"
                  : isRejected && req.rejection_stage === "executive"
                  ? "bg-rose-500 text-white"
                  : "bg-amber-500 text-white animate-pulse"
              }`}>
                {req.executive_status === "approved" || isPendingHR || isApproved ? (
                  <Check size={11} />
                ) : isRejected && req.rejection_stage === "executive" ? (
                  <X size={11} />
                ) : (
                  <Shield size={10} />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-black text-[11px] text-[var(--ab-text-main)]">2. Persetujuan Executive</span>
                  <span className="text-[9px] font-bold text-[var(--ab-text-dim)]">
                    {req.executive_approved_at ? formatDate(req.executive_approved_at) : (isRejected && req.rejection_stage === "executive") ? formatDate(req.rejected_at) : "Menunggu"}
                  </span>
                </div>
                <div className="text-[10px] mt-0.5">
                  {req.executive_status === "approved" || isPendingHR || isApproved ? (
                    <p className="text-emerald-600 dark:text-emerald-400 font-bold">
                      Disetujui oleh <span className="font-black">{req.executive_approved_by_name || "Executive"}</span>
                    </p>
                  ) : isRejected && req.rejection_stage === "executive" ? (
                    <p className="text-rose-600 dark:text-rose-400 font-bold">
                      Ditolak oleh <span className="font-black">{req.rejected_by || "Executive"}</span>
                    </p>
                  ) : (
                    <p className="text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping" />
                      Sedang Ditinjau oleh Executive
                    </p>
                  )}
                </div>
                {req.executive_notes && (
                  <div className="mt-1.5 p-2 bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 rounded-xl text-[10px] italic">
                    <span className="font-black not-italic block uppercase text-[8px] tracking-wider mb-0.5">Catatan Executive:</span>
                    &ldquo;{req.executive_notes}&rdquo;
                  </div>
                )}
              </div>
            </div>

            {/* Step 3: Persetujuan HR Final */}
            <div className="flex items-start gap-2.5">
              <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5 shadow-sm ${
                isApproved
                  ? "bg-emerald-500 text-white"
                  : isRejected && req.rejection_stage === "hr"
                  ? "bg-rose-500 text-white"
                  : isPendingHR
                  ? "bg-blue-500 text-white animate-pulse"
                  : "bg-slate-300 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
              }`}>
                {isApproved ? (
                  <CheckCircle2 size={12} />
                ) : isRejected && req.rejection_stage === "hr" ? (
                  <X size={11} />
                ) : isPendingHR ? (
                  <Sparkles size={10} />
                ) : (
                  <span className="text-[9px] font-black">3</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-black text-[11px] text-[var(--ab-text-main)]">3. Persetujuan HR (Final)</span>
                  <span className="text-[9px] font-bold text-[var(--ab-text-dim)]">
                    {req.hr_approved_at ? formatDate(req.hr_approved_at) : (isRejected && req.rejection_stage === "hr") ? formatDate(req.rejected_at) : isPendingHR ? "Menunggu HR" : "-"}
                  </span>
                </div>
                <div className="text-[10px] mt-0.5">
                  {isApproved ? (
                    <p className="text-emerald-600 dark:text-emerald-400 font-bold">
                      Disetujui Final oleh <span className="font-black">{req.hr_approved_by_name || req.processed_by || "HR"}</span>
                    </p>
                  ) : isRejected && req.rejection_stage === "hr" ? (
                    <p className="text-rose-600 dark:text-rose-400 font-bold">
                      Ditolak oleh <span className="font-black">{req.rejected_by || "HR"}</span>
                    </p>
                  ) : isPendingHR ? (
                    <p className="text-blue-600 dark:text-blue-400 font-bold flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-ping" />
                      Sedang Ditinjau oleh HR
                    </p>
                  ) : (
                    <p className="text-[var(--ab-text-dim)] opacity-60">Menunggu Tahap 1 Disetujui</p>
                  )}
                </div>
                {req.hr_notes && (
                  <div className="mt-1.5 p-2 bg-blue-500/10 border border-blue-500/20 text-blue-700 dark:text-blue-300 rounded-xl text-[10px] italic">
                    <span className="font-black not-italic block uppercase text-[8px] tracking-wider mb-0.5">Catatan HR:</span>
                    &ldquo;{req.hr_notes}&rdquo;
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Rejection Banner */}
          {isRejected && (
            <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/40 rounded-xl text-rose-700 dark:text-rose-300 text-[10px] space-y-1">
              <span className="font-black uppercase text-[8px] tracking-wider block text-rose-600 dark:text-rose-400">
                Alasan Penolakan (Tahap {req.rejection_stage === "executive" ? "Executive" : "HR"} oleh {req.rejected_by || "Admin"}):
              </span>
              <p className="italic font-bold">&ldquo;{req.rejection_reason || "-"}&rdquo;</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
