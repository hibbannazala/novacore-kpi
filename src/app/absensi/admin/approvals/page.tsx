"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import ConfirmDialog from "@/components/absensi/ConfirmDialog";
import {
  Check, X, CalendarDays, FileEdit, Smile, Shield, ArrowRight,
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
  cancellationRequested?: boolean;
  cancellationReason?: string | null;
  deductedSick?: number;
  deductedLeave?: number;
  status?: string;
  departmentName?: string;
}

type ConfirmCfg = {
  title: string;
  msg: string;
  type: "info" | "warning" | "danger";
  onConfirm: () => Promise<void>;
} | null;

export default function AdminApprovalsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [pendingReqs, setPendingReqs] = useState<PendingRequest[]>([]);
  const [cancelReqs, setCancelReqs] = useState<PendingRequest[]>([]);
  const [pendingStaffCount, setPendingStaffCount] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmCfg, setConfirmCfg] = useState<ConfirmCfg>(null);

  useEffect(() => {
    const supabase = createClient();

    const fetchPending = async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*, users(id, name, email, departments(name))")
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      setPendingReqs(
        (data ?? []).map((r) => {
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
        };
      })
      );
      setIsLoading(false);
    };

    const fetchCancel = async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*, users(id, name, email, departments(name))")
        .eq("status", "approved")
        .eq("cancellation_requested", true);

      setCancelReqs(
        (data ?? []).map((r) => {
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
          cancellationReason: r.cancellation_reason as string | null,
          deductedSick: (r.deducted_sick as number) ?? 0,
          deductedLeave: (r.deducted_leave as number) ?? 0,
        };
      })
      );
    };

    const fetchPendingStaff = async () => {
      const { count } = await supabase
        .from("users")
        .select("id", { count: "exact", head: true })
        .eq("absensi_status", "pending");
      setPendingStaffCount(count ?? 0);
    };

    Promise.all([fetchPending(), fetchCancel(), fetchPendingStaff()]);

    const ch = supabase
      .channel("admin_approvals")
      .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, () => {
        fetchPending();
        fetchCancel();
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, fetchPendingStaff)
      .subscribe();

    return () => { ch.unsubscribe(); };
  }, []);

  const processRequest = (req: PendingRequest, action: "approve" | "reject") => {
    setConfirmCfg({
      title: action === "approve" ? "Konfirmasi Persetujuan" : "Konfirmasi Penolakan",
      msg: `Yakin ingin ${action === "approve" ? "menyetujui" : "menolak"} pengajuan ${req.type} dari ${req.userName}?`,
      type: action === "approve" ? "warning" : "danger",
      onConfirm: async () => {
        const tid = toast.loading("Memproses pengajuan...");
        try {
          const supabase = createClient();
          const { error } = await supabase.rpc("process_leave_request", {
            p_request_id: req.id,
            p_action: action,
            p_admin_name: user?.name ?? "Admin",
          });
          if (error) throw error;
          toast.success("Berhasil memproses pengajuan.", { id: tid });
        } catch (err: unknown) {
          toast.error("Gagal: " + (err instanceof Error ? err.message : "Unknown error"), { id: tid });
        } finally {
          setConfirmCfg(null);
        }
      },
    });
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

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-black text-[var(--ab-text-main)] uppercase tracking-tight">
            Persetujuan Cuti & Izin
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

      {/* Pending Requests */}
      <div className="space-y-8 pb-4">
        {isLoading ? (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="animate-pulse bg-[var(--ab-bg-surface)] p-6 rounded-[32px] border border-[var(--ab-border)] h-48" />
            ))}
          </div>
        ) : pendingReqs.length === 0 ? (
          <div className="p-20 text-center ab-animate-scaleIn">
            <div className="w-16 h-16 bg-[var(--ab-bg-surface)] rounded-[20px] flex items-center justify-center mx-auto mb-4 text-[var(--ab-text-dim)]">
              <Smile size={32} />
            </div>
            <h4 className="text-[10px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest italic">
              Semua pengajuan sudah diproses. Aman!
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
                {reqs.map((req) => (
                  <div
                    key={req.id}
                    className="bg-[var(--ab-bg-surface)] p-5 rounded-[32px] border border-[var(--ab-border)] shadow-sm flex flex-col justify-between gap-5 relative overflow-hidden"
                  >
                    <div className="space-y-4">
                      <div className="flex justify-between items-start">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${typeStyle(req.type)}`}>
                              {typeLabel(req.type)}
                            </span>
                            <span className="text-[8px] font-black text-[var(--ab-text-dim)] uppercase tracking-widest">
                              {new Date(req.createdAt).toLocaleDateString("id-ID")}
                            </span>
                          </div>
                          <h4 className="font-black text-[var(--ab-text-main)] text-base tracking-tight">{req.userName}</h4>
                        </div>
                        <div className="text-right">
                          <p className="text-[8px] font-black text-[var(--ab-text-dim)] uppercase tracking-widest leading-none">Durasi</p>
                          <p className="text-sm font-black mt-0.5" style={{ color: "var(--ab-primary)" }}>
                            {req.dates.length} Hari
                          </p>
                        </div>
                      </div>
                      <div className="space-y-3">
                        <div className="flex items-start gap-2 text-[10px] font-bold text-[var(--ab-text-dim)] bg-[var(--ab-bg-main)] p-3 rounded-2xl border border-[var(--ab-border)]">
                          <CalendarDays size={12} className="mt-0.5 shrink-0" style={{ color: "var(--ab-primary)" }} />
                          <span className="leading-relaxed">{req.dates.join(", ")}</span>
                        </div>
                        <div className="flex items-start gap-2 text-[10px] font-medium text-[var(--ab-text-dim)] italic px-2">
                          <FileEdit size={12} className="mt-1 text-[var(--ab-text-dim)] shrink-0 opacity-40" />
                          <span className="line-clamp-2">&ldquo;{req.reason}&rdquo;</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => processRequest(req, "approve")}
                        className="flex-1 bg-green-500 text-white py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-green-600 transition shadow-lg flex items-center justify-center gap-2"
                      >
                        <Check size={14} /> Setujui
                      </button>
                      <button
                        onClick={() => processRequest(req, "reject")}
                        className="flex-1 bg-[var(--ab-bg-main)] text-red-500 border border-[var(--ab-border)] py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-500 hover:text-white transition flex items-center justify-center gap-2"
                      >
                        <X size={14} /> Tolak
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Cancellation Requests */}
      {cancelReqs.length > 0 && (
        <div className="space-y-4 mt-8">
          <div className="flex items-center gap-3">
            <h2 className="text-xl font-black text-[var(--ab-text-main)] uppercase tracking-tight">Permohonan Batal Cuti</h2>
          </div>
          <div className="space-y-8">
            {Object.entries(groupedCancel).map(([deptName, reqs]) => (
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
                      <div className="absolute top-0 right-0 w-24 h-24 bg-red-100 dark:bg-red-900/30 rounded-bl-[64px] -z-10" />
                      <div className="space-y-4 relative z-10">
                        <div className="flex justify-between items-start">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest bg-red-100 text-red-600 dark:bg-red-900/40 dark:text-red-400">
                                Batal Cuti
                              </span>
                              <span className="text-[8px] font-black text-red-400 uppercase tracking-widest">
                                {new Date(req.createdAt).toLocaleDateString("id-ID")}
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
            ))}
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={!!confirmCfg}
        title={confirmCfg?.title ?? "Konfirmasi"}
        message={confirmCfg?.msg ?? ""}
        type={confirmCfg?.type ?? "warning"}
        onConfirm={confirmCfg?.onConfirm ?? (() => {})}
        onCancel={() => setConfirmCfg(null)}
      />
    </div>
  );
}
