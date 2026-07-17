"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHolidays } from "@/hooks/absensi/useHolidays";
import { useAbsensiSettings } from "@/hooks/absensi/useAbsensiSettings";
import { useAuth } from "@/contexts/AuthContext";
import { CalendarDays, Search, Users, MapPin, Laptop, Umbrella, AlertCircle, Check, X, Clock } from "lucide-react";
import { toast } from "sonner";

interface AttLog {
  id: string;
  userId: string;
  userName: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: string;
  type: string;
  lateFine: number;
  locationStatus: string | null;
  lateReason: string;
  lateReasonStatus: string | null;
  notes: string | null;
}

interface ActiveUser { id: string; name: string; isHidden: boolean }

function fmt(t: string | null) { return t ? t.substring(0, 5) : "--:--"; }

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const { settings } = useAbsensiSettings();
  const { holidayDates } = useHolidays();

  const today = new Date().toISOString().split("T")[0];
  const [filterDate, setFilterDate] = useState(today);
  const [logs, setLogs] = useState<AttLog[]>([]);
  const [activeUsers, setActiveUsers] = useState<ActiveUser[]>([]);
  const [excusedMap, setExcusedMap] = useState<Map<string, string>>(new Map());
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  // Late reason review modal
  const [selectedLog, setSelectedLog] = useState<AttLog | null>(null);

  useEffect(() => {
    const supabase = createClient();

    const fetchLogs = async () => {
      const [attRes, usersRes, reqsRes] = await Promise.all([
        supabase.from("attendance").select("id, user_id, date, check_in, check_out, status, type, late_fine, location_status, late_reason, late_reason_status, notes").eq("date", filterDate),
        supabase.from("users").select("id, name, is_hidden").eq("absensi_status", "active"),
        supabase.from("leave_requests").select("user_id, type").eq("status", "approved").contains("dates", [filterDate]),
      ]);

      // Build user map
      const uMap = new Map<string, ActiveUser>();
      (usersRes.data ?? []).forEach((r) => {
        uMap.set(r.id as string, { id: r.id as string, name: r.name as string, isHidden: (r.is_hidden as boolean) ?? false });
      });
      setActiveUsers([...uMap.values()].filter((u) => !u.isHidden));

      // Build excused map
      const ex = new Map<string, string>();
      (reqsRes.data ?? []).forEach((r) => { ex.set(r.user_id as string, r.type as string); });
      setExcusedMap(ex);

      setLogs(
        (attRes.data ?? []).map((r) => ({
          id:               r.id as string,
          userId:           r.user_id as string,
          userName:         uMap.get(r.user_id as string)?.name ?? "Unknown",
          date:             r.date as string,
          checkIn:          r.check_in as string | null,
          checkOut:         r.check_out as string | null,
          status:           r.status as string,
          type:             r.type as string,
          lateFine:         (r.late_fine as number) ?? 0,
          locationStatus:   r.location_status as string | null,
          lateReason:       (r.late_reason as string) ?? "",
          lateReasonStatus: r.late_reason_status as string | null,
          notes:            r.notes as string | null,
        }))
      );
      setIsLoading(false);
    };

    fetchLogs();

    const ch = supabase.channel("admin_dash_" + filterDate)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, fetchLogs)
      .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, fetchLogs)
      .subscribe();

    return () => { ch.unsubscribe(); };
  }, [filterDate]);

  const isHoliday = holidayDates.includes(filterDate);

  const stats = useMemo(() => {
    const presentIds = new Set(logs.map((l) => l.userId));
    const excusedIds = new Set(excusedMap.keys());
    const wfo    = logs.filter((l) => l.type === "WFO").length;
    const wfa    = logs.filter((l) => l.type === "WFA").length;
    const excused = excusedIds.size;
    const missed = activeUsers.filter((u) => !presentIds.has(u.id) && !excusedIds.has(u.id)).length;
    return { total: logs.length, wfo, wfa, excused, missed };
  }, [logs, activeUsers, excusedMap]);

  const displayRows = useMemo(() => {
    const presentIds = new Set(logs.map((l) => l.userId));
    const excusedIds = new Set(excusedMap.keys());

    type Row = AttLog | { id: string; userId: string; userName: string; isExcused: boolean; excusedType?: string; isMissed: boolean; status: string; type: string; checkIn: null; checkOut: null; lateFine: number; locationStatus: null; lateReason: string; lateReasonStatus: null; notes: null; date: string };

    const rows: Row[] = [...logs];

    activeUsers.forEach((u) => {
      if (!presentIds.has(u.id)) {
        if (excusedIds.has(u.id)) {
          rows.push({ id: `ex-${u.id}`, userId: u.id, userName: u.name, isExcused: true, excusedType: excusedMap.get(u.id), isMissed: false, status: "approved", type: excusedMap.get(u.id) ?? "leave", checkIn: null, checkOut: null, lateFine: 0, locationStatus: null, lateReason: "", lateReasonStatus: null, notes: null, date: filterDate });
        } else {
          rows.push({ id: `ms-${u.id}`, userId: u.id, userName: u.name, isExcused: false, isMissed: true, status: "missed", type: "-", checkIn: null, checkOut: null, lateFine: 0, locationStatus: null, lateReason: "", lateReasonStatus: null, notes: null, date: filterDate });
        }
      }
    });

    if (!searchTerm) return rows;
    return rows.filter((r) => r.userName.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [logs, activeUsers, excusedMap, searchTerm, filterDate]);

  const handleLateReason = async (logId: string, action: "accepted" | "rejected") => {
    const supabase = createClient();
    const tid = toast.loading("Memproses alasan...");
    try {
      const updatePayload = action === "accepted"
        ? { late_reason_status: action, late_fine: 0, status: "on_time" as const }
        : { late_reason_status: action };
      const { error } = await supabase.from("attendance").update(updatePayload).eq("id", logId);
      if (error) throw error;
      toast.success(action === "accepted" ? "Alasan diterima, denda dibatalkan." : "Alasan ditolak.", { id: tid });
      setSelectedLog(null);
    } catch (err: unknown) {
      toast.error("Gagal: " + (err instanceof Error ? err.message : "Unknown"), { id: tid });
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-center gap-4">
        <div>
          <h1 className="text-3xl font-black text-[var(--ab-text-main)] tracking-tighter">Admin Dashboard</h1>
          <p className="text-[10px] font-bold text-[var(--ab-text-dim)] uppercase tracking-widest mt-0.5">Management & Oversight System</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 bg-[var(--ab-bg-surface)] px-4 py-2 rounded-2xl border border-[var(--ab-border)] shadow-sm">
            <CalendarDays size={12} style={{ color: "var(--ab-primary)" }} />
            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="bg-transparent text-[10px] font-black text-[var(--ab-text-main)] outline-none uppercase"
            />
          </div>
          {isHoliday && (
            <span className="text-[10px] font-black text-white bg-rose-500 px-3 py-1.5 rounded-full">
              Hari Libur
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total Hadir", value: stats.total, icon: <Users size={16} />, col: "var(--ab-primary)" },
          { label: "WFO", value: stats.wfo, icon: <MapPin size={16} />, col: "#22c55e" },
          { label: "WFA / Cuti", value: stats.excused + stats.wfa, icon: <Umbrella size={16} />, col: "#f97316" },
          { label: "Belum Hadir", value: stats.missed, icon: <AlertCircle size={16} />, col: "#f43f5e" },
        ].map(({ label, value, icon, col }) => (
          <div key={label} className="ab-card-tactile !p-5 relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 h-full" style={{ background: col }} />
            <div style={{ color: col }} className="mb-2">{icon}</div>
            <p className="text-[9px] font-black text-[var(--ab-text-dim)] uppercase tracking-widest mb-1">{label}</p>
            <p className="text-2xl font-black text-[var(--ab-text-main)] font-mono">{value}</p>
          </div>
        ))}
      </div>

      {/* Table */}
      <div className="ab-card-tactile !p-0 overflow-hidden">
        <div className="p-4 border-b border-[var(--ab-border)] flex items-center justify-between gap-4">
          <h2 className="font-black text-[var(--ab-text-main)] uppercase tracking-tight text-sm">Log Absensi — {filterDate}</h2>
          <div className="relative flex items-center w-48">
            <Search size={12} className="absolute left-3 text-[var(--ab-text-dim)]" />
            <input
              type="text"
              placeholder="Cari nama..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ab-input pl-9 text-xs py-2"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          {isLoading ? (
            <div className="animate-pulse p-6 space-y-3">
              {[1, 2, 3].map((i) => <div key={i} className="h-10 bg-[var(--ab-bg-main)] rounded-xl" />)}
            </div>
          ) : displayRows.length === 0 ? (
            <div className="p-16 text-center text-[var(--ab-text-dim)] text-sm">
              Tidak ada data untuk tanggal ini.
            </div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[var(--ab-bg-main)] text-[var(--ab-text-dim)]">
                  <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-[9px]">Nama</th>
                  <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-[9px]">Status</th>
                  <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-[9px]">Masuk</th>
                  <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-[9px]">Pulang</th>
                  <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-[9px]">Denda</th>
                  <th className="px-4 py-3 text-left font-black uppercase tracking-widest text-[9px]">Aksi</th>
                </tr>
              </thead>
              <tbody>
                {displayRows.map((row) => {
                  const isExcused = "isExcused" in row && (row as { isExcused: boolean }).isExcused;
                  const isMissed  = "isMissed"  in row && (row as { isMissed: boolean }).isMissed;
                  const isLog     = !isExcused && !isMissed && "lateReasonStatus" in row;
                  const log       = isLog ? (row as AttLog) : null;
                  const hasPendingReason = log?.lateReasonStatus === "pending";

                  return (
                    <tr
                      key={row.id}
                      className={`border-t border-[var(--ab-border)] hover:bg-[var(--ab-bg-main)]/50 transition-colors ${hasPendingReason ? "bg-orange-50/30 dark:bg-orange-900/5" : ""}`}
                    >
                      <td className="px-4 py-3 font-bold text-[var(--ab-text-main)]">{row.userName}</td>
                      <td className="px-4 py-3">
                        {isExcused ? (
                          <span className="text-orange-600 font-black text-[9px] uppercase bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded border border-orange-200 dark:border-orange-800">
                            {(row as { excusedType?: string }).excusedType === "wfa" ? "WFA" : "Cuti/Sakit"}
                          </span>
                        ) : isMissed ? (
                          <span className="text-red-500 font-black text-[9px] uppercase bg-red-50 dark:bg-red-900/20 px-2 py-0.5 rounded border border-red-200 dark:border-red-800">Alpha</span>
                        ) : (
                          <span className={`font-black text-[9px] uppercase px-2 py-0.5 rounded border ${
                            row.status === "on_time" ? "text-green-600 bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800" :
                            "text-orange-600 bg-orange-50 border-orange-200 dark:bg-orange-900/20 dark:border-orange-800"
                          }`}>
                            {row.status.replace("_", " ")}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-mono font-black text-[var(--ab-text-main)]">{fmt(row.checkIn)}</td>
                      <td className="px-4 py-3 font-mono font-black text-[var(--ab-text-main)]">{fmt(row.checkOut)}</td>
                      <td className="px-4 py-3 font-bold text-[var(--ab-text-main)]">
                        {(row.lateFine ?? 0) > 0 ? `Rp ${row.lateFine.toLocaleString("id-ID")}` : "-"}
                      </td>
                      <td className="px-4 py-3">
                        {hasPendingReason && (
                          <button
                            onClick={() => setSelectedLog(log!)}
                            className="text-[8px] font-black uppercase tracking-widest text-orange-500 bg-orange-50 dark:bg-orange-900/20 px-3 py-1 rounded-lg border border-orange-200 dark:border-orange-800 hover:bg-orange-100 transition"
                          >
                            Review Alasan
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Late Reason Review Modal */}
      {selectedLog && (
        <div className="ab-confirm-overlay">
          <div className="absolute inset-0" onClick={() => setSelectedLog(null)} />
          <div className="bg-[var(--ab-bg-surface)] w-full max-w-md rounded-[40px] shadow-2xl relative overflow-hidden ab-animate-scaleIn border border-[var(--ab-border)] p-8">
            <h3 className="text-xl font-black text-[var(--ab-text-main)] uppercase tracking-tight mb-2">Review Alasan Telat</h3>
            <p className="text-[10px] text-[var(--ab-text-dim)] font-bold uppercase tracking-widest mb-6">{selectedLog.userName}</p>
            <div className="bg-[var(--ab-bg-main)] p-4 rounded-2xl border border-[var(--ab-border)] mb-4">
              <p className="text-[9px] font-black text-[var(--ab-text-dim)] uppercase tracking-widest mb-1">Check In</p>
              <p className="font-mono font-black text-[var(--ab-text-main)]">{fmt(selectedLog.checkIn)}</p>
            </div>
            <div className="bg-[var(--ab-bg-main)] p-4 rounded-2xl border border-[var(--ab-border)] mb-6">
              <p className="text-[9px] font-black text-[var(--ab-text-dim)] uppercase tracking-widest mb-1">Alasan</p>
              <p className="text-sm font-bold text-[var(--ab-text-main)] italic">&ldquo;{selectedLog.lateReason}&rdquo;</p>
            </div>
            {(selectedLog.lateFine ?? 0) > 0 && (
              <div className="text-center mb-6">
                <p className="text-[10px] text-[var(--ab-text-dim)] uppercase tracking-widest">Denda saat ini</p>
                <p className="text-2xl font-black text-orange-600 font-mono">Rp {selectedLog.lateFine.toLocaleString("id-ID")}</p>
              </div>
            )}
            <div className="flex gap-3">
              <button
                onClick={() => handleLateReason(selectedLog.id, "accepted")}
                className="flex-1 bg-green-500 text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-green-600 transition"
              >
                <Check size={14} /> Terima & Hapus Denda
              </button>
              <button
                onClick={() => handleLateReason(selectedLog.id, "rejected")}
                className="flex-1 bg-red-500 text-white py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-red-600 transition"
              >
                <X size={14} /> Tolak
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
