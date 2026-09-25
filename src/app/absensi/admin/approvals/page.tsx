"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ConfirmDialog from "@/components/absensi/ConfirmDialog";
import PromptDialog from "@/components/absensi/PromptDialog";
import type { OvertimeRequest, OvertimeTaskReport } from "@/types/absensi";
import ImageLightboxModal from "@/components/absensi/ImageLightboxModal";
import OvertimeDetailModal from "@/components/absensi/OvertimeDetailModal";
import {
  formatDurationDetail,
  formatScheduleRange,
  calcDurationMinutes,
  calcOvertimeDurationMinutes,
  addDaysToDate,
} from "@/lib/overtimeHelpers";
import {
  Check, X, CalendarDays, FileEdit, Smile, Shield, ArrowRight,
  Clock, CheckCircle2, ClipboardCheck, Image as ImageIcon, Eye,
  Search, Filter, Users, ChevronRight, Sparkles, AlertCircle, Moon,
  AlertTriangle, History, Info
} from "lucide-react";
import { toast } from "sonner";

interface PendingRequest {
  id: string;
  userId: string;
  userName: string;
  type: string;
  dates: string[];
  reason: string;
  createdAt: string;
  status: string;
  departmentName?: string;
  cancellationRequested?: boolean;
  cancellationReason?: string | null;
  deductedSick?: number;
  deductedLeave?: number;
  executiveStatus?: "pending" | "approved" | "rejected" | null;
  executiveApprovedBy?: string | null;
  executiveApprovedByName?: string | null;
  executiveApprovedAt?: string | null;
  executiveNotes?: string | null;
  hrStatus?: "pending" | "approved" | "rejected" | null;
  hrApprovedBy?: string | null;
  hrApprovedByName?: string | null;
  hrApprovedAt?: string | null;
  hrNotes?: string | null;
  rejectionStage?: "executive" | "hr" | null;
  rejectionReason?: string | null;
  rejectedBy?: string | null;
  rejectedAt?: string | null;
}

type ConfirmCfg = {
  title: string;
  msg: string;
  type: "info" | "warning" | "danger";
  onConfirm: () => Promise<void>;
} | null;

