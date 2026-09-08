"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { OvertimeRequest, OvertimeTask, OvertimeTaskReport } from "@/types/absensi";
import ConfirmDialog from "@/components/absensi/ConfirmDialog";
import {
  Clock, Plus, Trash2, CheckCircle2, AlertCircle, CalendarDays,
  FileText, Send, Loader2, Sparkles, Check, X, ShieldAlert, History
} from "lucide-react";
import { toast } from "sonner";

export function OvertimeStaffSection() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<"form" | "history">("form");
  const [overtimeRequests, setOvertimeRequests] = useState<OvertimeRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Form State
  const [overtimeDate, setOvertimeDate] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  const [startTime, setStartTime] = useState("18:30");
  const [endTime, setEndTime] = useState("20:30");
  const [staffNotes, setStaffNotes] = useState("");
  const [tasks, setTasks] = useState<OvertimeTask[]>([
    { id: "1", task: "", target: "", note: "" }
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Report Modal State
  const [reportingReq, setReportingReq] = useState<OvertimeRequest | null>(null);
  const [actualEndTime, setActualEndTime] = useState("");
  const [taskReports, setTaskReports] = useState<OvertimeTaskReport[]>([]);
  const [reportNotes, setReportNotes] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Auto calculate requested duration in minutes
  const calcDurationMinutes = (startStr: string, endStr: string) => {
    if (!startStr || !endStr) return 0;
    const [sh, sm] = startStr.split(":").map(Number);
    const [eh, em] = endStr.split(":").map(Number);
    const startMins = sh * 60 + sm;
    const endMins = eh * 60 + em;
    return Math.max(0, endMins - startMins);
  };

  const formatMinutes = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    if (h === 0) return `${m} Menit`;
    if (m === 0) return `${h} Jam`;
    return `${h} Jam ${m} Menit`;
  };

  const durationMinutes = calcDurationMinutes(startTime, endTime);

  // Fetch overtime requests for current user
  const fetchOvertimes = async () => {
    if (!user) return;
    setIsLoading(true);
    const supabase = createClient();
    const { data } = await supabase
      .from("overtime_requests" as any)
      .select("*, users(name, position, departments(name))")
      .eq("user_id", user.id)
      .order("overtime_date", { ascending: false });

    if (data) {
      setOvertimeRequests(
        data.map((r: any) => ({
          id: r.id,
          userId: r.user_id,
          requestDate: r.request_date,
          overtimeDate: r.overtime_date,
          requestedStartTime: (r.requested_start_time || "").substring(0, 5),
          requestedEndTime: (r.requested_end_time || "").substring(0, 5),
          requestedDurationMinutes: r.requested_duration_minutes,
          tasks: r.tasks || [],
          staffNotes: r.staff_notes,
          status: r.status,
          approvedStartTime: r.approved_start_time ? r.approved_start_time.substring(0, 5) : null,
          approvedEndTime: r.approved_end_time ? r.approved_end_time.substring(0, 5) : null,
          approvedDurationMinutes: r.approved_duration_minutes,
          approvedBy: r.approved_by,
          approvalDate: r.approval_date,
          approvalNotes: r.approval_notes,
          rejectionReason: r.rejection_reason,
          actualStartTime: r.actual_start_time ? r.actual_start_time.substring(0, 5) : null,
          actualEndTime: r.actual_end_time ? r.actual_end_time.substring(0, 5) : null,
          actualDurationMinutes: r.actual_duration_minutes,
          reportSubmittedAt: r.report_submitted_at,
          taskReports: r.task_reports,
          staffReportNotes: r.staff_report_notes,
          finalDurationMinutes: r.final_duration_minutes,
          finalizedBy: r.finalized_by,
          finalizedDate: r.finalized_date,
          finalNotes: r.final_notes,
          createdAt: r.created_at,
          updatedAt: r.updated_at,
          userName: r.users?.name,
          userDepartment: r.users?.departments?.name,
          userPosition: r.users?.position,
        }))
      );
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchOvertimes();
    const supabase = createClient();
    const ch = supabase
      .channel("overtime_staff_watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "overtime_requests" }, fetchOvertimes)
      .subscribe();
    return () => { ch.unsubscribe(); };
  }, [user]);

  // Task repeater actions
  const addTask = () => {
    setTasks(prev => [...prev, { id: Date.now().toString(), task: "", target: "", note: "" }]);
  };

  const removeTask = (id: string) => {
    if (tasks.length <= 1) return;
    setTasks(prev => prev.filter(t => t.id !== id));
  };

  const updateTask = (id: string, field: keyof OvertimeTask, val: string) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, [field]: val } : t));
  };

  // Submit Overtime Request
  const handleSubmitForm = async () => {
    if (!user) return;
    if (!overtimeDate) { toast.error("Pilih tanggal lembur."); return; }
    if (durationMinutes <= 0) { toast.error("Jam selesai harus lebih besar dari jam mulai."); return; }
    const validTasks = tasks.filter(t => t.task.trim() !== "");
    if (validTasks.length === 0) { toast.error("Isi minimal 1 rencana tugas lembur."); return; }

    setShowConfirm(false);
    setIsSubmitting(true);
    const tid = toast.loading("Mengirim pengajuan lembur...");
    try {
      const supabase = createClient();
      const { error } = await supabase.from("overtime_requests" as any).insert({
        user_id: user.id,
        request_date: new Date().toISOString().substring(0, 10),
        overtime_date: overtimeDate,
        requested_start_time: startTime + ":00",
        requested_end_time: endTime + ":00",
        requested_duration_minutes: durationMinutes,
        tasks: validTasks,
        staff_notes: staffNotes.trim() || null,
        status: "pending",
      });

      if (error) throw error;

      toast.success("Pengajuan lembur berhasil dikirim ke HR!", { id: tid });
      setStaffNotes("");
      setTasks([{ id: "1", task: "", target: "", note: "" }]);
      setActiveTab("history");
      fetchOvertimes();
    } catch (err: any) {
      toast.error("Gagal: " + (err.message || "Terjadi kesalahan"), { id: tid });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open Report Modal
  const handleOpenReportModal = (req: OvertimeRequest) => {
    setReportingReq(req);
    const now = new Date();
    const currentHM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
    setActualEndTime(req.approvedEndTime || currentHM);
    
    setTaskReports(
      req.tasks.map(t => ({
        id: t.id,
        task: t.task,
        target: t.target,
        actualResult: "",
        progress: 100,
        status: "completed",
        note: ""
      }))
    );
    setReportNotes("");
  };

  // Submit Overtime Report
  const handleSubmitReport = async () => {
    if (!reportingReq || !user) return;
    if (!actualEndTime) { toast.error("Isi jam selesai aktual."); return; }

    const actualStart = reportingReq.approvedStartTime || reportingReq.requestedStartTime;
    const actualDur = calcDurationMinutes(actualStart, actualEndTime);

    setIsSubmittingReport(true);
    const tid = toast.loading("Mengirim laporan kerja lembur...");
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("overtime_requests" as any)
        .update({
          actual_start_time: actualStart + ":00",
          actual_end_time: actualEndTime + ":00",
          actual_duration_minutes: actualDur,
          report_submitted_at: new Date().toISOString(),
          task_reports: taskReports,
          staff_report_notes: reportNotes.trim() || null,
          status: "reported",
        })
        .eq("id", reportingReq.id);

      if (error) throw error;

      toast.success("Laporan lembur berhasil disubmit ke HR!", { id: tid });
      setReportingReq(null);
      fetchOvertimes();
    } catch (err: any) {
      toast.error("Gagal submit laporan: " + err.message, { id: tid });
    } finally {
      setIsSubmittingReport(false);
    }
  };

  const statusBadge = (s: string) => {
    switch (s) {
      case "pending":
        return <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-500 border border-amber-500/20">Menunggu Review HR</span>;
      case "approved":
        return <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-blue-500/10 text-blue-500 border border-blue-500/20">Disetujui HR (Jadwal)</span>;
      case "reported":
        return <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-500 border border-purple-500/20">Laporan Terkirim (Verifikasi HR)</span>;
      case "finalized":
        return <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">Final (Selesai)</span>;
      case "rejected":
        return <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-red-500/10 text-red-500 border border-red-500/20">Ditolak HR</span>;
      default:
        return <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-gray-500/10 text-gray-500">{s}</span>;
    }
  };

  return (
    <div className="space-y-6">
      {/* Sub Tabs */}
      <div className="flex bg-[var(--ab-bg-main)] p-1.5 rounded-2xl border border-[var(--ab-border)] w-fit mx-auto shadow-inner">
        <button
          onClick={() => setActiveTab("form")}
          className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
            activeTab === "form"
              ? "bg-[var(--ab-bg-surface)] text-[var(--ab-primary)] shadow-md border border-[var(--ab-border)]"
              : "text-[var(--ab-text-dim)] hover:text-[var(--ab-text-main)]"
          }`}
        >
          Form Pengajuan
        </button>
        <button
          onClick={() => setActiveTab("history")}
          className={`px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2 ${
            activeTab === "history"
              ? "bg-[var(--ab-bg-surface)] text-[var(--ab-primary)] shadow-md border border-[var(--ab-border)]"
              : "text-[var(--ab-text-dim)] hover:text-[var(--ab-text-main)]"
          }`}
        >
          <History size={14} /> Riwayat Lembur ({overtimeRequests.length})
        </button>
      </div>

      {activeTab === "form" ? (
        <div className="ab-card-tactile space-y-6">
          <div className="flex items-center gap-3 border-b border-[var(--ab-border)] pb-4">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-black">
              <Clock size={20} />
            </div>
            <div>
              <h3 className="text-base font-black text-[var(--ab-text-main)] uppercase tracking-tight">
                Pengajuan Lembur Staf
              </h3>
              <p className="text-[10px] font-bold text-[var(--ab-text-dim)] uppercase tracking-widest">
                Isi rencana tugas & durasi lembur untuk di-review HR
              </p>
            </div>
          </div>

          {/* User Identitas Card (Readonly) */}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-4 bg-[var(--ab-bg-main)] rounded-2xl border border-[var(--ab-border)] text-xs">
            <div>
              <span className="block text-[9px] font-black uppercase tracking-widest text-[var(--ab-text-dim)]">Nama Karyawan</span>
              <span className="font-black text-[var(--ab-text-main)]">{user?.name}</span>
            </div>
            <div>
              <span className="block text-[9px] font-black uppercase tracking-widest text-[var(--ab-text-dim)]">Divisi</span>
              <span className="font-bold text-[var(--ab-text-main)]">{user?.departmentName || "-"}</span>
            </div>
            <div>
              <span className="block text-[9px] font-black uppercase tracking-widest text-[var(--ab-text-dim)]">Posisi</span>
              <span className="font-bold text-[var(--ab-text-main)]">{user?.position || "-"}</span>
            </div>
          </div>

          {/* Tanggal & Waktu Lembur */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest">
                Tanggal Lembur
              </label>
              <input
                type="date"
                value={overtimeDate}
                onChange={(e) => setOvertimeDate(e.target.value)}
                className="ab-input text-xs font-black py-3 px-4 rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest">
                Mulai Lembur
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="ab-input text-xs font-black py-3 px-4 rounded-xl text-center"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest">
                Selesai Lembur
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="ab-input text-xs font-black py-3 px-4 rounded-xl text-center"
              />
            </div>
          </div>

          {/* Durasi Summary Box */}
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Clock size={16} className="text-amber-500" />
              <span className="text-[11px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Estimasi Durasi Pengajuan
              </span>
            </div>
            <span className="text-sm font-black text-amber-600 dark:text-amber-400">
              {formatMinutes(durationMinutes)}
            </span>
          </div>

          {/* Tasks Repeater */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest">
                Rencana Tugas & Target Output (Workload)
              </label>
              <button
                type="button"
                onClick={addTask}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-[var(--ab-primary)]/10 text-[var(--ab-primary)] rounded-lg text-[10px] font-black uppercase tracking-wider hover:bg-[var(--ab-primary)]/20 transition-all"
              >
                <Plus size={12} /> Tambah Task
              </button>
            </div>

            <div className="space-y-2.5">
              {tasks.map((t, index) => (
                <div key={t.id} className="p-3 bg-[var(--ab-bg-main)] rounded-2xl border border-[var(--ab-border)] flex flex-col md:flex-row gap-2.5 items-start md:items-center">
                  <span className="text-[10px] font-black w-5 h-5 rounded-full bg-[var(--ab-bg-surface)] text-[var(--ab-text-dim)] flex items-center justify-center shrink-0">
                    {index + 1}
                  </span>
                  <div className="flex-1 w-full space-y-1">
                    <input
                      type="text"
                      value={t.task}
                      onChange={(e) => updateTask(t.id, "task", e.target.value)}
                      placeholder="Nama Pekerjaan / Task (cth: Edit 3 Video TikTok)"
                      className="ab-input text-xs w-full py-2 px-3"
                    />
                  </div>
                  <div className="w-full md:w-48 space-y-1">
                    <input
                      type="text"
                      value={t.target}
                      onChange={(e) => updateTask(t.id, "target", e.target.value)}
                      placeholder="Target Output (cth: 3 Video Siap)"
                      className="ab-input text-xs w-full py-2 px-3"
                    />
                  </div>
                  {tasks.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeTask(t.id)}
                      className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-colors shrink-0"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Catatan Tambahan */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest">
              Catatan / Urgensi Lembur (Opsional)
            </label>
            <textarea
              rows={2}
              value={staffNotes}
              onChange={(e) => setStaffNotes(e.target.value)}
              placeholder="Berikan keterangan tambahan jika ada deadline mendesak..."
              className="ab-input text-xs w-full py-3 px-4 rounded-xl resize-none"
            />
          </div>

          <button
            onClick={() => setShowConfirm(true)}
            disabled={isSubmitting}
            className="w-full py-4 rounded-2xl font-black uppercase text-xs tracking-widest bg-amber-500 hover:bg-amber-600 text-white shadow-lg shadow-amber-500/20 transition-transform active:scale-[0.99] flex items-center justify-center gap-2"
          >
            <Send size={14} /> Kirim Pengajuan Lembur
          </button>
        </div>
      ) : (
        /* History Section */
        <div className="space-y-4">
          {isLoading ? (
            <div className="p-12 text-center text-xs font-bold text-[var(--ab-text-dim)] animate-pulse">
              Memuat data lembur...
            </div>
          ) : overtimeRequests.length === 0 ? (
            <div className="p-12 bg-[var(--ab-bg-surface)] rounded-3xl border border-[var(--ab-border)] text-center space-y-2">
              <Clock size={36} className="mx-auto text-[var(--ab-text-dim)] opacity-40 mb-2" />
              <p className="text-xs font-black uppercase tracking-wider text-[var(--ab-text-dim)]">
                Belum ada riwayat lembur
              </p>
            </div>
          ) : (
            overtimeRequests.map((req) => (
              <div
                key={req.id}
                className="bg-[var(--ab-bg-surface)] p-5 rounded-3xl border border-[var(--ab-border)] shadow-sm space-y-4 relative overflow-hidden"
              >
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-[var(--ab-border)]/60 pb-3">
                  <div className="flex items-center gap-3">
                    <CalendarDays size={18} className="text-amber-500" />
                    <div>
                      <h4 className="text-sm font-black text-[var(--ab-text-main)]">
                        {new Date(req.overtimeDate).toLocaleDateString("id-ID", {
                          weekday: "long", day: "numeric", month: "long", year: "numeric"
                        })}
                      </h4>
                      <p className="text-[10px] font-bold text-[var(--ab-text-dim)] uppercase tracking-wider">
                        Diajukan pada {new Date(req.requestDate).toLocaleDateString("id-ID")}
                      </p>
                    </div>
                  </div>
                  <div>{statusBadge(req.status)}</div>
                </div>

                {/* 4 Durasi Columns Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3.5 bg-[var(--ab-bg-main)] rounded-2xl border border-[var(--ab-border)] text-center">
                  <div className="p-2 rounded-xl bg-[var(--ab-bg-surface)] border border-[var(--ab-border)]/40">
                    <span className="block text-[8px] font-black uppercase tracking-widest text-[var(--ab-text-dim)]">1. Request</span>
                    <span className="text-xs font-black text-[var(--ab-text-main)]">{req.requestedStartTime} - {req.requestedEndTime}</span>
                    <span className="block text-[9px] font-bold text-amber-500">({formatMinutes(req.requestedDurationMinutes)})</span>
                  </div>
                  <div className="p-2 rounded-xl bg-[var(--ab-bg-surface)] border border-[var(--ab-border)]/40">
                    <span className="block text-[8px] font-black uppercase tracking-widest text-[var(--ab-text-dim)]">2. Approved HR</span>
                    {req.approvedStartTime ? (
                      <>
                        <span className="text-xs font-black text-blue-500">{req.approvedStartTime} - {req.approvedEndTime}</span>
                        <span className="block text-[9px] font-bold text-blue-500">({formatMinutes(req.approvedDurationMinutes || 0)})</span>
                      </>
                    ) : (
                      <span className="text-xs font-bold text-[var(--ab-text-dim)]">-</span>
                    )}
                  </div>
                  <div className="p-2 rounded-xl bg-[var(--ab-bg-surface)] border border-[var(--ab-border)]/40">
                    <span className="block text-[8px] font-black uppercase tracking-widest text-[var(--ab-text-dim)]">3. Actual Selesai</span>
                    {req.actualEndTime ? (
                      <>
                        <span className="text-xs font-black text-purple-500">{req.actualStartTime} - {req.actualEndTime}</span>
                        <span className="block text-[9px] font-bold text-purple-500">({formatMinutes(req.actualDurationMinutes || 0)})</span>
                      </>
                    ) : (
                      <span className="text-xs font-bold text-[var(--ab-text-dim)]">Belum lapor</span>
                    )}
                  </div>
                  <div className="p-2 rounded-xl bg-[var(--ab-bg-surface)] border border-[var(--ab-border)]/40">
                    <span className="block text-[8px] font-black uppercase tracking-widest text-[var(--ab-text-dim)]">4. Final Sah</span>
                    {req.finalDurationMinutes !== null && req.finalDurationMinutes !== undefined ? (
                      <span className="text-xs font-black text-emerald-500">{formatMinutes(req.finalDurationMinutes)}</span>
                    ) : (
                      <span className="text-xs font-bold text-[var(--ab-text-dim)]">-</span>
                    )}
                  </div>
                </div>

                {/* Task List */}
                <div className="space-y-1.5">
                  <span className="text-[9px] font-black uppercase tracking-widest text-[var(--ab-text-dim)]">Daftar Pekerjaan:</span>
                  <div className="space-y-1">
                    {req.tasks.map((t, idx) => (
                      <div key={idx} className="flex items-center justify-between text-xs py-1 px-3 bg-[var(--ab-bg-main)]/50 rounded-lg">
                        <span className="font-bold text-[var(--ab-text-main)]">• {t.task}</span>
                        <span className="text-[10px] font-black text-[var(--ab-text-dim)] bg-[var(--ab-bg-surface)] px-2 py-0.5 rounded border border-[var(--ab-border)]">{t.target}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Notes from HR if any */}
                {req.rejectionReason && (
                  <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-500 space-y-0.5">
                    <span className="font-black uppercase text-[8px] tracking-widest">Alasan Penolakan HR:</span>
                    <p className="font-bold">{req.rejectionReason}</p>
                  </div>
                )}
                {req.finalNotes && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs text-emerald-600 dark:text-emerald-400 space-y-0.5">
                    <span className="font-black uppercase text-[8px] tracking-widest">Catatan Final HR:</span>
                    <p className="font-bold">{req.finalNotes}</p>
                  </div>
                )}

                {/* Action button to Submit Report */}
                {req.status === "approved" && (
                  <button
                    onClick={() => handleOpenReportModal(req)}
                    className="w-full py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg hover:opacity-95 transition-all flex items-center justify-center gap-2"
                  >
                    <FileText size={14} /> Isi Laporan Selesai Lembur
                  </button>
                )}
              </div>
            ))
          )}
        </div>
      )}

      {/* Confirmation Dialog */}
      <ConfirmDialog
        isOpen={showConfirm}
        title="Konfirmasi Pengajuan Lembur"
        message={`Yakin ingin mengajukan lembur pada tanggal ${overtimeDate} dengan durasi ${formatMinutes(durationMinutes)}?`}
        confirmLabel="Ya, Kirim Pengajuan"
        type="info"
        onConfirm={handleSubmitForm}
        onCancel={() => setShowConfirm(false)}
      />

      {/* Report Modal */}
      {reportingReq && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[var(--ab-bg-surface)] max-w-lg w-full p-6 rounded-3xl border border-[var(--ab-border)] shadow-2xl space-y-5 animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center border-b border-[var(--ab-border)] pb-3">
              <div>
                <h3 className="text-base font-black text-[var(--ab-text-main)] uppercase tracking-tight">
                  Laporan Hasil Kerja Lembur
                </h3>
                <p className="text-[10px] font-bold text-[var(--ab-text-dim)] uppercase tracking-widest">
                  Tanggal: {reportingReq.overtimeDate}
                </p>
              </div>
              <button
                onClick={() => setReportingReq(null)}
                className="p-2 text-[var(--ab-text-dim)] hover:text-[var(--ab-text-main)]"
              >
                <X size={18} />
              </button>
            </div>

            {/* Jam Selesai Riil */}
            <div className="space-y-1.5 p-3.5 bg-[var(--ab-bg-main)] rounded-2xl border border-[var(--ab-border)]">
              <label className="text-[10px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest block">
                Jam Selesai Aktual (Bisa lebih cepat / lebih lama)
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="time"
                  value={actualEndTime}
                  onChange={(e) => setActualEndTime(e.target.value)}
                  className="ab-input text-sm font-black py-2 px-3 rounded-xl text-center w-36"
                />
                <span className="text-xs font-bold text-[var(--ab-text-dim)]">
                  Mulai: {reportingReq.approvedStartTime || reportingReq.requestedStartTime}
                </span>
              </div>
            </div>

            {/* Progress per Task */}
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest block">
                Hasil Pencapaian Tugas
              </label>
              {taskReports.map((tr, idx) => (
                <div key={tr.id} className="p-3 bg-[var(--ab-bg-main)] rounded-2xl border border-[var(--ab-border)] space-y-2">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-black text-[var(--ab-text-main)]">• {tr.task}</span>
                    <span className="text-[9px] font-bold text-[var(--ab-text-dim)]">Target: {tr.target}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      placeholder="Hasil riil (cth: 3 Video Selesai)"
                      value={tr.actualResult}
                      onChange={(e) => {
                        const val = e.target.value;
                        setTaskReports(prev => prev.map(p => p.id === tr.id ? { ...p, actualResult: val } : p));
                      }}
                      className="ab-input text-xs py-1.5 px-3 rounded-lg"
                    />
                    <select
                      value={tr.status}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        setTaskReports(prev => prev.map(p => p.id === tr.id ? { ...p, status: val } : p));
                      }}
                      className="ab-input text-xs py-1.5 px-2 rounded-lg font-bold"
                    >
                      <option value="completed">✅ Selesai Penuh (100%)</option>
                      <option value="partial">⏳ Sebagian</option>
                      <option value="not_completed">❌ Belum Selesai</option>
                    </select>
                  </div>
                </div>
              ))}
            </div>

            {/* Catatan Laporan */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest">
                Catatan / Kendala Selama Lembur
              </label>
              <textarea
                rows={2}
                value={reportNotes}
                onChange={(e) => setReportNotes(e.target.value)}
                placeholder="Penjelasan hasil kerja atau alasan jika waktu molor..."
                className="ab-input text-xs w-full py-2.5 px-3 rounded-xl resize-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => setReportingReq(null)}
                className="flex-1 py-3 bg-[var(--ab-bg-main)] text-[var(--ab-text-dim)] font-black text-xs uppercase tracking-widest rounded-xl hover:bg-[var(--ab-border)] transition-all"
              >
                Batal
              </button>
              <button
                onClick={handleSubmitReport}
                disabled={isSubmittingReport}
                className="flex-1 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-black text-xs uppercase tracking-widest rounded-xl shadow-lg hover:opacity-95 transition-all"
              >
                {isSubmittingReport ? "Mengirim..." : "Kirim Laporan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
