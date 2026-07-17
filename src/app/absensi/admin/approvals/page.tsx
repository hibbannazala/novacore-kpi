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
        .select("*, users(id, name, email)")
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      setPendingReqs(
        (data ?? []).map((r) => ({
          id: r.id as string,
          userId: r.user_id as string,
          userName: ((r.users as unknown) as { name: string } | null)?.name ?? "Unknown",
          type: r.type as string,
          dates: (r.dates as string[]) ?? [],
          reason: (r.reason as string) ?? "",
          createdAt: r.created_at as string,
        }))
      );
      setIsLoading(false);
    };

    const fetchCancel = async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*, users(id, name, email)")
        .eq("status", "approved")
        .eq("cancellation_requested", true);

      setCancelReqs(
        (data ?? []).map((r) => ({
          id: r.id as string,
          userId: r.user_id as string,
          userName: ((r.users as unknown) as { name: string } | null)?.name ?? "Unknown",
          type: r.type as string,
          dates: (r.dates as string[]) ?? [],
          reason: (r.reason as string) ?? "",
          createdAt: r.created_at as string,
          cancellationReason: r.cancellation_reason as string | null,
          deductedSick: (r.deducted_sick as number) ?? 0,
          deductedLeave: (r.deducted_leave as number) ?? 0,
        }))
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
        ? "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/20 dark:border-rose-800"
        : "bg-purple-50 text-purple-600 border-purple-100 dark:bg-purple-900/20 dark:border-purple-800";

  const typeLabel = (t: string) =>
    t === "leave" ? "Cuti" : t === "sick" ? "Sakit" : "WFA";

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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-4">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse bg-[var(--ab-bg-surface)] p-6 rounded-[32px] border border-[var(--ab-border)] h-48" />
          ))
        ) : pendingReqs.length === 0 ? (
          <div className="col-span-full p-20 text-center ab-animate-scaleIn">
            <div className="w-16 h-16 bg-[var(--ab-bg-surface)] rounded-[20px] flex items-center justify-center mx-auto mb-4 text-[var(--ab-text-dim)]">
              <Smile size={32} />
            </div>
            <h4 className="text-[10px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest italic">
              Semua pengajuan sudah diproses. Aman!
            </h4>
          </div>
        ) : (
          pendingReqs.map((req) => (
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
          ))
        )}
      </div>

      {/* Cancellation Requests */}
      {cancelReqs.length > 0 && (
        <>
          <div className="flex items-center gap-4 mt-8">
            <h2 className="text-xl font-black text-orange-600 uppercase tracking-tight">Pengajuan Pembatalan</h2>
            <div className="bg-orange-100 dark:bg-orange-900/20 text-orange-600 px-3 py-1 rounded-full text-[10px] font-black border border-orange-200 dark:border-orange-800">
              {cancelReqs.length} MENUNGGU
            </div>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pb-10">
            {cancelReqs.map((req) => (
              <div
                key={`cancel-${req.id}`}
                className="bg-orange-50 dark:bg-orange-900/10 p-5 rounded-[32px] border border-orange-200 dark:border-orange-900/30 flex flex-col justify-between gap-5"
              >
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-widest border ${typeStyle(req.type)}`}>
                      {typeLabel(req.type)}
                    </span>
                    <span className="text-[8px] font-black text-orange-500 uppercase tracking-widest bg-orange-100 dark:bg-orange-900/30 px-2 py-0.5 rounded">
                      Minta Batal
                    </span>
                  </div>
                  <h4 className="font-black text-[var(--ab-text-main)] text-base tracking-tight">{req.userName}</h4>
                  <div className="flex items-start gap-2 text-[10px] font-bold text-[var(--ab-text-dim)] bg-[var(--ab-bg-surface)] p-3 rounded-2xl border border-orange-100 dark:border-slate-700">
                    <CalendarDays size={12} className="mt-0.5 text-orange-400 shrink-0" />
                    <span className="leading-relaxed">{req.dates.join(", ")}</span>
                  </div>
                  <div className="space-y-2 px-2 text-[10px] italic text-[var(--ab-text-dim)]">
                    <p><span className="font-black not-italic text-[9px] text-[var(--ab-text-dim)] uppercase tracking-widest">Alasan Cuti: </span>&ldquo;{req.reason}&rdquo;</p>
                    <p><span className="font-black not-italic text-[9px] text-orange-500 uppercase tracking-widest">Alasan Batal: </span>&ldquo;{req.cancellationReason}&rdquo;</p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => processCancellation(req, "approve")}
                    className="flex-1 bg-green-500 text-white py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-green-600 transition shadow-lg flex items-center justify-center gap-2"
                  >
                    <Check size={14} /> Setujui Batal
                  </button>
                  <button
                    onClick={() => processCancellation(req, "reject")}
                    className="flex-1 bg-white dark:bg-slate-800 text-red-500 border border-red-200 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-red-50 transition flex items-center justify-center gap-2"
                  >
                    <X size={14} /> Tolak
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
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