export default function AdminApprovalsPage() {
  const { user, kpiRole } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  // Role authority
  const isExecutive = kpiRole === "executive" || kpiRole === "developer";
  const isHR = kpiRole === "hr" || kpiRole === "developer";

  useEffect(() => {
    setMounted(true);
  }, []);

  // Tabs: "leave" vs "overtime"
  const [activeMainTab, setActiveMainTab] = useState<"leave" | "overtime">("leave");

  // Cuti States & Sub-Tabs
  const [leaveSubTab, setLeaveSubTab] = useState<"pending" | "cancellation" | "history">("pending");
  const [historyFilter, setHistoryFilter] = useState<"all" | "approved" | "rejected">("all");
  const [historySearch, setHistorySearch] = useState("");
  const [allActiveLeaves, setAllActiveLeaves] = useState<PendingRequest[]>([]);
  const [pendingReqs, setPendingReqs] = useState<PendingRequest[]>([]);
  const [cancelReqs, setCancelReqs] = useState<PendingRequest[]>([]);
  const [historyReqs, setHistoryReqs] = useState<PendingRequest[]>([]);
  const [pendingStaffCount, setPendingStaffCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmCfg, setConfirmCfg] = useState<ConfirmCfg>(null);

  // Leave Approval 2-Layer Dialogs
  const [leaveApproveModal, setLeaveApproveModal] = useState<{ req: PendingRequest; layer: "executive" | "hr" } | null>(null);
  const [leaveApproveNotes, setLeaveApproveNotes] = useState("");
  const [leaveRejectModal, setLeaveRejectModal] = useState<{ req: PendingRequest; layer: "executive" | "hr" } | null>(null);
  const [leaveRejectReason, setLeaveRejectReason] = useState("");

  // Overtime States
  const [overtimes, setOvertimes] = useState<OvertimeRequest[]>([]);
  const [overtimeTab, setOvertimeTab] = useState<"pending" | "reported" | "finalized">("pending");
  const [adjustingReq, setAdjustingReq] = useState<OvertimeRequest | null>(null);
  const [adjustStartDate, setAdjustStartDate] = useState("");
  const [adjustEndDate, setAdjustEndDate] = useState("");
  const [adjustStartTime, setAdjustStartTime] = useState("");
  const [adjustEndTime, setAdjustEndTime] = useState("");
  const [adjustNotes, setAdjustNotes] = useState("");

  // Reject Overtime Dialog
  const [rejectingReq, setRejectingReq] = useState<OvertimeRequest | null>(null);

  // Finalize Overtime Dialog
  const [finalizingReq, setFinalizingReq] = useState<OvertimeRequest | null>(null);
  const [finalHours, setFinalHours] = useState(0);
  const [finalMinutes, setFinalMinutes] = useState(0);
  const [finalNotes, setFinalNotes] = useState("");

  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterDate, setFilterDate] = useState("");
  const [quickDateFilter, setQuickDateFilter] = useState<"all" | "today" | "custom">("all");

  // Detail Modal State
  const [selectedDetailOvertime, setSelectedDetailOvertime] = useState<OvertimeRequest | null>(null);

  // Lightbox Preview Modal State
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Lock background scroll when adjustingReq, finalizingReq, leaveApproveModal, or leaveRejectModal is open
  useEffect(() => {
    const isAnyModalOpen = !!adjustingReq || !!finalizingReq || !!leaveApproveModal || !!leaveRejectModal;
    if (!isAnyModalOpen) return;
    const prevBody = document.body.style.overflow;
    const mainEl = document.querySelector("main");
    const prevMain = mainEl ? mainEl.style.overflow : "";

    document.body.style.overflow = "hidden";
    if (mainEl) mainEl.style.overflow = "hidden";

    return () => {
      document.body.style.overflow = prevBody;
      if (mainEl) mainEl.style.overflow = prevMain;
    };
  }, [adjustingReq, finalizingReq, leaveApproveModal, leaveRejectModal]);

  const fetchOvertime = useCallback(async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("overtime_requests" as any)
        .select("*, users!user_id(name, position, departments(name))")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching overtime in admin approvals:", error);
      }

      if (data) {
        setOvertimes(
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
            proofImages: r.proof_images || [],
            finalDurationMinutes: r.final_duration_minutes,
            finalizedBy: r.finalized_by,
            finalizedDate: r.finalized_date,
            finalNotes: r.final_notes,
            calculationBreakdown: r.calculation_breakdown || null,
            createdAt: r.created_at,
            updatedAt: r.updated_at,
            userName: r.users?.name,
            userDepartment: r.users?.departments?.name,
            userPosition: r.users?.position,
          }))
        );
      }
    } catch (err) {
      console.error("fetchOvertime exception:", err);
    }
  }, []);

  const fetchLeaves = useCallback(async () => {
    setIsLoading(true);
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("leave_requests")
        .select("*, users!user_id(id, name, email, department_id, departments(name))")
        .order("created_at", { ascending: true });

      if (error) {
        console.error("Error fetching leave requests:", error);
        return;
      }

      const mapped: PendingRequest[] = (data ?? []).map((r) => {
        const u = r.users as any;
        return {
          id: r.id as string,
          userId: r.user_id as string,
          userName: u?.name ?? "Unknown",
          departmentName: u?.departments?.name ?? "Umum",
          type: r.type as string,
          dates: (r.dates as string[]) ?? [],
          reason: (r.reason as string) ?? "",
          createdAt: r.created_at as string,
          status: r.status as string,
          cancellationRequested: (r.cancellation_requested as boolean) ?? false,
          cancellationReason: r.cancellation_reason as string | null,
          deductedSick: (r.deducted_sick as number) ?? 0,
          deductedLeave: (r.deducted_leave as number) ?? 0,
          executiveStatus: r.executive_status,
          executiveApprovedBy: r.executive_approved_by,
          executiveApprovedByName: r.executive_approved_by_name,
          executiveApprovedAt: r.executive_approved_at,
          executiveNotes: r.executive_notes,
          hrStatus: r.hr_status,
          hrApprovedBy: r.hr_approved_by,
          hrApprovedByName: r.hr_approved_by_name,
          hrApprovedAt: r.hr_approved_at,
          hrNotes: r.hr_notes,
          rejectionStage: r.rejection_stage,
          rejectionReason: r.rejection_reason,
          rejectedBy: r.rejected_by,
          rejectedAt: r.rejected_at,
        };
      });

      // Active leaves for conflict detection: pending, approved_executive, approved (not cancelled)
      const activeLeaves = mapped.filter(
        (r) => ["pending", "approved_executive", "approved"].includes(r.status) && !r.cancellationRequested
      );
      setAllActiveLeaves(activeLeaves);

      // Pending requests: pending & approved_executive
      const pending = mapped.filter((r) => ["pending", "approved_executive"].includes(r.status));
      setPendingReqs(pending);

      // Cancellation requests: approved with cancellation_requested
      const cancel = mapped.filter((r) => r.status === "approved" && r.cancellationRequested);
      setCancelReqs(cancel);

      // History: approved & rejected (ordered newest first)
      const history = mapped
        .filter((r) => ["approved", "rejected"].includes(r.status))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setHistoryReqs(history);
    } catch (err) {
      console.error("fetchLeaves exception:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const supabase = createClient();

    const fetchPendingStaff = async () => {
      const { count } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("absensi_status", "pending");
      setPendingStaffCount(count ?? 0);
    };

    Promise.all([fetchLeaves(), fetchPendingStaff(), fetchOvertime()]);

    const ch = supabase
      .channel("admin_approvals")
      .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, () => {
        fetchLeaves();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "overtime_requests" }, fetchOvertime)
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, fetchPendingStaff)
      .subscribe();

    return () => { ch.unsubscribe(); };
  }, [fetchLeaves, fetchOvertime]);

  // Division Conflict & Queue Calculation Helper
  const getDivisionConflicts = useCallback((req: PendingRequest) => {
    if (!req.dates || req.dates.length === 0) return [];
    const reqDept = req.departmentName || "Umum";
    const reqTime = new Date(req.createdAt).getTime();

    return allActiveLeaves
      .filter((other) => {
        if (other.id === req.id) return false;
        const otherDept = other.departmentName || "Umum";
        if (reqDept !== otherDept) return false;
        return other.dates.some((d) => req.dates.includes(d));
      })
      .map((other) => {
        const overlapping = other.dates.filter((d) => req.dates.includes(d));
        const otherTime = new Date(other.createdAt).getTime();
        const isEarlier = otherTime < reqTime;
        const diffMinutes = Math.round(Math.abs(reqTime - otherTime) / (1000 * 60));

        return {
          ...other,
          overlappingDates: overlapping,
          isEarlier,
          diffMinutes,
        };
      })
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  }, [allActiveLeaves]);

  const formatTimeAgoOrDiff = (diffMinutes: number, isEarlier: boolean) => {
    if (diffMinutes < 1) return isEarlier ? "beberapa detik lebih dulu" : "beberapa detik setelahnya";
    if (diffMinutes < 60) return `${diffMinutes} menit ${isEarlier ? "lebih awal" : "setelahnya"}`;
    const hours = Math.floor(diffMinutes / 60);
    const mins = diffMinutes % 60;
    if (hours < 24) {
      return `${hours} jam ${mins > 0 ? `${mins} mnt ` : ""}${isEarlier ? "lebih awal" : "setelahnya"}`;
    }
    const days = Math.floor(hours / 24);
    return `${days} hari ${isEarlier ? "lebih awal" : "setelahnya"}`;
  };

  const formatMinutes = formatDurationDetail;

  const todayDateStr = (() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  })();

  const activeFilterDate = quickDateFilter === "today" ? todayDateStr : quickDateFilter === "custom" ? filterDate : "";

  const filteredOvertimes = overtimes.filter((o) => {
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchName = (o.userName || "").toLowerCase().includes(q);
      const matchDept = (o.userDepartment || "").toLowerCase().includes(q);
      const matchPos = (o.userPosition || "").toLowerCase().includes(q);
      const matchTask = (o.tasks || []).some(t => t.task.toLowerCase().includes(q));
      if (!matchName && !matchDept && !matchPos && !matchTask) return false;
    }

    if (activeFilterDate) {
      if (o.overtimeDate !== activeFilterDate) return false;
    }

    return true;
  });

  const targetSummaryDate = activeFilterDate || todayDateStr;
  const targetDateOvertimes = overtimes.filter(
    (o) => o.overtimeDate === targetSummaryDate && o.status !== "rejected" && o.status !== "cancelled"
  );

  // Overtime Actions
  const handleOpenApproveModal = (req: OvertimeRequest) => {
    setAdjustingReq(req);
    const reqStart = req.calculationBreakdown?.startDate || req.overtimeDate;
    const reqEnd = req.calculationBreakdown?.endDate || req.overtimeDate;
    setAdjustStartDate(reqStart);
    setAdjustEndDate(reqEnd);
    setAdjustStartTime(req.requestedStartTime);
    setAdjustEndTime(req.requestedEndTime);
    setAdjustNotes("");
  };

  const handleApproveOvertime = async () => {
    if (!adjustingReq || !user) return;
    const durMins = calcOvertimeDurationMinutes(adjustStartDate, adjustStartTime, adjustEndDate, adjustEndTime);
    if (durMins <= 0) { toast.error("Waktu selesai harus lebih besar dari waktu mulai."); return; }

    const tid = toast.loading("Menyetujui jadwal lembur...");
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("overtime_requests" as any)
        .update({
          status: "approved",
          approved_start_time: adjustStartTime + ":00",
          approved_end_time: adjustEndTime + ":00",
          approved_duration_minutes: durMins,
          calculation_breakdown: {
            ...(adjustingReq.calculationBreakdown || {}),
            startDate: adjustStartDate,
            endDate: adjustEndDate,
            isCrossDay: adjustStartDate !== adjustEndDate,
          },
          approved_by: user.id,
          approval_date: new Date().toISOString(),
          approval_notes: adjustNotes.trim() || null,
        })
        .eq("id", adjustingReq.id);

      if (error) throw error;
      toast.success("Lembur berhasil disetujui!", { id: tid });
      setAdjustingReq(null);
      await fetchOvertime();
    } catch (err: any) {
      toast.error("Gagal: " + err.message, { id: tid });
    }
  };

  const handleRejectOvertime = async (reason: string) => {
    if (!rejectingReq || !user) return;
    if (!reason.trim()) { toast.error("Alasan penolakan wajib diisi."); return; }

    const tid = toast.loading("Menolak pengajuan lembur...");
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("overtime_requests" as any)
        .update({
          status: "rejected",
          approved_by: user.id,
          approval_date: new Date().toISOString(),
          rejection_reason: reason.trim(),
        })
        .eq("id", rejectingReq.id);

      if (error) throw error;
      toast.success("Pengajuan lembur telah ditolak.", { id: tid });
      setRejectingReq(null);
      await fetchOvertime();
    } catch (err: any) {
      toast.error("Gagal: " + err.message, { id: tid });
    }
  };

  const handleOpenFinalizeModal = (req: OvertimeRequest) => {
    setFinalizingReq(req);
    const defaultMins = req.actualDurationMinutes || req.approvedDurationMinutes || req.requestedDurationMinutes || 0;
    setFinalHours(Math.floor(defaultMins / 60));
    setFinalMinutes(defaultMins % 60);
    setFinalNotes("");
  };

  const handleFinalizeOvertime = async () => {
    if (!finalizingReq || !user) return;
    const totalMins = finalHours * 60 + finalMinutes;

    const tid = toast.loading("Memfinalisasi durasi lembur...");
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("overtime_requests" as any)
        .update({
          status: "finalized",
          final_duration_minutes: totalMins,
          finalized_by: user.id,
          finalized_date: new Date().toISOString(),
          final_notes: finalNotes.trim() || null,
        })
        .eq("id", finalizingReq.id);

      if (error) throw error;
      toast.success(`Lembur difinalisasi menjadi ${formatMinutes(totalMins)}!`, { id: tid });
      setFinalizingReq(null);
      await fetchOvertime();
    } catch (err: any) {
      toast.error("Gagal finalisasi: " + err.message, { id: tid });
    }
  };

  const formatDateDisplay = (dateStr?: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString("id-ID", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }).replace(/\./g, ":");
  };

  const handleConfirmApproveLeave = async () => {
    if (!leaveApproveModal?.req || !user) return;
    const { req, layer } = leaveApproveModal;
    const tid = toast.loading(
      layer === "executive" ? "Menyetujui pengajuan (Executive)..." : "Menyetujui final pengajuan (HR)..."
    );
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("process_leave_request", {
        p_request_id: req.id,
        p_layer: layer,
        p_action: "approve",
        p_admin_id: user.id,
        p_admin_name: user.name,
        p_notes: leaveApproveNotes.trim() || null,
        p_reason: null,
      });
      if (error) throw error;
      toast.success(
        layer === "executive"
          ? "Persetujuan Executive berhasil dicatat. Menunggu persetujuan HR."
          : "Pengajuan berhasil disetujui final oleh HR.",
        { id: tid }
      );
      setLeaveApproveModal(null);
      setLeaveApproveNotes("");
    } catch (err: any) {
      toast.error("Gagal: " + (err.message || "Unknown error"), { id: tid });
    }
  };

  const handleConfirmRejectLeave = async () => {
    if (!leaveRejectModal?.req || !user) return;
    if (!leaveRejectReason.trim()) {
      toast.error("Alasan penolakan wajib diisi.");
      return;
    }
    const { req, layer } = leaveRejectModal;
    const tid = toast.loading("Menolak pengajuan...");
    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("process_leave_request", {
        p_request_id: req.id,
        p_layer: layer,
        p_action: "reject",
        p_admin_id: user.id,
        p_admin_name: user.name,
        p_notes: null,
        p_reason: leaveRejectReason.trim(),
      });
      if (error) throw error;
      toast.success("Pengajuan cuti telah ditolak.", { id: tid });
      setLeaveRejectModal(null);
      setLeaveRejectReason("");
    } catch (err: any) {
      toast.error("Gagal: " + (err.message || "Unknown error"), { id: tid });
    }
  };

  const processCancellation = (req: PendingRequest, action: "approve" | "reject") => {
    setConfirmCfg({
      title: "Konfirmasi Pembatalan",
      msg:
        action === "approve"
          ? `Yakin menyetujui pembatalan cuti ${req.userName}? Kuota cuti akan dikembalikan.`
          : `Tolak pembatalan cuti ${req.userName}?`,
      type: action === "approve" ? "warning" : "danger",
      onConfirm: async () => {
        const tid = toast.loading("Memproses...");
        try {
          const supabase = createClient();
          const { error } = await supabase.rpc("process_leave_cancellation", {
            p_request_id: req.id,
            p_action: action,
            p_admin_name: user?.name ?? "Admin",
          });
          if (error) throw error;
          toast.success("Selesai.", { id: tid });
        } catch (err: unknown) {
          toast.error("Gagal: " + (err instanceof Error ? err.message : "Unknown error"), { id: tid });
        } finally {
          setConfirmCfg(null);
        }
      },
    });
  };

  const typeStyle = (t: string) =>
    t === "leave"
      ? "bg-emerald-50 text-[#00897B] border-emerald-100 dark:bg-emerald-900/20 dark:border-emerald-800"
      : t === "sick"
        ? "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/20 dark:border-amber-800"
        : "bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:border-purple-800";

  const typeLabel = (t: string) =>
    t === "leave" ? "Cuti" : t === "sick" ? "Sakit" : "WFA";

  const groupedPending = pendingReqs.reduce((acc, req) => {
    const dept = req.departmentName || "Umum";
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(req);
    return acc;
  }, {} as Record<string, PendingRequest[]>);

  const groupedCancel = cancelReqs.reduce((acc, req) => {
    const dept = req.departmentName || "Umum";
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(req);
    return acc;
  }, {} as Record<string, PendingRequest[]>);

  const filteredHistoryReqs = historyReqs.filter((req) => {
    if (historyFilter === "approved" && req.status !== "approved") return false;
    if (historyFilter === "rejected" && req.status !== "rejected") return false;
    if (historySearch.trim()) {
      const q = historySearch.toLowerCase();
      const matchName = req.userName.toLowerCase().includes(q);
      const matchDept = (req.departmentName || "").toLowerCase().includes(q);
      const matchReason = (req.reason || "").toLowerCase().includes(q);
      if (!matchName && !matchDept && !matchReason) return false;
    }
    return true;
  });

  const groupedHistory = filteredHistoryReqs.reduce((acc, req) => {
    const dept = req.departmentName || "Umum";
    if (!acc[dept]) acc[dept] = [];
    acc[dept].push(req);
    return acc;
  }, {} as Record<string, PendingRequest[]>);

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black text-[var(--ab-text-main)] uppercase tracking-tight">
            Manajemen Cuti
          </h1>
          {pendingReqs.length > 0 && (
            <div className="bg-orange-50 dark:bg-orange-950/30 text-orange-600 dark:text-orange-400 px-4 py-1.5 rounded-full text-[10px] font-black border border-orange-100 dark:border-orange-800 flex items-center gap-2 animate-pulse">
              <span className="w-1.5 h-1.5 bg-orange-600 rounded-full" />
              {pendingReqs.length} PENDING
            </div>
          )}
        </div>
      </div>

      {/* Pending Staff Banner */}
      {!isLoading && pendingStaffCount > 0 && (
        <button
          onClick={() => router.push("/absensi/admin/staff")}
          className="w-full flex flex-col md:flex-row items-center justify-between gap-4 bg-gradient-to-r from-amber-500 to-orange-600 p-5 rounded-[32px] text-white shadow-lg hover:scale-[1.01] transition-transform active:scale-[0.99] group overflow-hidden relative text-left"
        >
          <Shield className="absolute -right-6 -bottom-6 text-white opacity-10 group-hover:rotate-12 transition-transform duration-700" size={96} />
          <div className="flex items-center gap-4 relative z-10">
            <div className="bg-white/20 backdrop-blur-md w-12 h-12 rounded-2xl flex items-center justify-center border border-white/20">
              <Shield size={20} />
            </div>
            <div>
              <h3 className="font-black text-sm uppercase tracking-tight leading-none mb-1">Ada Pendaftar Baru!</h3>
              <p className="text-[10px] text-amber-50 font-bold opacity-90">
                Terdapat {pendingStaffCount} akun karyawan baru yang menunggu persetujuan Anda.
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-white/20 px-5 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest group-hover:bg-white group-hover:text-amber-600 transition-all">
            Lihat Pendaftar <ArrowRight size={12} className="group-hover:translate-x-1 transition-transform" />
          </div>
        </button>
      )}

      {/* SUB-TAB SWITCHER: APPROVAL / CANCELLATION / HISTORY */}
      <div className="flex bg-[var(--ab-bg-surface)] p-1.5 rounded-2xl border border-[var(--ab-border)] w-full sm:w-fit shadow-inner flex-wrap items-center gap-1.5">
        <button
          onClick={() => setLeaveSubTab("pending")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            leaveSubTab === "pending"
              ? "bg-[var(--ab-primary)] text-white shadow-md"
              : "text-[var(--ab-text-dim)] hover:text-[var(--ab-text-main)] hover:bg-[var(--ab-bg-main)]"
          }`}
        >
          <Clock size={14} />
          <span>Persetujuan Cuti</span>
          {pendingReqs.length > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                leaveSubTab === "pending"
                  ? "bg-white text-[var(--ab-primary)]"
                  : "bg-amber-500 text-white"
              }`}
            >
              {pendingReqs.length}
            </span>
          )}
        </button>

        {cancelReqs.length > 0 && (
          <button
            onClick={() => setLeaveSubTab("cancellation")}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
              leaveSubTab === "cancellation"
                ? "bg-red-600 text-white shadow-md"
                : "text-[var(--ab-text-dim)] hover:text-[var(--ab-text-main)] hover:bg-[var(--ab-bg-main)]"
            }`}
          >
            <X size={14} />
            <span>Permohonan Batal</span>
            <span
              className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                leaveSubTab === "cancellation" ? "bg-white text-red-600" : "bg-red-500 text-white"
              }`}
            >
              {cancelReqs.length}
            </span>
          </button>
        )}

        <button
          onClick={() => setLeaveSubTab("history")}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all ${
            leaveSubTab === "history"
              ? "bg-slate-800 dark:bg-slate-700 text-white shadow-md"
              : "text-[var(--ab-text-dim)] hover:text-[var(--ab-text-main)] hover:bg-[var(--ab-bg-main)]"
          }`}
        >
          <History size={14} />
          <span>Riwayat Pengajuan</span>
          {historyReqs.length > 0 && (
            <span
              className={`px-2 py-0.5 rounded-full text-[9px] font-black ${
                leaveSubTab === "history"
                  ? "bg-white/20 text-white"
                  : "bg-[var(--ab-bg-main)] text-[var(--ab-text-dim)] border border-[var(--ab-border)]"
              }`}
            >
              {historyReqs.length}
            </span>
          )}
        </button>
      </div>

      {/* TAB CONTENT */}
      {activeMainTab === "leave" && (
        <div className="space-y-6">
          {/* SUB-TAB 1: PENDING APPROVALS */}
          {leaveSubTab === "pending" && (
            <div className="space-y-8 pb-4">
              {isLoading ? (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {[...Array(4)].map((_, i) => (
                    <div key={i} className="animate-pulse bg-[var(--ab-bg-surface)] p-6 rounded-[32px] border border-[var(--ab-border)] h-48" />
                  ))}
                </div>
              ) : pendingReqs.length === 0 ? (
                <div className="p-20 text-center ab-animate-scaleIn bg-[var(--ab-bg-surface)] rounded-3xl border border-[var(--ab-border)]">
                  <div className="w-16 h-16 bg-[var(--ab-bg-main)] rounded-[20px] flex items-center justify-center mx-auto mb-4 text-[var(--ab-text-dim)]">
                    <Smile size={32} />
                  </div>
                  <h4 className="text-[10px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest italic">
                    Semua pengajuan cuti sudah diproses. Aman!
                  </h4>
                </div>
              ) : (
                Object.entries(groupedPending).map(([deptName, reqs]) => (
                  <div key={deptName} className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="bg-[var(--ab-primary)] w-2 h-6 rounded-full"></div>
                      <h2 className="text-lg font-black text-[var(--ab-text-main)] uppercase tracking-tight">{deptName}</h2>
                      <span className="bg-[var(--ab-bg-main)] px-2 py-1 rounded-full text-[10px] font-black text-[var(--ab-text-dim)] border border-[var(--ab-border)]">
                        {reqs.length} Pengajuan
                      </span>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {reqs.map((req) => {
                        const isLayer1 = req.status === "pending";
                        const isLayer2 = req.status === "approved_executive";
                        const conflicts = getDivisionConflicts(req);

                        return (
                          <div
                            key={req.id}
                            className="bg-[var(--ab-bg-surface)] p-5 sm:p-6 rounded-[32px] border border-[var(--ab-border)] shadow-sm flex flex-col justify-between gap-5 relative overflow-hidden"
                          >
                            <div className="space-y-4">
                              {/* Header Badges & Dates */}
                              <div className="flex justify-between items-start gap-2">
                                <div className="flex flex-col gap-1.5">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${typeStyle(req.type)}`}>
                                      {typeLabel(req.type)}
                                    </span>
                                    {isLayer1 ? (
                                      <span className="px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-800/40 flex items-center gap-1">
                                        <Shield size={10} className="text-amber-500" /> Tahap 1: Executive
                                      </span>
                                    ) : (
                                      <span className="px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400 border border-blue-200 dark:border-blue-800/40 flex items-center gap-1">
                                        <Sparkles size={10} className="text-blue-500" /> Tahap 2: HR Final
                                      </span>
                                    )}
                                    <span className="text-[8px] font-black text-[var(--ab-text-dim)] uppercase tracking-widest flex items-center gap-1">
                                      <Clock size={10} />
                                      {formatDateDisplay(req.createdAt)}
                                    </span>
                                  </div>
                                  <h4 className="font-black text-[var(--ab-text-main)] text-base tracking-tight">{req.userName}</h4>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-[8px] font-black text-[var(--ab-text-dim)] uppercase tracking-widest leading-none">Durasi</p>
                                  <p className="text-sm font-black mt-0.5" style={{ color: "var(--ab-primary)" }}>
                                    {req.dates.length} Hari
                                  </p>
                                </div>
                              </div>

                              {/* Dates & Reason */}
                              <div className="space-y-2.5">
                                <div className="flex items-start gap-2 text-[10px] font-bold text-[var(--ab-text-dim)] bg-[var(--ab-bg-main)] p-3 rounded-2xl border border-[var(--ab-border)]">
                                  <CalendarDays size={12} className="mt-0.5 shrink-0" style={{ color: "var(--ab-primary)" }} />
                                  <span className="leading-relaxed">{req.dates.join(", ")}</span>
                                </div>
                                <div className="flex items-start gap-2 text-[10px] font-medium text-[var(--ab-text-dim)] italic px-2">
                                  <FileEdit size={12} className="mt-1 text-[var(--ab-text-dim)] shrink-0 opacity-40" />
                                  <span className="line-clamp-2">&ldquo;{req.reason}&rdquo;</span>
                                </div>
                              </div>

                              {/* INSIGHT CUTI DIVISI & ANTREAN PRIORITAS */}
                              {conflicts.length > 0 ? (
                                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 dark:bg-amber-950/25 dark:border-amber-700/40 space-y-2.5">
                                  <div className="flex items-center justify-between gap-2 border-b border-amber-500/20 pb-2">
                                    <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300">
                                      <AlertTriangle size={14} className="text-amber-500 shrink-0" />
                                      <span className="font-black text-[10px] uppercase tracking-wider">
                                        Insight Cuti Divisi ({conflicts.length} Rekan Serentak)
                                      </span>
                                    </div>
                                    <span className="text-[8.5px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-white uppercase tracking-wider">
                                      Bentrok Tanggal
                                    </span>
                                  </div>

                                  <p className="text-[10px] text-amber-900/90 dark:text-amber-200/90 font-medium">
                                    Ada <span className="font-black">{conflicts.length} rekan</span> di divisi <span className="font-black underline">{req.departmentName}</span> yang juga mengajukan/cuti di tanggal yang sama:
                                  </p>

                                  <div className="space-y-2">
                                    {conflicts.map((c, idx) => {
                                      const isApprovedFinal = c.status === "approved";
                                      const isApprovedExec = c.status === "approved_executive";

                                      return (
                                        <div
                                          key={c.id}
                                          className="p-2.5 rounded-xl bg-white/80 dark:bg-slate-900/70 border border-amber-500/20 space-y-1.5 text-[10px]"
                                        >
                                          <div className="flex flex-wrap items-center justify-between gap-1">
                                            <div className="flex items-center gap-1.5">
                                              <span className="w-5 h-5 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 flex items-center justify-center font-black text-[9px]">
                                                #{idx + 1}
                                              </span>
                                              <span className="font-black text-[var(--ab-text-main)] text-xs">
                                                {c.userName}
                                              </span>
                                            </div>
                                            <div className="flex items-center gap-1">
                                              {isApprovedFinal ? (
                                                <span className="px-2 py-0.5 rounded-md text-[8.5px] font-black uppercase tracking-wider bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                                                  <CheckCircle2 size={10} /> Sudah Disetujui (Final)
                                                </span>
                                              ) : isApprovedExec ? (
                                                <span className="px-2 py-0.5 rounded-md text-[8.5px] font-black uppercase tracking-wider bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30 flex items-center gap-1">
                                                  <Sparkles size={10} /> Lolos Exec (Menunggu HR)
                                                </span>
                                              ) : (
                                                <span className="px-2 py-0.5 rounded-md text-[8.5px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 flex items-center gap-1">
                                                  <Clock size={10} /> Menunggu Exec
                                                </span>
                                              )}
                                            </div>
                                          </div>

                                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[9.5px] pt-1 border-t border-amber-500/10">
                                            <div className="text-[var(--ab-text-dim)] font-bold">
                                              <span className="opacity-70">Tgl Bentrok:</span>{" "}
                                              <span className="text-amber-600 dark:text-amber-400 font-black">
                                                {c.overlappingDates.join(", ")}
                                              </span>
                                            </div>
                                            <div className="text-left sm:text-right text-[var(--ab-text-dim)]">
                                              <span className={`font-black ${c.isEarlier ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`}>
                                                {c.isEarlier ? "🏆 Diajukan Lebih Awal" : "⏳ Diajukan Setelah Ini"}
                                              </span>{" "}
                                              <span className="text-[8.5px] opacity-75">
                                                ({formatTimeAgoOrDiff(c.diffMinutes, c.isEarlier)})
                                              </span>
                                            </div>
                                          </div>

                                          <div className="text-[8.5px] text-[var(--ab-text-dim)] flex items-center gap-1 opacity-80">
                                            <Clock size={9} />
                                            <span>Waktu Diajukan: {formatDateDisplay(c.createdAt)}</span>
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>

                                  <div className="text-[9px] font-bold text-amber-700 dark:text-amber-300/95 bg-amber-500/15 p-2 rounded-xl border border-amber-500/20">
                                    💡 <span className="font-black uppercase tracking-wider">Saran Persetujuan:</span> Pertimbangkan kuota operasional staf pada tanggal tersebut. Dahulukan pengajuan yang masuk lebih awal jika personil terbatas.
                                  </div>
                                </div>
                              ) : (
                                <div className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 dark:bg-emerald-950/20 flex items-center gap-2 text-emerald-700 dark:text-emerald-300 text-[10px] font-bold">
                                  <CheckCircle2 size={13} className="text-emerald-500 shrink-0" />
                                  <span>Tidak ada bentrok cuti dengan rekan lain di divisi {req.departmentName || "Umum"} pada tanggal ini (Aman).</span>
                                </div>
                              )}

                              {/* 2-Layer Funnel Status Tracker */}
                              <div className="p-3.5 bg-[var(--ab-bg-main)] rounded-2xl border border-[var(--ab-border)] space-y-2">
                                <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-[var(--ab-text-dim)] pb-1 border-b border-[var(--ab-border)]">
                                  <span>Status Funnel (2-Layer)</span>
                                  <span className={isLayer1 ? "text-amber-500 font-bold" : "text-blue-500 font-bold"}>
                                    {isLayer1 ? "Menunggu Executive" : "Menunggu HR (Final)"}
                                  </span>
                                </div>

                                <div className="space-y-1.5 text-[10px]">
                                  {/* Layer 1 - Executive */}
                                  <div className="flex items-start justify-between gap-2">
                                    <span className="font-bold text-[var(--ab-text-dim)] flex items-center gap-1.5 shrink-0">
                                      <span className={`w-2 h-2 rounded-full ${req.executiveStatus === 'approved' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                                      1. Executive:
                                    </span>
                                    <div className="text-right">
                                      {req.executiveStatus === 'approved' ? (
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                          Disetujui ({req.executiveApprovedByName || "Executive"}{req.executiveApprovedAt ? ` • ${formatDateDisplay(req.executiveApprovedAt)}` : ""})
                                        </span>
                                      ) : (
                                        <span className="font-bold text-amber-600 dark:text-amber-400">
                                          Menunggu Persetujuan
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                  {req.executiveNotes && (
                                    <div className="text-[9px] bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-300 p-2 rounded-xl italic">
                                      <span className="font-black not-italic block uppercase text-[8px] tracking-wider mb-0.5">Catatan Executive:</span>
                                      &ldquo;{req.executiveNotes}&rdquo;
                                    </div>
                                  )}

                                  {/* Layer 2 - HR */}
                                  <div className="flex items-start justify-between gap-2 pt-1 border-t border-[var(--ab-border)]">
                                    <span className="font-bold text-[var(--ab-text-dim)] flex items-center gap-1.5 shrink-0">
                                      <span className={`w-2 h-2 rounded-full ${req.hrStatus === 'approved' ? 'bg-emerald-500' : isLayer2 ? 'bg-blue-500 animate-pulse' : 'bg-slate-400'}`} />
                                      2. HR (Final):
                                    </span>
                                    <div className="text-right">
                                      {req.hrStatus === 'approved' ? (
                                        <span className="font-bold text-emerald-600 dark:text-emerald-400">
                                          Disetujui ({req.hrApprovedByName || "HR"}{req.hrApprovedAt ? ` • ${formatDateDisplay(req.hrApprovedAt)}` : ""})
                                        </span>
                                      ) : isLayer2 ? (
                                        <span className="font-bold text-blue-600 dark:text-blue-400">
                                          Menunggu Persetujuan Final
                                        </span>
                                      ) : (
                                        <span className="text-[var(--ab-text-dim)] opacity-60">
                                          Menunggu Tahap 1 Selesai
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            </div>

                            {/* Action Buttons based on Role & Layer */}
                            <div className="pt-2 border-t border-[var(--ab-border)]">
                              {isLayer1 ? (
                                // TAHAP 1: Menunggu Executive
                                isExecutive ? (
                                  <div className="flex gap-2">
                                    <button
                                      onClick={() => {
                                        setLeaveApproveModal({ req, layer: "executive" });
                                        setLeaveApproveNotes("");
                                      }}
                                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition shadow-lg shadow-emerald-600/20 flex items-center justify-center gap-2"
                                    >
                                      <Check size={14} /> Setujui (Executive)
                                    </button>
                                    <button
                                      onClick={() => {
                                        setLeaveRejectModal({ req, layer: "executive" });
                                        setLeaveRejectReason("");
                                      }}
                                      className="flex-1 bg-[var(--ab-bg-main)] text-red-500 border border-[var(--ab-border)] hover:bg-red-500 hover:text-white py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition flex items-center justify-center gap-2"
                                    >
                                      <X size={14} /> Tolak
                                    </button>
                                  </div>
                                ) : isHR ? (
                                  <div className="w-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 p-3 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left">
                                    <div className="flex items-center gap-2 text-amber-700 dark:text-amber-300 text-[10px] font-bold">
                                      <Shield size={14} className="text-amber-600 shrink-0" />
                                      <span>Menunggu persetujuan role Executive sebelum HR dapat menyetujui.</span>
                                    </div>
                                    <button
                                      onClick={() => {
                                        setLeaveRejectModal({ req, layer: "executive" });
                                        setLeaveRejectReason("");
                                      }}
                                      className="bg-[var(--ab-bg-main)] text-red-500 border border-[var(--ab-border)] hover:bg-red-500 hover:text-white px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition shrink-0"
                                    >
                                      Tolak
                                    </button>
                                  </div>
                                ) : (
                                  <div className="text-center text-[10px] font-bold text-[var(--ab-text-dim)] py-2">
                                    Menunggu Persetujuan Executive
                                  </div>
                                )
                              ) : (
                                // TAHAP 2: Menunggu HR Final
                                (isHR || isExecutive) ? (
                                  <div className="space-y-2">
                                    <div className="flex gap-2">
                                      <button
                                        onClick={() => {
                                          setLeaveApproveModal({ req, layer: "hr" });
                                          setLeaveApproveNotes("");
                                        }}
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition shadow-lg shadow-blue-600/20 flex items-center justify-center gap-2"
                                      >
                                        <CheckCircle2 size={14} /> Setujui Final (HR)
                                      </button>
                                      <button
                                        onClick={() => {
                                          setLeaveRejectModal({ req, layer: "hr" });
                                          setLeaveRejectReason("");
                                        }}
                                        className="flex-1 bg-[var(--ab-bg-main)] text-red-500 border border-[var(--ab-border)] hover:bg-red-500 hover:text-white py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest transition flex items-center justify-center gap-2"
                                      >
                                        <X size={14} /> Tolak
                                      </button>
                                    </div>
                                    {isExecutive && !isHR && (
                                      <p className="text-[9px] text-center text-amber-600 dark:text-amber-400 font-bold">
                                        *Sebagai Executive, Anda memiliki wewenang untuk menyetujui tahap HR secara langsung.
                                      </p>
                                    )}
                                  </div>
                                ) : (
                                  <div className="text-center text-[10px] font-bold text-[var(--ab-text-dim)] py-2">
                                    Menunggu Persetujuan Final HR
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* SUB-TAB 2: CANCELLATION REQUESTS */}
          {leaveSubTab === "cancellation" && (
            <div className="space-y-8 pb-4">
              {cancelReqs.length === 0 ? (
                <div className="p-20 text-center ab-animate-scaleIn bg-[var(--ab-bg-surface)] rounded-3xl border border-[var(--ab-border)]">
                  <div className="w-16 h-16 bg-[var(--ab-bg-main)] rounded-[20px] flex items-center justify-center mx-auto mb-4 text-[var(--ab-text-dim)]">
                    <Smile size={32} />
                  </div>
                  <h4 className="text-[10px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest italic">
                    Tidak ada permohonan pembatalan cuti.
                  </h4>
                </div>
              ) : (
                Object.entries(groupedCancel).map(([deptName, reqs]) => (
                  <div key={deptName} className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="bg-red-500 w-2 h-6 rounded-full"></div>
                      <h3 className="text-lg font-black text-[var(--ab-text-main)] uppercase tracking-tight">{deptName}</h3>
                      <span className="bg-[var(--ab-bg-main)] px-2 py-1 rounded-full text-[10px] font-black text-[var(--ab-text-dim)] border border-[var(--ab-border)]">
                        {reqs.length} Pengajuan
                      </span>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {reqs.map((req) => (
                        <div
                          key={req.id}
                          className="bg-red-50 dark:bg-red-950/20 p-5 rounded-[32px] border border-red-200 dark:border-red-900/30 flex flex-col justify-between gap-4 relative overflow-hidden"
                        >
                          <div className="space-y-4 relative z-10">
                            <div className="flex justify-between items-start">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
                                    Batal Cuti
                                  </span>
                                  <span className="text-[8px] font-black text-red-400 uppercase tracking-widest flex items-center gap-1">
                                    <Clock size={10} />
                                    {formatDateDisplay(req.createdAt)}
                                  </span>
                                </div>
                                <h4 className="font-black text-red-900 dark:text-red-100 text-base tracking-tight">{req.userName}</h4>
                              </div>
                            </div>
                            <div className="space-y-3">
                              <div className="flex items-start gap-2 text-[10px] font-bold text-red-800 dark:text-red-200 bg-red-100/50 dark:bg-red-900/20 p-3 rounded-2xl border border-red-200 dark:border-red-800/30">
                                <CalendarDays size={12} className="mt-0.5 shrink-0 text-red-500" />
                                <span className="leading-relaxed">{req.dates.join(", ")}</span>
                              </div>
                              <div className="flex flex-col gap-1 text-[10px] font-medium text-red-700 dark:text-red-300 italic px-2 border-l-2 border-red-300 dark:border-red-800 ml-1 pl-3">
                                <span className="font-black uppercase text-[8px] tracking-widest opacity-60 not-italic">Alasan Batal</span>
                                <span className="line-clamp-2">&ldquo;{req.cancellationReason}&rdquo;</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 relative z-10">
                            <button
                              onClick={() => processCancellation(req, "approve")}
                              className="flex-1 bg-red-600 text-white py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                            >
                              <Check size={14} /> Setujui Batal
                            </button>
                            <button
                              onClick={() => processCancellation(req, "reject")}
                              className="flex-1 bg-white dark:bg-red-950 text-red-500 border border-red-200 dark:border-red-900 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-900/50 transition flex items-center justify-center gap-2"
                            >
                              <X size={14} /> Tolak Batal
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* SUB-TAB 3: HISTORY REQUESTS */}
          {leaveSubTab === "history" && (
            <div className="space-y-6 pb-4">
              {/* Search & Filter Toolbar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-[var(--ab-bg-surface)] p-3.5 rounded-2xl border border-[var(--ab-border)]">
                <div className="relative flex-1">
                  <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ab-text-dim)]" />
                  <input
                    type="text"
                    placeholder="Cari nama karyawan, divisi, atau alasan..."
                    value={historySearch}
                    onChange={(e) => setHistorySearch(e.target.value)}
                    className="ab-input text-xs pl-9 pr-8 py-2 w-full rounded-xl"
                  />
                  {historySearch && (
                    <button
                      onClick={() => setHistorySearch("")}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ab-text-dim)] hover:text-[var(--ab-text-main)]"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="flex items-center gap-1 bg-[var(--ab-bg-main)] p-1 rounded-xl border border-[var(--ab-border)] self-start sm:self-auto">
                  <button
                    onClick={() => setHistoryFilter("all")}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                      historyFilter === "all"
                        ? "bg-[var(--ab-primary)] text-white shadow-sm"
                        : "text-[var(--ab-text-dim)] hover:text-[var(--ab-text-main)]"
                    }`}
                  >
                    Semua ({historyReqs.length})
                  </button>
                  <button
                    onClick={() => setHistoryFilter("approved")}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                      historyFilter === "approved"
                        ? "bg-emerald-600 text-white shadow-sm"
                        : "text-[var(--ab-text-dim)] hover:text-[var(--ab-text-main)]"
                    }`}
                  >
                    Disetujui ({historyReqs.filter((r) => r.status === "approved").length})
                  </button>
                  <button
                    onClick={() => setHistoryFilter("rejected")}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${
                      historyFilter === "rejected"
                        ? "bg-red-600 text-white shadow-sm"
                        : "text-[var(--ab-text-dim)] hover:text-[var(--ab-text-main)]"
                    }`}
                  >
                    Ditolak ({historyReqs.filter((r) => r.status === "rejected").length})
                  </button>
                </div>
              </div>

              {filteredHistoryReqs.length === 0 ? (
                <div className="p-20 text-center ab-animate-scaleIn bg-[var(--ab-bg-surface)] rounded-3xl border border-[var(--ab-border)]">
                  <div className="w-16 h-16 bg-[var(--ab-bg-main)] rounded-[20px] flex items-center justify-center mx-auto mb-4 text-[var(--ab-text-dim)]">
                    <Smile size={32} />
                  </div>
                  <h4 className="text-[10px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest italic">
                    Tidak ada riwayat pengajuan cuti yang sesuai filter.
                  </h4>
                </div>
              ) : (
                Object.entries(groupedHistory).map(([deptName, reqs]) => (
                  <div key={deptName} className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="bg-[var(--ab-text-dim)] w-2 h-6 rounded-full"></div>
                      <h3 className="text-lg font-black text-[var(--ab-text-main)] uppercase tracking-tight">{deptName}</h3>
                      <span className="bg-[var(--ab-bg-main)] px-2 py-1 rounded-full text-[10px] font-black text-[var(--ab-text-dim)] border border-[var(--ab-border)]">
                        {reqs.length} Riwayat
                      </span>
                    </div>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {reqs.map((req) => {
                        const isApproved = req.status === "approved";
                        const isRejected = req.status === "rejected";

                        return (
                          <div
                            key={req.id}
                            className="bg-[var(--ab-bg-surface)] p-5 sm:p-6 rounded-[32px] border border-[var(--ab-border)] shadow-sm flex flex-col justify-between gap-4 relative overflow-hidden opacity-90 hover:opacity-100 transition-opacity"
                          >
                            <div className="space-y-4 relative z-10">
                              <div className="flex justify-between items-start gap-2">
                                <div className="space-y-1">
                                  <div className="flex flex-wrap items-center gap-2 mb-1">
                                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${typeStyle(req.type)}`}>
                                      {typeLabel(req.type)}
                                    </span>
                                    <span
                                      className={`px-2.5 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                                        isApproved
                                          ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                                          : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                                      }`}
                                    >
                                      {isApproved ? "Disetujui" : "Ditolak"}
                                    </span>
                                    <span className="text-[8px] font-black text-[var(--ab-text-dim)] uppercase tracking-widest flex items-center gap-1">
                                      <Clock size={10} />
                                      {formatDateDisplay(req.createdAt)}
                                    </span>
                                  </div>
                                  <h4 className="font-black text-[var(--ab-text-main)] text-base tracking-tight">{req.userName}</h4>
                                </div>
                                <div className="text-right shrink-0">
                                  <p className="text-[8px] font-black text-[var(--ab-text-dim)] uppercase tracking-widest leading-none">Durasi</p>
                                  <p className="text-sm font-black mt-0.5" style={{ color: "var(--ab-primary)" }}>
                                    {req.dates.length} Hari
                                  </p>
                                </div>
                              </div>

                              {/* Dates & Reason */}
                              <div className="space-y-2.5">
                                <div className="flex items-start gap-2 text-[10px] font-bold text-[var(--ab-text-dim)] bg-[var(--ab-bg-main)] p-3 rounded-2xl border border-[var(--ab-border)]">
                                  <CalendarDays size={12} className="mt-0.5 shrink-0" style={{ color: "var(--ab-primary)" }} />
                                  <span className="leading-relaxed">{req.dates.join(", ")}</span>
                                </div>
                                <div className="flex flex-col gap-1 text-[10px] font-medium text-[var(--ab-text-dim)] italic px-2 border-l-2 border-[var(--ab-border)] ml-1 pl-3">
                                  <span className="font-black uppercase text-[8px] tracking-widest opacity-60 not-italic">Alasan Pengajuan</span>
                                  <span className="line-clamp-2">&ldquo;{req.reason}&rdquo;</span>
                                </div>
                              </div>

                              {/* 2-Layer Approval Audit Trail */}
                              <div className="p-3.5 bg-[var(--ab-bg-main)] rounded-2xl border border-[var(--ab-border)] space-y-2.5 text-[10px]">
                                <span className="font-black uppercase text-[8px] tracking-widest text-[var(--ab-text-dim)] block border-b border-[var(--ab-border)] pb-1">
                                  Riwayat Persetujuan 2-Layer
                                </span>

                                {/* Executive Layer */}
                                <div className="space-y-1">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-bold text-[var(--ab-text-dim)]">1. Executive:</span>
                                    <span className="font-bold text-right">
                                      {req.executiveStatus === "approved" ? (
                                        <span className="text-emerald-600 dark:text-emerald-400">
                                          Disetujui ({req.executiveApprovedByName || "Executive"}
                                          {req.executiveApprovedAt ? ` • ${formatDateDisplay(req.executiveApprovedAt)}` : ""})
                                        </span>
                                      ) : req.rejectionStage === "executive" ? (
                                        <span className="text-red-500">Ditolak ({req.rejectedBy || "Executive"})</span>
                                      ) : (
                                        <span className="text-slate-400">-</span>
                                      )}
                                    </span>
                                  </div>
                                  {req.executiveNotes && (
                                    <p className="text-[9px] italic text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 p-2 rounded-xl">
                                      <span className="font-black not-italic block uppercase text-[8px] mb-0.5">Catatan Executive:</span>
                                      &ldquo;{req.executiveNotes}&rdquo;
                                    </p>
                                  )}
                                </div>

                                {/* HR Layer */}
                                <div className="space-y-1 pt-1.5 border-t border-[var(--ab-border)]">
                                  <div className="flex items-center justify-between gap-2">
                                    <span className="font-bold text-[var(--ab-text-dim)]">2. HR (Final):</span>
                                    <span className="font-bold text-right">
                                      {req.hrStatus === "approved" || req.status === "approved" ? (
                                        <span className="text-emerald-600 dark:text-emerald-400">
                                          Disetujui Final ({req.hrApprovedByName || "HR"}
                                          {req.hrApprovedAt ? ` • ${formatDateDisplay(req.hrApprovedAt)}` : ""})
                                        </span>
                                      ) : req.rejectionStage === "hr" ? (
                                        <span className="text-red-500">Ditolak ({req.rejectedBy || "HR"})</span>
                                      ) : (
                                        <span className="text-slate-400">-</span>
                                      )}
                                    </span>
                                  </div>
                                  {req.hrNotes && (
                                    <p className="text-[9px] italic text-emerald-700 dark:text-emerald-300 bg-emerald-500/10 p-2 rounded-xl">
                                      <span className="font-black not-italic block uppercase text-[8px] mb-0.5">Catatan HR:</span>
                                      &ldquo;{req.hrNotes}&rdquo;
                                    </p>
                                  )}
                                </div>

                                {/* If Rejected */}
                                {isRejected && (
                                  <div className="p-2.5 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900/40 rounded-xl text-red-600 dark:text-red-400">
                                    <span className="font-black uppercase text-[8px] tracking-wider block mb-0.5">
                                      Alasan Penolakan (Tahap {req.rejectionStage === "executive" ? "Executive" : "HR"} oleh {req.rejectedBy || "Admin"}
                                      {req.rejectedAt ? ` • ${formatDateDisplay(req.rejectedAt)}` : ""}):
                                    </span>
                                    <p className="italic">&ldquo;{req.rejectionReason || "-"}&rdquo;</p>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: OVERTIME MANAGEMENT */}
      {false && (
        <div className="space-y-6">
          {/* Widget Info Tim Lembur Hari Ini / Tanggal Terpilih */}
          <div className="p-4 sm:p-5 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-purple-500/10 rounded-3xl border border-amber-500/20 shadow-sm space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/20 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                  <Users size={18} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black text-[var(--ab-text-main)] uppercase tracking-tight flex items-center gap-2">
                    Info Staf Lembur ({targetSummaryDate === todayDateStr ? "Hari Ini" : new Date(targetSummaryDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })})
                    <span className="text-[10px] font-black px-2 py-0.5 rounded-full bg-amber-500 text-white">
                      {targetDateOvertimes.length} Staf
                    </span>
                  </h3>
                  <p className="text-[10px] font-bold text-[var(--ab-text-dim)]">
                    Daftar karyawan yang memiliki jadwal atau pelaksanaan lembur pada tanggal ini
                  </p>
                </div>
              </div>
              {quickDateFilter !== "today" && (
                <button
                  onClick={() => {
                    setQuickDateFilter("today");
                    setFilterDate(todayDateStr);
                  }}
                  className="text-[10px] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-3 py-1.5 rounded-xl border border-amber-500/30 transition-colors w-fit self-end sm:self-center"
                >
                  Lihat Hari Ini
                </button>
              )}
            </div>

            {targetDateOvertimes.length === 0 ? (
              <div className="p-3.5 rounded-2xl bg-[var(--ab-bg-surface)] border border-[var(--ab-border)] text-center text-xs font-bold text-[var(--ab-text-dim)]">
                Tidak ada staf yang dijadwalkan lembur pada tanggal ini.
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {targetDateOvertimes.map((item) => (
                  <div
                    key={item.id}
                    onClick={() => setSelectedDetailOvertime(item)}
                    className="p-3 rounded-2xl bg-[var(--ab-bg-surface)] border border-[var(--ab-border)] hover:border-amber-500/40 hover:shadow-md transition-all cursor-pointer flex items-center justify-between gap-3 group"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black text-xs shrink-0 uppercase">
                        {item.userName ? item.userName.substring(0, 2) : "ST"}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-black text-[var(--ab-text-main)] truncate group-hover:text-amber-500 transition-colors">
                          {item.userName}
                        </p>
                        <p className="text-[9.5px] font-bold text-[var(--ab-text-dim)] truncate">
                          {formatScheduleRange(
                            item.approvedStartTime || item.requestedStartTime,
                            item.actualEndTime || item.approvedEndTime || item.requestedEndTime,
                            item.finalDurationMinutes || item.actualDurationMinutes || item.approvedDurationMinutes || item.requestedDurationMinutes
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      {item.status === "finalized" ? (
                        <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                          Final
                        </span>
                      ) : item.status === "reported" ? (
                        <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-600 border border-purple-500/20">
                          Lapor
                        </span>
                      ) : item.status === "approved" ? (
                        <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 border border-blue-500/20">
                          Disetujui
                        </span>
                      ) : (
                        <span className="text-[8px] font-black uppercase px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 border border-amber-500/20">
                          Review
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Search & Filter Toolbar */}
          <div className="p-3 sm:p-4 bg-[var(--ab-bg-surface)] rounded-2xl border border-[var(--ab-border)] shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
            {/* Search Box */}
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--ab-text-dim)]" />
              <input
                type="text"
                placeholder="Cari nama staf, divisi, atau tugas..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="ab-input pl-10 pr-8 text-xs py-2.5 rounded-xl w-full"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--ab-text-dim)] hover:text-[var(--ab-text-main)]"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Date Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setQuickDateFilter("all");
                  setFilterDate("");
                }}
                className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                  quickDateFilter === "all"
                    ? "bg-[var(--ab-primary)] text-white shadow-sm"
                    : "bg-[var(--ab-bg-main)] text-[var(--ab-text-dim)] hover:text-[var(--ab-text-main)] border border-[var(--ab-border)]"
                }`}
              >
                Semua Tanggal
              </button>

              <button
                type="button"
                onClick={() => {
                  setQuickDateFilter("today");
                  setFilterDate(todayDateStr);
                }}
                className={`px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all ${
                  quickDateFilter === "today"
                    ? "bg-amber-500 text-white shadow-sm"
                    : "bg-[var(--ab-bg-main)] text-[var(--ab-text-dim)] hover:text-[var(--ab-text-main)] border border-[var(--ab-border)]"
                }`}
              >
                Hari Ini
              </button>

              <div className="relative">
                <input
                  type="date"
                  value={filterDate}
                  onChange={(e) => {
                    setFilterDate(e.target.value);
                    setQuickDateFilter(e.target.value ? "custom" : "all");
                  }}
                  className={`ab-input text-xs py-1.5 px-3 rounded-xl cursor-pointer w-36 ${
                    quickDateFilter === "custom" ? "border-amber-500 text-amber-500 font-bold" : ""
                  }`}
                />
              </div>
            </div>
          </div>

          {/* Overtime Sub Tabs */}
          <div className="flex bg-[var(--ab-bg-main)] p-1.5 rounded-2xl border border-[var(--ab-border)] w-fit mx-auto shadow-inner flex-wrap justify-center gap-1">
            <button
              onClick={() => setOvertimeTab("pending")}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                overtimeTab === "pending"
                  ? "bg-amber-500 text-white shadow-md"
                  : "text-[var(--ab-text-dim)] hover:text-[var(--ab-text-main)]"
              }`}
            >
              1. Review Pengajuan ({filteredOvertimes.filter(o => o.status === "pending").length})
            </button>
            <button
              onClick={() => setOvertimeTab("reported")}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                overtimeTab === "reported"
                  ? "bg-purple-600 text-white shadow-md"
                  : "text-[var(--ab-text-dim)] hover:text-[var(--ab-text-main)]"
              }`}
            >
              2. Verifikasi Laporan ({filteredOvertimes.filter(o => o.status === "reported").length})
            </button>
            <button
              onClick={() => setOvertimeTab("finalized")}
              className={`px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
                overtimeTab === "finalized"
                  ? "bg-emerald-600 text-white shadow-md"
                  : "text-[var(--ab-text-dim)] hover:text-[var(--ab-text-main)]"
              }`}
            >
              3. Selesai / Finalized ({filteredOvertimes.filter(o => o.status === "finalized").length})
            </button>
          </div>

          {/* Sub Tab 1: Pending Review */}
          {overtimeTab === "pending" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredOvertimes.filter(o => o.status === "pending").length === 0 ? (
                <div className="col-span-full p-16 bg-[var(--ab-bg-surface)] rounded-3xl border border-[var(--ab-border)] text-center">
                  <Smile size={36} className="mx-auto text-[var(--ab-text-dim)] opacity-40 mb-2" />
                  <p className="text-xs font-black uppercase tracking-wider text-[var(--ab-text-dim)]">
                    Tidak ada pengajuan lembur yang pending sesuai filter
                  </p>
                </div>
              ) : (
                filteredOvertimes.filter(o => o.status === "pending").map((req) => (
                  <div key={req.id} className="bg-[var(--ab-bg-surface)] p-5 rounded-3xl border border-[var(--ab-border)] shadow-sm space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[9px] font-bold text-[var(--ab-text-dim)] uppercase tracking-widest">
                            {req.userDepartment || "Divisi Umum"}
                          </span>
                          <h4 className="text-base font-black text-[var(--ab-text-main)]">{req.userName}</h4>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          {new Date(req.overtimeDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>

                      <div className="p-3 bg-[var(--ab-bg-main)] rounded-2xl border border-[var(--ab-border)] flex items-center justify-between">
                        <div>
                          <span className="block text-[8px] font-black uppercase tracking-widest text-[var(--ab-text-dim)]">Jadwal Diminta Staf</span>
                          <span className="text-xs font-black text-[var(--ab-text-main)]">
                            {formatScheduleRange(req.requestedStartTime, req.requestedEndTime, req.requestedDurationMinutes)}
                          </span>
                        </div>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--ab-text-dim)]">Workload / Rencana Tugas:</span>
                        <div className="space-y-1">
                          {req.tasks.map((t, idx) => (
                            <div key={idx} className="flex items-center justify-between text-xs py-1 px-2.5 bg-[var(--ab-bg-main)]/60 rounded-lg">
                              <span className="font-bold text-[var(--ab-text-main)]">• {t.task}</span>
                              <span className="text-[9px] font-black text-[var(--ab-text-dim)]">{t.target}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {req.staffNotes && (
                        <div className="p-2.5 bg-slate-500/5 rounded-xl text-xs italic text-[var(--ab-text-dim)]">
                          &ldquo;{req.staffNotes}&rdquo;
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 pt-2 border-t border-[var(--ab-border)]/50">
                      <button
                        type="button"
                        onClick={() => setSelectedDetailOvertime(req)}
                        className="w-full py-2 bg-[var(--ab-bg-main)] hover:bg-[var(--ab-border)] text-[var(--ab-text-main)] font-black text-[10px] uppercase tracking-wider rounded-xl transition-all border border-[var(--ab-border)] flex items-center justify-center gap-1.5"
                      >
                        <Eye size={13} /> Lihat Detail Lengkap
                      </button>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleOpenApproveModal(req)}
                          className="flex-1 py-2.5 bg-green-500 hover:bg-green-600 text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-md"
                        >
                          <Check size={14} /> Review & Approve
                        </button>
                        <button
                          onClick={() => setRejectingReq(req)}
                          className="px-4 py-2.5 bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white font-black text-[10px] uppercase tracking-widest rounded-xl transition-all border border-red-500/20"
                        >
                          Tolak
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Sub Tab 2: Reported (Waiting Verification) */}
          {overtimeTab === "reported" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredOvertimes.filter(o => o.status === "reported").length === 0 ? (
                <div className="col-span-full p-16 bg-[var(--ab-bg-surface)] rounded-3xl border border-[var(--ab-border)] text-center">
                  <CheckCircle2 size={36} className="mx-auto text-[var(--ab-text-dim)] opacity-40 mb-2" />
                  <p className="text-xs font-black uppercase tracking-wider text-[var(--ab-text-dim)]">
                    Tidak ada laporan lembur yang menunggu verifikasi HR sesuai filter
                  </p>
                </div>
              ) : (
                filteredOvertimes.filter(o => o.status === "reported").map((req) => (
                  <div key={req.id} className="bg-[var(--ab-bg-surface)] p-5 rounded-3xl border border-[var(--ab-border)] shadow-sm space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[9px] font-bold text-[var(--ab-text-dim)] uppercase tracking-widest">
                            {req.userDepartment || "Divisi Umum"}
                          </span>
                          <h4 className="text-base font-black text-[var(--ab-text-main)]">{req.userName}</h4>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-purple-500/10 text-purple-500 border border-purple-500/20">
                          {new Date(req.overtimeDate).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                        </span>
                      </div>

                      {/* Compare Box */}
                      <div className="grid grid-cols-2 gap-2.5 p-3 bg-[var(--ab-bg-main)] rounded-2xl border border-[var(--ab-border)] text-center text-xs">
                        <div className="p-2.5 rounded-xl bg-[var(--ab-bg-surface)]">
                          <span className="block text-[8px] font-black uppercase tracking-widest text-[var(--ab-text-dim)]">Disetujui HR</span>
                          <span className="font-black text-blue-500 block mt-0.5">
                            {formatScheduleRange(req.approvedStartTime, req.approvedEndTime, req.approvedDurationMinutes)}
                          </span>
                        </div>
                        <div className="p-2.5 rounded-xl bg-[var(--ab-bg-surface)]">
                          <span className="block text-[8px] font-black uppercase tracking-widest text-[var(--ab-text-dim)]">Actual Selesai</span>
                          <span className="font-black text-purple-500 block mt-0.5">
                            {formatScheduleRange(req.actualStartTime, req.actualEndTime, req.actualDurationMinutes)}
                          </span>
                        </div>
                      </div>

                      {/* Task Reports */}
                      <div className="space-y-1.5">
                        <span className="text-[9px] font-black uppercase tracking-widest text-[var(--ab-text-dim)]">Laporan Hasil Kerja:</span>
                        <div className="space-y-1.5">
                          {(req.taskReports || []).map((tr, idx) => (
                            <div key={idx} className="p-2.5 bg-[var(--ab-bg-main)] rounded-xl border border-[var(--ab-border)] text-xs space-y-1">
                              <div className="flex justify-between items-center font-bold text-[var(--ab-text-main)]">
                                <span>• {tr.task}</span>
                                <span className={tr.status === "completed" ? "text-emerald-500" : "text-amber-500"}>
                                  {tr.status === "completed" ? "✅ Selesai 100%" : "⏳ Sebagian"}
                                </span>
                              </div>
                              <div className="flex justify-between items-center text-[10px] text-[var(--ab-text-dim)]">
                                <span>Target: {tr.target}</span>
                                <span className="font-black text-[var(--ab-text-main)]">Hasil: {tr.actualResult || "-"}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {req.staffReportNotes && (
                        <div className="p-2.5 bg-purple-500/5 border border-purple-500/10 rounded-xl text-xs text-purple-600 dark:text-purple-400 space-y-0.5">
                          <span className="font-black uppercase text-[8px] tracking-widest">Catatan Staf:</span>
                          <p className="font-medium italic">&ldquo;{req.staffReportNotes}&rdquo;</p>
                        </div>
                      )}

                      {/* Bukti Foto Kerja */}
                      {req.proofImages && req.proofImages.length > 0 && (
                        <div className="space-y-1.5 p-3 bg-[var(--ab-bg-main)] rounded-2xl border border-[var(--ab-border)]">
                          <span className="text-[9px] font-black uppercase tracking-widest text-[var(--ab-text-dim)] flex items-center gap-1.5">
                            <ImageIcon size={13} className="text-purple-500" /> Foto Bukti Pekerjaan ({req.proofImages.length} Foto):
                          </span>
                          <div className="flex items-center gap-2.5 flex-wrap">
                            {req.proofImages.map((imgUrl, imgIdx) => (
                              <div
                                key={imgIdx}
                                onClick={() => setPreviewImageUrl(imgUrl)}
                                className="relative w-24 h-16 rounded-xl overflow-hidden border border-[var(--ab-border)] bg-black/10 cursor-pointer hover:opacity-90 hover:scale-105 transition-all group shadow-sm"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                  src={imgUrl}
                                  alt={`Bukti ${imgIdx + 1}`}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                  <Eye size={16} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-2 pt-2 border-t border-[var(--ab-border)]/50">
                      <button
                        type="button"
                        onClick={() => setSelectedDetailOvertime(req)}
                        className="w-full py-2 bg-[var(--ab-bg-main)] hover:bg-[var(--ab-border)] text-[var(--ab-text-main)] font-black text-[10px] uppercase tracking-wider rounded-xl transition-all border border-[var(--ab-border)] flex items-center justify-center gap-1.5"
                      >
                        <Eye size={13} /> Lihat Detail Lengkap
                      </button>
                      <button
                        onClick={() => handleOpenFinalizeModal(req)}
                        className="w-full py-3 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg hover:opacity-95 transition-all flex items-center justify-center gap-2"
                      >
                        <ClipboardCheck size={16} /> Verifikasi & Tentukan Durasi Final
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {/* Sub Tab 3: Finalized */}
          {overtimeTab === "finalized" && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {filteredOvertimes.filter(o => o.status === "finalized").length === 0 ? (
                <div className="col-span-full p-16 bg-[var(--ab-bg-surface)] rounded-3xl border border-[var(--ab-border)] text-center">
                  <p className="text-xs font-black uppercase tracking-wider text-[var(--ab-text-dim)]">
                    Belum ada riwayat lembur yang difinalisasi sesuai filter
                  </p>
                </div>
              ) : (
                filteredOvertimes.filter(o => o.status === "finalized").map((req) => (
                  <div key={req.id} className="bg-[var(--ab-bg-surface)] p-5 rounded-3xl border border-[var(--ab-border)] shadow-sm space-y-4 flex flex-col justify-between">
                    <div className="space-y-3">
                      <div className="flex justify-between items-start">
                        <div>
                          <span className="text-[9px] font-bold text-[var(--ab-text-dim)] uppercase tracking-widest">
                            {req.userDepartment || "Divisi Umum"}
                          </span>
                          <h4 className="text-base font-black text-[var(--ab-text-main)]">{req.userName}</h4>
                        </div>
                        <span className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                          Final: {formatDurationDetail(req.finalDurationMinutes || 0)}
                        </span>
                      </div>

                      <div className="p-3 bg-[var(--ab-bg-main)] rounded-2xl border border-[var(--ab-border)] space-y-2 text-xs">
                        <div className="flex items-center justify-between border-b border-[var(--ab-border)] pb-1.5">
                          <span className="text-[9px] font-bold text-[var(--ab-text-dim)]">Tanggal Lembur:</span>
                          <p className="font-black text-[var(--ab-text-main)]">
                            {new Date(req.overtimeDate).toLocaleDateString("id-ID", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                          </p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-center pt-1">
                          <div className="p-2 bg-[var(--ab-bg-surface)] rounded-xl border border-[var(--ab-border)]">
                            <span className="block text-[8px] font-black uppercase tracking-widest text-[var(--ab-text-dim)]">Jadwal HR</span>
                            <span className="font-bold text-blue-500 text-[11px] block mt-0.5">
                              {formatScheduleRange(req.approvedStartTime, req.approvedEndTime, req.approvedDurationMinutes)}
                            </span>
                          </div>
                          <div className="p-2 bg-[var(--ab-bg-surface)] rounded-xl border border-[var(--ab-border)]">
                            <span className="block text-[8px] font-black uppercase tracking-widest text-[var(--ab-text-dim)]">Aktual Staf</span>
                            <span className="font-bold text-purple-500 text-[11px] block mt-0.5">
                              {formatScheduleRange(req.actualStartTime, req.actualEndTime, req.actualDurationMinutes)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Bukti Foto Finalized */}
                      {req.proofImages && req.proofImages.length > 0 && (
                        <div className="space-y-1.5 pt-1">
                          <span className="text-[8px] font-black uppercase tracking-widest text-[var(--ab-text-dim)] flex items-center gap-1">
                            <ImageIcon size={11} className="text-purple-500" /> Foto Bukti ({req.proofImages.length}):
                          </span>
                          <div className="flex items-center gap-2 flex-wrap">
                            {req.proofImages.map((imgUrl, imgIdx) => (
                              <div
                                key={imgIdx}
                                onClick={() => setPreviewImageUrl(imgUrl)}
                                className="relative w-16 h-11 rounded-xl overflow-hidden border border-[var(--ab-border)] bg-black/10 cursor-pointer hover:scale-105 transition-transform group shadow-sm"
                              >
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img src={imgUrl} alt="Bukti" className="w-full h-full object-cover" />
                                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                  <Eye size={14} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {req.finalNotes && (
                        <div className="p-2.5 bg-emerald-500/5 rounded-xl border border-emerald-500/10 text-xs italic text-[var(--ab-text-dim)]">
                          Catatan HR: &ldquo;{req.finalNotes}&rdquo;
                        </div>
                      )}
                    </div>

                    <div className="pt-2 border-t border-[var(--ab-border)]/50">
                      <button
                        type="button"
                        onClick={() => setSelectedDetailOvertime(req)}
                        className="w-full py-2.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-black text-[10px] uppercase tracking-wider rounded-xl transition-all border border-emerald-500/30 flex items-center justify-center gap-1.5"
                      >
                        <Eye size={13} /> Lihat Detail Lengkap (Semua Tahap)
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* MODAL 1: APPROVE & ADJUST JADWAL LEMBUR */}
      {adjustingReq && mounted && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[99999] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto overscroll-contain animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setAdjustingReq(null);
          }}
        >
          <div className="w-full max-w-sm sm:max-w-md my-auto bg-[var(--ab-bg-surface)] rounded-[32px] p-5 sm:p-7 border border-[var(--ab-border)] shadow-2xl ab-animate-scaleIn max-h-[90vh] overflow-y-auto space-y-5 relative">
            <div className="flex justify-between items-center border-b border-[var(--ab-border)] pb-3">
              <div>
                <h3 className="text-base font-black text-[var(--ab-text-main)] uppercase tracking-tight">
                  Review & Setujui Lembur
                </h3>
                <p className="text-[10px] font-bold text-[var(--ab-text-dim)] uppercase tracking-widest">
                  {adjustingReq.userName} ({adjustingReq.userDepartment})
                </p>
              </div>
              <button
                type="button"
                onClick={() => setAdjustingReq(null)}
                className="p-2 rounded-full text-[var(--ab-text-dim)] hover:text-[var(--ab-text-main)] hover:bg-[var(--ab-bg-main)] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="p-3.5 bg-[var(--ab-bg-main)] rounded-2xl border border-[var(--ab-border)] text-xs space-y-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-[var(--ab-text-dim)]">Permintaan Awal Staf:</span>
              <p className="font-black text-amber-500">
                {formatScheduleRange(
                  adjustingReq.requestedStartTime,
                  adjustingReq.requestedEndTime,
                  adjustingReq.requestedDurationMinutes,
                  adjustingReq.calculationBreakdown?.startDate || adjustingReq.overtimeDate,
                  adjustingReq.calculationBreakdown?.endDate || adjustingReq.overtimeDate
                )}
              </p>
            </div>

            {/* HR Adjust Time Inputs */}
            <div className="space-y-3">
              <label className="text-[10px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest block">
                Sesuaikan Waktu yang Disetujui HR
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Mulai */}
                <div className="p-3 bg-[var(--ab-bg-main)] rounded-2xl border border-[var(--ab-border)] space-y-2">
                  <span className="text-[9px] font-bold text-[var(--ab-text-dim)] block">Mulai Disetujui:</span>
                  <input
                    type="date"
                    value={adjustStartDate}
                    onChange={(e) => setAdjustStartDate(e.target.value)}
                    className="ab-input text-xs py-2 w-full"
                  />
                  <input
                    type="time"
                    value={adjustStartTime}
                    onChange={(e) => setAdjustStartTime(e.target.value)}
                    className="ab-input text-xs font-black py-2 px-3 rounded-xl text-center w-full"
                  />
                </div>

                {/* Selesai */}
                <div className="p-3 bg-[var(--ab-bg-main)] rounded-2xl border border-[var(--ab-border)] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] font-bold text-[var(--ab-text-dim)] block">Selesai Disetujui:</span>
                    <button
                      type="button"
                      onClick={() => setAdjustEndDate(adjustEndDate === adjustStartDate ? addDaysToDate(adjustStartDate, 1) : adjustStartDate)}
                      className="text-[9px] font-black text-purple-600 dark:text-purple-400 uppercase tracking-wider flex items-center gap-1 hover:underline"
                    >
                      <Moon size={10} /> {adjustEndDate === adjustStartDate ? "+1 Hr" : "Hari Sama"}
                    </button>
                  </div>
                  <input
                    type="date"
                    value={adjustEndDate}
                    min={adjustStartDate}
                    onChange={(e) => setAdjustEndDate(e.target.value)}
                    className="ab-input text-xs py-2 w-full"
                  />
                  <input
                    type="time"
                    value={adjustEndTime}
                    onChange={(e) => {
                      const newEnd = e.target.value;
                      setAdjustEndTime(newEnd);
                      if (newEnd < adjustStartTime && adjustEndDate === adjustStartDate) {
                        setAdjustEndDate(addDaysToDate(adjustStartDate, 1));
                      }
                    }}
                    className="ab-input text-xs font-black py-2 px-3 rounded-xl text-center w-full"
                  />
                </div>
              </div>
              <div className="p-2.5 bg-blue-500/10 border border-blue-500/20 rounded-xl text-center text-xs font-black text-blue-600 dark:text-blue-400">
                Durasi Disetujui: {formatDurationDetail(calcOvertimeDurationMinutes(adjustStartDate, adjustStartTime, adjustEndDate, adjustEndTime))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest">
                Catatan Persetujuan HR (Opsional)
              </label>
              <textarea
                rows={2}
                value={adjustNotes}
                onChange={(e) => setAdjustNotes(e.target.value)}
                placeholder="Catatan penyesuaian jam atau target tambahan..."
                className="ab-input text-xs w-full py-2.5 px-3 rounded-xl resize-none"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setAdjustingReq(null)}
                className="w-full sm:flex-1 py-3.5 bg-[var(--ab-bg-main)] text-[var(--ab-text-dim)] font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-[var(--ab-border)] transition-all border border-[var(--ab-border)]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleApproveOvertime}
                className="w-full sm:flex-1 py-3.5 bg-green-500 hover:bg-green-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg transition-all flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Check size={14} /> Approve Jadwal
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL 2: FINALIZE OVERTIME */}
      {finalizingReq && mounted && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[99999] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto overscroll-contain animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setFinalizingReq(null);
          }}
        >
          <div className="w-full max-w-sm sm:max-w-md my-auto bg-[var(--ab-bg-surface)] rounded-[32px] p-5 sm:p-7 border border-[var(--ab-border)] shadow-2xl ab-animate-scaleIn max-h-[90vh] overflow-y-auto space-y-5 relative">
            <div className="flex justify-between items-center border-b border-[var(--ab-border)] pb-3">
              <div>
                <h3 className="text-base font-black text-[var(--ab-text-main)] uppercase tracking-tight">
                  Penetapan Durasi Final Lembur
                </h3>
                <p className="text-[10px] font-bold text-[var(--ab-text-dim)] uppercase tracking-widest">
                  {finalizingReq.userName} • {finalizingReq.overtimeDate}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setFinalizingReq(null)}
                className="p-2 rounded-full text-[var(--ab-text-dim)] hover:text-[var(--ab-text-main)] hover:bg-[var(--ab-bg-main)] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-2 text-xs text-center p-3.5 bg-[var(--ab-bg-main)] rounded-2xl border border-[var(--ab-border)]">
              <div>
                <span className="text-[8px] font-black uppercase tracking-widest text-[var(--ab-text-dim)]">Approved HR</span>
                <p className="font-black text-blue-500 block mt-0.5">
                  {formatScheduleRange(finalizingReq.approvedStartTime, finalizingReq.approvedEndTime, finalizingReq.approvedDurationMinutes)}
                </p>
              </div>
              <div>
                <span className="text-[8px] font-black uppercase tracking-widest text-[var(--ab-text-dim)]">Actual Staf</span>
                <p className="font-black text-purple-500 block mt-0.5">
                  {formatScheduleRange(finalizingReq.actualStartTime, finalizingReq.actualEndTime, finalizingReq.actualDurationMinutes)}
                </p>
              </div>
            </div>

            {/* Proof Images in Finalize Modal */}
            {finalizingReq.proofImages && finalizingReq.proofImages.length > 0 && (
              <div className="space-y-1.5 p-3 bg-[var(--ab-bg-main)] rounded-2xl border border-[var(--ab-border)]">
                <span className="text-[9px] font-black uppercase tracking-widest text-[var(--ab-text-dim)] flex items-center gap-1.5">
                  <ImageIcon size={13} className="text-purple-500" /> Foto Bukti Pekerjaan ({finalizingReq.proofImages.length}):
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  {finalizingReq.proofImages.map((imgUrl, imgIdx) => (
                    <div
                      key={imgIdx}
                      onClick={() => setPreviewImageUrl(imgUrl)}
                      className="relative w-20 h-14 rounded-xl overflow-hidden border border-[var(--ab-border)] bg-black/10 cursor-pointer hover:opacity-90 hover:scale-105 transition-all group shadow-sm"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imgUrl}
                        alt={`Bukti ${imgIdx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Eye size={14} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Input Final Durasi */}
            <div className="space-y-2">
              <label className="text-[10px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest block">
                Keputusan Durasi Final yang Diakui
              </label>
              <div className="flex items-center gap-3">
                <div className="flex-1 space-y-1">
                  <span className="text-[9px] font-bold text-[var(--ab-text-dim)]">Jam:</span>
                  <input
                    type="number"
                    min="0"
                    max="24"
                    value={finalHours}
                    onChange={(e) => setFinalHours(Math.max(0, Number(e.target.value)))}
                    className="ab-input text-sm font-black py-2.5 px-3 rounded-xl text-center"
                  />
                </div>
                <div className="flex-1 space-y-1">
                  <span className="text-[9px] font-bold text-[var(--ab-text-dim)]">Menit:</span>
                  <input
                    type="number"
                    min="0"
                    max="59"
                    value={finalMinutes}
                    onChange={(e) => setFinalMinutes(Math.max(0, Math.min(59, Number(e.target.value))))}
                    className="ab-input text-sm font-black py-2.5 px-3 rounded-xl text-center"
                  />
                </div>
              </div>
              <p className="text-xs font-black text-emerald-500 text-center pt-1">
                Total Final: {formatMinutes(finalHours * 60 + finalMinutes)}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest">
                Catatan Keputusan HR
              </label>
              <textarea
                rows={2}
                value={finalNotes}
                onChange={(e) => setFinalNotes(e.target.value)}
                placeholder="Alasan durasi diakui penuh / dipotong sesuai evaluasi..."
                className="ab-input text-xs w-full py-2.5 px-3 rounded-xl resize-none"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setFinalizingReq(null)}
                className="w-full sm:flex-1 py-3.5 bg-[var(--ab-bg-main)] text-[var(--ab-text-dim)] font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-[var(--ab-border)] transition-all border border-[var(--ab-border)]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleFinalizeOvertime}
                className="w-full sm:flex-1 py-3.5 bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg transition-all flex items-center justify-center gap-1.5 active:scale-95"
              >
                <Check size={14} /> Simpan Durasi Final
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Reject Dialog Prompt */}
      <PromptDialog
        isOpen={!!rejectingReq}
        title="Tolak Pengajuan Lembur"
        message={`Masukkan alasan mengapa pengajuan lembur dari ${rejectingReq?.userName} ditolak:`}
        placeholder="Cth: Workload tidak memenuhi syarat lembur, deadline bukan hari ini..."
        onConfirm={handleRejectOvertime}
        onCancel={() => setRejectingReq(null)}
      />

      {/* MODAL: APPROVE LEAVE (2-LAYER) */}
      {leaveApproveModal && mounted && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[99999] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto overscroll-contain animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLeaveApproveModal(null);
          }}
        >
          <div className="w-full max-w-sm sm:max-w-md my-auto bg-[var(--ab-bg-surface)] rounded-[32px] p-5 sm:p-7 border border-[var(--ab-border)] shadow-2xl ab-animate-scaleIn max-h-[90vh] overflow-y-auto space-y-5 relative">
            <div className="flex justify-between items-center border-b border-[var(--ab-border)] pb-3">
              <div>
                <h3 className="text-base font-black text-[var(--ab-text-main)] uppercase tracking-tight flex items-center gap-2">
                  {leaveApproveModal.layer === "executive" ? (
                    <>
                      <Shield className="text-emerald-500" size={18} />
                      Persetujuan Executive (Tahap 1)
                    </>
                  ) : (
                    <>
                      <Sparkles className="text-blue-500" size={18} />
                      Persetujuan Final HR (Tahap 2)
                    </>
                  )}
                </h3>
                <p className="text-[10px] font-bold text-[var(--ab-text-dim)] uppercase tracking-widest mt-0.5">
                  {leaveApproveModal.req.userName} • {typeLabel(leaveApproveModal.req.type)} ({leaveApproveModal.req.dates.length} Hari)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLeaveApproveModal(null)}
                className="p-2 rounded-full text-[var(--ab-text-dim)] hover:text-[var(--ab-text-main)] hover:bg-[var(--ab-bg-main)] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Request Summary */}
            <div className="space-y-2 p-3 bg-[var(--ab-bg-main)] rounded-2xl border border-[var(--ab-border)] text-xs">
              <div className="flex items-start gap-2">
                <CalendarDays size={14} className="mt-0.5 shrink-0 text-emerald-500" />
                <div>
                  <span className="text-[9px] font-black uppercase text-[var(--ab-text-dim)] block">Tanggal:</span>
                  <span className="font-bold text-[var(--ab-text-main)]">{leaveApproveModal.req.dates.join(", ")}</span>
                </div>
              </div>
              <div className="flex items-start gap-2 pt-1 border-t border-[var(--ab-border)]">
                <FileEdit size={14} className="mt-0.5 shrink-0 text-slate-400" />
                <div>
                  <span className="text-[9px] font-black uppercase text-[var(--ab-text-dim)] block">Alasan:</span>
                  <span className="italic text-[var(--ab-text-dim)]">&ldquo;{leaveApproveModal.req.reason}&rdquo;</span>
                </div>
              </div>
            </div>

            {/* Note about layer */}
            {leaveApproveModal.layer === "executive" ? (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                Setelah Anda menyetujui, pengajuan akan diteruskan ke tim HR untuk persetujuan akhir dan pemotongan kuota cuti.
              </div>
            ) : (
              <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-2xl text-[10px] font-bold text-blue-700 dark:text-blue-300">
                Persetujuan HR ini merupakan tahap akhir. Kuota cuti/sakit karyawan akan langsung dipotong secara otomatis.
              </div>
            )}

            {/* Input Notes (Optional) */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest flex items-center justify-between">
                <span>Catatan {leaveApproveModal.layer === "executive" ? "Executive" : "HR"} (Opsional)</span>
                <span className="text-[9px] text-[var(--ab-text-dim)] opacity-60">Terlihat oleh staf</span>
              </label>
              <textarea
                rows={3}
                value={leaveApproveNotes}
                onChange={(e) => setLeaveApproveNotes(e.target.value)}
                placeholder="Tuliskan catatan, pesan, atau arahan untuk staf..."
                className="ab-input text-xs w-full py-2.5 px-3 rounded-xl resize-none"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setLeaveApproveModal(null)}
                className="w-full sm:flex-1 py-3.5 bg-[var(--ab-bg-main)] text-[var(--ab-text-dim)] font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-[var(--ab-border)] transition-all border border-[var(--ab-border)]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmApproveLeave}
                className={`w-full sm:flex-1 py-3.5 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg transition-all flex items-center justify-center gap-1.5 active:scale-95 ${
                  leaveApproveModal.layer === "executive"
                    ? "bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/30"
                    : "bg-blue-600 hover:bg-blue-700 shadow-blue-600/30"
                }`}
              >
                <Check size={14} /> {leaveApproveModal.layer === "executive" ? "Setujui Executive" : "Setujui Final HR"}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* MODAL: REJECT LEAVE (2-LAYER) */}
      {leaveRejectModal && mounted && typeof document !== "undefined" && createPortal(
        <div
          className="fixed inset-0 z-[99999] bg-slate-950/75 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto overscroll-contain animate-in fade-in duration-200"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLeaveRejectModal(null);
          }}
        >
          <div className="w-full max-w-sm sm:max-w-md my-auto bg-[var(--ab-bg-surface)] rounded-[32px] p-5 sm:p-7 border border-[var(--ab-border)] shadow-2xl ab-animate-scaleIn max-h-[90vh] overflow-y-auto space-y-5 relative">
            <div className="flex justify-between items-center border-b border-[var(--ab-border)] pb-3">
              <div>
                <h3 className="text-base font-black text-red-500 uppercase tracking-tight flex items-center gap-2">
                  <X className="text-red-500" size={18} />
                  Tolak Pengajuan ({leaveRejectModal.layer === "executive" ? "Executive" : "HR"})
                </h3>
                <p className="text-[10px] font-bold text-[var(--ab-text-dim)] uppercase tracking-widest mt-0.5">
                  {leaveRejectModal.req.userName} • {typeLabel(leaveRejectModal.req.type)} ({leaveRejectModal.req.dates.length} Hari)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setLeaveRejectModal(null)}
                className="p-2 rounded-full text-[var(--ab-text-dim)] hover:text-[var(--ab-text-main)] hover:bg-[var(--ab-bg-main)] transition-colors"
              >
                <X size={18} />
              </button>
            </div>

            {/* Input Rejection Reason (Required) */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest flex items-center justify-between">
                <span>Alasan Penolakan <span className="text-red-500">*</span></span>
                <span className="text-[9px] text-[var(--ab-text-dim)] opacity-60">Wajib diisi</span>
              </label>
              <textarea
                rows={3}
                value={leaveRejectReason}
                onChange={(e) => setLeaveRejectReason(e.target.value)}
                placeholder="Jelaskan alasan penolakan secara jelas agar staf dapat memahami..."
                className="ab-input text-xs w-full py-2.5 px-3 rounded-xl resize-none"
              />
            </div>

            <div className="flex flex-col-reverse sm:flex-row gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setLeaveRejectModal(null)}
                className="w-full sm:flex-1 py-3.5 bg-[var(--ab-bg-main)] text-[var(--ab-text-dim)] font-black text-xs uppercase tracking-widest rounded-2xl hover:bg-[var(--ab-border)] transition-all border border-[var(--ab-border)]"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmRejectLeave}
                className="w-full sm:flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg shadow-red-600/30 transition-all flex items-center justify-center gap-1.5 active:scale-95"
              >
                <X size={14} /> Tolak Pengajuan
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <ConfirmDialog
        isOpen={!!confirmCfg}
        title={confirmCfg?.title ?? "Konfirmasi"}
        message={confirmCfg?.msg ?? ""}
        type={confirmCfg?.type ?? "warning"}
        onConfirm={confirmCfg?.onConfirm ?? (() => {})}
        onCancel={() => setConfirmCfg(null)}
      />

      {/* Overtime Full Detail Modal */}
      <OvertimeDetailModal
        isOpen={!!selectedDetailOvertime}
        overtime={selectedDetailOvertime}
        onClose={() => setSelectedDetailOvertime(null)}
        onPreviewImage={(url) => setPreviewImageUrl(url)}
      />

      {/* Image Preview Lightbox */}
      <ImageLightboxModal
        imageUrl={previewImageUrl}
        onClose={() => setPreviewImageUrl(null)}
      />
    </div>
  );
}
