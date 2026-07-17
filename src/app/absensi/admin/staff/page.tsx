"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { AbsensiStatus } from "@/types";
import ConfirmDialog from "@/components/absensi/ConfirmDialog";
import { Search, UserMinus, UserCheck, RotateCcw, User } from "lucide-react";
import ExcelJS from "exceljs";
import { toast } from "sonner";

interface StaffUser {
  id: string;
  name: string;
  email: string;
  absensiRole: "staff" | "admin";
  absensiStatus: AbsensiStatus;
  leaveQuota: number;
  sickQuota: number;
  isHidden: boolean;
  departmentId: string | null;
  departmentName: string | null;
}

const STATUS_LABELS: Record<string, string> = {
  active:   "Staf Aktif",
  pending:  "Pendaftar Baru",
  rejected: "Akun Ditolak",
  resigned: "Staf Resign",
  deleted:  "Akun Dihapus",
};
const STATUS_TABS = Object.keys(STATUS_LABELS) as AbsensiStatus[];

type ConfirmCfg = { title: string; msg: string; type: "warning" | "danger"; onConfirm: () => Promise<void> } | null;

export default function AdminStaffPage() {
  const [statusFilter, setStatusFilter] = useState<AbsensiStatus>("active");
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [localEdits, setLocalEdits] = useState<Record<string, Partial<StaffUser>>>({});
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [searchTerm, setSearchTerm] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [confirmCfg, setConfirmCfg] = useState<ConfirmCfg>(null);
  const [departments, setDepartments] = useState<{ id: string; name: string }[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState(() => new Date().toISOString().substring(0, 7));

  useEffect(() => {
    const supabase = createClient();

    const fetchAll = async () => {
      const [usersRes, deptsRes] = await Promise.all([
        supabase.from("users").select("id, name, email, absensi_role, absensi_status, leave_quota, sick_quota, is_hidden, department_id, departments(name)"),
        supabase.from("departments").select("id, name").order("name"),
      ]);

      const allUsers = (usersRes.data ?? []).map((r) => ({
        id: r.id as string,
        name: r.name as string,
        email: r.email as string,
        absensiRole: (r.absensi_role as "staff" | "admin") ?? "staff",
        absensiStatus: (r.absensi_status as AbsensiStatus) ?? "pending",
        leaveQuota: (r.leave_quota as number) ?? 12,
        sickQuota: (r.sick_quota as number) ?? 14,
        isHidden: (r.is_hidden as boolean) ?? false,
        departmentId: r.department_id as string | null,
        departmentName: ((r.departments as unknown) as { name: string } | null)?.name ?? null,
      }));

      const newCounts: Record<string, number> = {};
      STATUS_TABS.forEach((s) => { newCounts[s] = allUsers.filter((u) => u.absensiStatus === s).length; });
      setCounts(newCounts);
      setUsers(allUsers.filter((u) => u.absensiStatus === statusFilter));
      setIsLoading(false);

      setDepartments((deptsRes.data ?? []).map((d) => ({ id: d.id as string, name: d.name as string })));
    };

    fetchAll();

    const ch = supabase.channel("admin_staff_watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, fetchAll)
      .subscribe();

    return () => { ch.unsubscribe(); };
  }, [statusFilter]);

  const getEdit = (id: string): Partial<StaffUser> => localEdits[id] ?? {};
  const patchEdit = (id: string, patch: Partial<StaffUser>) =>
    setLocalEdits((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));

  const getUserVal = <K extends keyof StaffUser>(u: StaffUser, key: K): StaffUser[K] =>
    (getEdit(u.id)[key] ?? u[key]) as StaffUser[K];

  const saveUser = async (user: StaffUser) => {
    const edits = getEdit(user.id);
    if (!Object.keys(edits).length) return;
    const supabase = createClient();
    const tid = toast.loading("Memperbarui data...");
    try {
      const updatePayload: {
        absensi_role?: "staff" | "admin";
        leave_quota?: number;
        sick_quota?: number;
        is_hidden?: boolean;
        department_id?: string | null;
      } = {};
      if (edits.absensiRole    !== undefined) updatePayload.absensi_role    = edits.absensiRole;
      if (edits.leaveQuota     !== undefined) updatePayload.leave_quota     = edits.leaveQuota;
      if (edits.sickQuota      !== undefined) updatePayload.sick_quota      = edits.sickQuota;
      if (edits.isHidden       !== undefined) updatePayload.is_hidden       = edits.isHidden;
      if (edits.departmentId   !== undefined) updatePayload.department_id   = edits.departmentId ?? null;

      const { error } = await supabase.from("users").update(updatePayload).eq("id", user.id);
      if (error) throw error;
      toast.success("Data staf berhasil diperbarui.", { id: tid });
      setLocalEdits((prev) => { const n = { ...prev }; delete n[user.id]; return n; });
    } catch (err: unknown) {
      toast.error("Gagal: " + (err instanceof Error ? err.message : "Unknown"), { id: tid });
    }
  };

  const updateStatus = (userId: string, newStatus: AbsensiStatus) => {
    const labels: Record<string, string> = { resigned: "Resign", deleted: "Hapus", active: "Aktif", rejected: "Tolak" };
    setConfirmCfg({
      title: `Konfirmasi ${labels[newStatus] ?? newStatus}`,
      msg: `Yakin ingin memindahkan status staf ini ke ${labels[newStatus] ?? newStatus}?`,
      type: newStatus === "deleted" ? "danger" : "warning",
      onConfirm: async () => {
        const supabase = createClient();
        const tid = toast.loading("Memperbarui status...");
        try {
          const { error } = await supabase.from("users").update({ absensi_status: newStatus }).eq("id", userId);
          if (error) throw error;
          toast.success("Status berhasil diperbarui.", { id: tid });
        } catch (err: unknown) {
          toast.error("Gagal: " + (err instanceof Error ? err.message : "Unknown"), { id: tid });
        } finally { setConfirmCfg(null); }
      },
    });
  };

  const handleSlipAbsen = async (u: StaffUser) => {
    const supabase = createClient();
    const tid = toast.loading(`Mengambil data absensi ${u.name}...`);
    try {
      const startStr = `${selectedPeriod}-01`;
      const endStr   = `${selectedPeriod}-31`;
      const { data: logs, error } = await supabase
        .from("attendance")
        .select("date, type, status, check_in, check_out, late_fine, radius_penalty, late_reason_status")
        .eq("user_id", u.id)
        .gte("date", startStr)
        .lte("date", endStr)
        .order("date");
      if (error) throw error;
      if (!logs || logs.length === 0) {
        toast.error(`Tidak ada absen untuk ${u.name} pada ${selectedPeriod}`, { id: tid });
        return;
      }
      const workbook  = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Slip Absen");
      worksheet.columns = [
        { header: "Tanggal",      key: "date",              width: 15 },
        { header: "Tipe",         key: "type",              width: 10 },
        { header: "Status",       key: "status",            width: 15 },
        { header: "Check In",     key: "checkIn",           width: 12 },
        { header: "Check Out",    key: "checkOut",          width: 12 },
        { header: "Denda (Rp)",   key: "lateFine",          width: 15 },
        { header: "Denda Radius", key: "radiusPenalty",     width: 15 },
        { header: "Status Alasan",key: "lateReasonStatus",  width: 15 },
      ];
      for (const l of logs) {
        const lrsRaw = l.late_reason_status as string | null;
        const lrsLabel = lrsRaw === "accepted" ? "Diterima" : lrsRaw === "rejected" ? "Ditolak" : lrsRaw === "pending" ? "Menunggu" : "-";
        worksheet.addRow({
          date:             l.date as string,
          type:             (l.type as string) ?? "-",
          status:           ((l.status as string) ?? "-").replace("_", " ").toUpperCase(),
          checkIn:          (l.check_in as string | null) ?? "-",
          checkOut:         (l.check_out as string | null) ?? "-",
          lateFine:         (l.late_fine as number) ?? 0,
          radiusPenalty:    (l.radius_penalty as number) ?? 0,
          lateReasonStatus: lrsLabel,
        });
      }
      worksheet.getRow(1).font = { bold: true };
      worksheet.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0E0E0" } };
      const buffer = await workbook.xlsx.writeBuffer();
      const blob   = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const url    = URL.createObjectURL(blob);
      const a      = document.createElement("a");
      a.href = url; a.download = `Slip_Absen_${u.name.replace(/\s+/g, "_")}_${selectedPeriod}.xlsx`; a.click();
      URL.revokeObjectURL(url);
      toast.success(`Slip absen ${u.name} berhasil diunduh`, { id: tid });
    } catch (err: unknown) {
      toast.error("Gagal: " + (err instanceof Error ? err.message : "Unknown"), { id: tid });
    }
  };

  const filtered = users.filter(
    (u) =>
      u.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 pb-20">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-[var(--ab-text-main)] uppercase tracking-tight">
            {STATUS_LABELS[statusFilter]}
          </h1>
          <p className="text-[10px] font-bold text-[var(--ab-text-dim)] uppercase tracking-widest italic">
            Manajemen Profil, Akses, dan Kuota Cuti
          </p>
        </div>
        <div className="flex gap-2 w-full md:w-auto">
          <input
            type="month"
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="ab-input text-xs w-36"
            title="Periode slip absen"
          />
          <div className="relative flex-1">
            <Search size={12} className="absolute left-3 top-3 text-[var(--ab-text-dim)]" />
            <input
              type="text"
              placeholder="Cari staf..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="ab-input pl-9 text-xs w-full md:w-64"
            />
          </div>
        </div>
      </div>

      {/* Status Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {STATUS_TABS.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setIsLoading(true); }}
            className="px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all whitespace-nowrap border flex items-center gap-2"
            style={statusFilter === s ? {
              background: "var(--ab-primary)", color: "#fff",
              borderColor: "var(--ab-primary)", boxShadow: "0 4px 12px -3px var(--ab-primary-glow)",
            } : {
              background: "var(--ab-bg-surface)", color: "var(--ab-text-dim)",
              borderColor: "var(--ab-border)",
            }}
          >
            {STATUS_LABELS[s].replace("Staf ", "").replace("Pendaftar ", "").replace("Akun ", "")}
            {(counts[s] ?? 0) > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[8px] bg-white/20">{counts[s]}</span>
            )}
          </button>
        ))}
      </div>

      {/* User Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="animate-pulse bg-[var(--ab-bg-surface)] p-6 rounded-3xl border border-[var(--ab-border)] h-48" />
          ))
        ) : filtered.length === 0 ? (
          <div className="col-span-full text-center py-20">
            <div className="w-16 h-16 bg-[var(--ab-bg-surface)] rounded-full flex items-center justify-center mx-auto mb-4 text-[var(--ab-text-dim)]">
              <User size={40} />
            </div>
            <h4 className="text-[11px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest italic">
              Tidak ada staf dalam kategori ini.
            </h4>
          </div>
        ) : (
          filtered.map((u) => (
            <div
              key={u.id}
              className="bg-[var(--ab-bg-surface)] p-6 rounded-3xl border border-[var(--ab-border)] shadow-sm hover:shadow-lg transition-all relative overflow-hidden"
            >
              <div className="flex justify-between items-start mb-6">
                <div className="flex items-center gap-4">
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center font-black text-xl text-white shadow-inner"
                    style={{ background: "var(--ab-primary)" }}
                  >
                    {u.name.substring(0, 1).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <h4 className="font-black text-[var(--ab-text-main)] text-lg tracking-tight truncate">{u.name}</h4>
                    <p className="text-[9px] text-[var(--ab-text-dim)] font-bold truncate">{u.email}</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-[var(--ab-bg-main)] rounded-lg text-[8px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest border border-[var(--ab-border)]">
                  {u.id.substring(0, 6)}
                </span>
              </div>

              <div className="space-y-3 mb-6">
                {/* Department & Role */}
                <div className="flex gap-3">
                  <div className="flex-1 space-y-1">
                    <label className="text-[8px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest ml-1">Divisi</label>
                    <select
                      value={getUserVal(u, "departmentId") ?? ""}
                      onChange={(e) => patchEdit(u.id, { departmentId: e.target.value || null })}
                      className="ab-input text-[10px] font-bold py-2 px-3"
                    >
                      <option value="">Pilih Divisi</option>
                      {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                    </select>
                  </div>
                  <div className="w-28 space-y-1">
                    <label className="text-[8px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest ml-1">Role</label>
                    <select
                      value={getUserVal(u, "absensiRole")}
                      onChange={(e) => patchEdit(u.id, { absensiRole: e.target.value as "staff" | "admin" })}
                      className="ab-input text-[10px] font-bold py-2 px-3 text-center"
                    >
                      <option value="staff">Staff</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                </div>

                {/* Quotas & Ghost */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase tracking-widest ml-1 text-center block" style={{ color: "var(--ab-primary)" }}>Cuti</label>
                    <input
                      type="number"
                      value={getUserVal(u, "leaveQuota")}
                      onChange={(e) => patchEdit(u.id, { leaveQuota: parseInt(e.target.value) || 0 })}
                      className="ab-input text-[11px] font-black text-center py-2 px-2"
                      style={{ color: "var(--ab-primary)" }}
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-rose-500 tracking-widest ml-1 text-center block">Sakit</label>
                    <input
                      type="number"
                      value={getUserVal(u, "sickQuota")}
                      onChange={(e) => patchEdit(u.id, { sickQuota: parseInt(e.target.value) || 0 })}
                      className="ab-input text-[11px] font-black text-center py-2 px-2 text-rose-500"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[8px] font-black uppercase text-[var(--ab-text-dim)] tracking-widest ml-1 text-center block">Ghost</label>
                    <button
                      onClick={() => patchEdit(u.id, { isHidden: !getUserVal(u, "isHidden") })}
                      className="w-full h-9 rounded-xl flex items-center justify-center cursor-pointer transition-all border"
                      style={getUserVal(u, "isHidden") ? {
                        background: "#a855f715", borderColor: "#a855f740", color: "#a855f7",
                      } : {
                        background: "var(--ab-bg-main)", borderColor: "var(--ab-border)", color: "var(--ab-text-dim)",
                      }}
                    >
                      <UserMinus size={14} className={getUserVal(u, "isHidden") ? "animate-pulse" : ""} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                <button
                  onClick={() => saveUser(u)}
                  disabled={!Object.keys(getEdit(u.id)).length}
                  className="flex-1 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all disabled:opacity-40 text-white"
                  style={{ background: "var(--ab-text-main)" }}
                >
                  Simpan Data
                </button>
                <button
                  className="flex-1 py-3 rounded-2xl text-[9px] font-black uppercase tracking-widest transition-all text-white flex items-center justify-center gap-2 shadow-lg"
                  style={{ background: "var(--ab-primary)", boxShadow: "0 4px 12px -3px var(--ab-primary-glow)" }}
                  onClick={() => toast.info("Slip absen — instal ExcelJS dulu untuk fitur ini")}
                >
                  <RotateCcw size={10} /> Slip Absen
                </button>
              </div>

              {statusFilter === "active" && (
                <div className="mt-4 pt-4 border-t border-[var(--ab-border)] flex justify-between items-center">
                  <button
                    onClick={() => updateStatus(u.id, "resigned")}
                    className="text-orange-500 font-black text-[8px] uppercase tracking-widest hover:bg-orange-50 dark:hover:bg-orange-900/20 px-3 py-1.5 rounded-lg transition"
                  >Resign</button>
                  <button
                    onClick={() => updateStatus(u.id, "deleted")}
                    className="text-red-500 font-black text-[8px] uppercase tracking-widest hover:bg-red-50 dark:hover:bg-red-900/20 px-3 py-1.5 rounded-lg transition"
                  >Hapus</button>
                </div>
              )}
              {statusFilter === "pending" && (
                <div className="mt-4 pt-4 border-t border-[var(--ab-border)] flex gap-2">
                  <button
                    onClick={() => updateStatus(u.id, "active")}
                    className="flex-1 bg-green-500 text-white py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-green-600 flex items-center justify-center gap-2"
                  >
                    <UserCheck size={12} /> Setujui
                  </button>
                  <button
                    onClick={() => updateStatus(u.id, "rejected")}
                    className="flex-1 bg-red-100 dark:bg-red-900/20 text-red-600 py-3 rounded-2xl font-black text-[9px] uppercase tracking-widest hover:bg-red-200"
                  >Tolak</button>
                </div>
              )}
            </div>
          ))
        )}
      </div>

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
