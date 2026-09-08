"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { OvertimeRequest } from "@/types/absensi";
import {
  formatDurationDetail,
  formatScheduleRange,
  getOvertimeStepState,
} from "@/lib/overtimeHelpers";
import {
  X,
  Check,
  Clock,
  CheckCircle2,
  AlertCircle,
  FileText,
  Camera,
  Eye,
  Sparkles,
  CalendarDays,
  User,
  Building2,
  Award,
} from "lucide-react";

interface OvertimeDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  overtime: OvertimeRequest | null;
  onPreviewImage?: (url: string) => void;
}

export default function OvertimeDetailModal({
  isOpen,
  onClose,
  overtime,
  onPreviewImage,
}: OvertimeDetailModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Lock background scroll
  useEffect(() => {
    if (!isOpen || !overtime) return;
    const originalBodyOverflow = document.body.style.overflow;
    const mainEl = document.querySelector("main");
    const originalMainOverflow = mainEl ? mainEl.style.overflow : "";

    document.body.style.overflow = "hidden";
    if (mainEl) mainEl.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = originalBodyOverflow;
      if (mainEl) mainEl.style.overflow = originalMainOverflow;
    };
  }, [isOpen, overtime]);

  if (!mounted || !isOpen || !overtime || typeof document === "undefined") return null;

  const statusBadge = (s: string) => {
    switch (s) {
      case "pending":
        return (
          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-500 border border-amber-500/20">
            🟡 Menunggu Review HR
          </span>
        );
      case "approved":
        return (
          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-500 border border-blue-500/20">
            🔵 Jadwal Disetujui
          </span>
        );
      case "reported":
        return (
          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-500 border border-purple-500/20">
            🟣 Laporan Terkirim (Verifikasi HR)
          </span>
        );
      case "finalized":
        return (
          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
            🟢 Final Sah (Slip Gaji)
          </span>
        );
      case "rejected":
        return (
          <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-rose-500/10 text-rose-500 border border-rose-500/20">
            🔴 Ditolak HR
          </span>
        );
      default:
        return null;
    }
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("id-ID", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 overflow-y-auto overscroll-contain animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="w-full max-w-2xl my-auto bg-[var(--ab-bg-surface)] rounded-[32px] p-5 sm:p-7 border border-[var(--ab-border)] shadow-2xl space-y-6 max-h-[92vh] overflow-y-auto relative box-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start border-b border-[var(--ab-border)] pb-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-black text-[var(--ab-text-main)] uppercase tracking-tight">
                Detail Lengkap Lembur
              </h3>
              {statusBadge(overtime.status)}
            </div>
            <div className="flex items-center gap-3 text-xs text-[var(--ab-text-dim)] flex-wrap">
              <span className="flex items-center gap-1 font-bold text-[var(--ab-text-main)]">
                <User size={13} className="text-amber-500" />
                {overtime.userName || "Karyawan"}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-bold">
                <Building2 size={13} className="text-blue-500" />
                {overtime.userDepartment || "Divisi Umum"}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-bold">
                <CalendarDays size={13} className="text-purple-500" />
                {formatDate(overtime.overtimeDate)}
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-full text-[var(--ab-text-dim)] hover:text-[var(--ab-text-main)] hover:bg-[var(--ab-bg-main)] transition-colors shrink-0"
          >
            <X size={20} />
          </button>
        </div>

        {/* 4-Stage Stepper Tracker */}
        <div className="p-4 bg-[var(--ab-bg-main)] rounded-2xl border border-[var(--ab-border)] space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-widest text-[var(--ab-text-dim)] flex items-center gap-1.5">
              <Sparkles size={13} className="text-amber-500" />
              Riwayat & Status Progres 4 Tahap
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              {
                step: 1,
                title: "1. Pengajuan",
                desc: formatScheduleRange(
                  overtime.requestedStartTime,
                  overtime.requestedEndTime,
                  overtime.requestedDurationMinutes
                ),
              },
              {
                step: 2,
                title: "2. Review HR",
                desc:
                  overtime.status === "pending"
                    ? "Menunggu HR"
                    : overtime.status === "rejected"
                    ? "Ditolak"
                    : formatScheduleRange(
                        overtime.approvedStartTime,
                        overtime.approvedEndTime,
                        overtime.approvedDurationMinutes
                      ),
              },
              {
                step: 3,
                title: "3. Laporan Kerja",
                desc: overtime.actualEndTime
                  ? formatScheduleRange(
                      overtime.actualStartTime,
                      overtime.actualEndTime,
                      overtime.actualDurationMinutes
                    )
                  : overtime.status === "approved"
                  ? "Waktunya Lapor"
                  : "Belum Mulai",
              },
              {
                step: 4,
                title: "4. Final Sah",
                desc:
                  overtime.finalDurationMinutes !== null &&
                  overtime.finalDurationMinutes !== undefined
                    ? formatDurationDetail(overtime.finalDurationMinutes)
                    : "Slip Gaji",
              },
            ].map((st) => {
              const { state } = getOvertimeStepState(st.step as any, overtime.status);
              return (
                <div
                  key={st.step}
                  className={`flex flex-col items-center text-center p-2.5 rounded-xl border transition-all ${
                    state === "completed"
                      ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400"
                      : state === "current"
                      ? "bg-amber-500/15 border-amber-500/40 text-amber-600 dark:text-amber-400 ring-2 ring-amber-500/20"
                      : state === "rejected"
                      ? "bg-rose-500/10 border-rose-500/30 text-rose-500"
                      : "bg-[var(--ab-bg-surface)] border-[var(--ab-border)]/40 text-[var(--ab-text-dim)] opacity-60"
                  }`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-black mb-1.5 ${
                      state === "completed"
                        ? "bg-emerald-500 text-white"
                        : state === "current"
                        ? "bg-amber-500 text-white animate-pulse"
                        : state === "rejected"
                        ? "bg-rose-500 text-white"
                        : "bg-[var(--ab-border)] text-[var(--ab-text-dim)]"
                    }`}
                  >
                    {state === "completed" ? (
                      <Check size={12} strokeWidth={3} />
                    ) : state === "rejected" ? (
                      <X size={12} strokeWidth={3} />
                    ) : (
                      st.step
                    )}
                  </div>
                  <span className="text-[10px] font-black uppercase tracking-tight">
                    {st.title}
                  </span>
                  <span className="text-[8.5px] font-bold line-clamp-2 mt-0.5 opacity-85">
                    {st.desc}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* 4 Tahap Detail Cards */}
        <div className="space-y-4">
          {/* TAHAP 1: PENGAJUAN STAF */}
          <div className="p-4 bg-[var(--ab-bg-main)] rounded-2xl border border-[var(--ab-border)] space-y-3">
            <div className="flex justify-between items-center border-b border-[var(--ab-border)] pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                <FileText size={14} /> Tahap 1: Pengajuan Lembur oleh Staf
              </span>
              <span className="text-[10px] font-bold text-[var(--ab-text-dim)]">
                Diajukan pada: {overtime.requestDate}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="p-2.5 bg-[var(--ab-bg-surface)] rounded-xl border border-[var(--ab-border)]">
                <span className="text-[8.5px] font-black uppercase tracking-widest text-[var(--ab-text-dim)] block">
                  Jadwal Diajukan:
                </span>
                <p className="font-black text-[var(--ab-text-main)] mt-0.5">
                  {formatScheduleRange(
                    overtime.requestedStartTime,
                    overtime.requestedEndTime,
                    overtime.requestedDurationMinutes
                  )}
                </p>
              </div>
              <div className="p-2.5 bg-[var(--ab-bg-surface)] rounded-xl border border-[var(--ab-border)]">
                <span className="text-[8.5px] font-black uppercase tracking-widest text-[var(--ab-text-dim)] block">
                  Catatan Urgensi Staf:
                </span>
                <p className="font-bold text-[var(--ab-text-main)] italic mt-0.5">
                  {overtime.staffNotes ? `"${overtime.staffNotes}"` : "Tidak ada catatan"}
                </p>
              </div>
            </div>

            <div className="space-y-1.5">
              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--ab-text-dim)] block">
                Rencana Tugas & Target yang Diajukan:
              </span>
              <div className="space-y-1.5">
                {overtime.tasks.map((t, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 bg-[var(--ab-bg-surface)] rounded-xl border border-[var(--ab-border)] text-xs flex justify-between items-center"
                  >
                    <span className="font-black text-[var(--ab-text-main)]">• {t.task}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-[var(--ab-bg-main)] text-[var(--ab-text-dim)] border border-[var(--ab-border)]">
                      Target: {t.target}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* TAHAP 2: REVIEW & PERSETUJUAN HR */}
          <div className="p-4 bg-[var(--ab-bg-main)] rounded-2xl border border-[var(--ab-border)] space-y-3">
            <div className="flex justify-between items-center border-b border-[var(--ab-border)] pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-blue-500 flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Tahap 2: Review Jadwal oleh HR
              </span>
              <span className="text-[10px] font-bold text-[var(--ab-text-dim)]">
                {overtime.approvalDate ? `Direview: ${new Date(overtime.approvalDate).toLocaleDateString("id-ID")}` : "Belum direview"}
              </span>
            </div>

            {overtime.status === "rejected" ? (
              <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-500 space-y-1">
                <span className="font-black uppercase text-[9px] tracking-widest">
                  Pengajuan Lembur Ditolak HR:
                </span>
                <p className="font-bold">
                  Alasan: {overtime.rejectionReason || "Tidak memenuhi kriteria lembur"}
                </p>
              </div>
            ) : overtime.approvedStartTime ? (
              <div className="space-y-2.5 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-2.5 bg-[var(--ab-bg-surface)] rounded-xl border border-[var(--ab-border)]">
                    <span className="text-[8.5px] font-black uppercase tracking-widest text-[var(--ab-text-dim)] block">
                      Jadwal yang Disetujui HR:
                    </span>
                    <p className="font-black text-blue-500 mt-0.5">
                      {formatScheduleRange(
                        overtime.approvedStartTime,
                        overtime.approvedEndTime,
                        overtime.approvedDurationMinutes
                      )}
                    </p>
                  </div>
                  <div className="p-2.5 bg-[var(--ab-bg-surface)] rounded-xl border border-[var(--ab-border)]">
                    <span className="text-[8.5px] font-black uppercase tracking-widest text-[var(--ab-text-dim)] block">
                      Catatan Persetujuan HR:
                    </span>
                    <p className="font-bold text-[var(--ab-text-main)] italic mt-0.5">
                      {overtime.approvalNotes ? `"${overtime.approvalNotes}"` : "Disetujui sesuai rencana"}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs font-bold text-amber-500 italic">
                Menunggu peninjauan dan penyesuaian jadwal oleh tim HR.
              </p>
            )}
          </div>

          {/* TAHAP 3: PELAKSANAAN & LAPORAN KERJA STAF */}
          <div className="p-4 bg-[var(--ab-bg-main)] rounded-2xl border border-[var(--ab-border)] space-y-3">
            <div className="flex justify-between items-center border-b border-[var(--ab-border)] pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-purple-500 flex items-center gap-1.5">
                <Clock size={14} /> Tahap 3: Pelaksanaan & Laporan Kerja Staf
              </span>
              <span className="text-[10px] font-bold text-[var(--ab-text-dim)]">
                {overtime.reportSubmittedAt
                  ? `Disubmit: ${new Date(overtime.reportSubmittedAt).toLocaleDateString("id-ID")}`
                  : "Belum lapor"}
              </span>
            </div>

            {overtime.actualEndTime ? (
              <div className="space-y-3 text-xs">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="p-2.5 bg-[var(--ab-bg-surface)] rounded-xl border border-[var(--ab-border)]">
                    <span className="text-[8.5px] font-black uppercase tracking-widest text-[var(--ab-text-dim)] block">
                      Waktu Aktual Dijalankan:
                    </span>
                    <p className="font-black text-purple-500 mt-0.5">
                      {formatScheduleRange(
                        overtime.actualStartTime,
                        overtime.actualEndTime,
                        overtime.actualDurationMinutes
                      )}
                    </p>
                  </div>
                  <div className="p-2.5 bg-[var(--ab-bg-surface)] rounded-xl border border-[var(--ab-border)]">
                    <span className="text-[8.5px] font-black uppercase tracking-widest text-[var(--ab-text-dim)] block">
                      Catatan / Kendala Staf:
                    </span>
                    <p className="font-bold text-[var(--ab-text-main)] italic mt-0.5">
                      {overtime.staffReportNotes ? `"${overtime.staffReportNotes}"` : "Tidak ada kendala"}
                    </p>
                  </div>
                </div>

                {/* Task Reports */}
                {overtime.taskReports && overtime.taskReports.length > 0 && (
                  <div className="space-y-1.5">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--ab-text-dim)] block">
                      Hasil Pencapaian Tugas:
                    </span>
                    <div className="space-y-2">
                      {overtime.taskReports.map((tr, idx) => (
                        <div
                          key={idx}
                          className="p-3 bg-[var(--ab-bg-surface)] rounded-xl border border-[var(--ab-border)] space-y-1"
                        >
                          <div className="flex justify-between items-center">
                            <span className="font-black text-[var(--ab-text-main)]">• {tr.task}</span>
                            <span
                              className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md ${
                                tr.status === "completed"
                                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                                  : tr.status === "partial"
                                  ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                                  : "bg-rose-500/15 text-rose-500"
                              }`}
                            >
                              {tr.status === "completed"
                                ? "✅ Selesai 100%"
                                : tr.status === "partial"
                                ? "⏳ Sebagian"
                                : "❌ Belum Selesai"}
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-[11px] text-[var(--ab-text-dim)]">
                            <span>Target: {tr.target}</span>
                            <span className="font-bold text-[var(--ab-text-main)]">
                              Hasil Riil: {tr.actualResult || "-"}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Proof Images */}
                {overtime.proofImages && overtime.proofImages.length > 0 && (
                  <div className="space-y-2 pt-1">
                    <span className="text-[9px] font-black uppercase tracking-widest text-[var(--ab-text-dim)] flex items-center gap-1.5">
                      <Camera size={13} className="text-purple-500" />
                      Foto Bukti Kerja ({overtime.proofImages.length} Foto):
                    </span>
                    <div className="flex items-center gap-3 flex-wrap">
                      {overtime.proofImages.map((imgUrl, imgIdx) => (
                        <div
                          key={imgIdx}
                          onClick={() => onPreviewImage && onPreviewImage(imgUrl)}
                          className="relative w-28 h-20 rounded-2xl overflow-hidden border border-[var(--ab-border)] bg-black/10 cursor-pointer hover:opacity-90 hover:scale-105 transition-all group shadow-sm"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={imgUrl}
                            alt={`Bukti ${imgIdx + 1}`}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Eye size={18} />
                          </div>
                          <span className="absolute bottom-1 left-1.5 px-1.5 py-0.5 text-[8px] font-black uppercase rounded bg-black/60 text-white backdrop-blur-sm">
                            Foto {imgIdx + 1}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs font-bold text-[var(--ab-text-dim)] italic">
                Staf belum mengisi laporan kerja lembur aktual.
              </p>
            )}
          </div>

          {/* TAHAP 4: KEPUTUSAN FINAL HR (PAYROLL) */}
          <div className="p-4 bg-[var(--ab-bg-main)] rounded-2xl border border-[var(--ab-border)] space-y-3">
            <div className="flex justify-between items-center border-b border-[var(--ab-border)] pb-2">
              <span className="text-xs font-black uppercase tracking-wider text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5">
                <Award size={14} /> Tahap 4: Keputusan Final HR (Payroll)
              </span>
              <span className="text-[10px] font-bold text-[var(--ab-text-dim)]">
                {overtime.finalizedDate
                  ? `Disahkan: ${new Date(overtime.finalizedDate).toLocaleDateString("id-ID")}`
                  : "Menunggu finalisasi"}
              </span>
            </div>

            {overtime.finalDurationMinutes !== null && overtime.finalDurationMinutes !== undefined ? (
              <div className="space-y-3 text-xs">
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[9px] font-black uppercase tracking-widest text-emerald-700 dark:text-emerald-300 block">
                      Durasi Final yang Sah & Diakui:
                    </span>
                    <p className="text-base font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {formatDurationDetail(overtime.finalDurationMinutes)}
                    </p>
                  </div>
                  <span className="text-[10px] font-black px-3 py-1 rounded-full bg-emerald-500 text-white shadow-sm">
                    Masuk Slip Gaji
                  </span>
                </div>

                {overtime.finalNotes && (
                  <div className="p-3 bg-[var(--ab-bg-surface)] rounded-xl border border-[var(--ab-border)]">
                    <span className="text-[8.5px] font-black uppercase tracking-widest text-[var(--ab-text-dim)] block">
                      Catatan Final HR:
                    </span>
                    <p className="font-bold text-[var(--ab-text-main)] italic mt-0.5">
                      &ldquo;{overtime.finalNotes}&rdquo;
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs font-bold text-[var(--ab-text-dim)] italic">
                Durasi final belum disahkan oleh HR.
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-3 bg-[var(--ab-bg-main)] text-[var(--ab-text-main)] hover:bg-[var(--ab-border)] font-black text-xs uppercase tracking-widest rounded-2xl border border-[var(--ab-border)] transition-all"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>,
    document.body
  );
}
