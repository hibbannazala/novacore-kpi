"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMyLeaveRequests } from "@/hooks/absensi/useLeaveRequests";
import { useAbsensiSettings } from "@/hooks/absensi/useAbsensiSettings";
import { useHolidays } from "@/hooks/absensi/useHolidays";
import type { LeaveRequest, LeaveRequestType } from "@/types/absensi";
import ConfirmDialog from "@/components/absensi/ConfirmDialog";
import PromptDialog from "@/components/absensi/PromptDialog";
import {
  CalendarPlus, CalendarDays, History, X, Info,
  FileEdit, Smile,
} from "lucide-react";
import { toast } from "sonner";

function getToday() {
  return new Date().toISOString().split("T")[0];
}

type ConfirmCfg = {
  title: string;
  message: string;
  confirmLabel: string;
  type: "info" | "warning" | "danger";
};

export default function StaffRequestsPage() {
  const { user } = useAuth();
  const { requests, isLoading } = useMyLeaveRequests(user?.id ?? null);
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
      const s = cur.toISOString().split("T")[0];
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

    const reqDays   = selectedDates.length;
    const curSick   = user.sickQuota  ?? 0;
    const curLeave  = user.leaveQuota ?? 0;
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
      {/* Header */}
      <div className="ab-card-tactile flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 text-white rounded-2xl flex items-center justify-center shadow-lg"
            style={{ background: "var(--ab-primary)", boxShadow: "0 8px 20px -4px var(--ab-primary-glow)" }}
          >
            <FileEdit size={20} />
          </div>
          <div>
            <h2 className="text-xl font-black text-[var(--ab-text-main)] uppercase tracking-tight leading-none mb-1">
              Pengajuan Staf
            </h2>
            <p className="text-[10px] font-bold text-[var(--ab-text-dim)] uppercase tracking-widest">
              Cuti • Sakit • WFA
            </p>
          </div>
        </div>
        {settings && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-full border self-start"
            style={{ background: "color-mix(in srgb, var(--ab-primary), transparent 90%)", borderColor: "var(--ab-primary-glow)" }}
          >
            <Info size={12} style={{ color: "var(--ab-primary)" }} />
            <span className="text-[9px] font-black uppercase tracking-widest" style={{ color: "var(--ab-primary)" }}>
              Sakit H-0: {settings.maxTimeSick}
            </span>
          </div>
        )}
      </div>

      {/* Form Card */}
      <div className="ab-card-tactile space-y-6">
        {/* Type Selector */}
        <div>
          <label className="block text-[10px] font-black text-[var(--ab-text-dim)] uppercase mb-3 tracking-widest">
            Pilih Jenis Pengajuan
          </label>
          <div className="flex bg-[var(--ab-bg-main)] p-1.5 rounded-2xl border border-[var(--ab-border)]">
            {(["leave", "sick", "wfa"] as LeaveRequestType[]).map((t) => (
              <button
                key={t}
                onClick={() => setReqType(t)}
                className="flex-1 py-3 rounded-xl text-xs font-black uppercase transition-all duration-300"
                style={reqType === t ? {
                  background: "var(--ab-bg-surface)",
                  color: "var(--ab-primary)",
                  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
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
          <label className="block text-[10px] font-black text-[var(--ab-text-dim)] uppercase mb-3 tracking-widest">
            Rentang Tanggal
          </label>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div className="space-y-1.5">
              <span className="text-[8px] font-black text-[var(--ab-text-dim)] uppercase ml-3">Mulai</span>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="ab-input text-xs font-black"
              />
            </div>
            <div className="space-y-1.5">
              <span className="text-[8px] font-black text-[var(--ab-text-dim)] uppercase ml-3">Selesai (Opsional)</span>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="ab-input text-xs font-black"
              />
            </div>
          </div>
          <button
            onClick={addDateRange}
            className="ab-btn-primary w-full py-4 rounded-2xl text-[10px] tracking-[0.2em] flex justify-center items-center gap-3"
          >
            <CalendarPlus size={16} /> Tambahkan ke Daftar
          </button>

          {/* Selected Dates */}
          <div className="mt-5 flex flex-wrap gap-2 p-5 bg-[var(--ab-bg-main)] rounded-2xl border-2 border-dashed border-[var(--ab-border)] min-h-[70px] items-center">
            {selectedDates.length === 0 ? (
              <p className="text-center w-full text-[10px] text-[var(--ab-text-dim)] font-black uppercase tracking-widest italic opacity-50">
                Daftar Tanggal Masih Kosong
              </p>
            ) : (
              selectedDates.map((d) => (
                <div
                  key={d}
                  className="bg-[var(--ab-bg-surface)] text-xs font-black px-4 py-2 rounded-xl flex items-center gap-2 border border-[var(--ab-border)] shadow-sm"
                  style={{ color: "var(--ab-primary)" }}
                >
                  <CalendarDays size={9} className="opacity-60" />
                  {d}
                  <button
                    onClick={() => removeDate(d)}
                    className="text-red-400 hover:text-red-600 transition ml-2 p-1 rounded-md hover:bg-red-50 dark:hover:bg-red-900/20"
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
          <label className="block text-[10px] font-black text-[var(--ab-text-dim)] uppercase mb-3 tracking-widest">
            Alasan / Keterangan
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            className="ab-input resize-none text-xs"
            placeholder="Berikan alasan yang jelas untuk mempercepat approval..."
          />
        </div>

        <button
          onClick={submitRequest}
          disabled={isSubmitting}
          className="w-full py-5 rounded-[22px] font-black uppercase text-xs tracking-[0.25em] shadow-2xl disabled:opacity-50 active:scale-[0.95] transition-all text-white"
          style={{ background: "var(--ab-text-main)" }}
        >
          {isSubmitting ? "Mengirim Data..." : "Kirim Pengajuan Form"}
        </button>
      </div>

      {/* History Header */}
      <div className="flex items-center gap-2 px-2">
        <History size={18} style={{ color: "var(--ab-primary)" }} />
        <h3 className="font-black text-[var(--ab-text-dim)] uppercase text-[10px] tracking-[0.2em]">
          Riwayat & Status
        </h3>
      </div>

      {/* Requests List */}
      {isLoading ? (
        <div className="space-y-4">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 bg-[var(--ab-bg-surface)] rounded-[30px] animate-pulse" />
          ))}
        </div>
      ) : requests.length === 0 ? (
        <div className="p-20 text-center ab-animate-scaleIn">
          <div className="w-16 h-16 bg-[var(--ab-bg-surface)] rounded-[20px] flex items-center justify-center mx-auto mb-4 text-[var(--ab-text-dim)]">
            <Smile size={32} />
          </div>
          <h4 className="text-[10px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest italic">
            Belum Ada Histori Pengajuan
          </h4>
        </div>
      ) : (
        <div className="space-y-4">
          {requests.map((req) => (
            <RequestCard
              key={req.id}
              req={req}
              onCancel={handleCancelClick}
            />
          ))}
        </div>
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
function RequestCard({ req, onCancel }: { req: LeaveRequest; onCancel: (req: LeaveRequest) => void }) {
  const statusColor =
    req.status === "approved" ? "bg-green-500" :
    req.status === "pending"  ? "bg-orange-400" :
    req.status === "cancelled" ? "#94a3b8" : "bg-red-500";

  const typeStyle =
    req.type === "leave" ? "bg-emerald-50 text-[#00897B] border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800 dark:text-emerald-400" :
    req.type === "sick"  ? "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20 dark:border-rose-800 dark:text-rose-400" :
                           "bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:border-purple-800 dark:text-purple-400";

  const statusBadgeStyle =
    req.status === "approved"  ? "bg-green-500 text-white" :
    req.status === "pending"   ? "bg-orange-50 text-orange-600 dark:bg-orange-900/20 dark:text-orange-400" :
    req.status === "cancelled" ? "bg-[var(--ab-bg-main)] text-[var(--ab-text-dim)]" :
                                 "bg-red-500 text-white";

  const statusLabel =
    req.status === "pending"   ? "DIAJUKAN" :
    req.status === "cancelled" ? "DIBATALKAN" :
    req.status.toUpperCase();

  return (
    <div className="bg-[var(--ab-bg-surface)] p-6 rounded-[30px] border border-[var(--ab-border)] shadow-sm relative overflow-hidden">
      <div
        className="absolute top-0 right-0 w-2 h-full"
        style={{ background: statusColor }}
      />
      <div className="flex justify-between items-start mb-4">
        <span className={`text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-sm border ${typeStyle}`}>
          {req.type === "leave" ? "🏡 Cuti" : req.type === "sick" ? "🤒 Sakit" : "💻 WFA"}
        </span>
        <div className="flex flex-col items-end gap-2">
          <span className={`text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest ${statusBadgeStyle}`}>
            {statusLabel}
          </span>
          {(req.status === "pending" || (req.status === "approved" && !req.cancellationRequested)) && (
            <button
              onClick={() => onCancel(req)}
              className="text-[8px] font-black uppercase tracking-widest text-red-400 hover:text-white hover:bg-red-500 px-3 py-1.5 rounded-lg border border-red-200 transition-all active:scale-95"
            >
              {req.status === "pending" ? "Batalkan" : "Pengajuan Batal"}
            </button>
          )}
          {req.cancellationRequested && (
            <span className="text-[8px] font-black uppercase tracking-widest text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-2 py-1 rounded border border-orange-200 dark:border-orange-800">
              Menunggu Batal
            </span>
          )}
        </div>
      </div>
      <div className="flex flex-wrap gap-2 mb-4">
        {req.dates?.map((d) => (
          <span
            key={d}
            className="text-[10px] font-black text-[var(--ab-text-main)] bg-[var(--ab-bg-main)] px-3 py-1 rounded-lg border border-[var(--ab-border)]"
          >
            {d}
          </span>
        ))}
      </div>
      <div className="bg-[var(--ab-bg-main)] p-4 rounded-2xl border border-[var(--ab-border)]">
        <p className="text-xs text-[var(--ab-text-dim)] font-bold leading-relaxed italic">
          &ldquo;{req.reason}&rdquo;
        </p>
      </div>
    </div>
  );
}
