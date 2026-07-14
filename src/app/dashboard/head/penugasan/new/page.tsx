"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useKpis } from "@/hooks/useKpis";
import { useDivisionMembers } from "@/hooks/useUsers";
import { useDivisionAssignments } from "@/hooks/useAssignments";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { getWorkingDaysInMonth, getBrandColor, monthName } from "@/lib/utils";
import { Search, ChevronLeft } from "lucide-react";

const typeLabel: Record<string, string> = { result: "Result", activity: "Activity", quality: "Quality" };
const typeColor: Record<string, string> = {
  result: "text-blue-600 bg-blue-50",
  activity: "text-amber-600 bg-amber-50",
  quality: "text-purple-600 bg-purple-50",
};

export default function HeadNewAssignmentPage() {
  const router = useRouter();
  const { user } = useAuth();
  const now = new Date();

  const managedDepartments: string[] =
    user?.managedDepartments && user.managedDepartments.length > 0
      ? user.managedDepartments
      : user?.department ? [user.department] : [];

  const [selectedMonth, setSelectedMonth] = useState(
    () => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );
  const [year, month] = selectedMonth.split("-").map(Number);

  const { kpis } = useKpis(year, month);
  const { members: users } = useDivisionMembers(managedDepartments);
  const { assignments } = useDivisionAssignments(managedDepartments, year, month);

  const [step, setStep] = useState<1 | 2>(1);
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [selectedKpis, setSelectedKpis] = useState<Record<string, string>>({});
  const [perUserTargets, setPerUserTargets] = useState<Record<string, Record<string, string>>>({});
  const [userSearch, setUserSearch] = useState("");
  const [kpiSearch, setKpiSearch] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const workingDays = getWorkingDaysInMonth(year, month);

  // useDivisionMembers already scopes to dept; filter redundantly for safety
  const assignableUsers = users.filter(
    (u) => managedDepartments.includes(u.department ?? "")
  );
  // Show all non-deleted, non-cancelled KPIs so users can see what exists
  const activeKpis = kpis.filter(
    (k) => !k.deletedAt && k.status !== "cancelled" && managedDepartments.includes(k.department)
  );
  const userMap = Object.fromEntries(users.map((u) => [u.id, u]));
  const kpiMap = Object.fromEntries(kpis.map((k) => [k.id, k]));

  const existingSet = useMemo(() => {
    const set = new Set<string>();
    assignments.forEach((a) => { if (a.status !== "cancelled") set.add(`${a.userId}-${a.kpiId}`); });
    return set;
  }, [assignments]);

  const checkedKpiIds = Object.keys(selectedKpis);
  const checkedKpiCount = checkedKpiIds.length;
  const totalAssignments = selectedUserIds.length * checkedKpiCount;
  const newAssignmentCount = useMemo(
    () => selectedUserIds.reduce(
      (total, uid) => total + checkedKpiIds.filter((kpiId) => !existingSet.has(`${uid}-${kpiId}`)).length, 0
    ),
    [selectedUserIds, checkedKpiIds, existingSet]
  );
  const skippedCount = totalAssignments - newAssignmentCount;

  const filteredUsers = useMemo(() => {
    const q = userSearch.trim().toLowerCase();
    return q ? assignableUsers.filter((u) => u.name.toLowerCase().includes(q) || (u.department ?? "").toLowerCase().includes(q)) : assignableUsers;
  }, [assignableUsers, userSearch]);

  const filteredKpis = useMemo(() => {
    const q = kpiSearch.trim().toLowerCase();
    return q ? activeKpis.filter((k) => k.title.toLowerCase().includes(q) || k.department.toLowerCase().includes(q) || k.type.toLowerCase().includes(q)) : activeKpis;
  }, [activeKpis, kpiSearch]);

  function toggleKpi(kpiId: string, defaultTarget: number) {
    setSelectedKpis((prev) => {
      if (kpiId in prev) { const next = { ...prev }; delete next[kpiId]; return next; }
      return { ...prev, [kpiId]: defaultTarget > 0 ? String(defaultTarget) : "" };
    });
  }

  function toggleUser(userId: string) {
    setSelectedUserIds((prev) => prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId]);
  }

  function handleNext() {
    setError("");
    if (selectedUserIds.length === 0) { setError("Pilih minimal 1 karyawan."); return; }
    if (checkedKpiCount === 0) { setError("Pilih minimal 1 KPI."); return; }
    const invalid = Object.entries(selectedKpis).filter(([, t]) => !(parseFloat(t) > 0));
    if (invalid.length > 0) { setError("Isi target untuk semua KPI yang dipilih."); return; }
    const initial: Record<string, Record<string, string>> = {};
    for (const userId of selectedUserIds) {
      initial[userId] = {};
      for (const [kpiId, target] of Object.entries(selectedKpis)) initial[userId][kpiId] = target;
    }
    setPerUserTargets(initial);
    setStep(2);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      const supabase = createClient();

      const deptNames = [...new Set(
        checkedKpiIds.map((kpiId) => kpis.find((k) => k.id === kpiId)?.department ?? "").filter(Boolean)
      )];
      const { data: deptRows } = await supabase.from("departments").select("id, name").in("name", deptNames);
      const deptIdByName: Record<string, string> = {};
      (deptRows ?? []).forEach((d: any) => { deptIdByName[d.name] = d.id; });

      const toInsert: Record<string, unknown>[] = [];
      for (const userId of selectedUserIds) {
        for (const kpiId of checkedKpiIds) {
          if (existingSet.has(`${userId}-${kpiId}`)) continue;
          const kpi = kpis.find((k) => k.id === kpiId)!;
          const targetStr = perUserTargets[userId]?.[kpiId] ?? selectedKpis[kpiId];
          const perPersonTarget = parseFloat(targetStr);
          if (!(perPersonTarget > 0)) continue;
          const dailyTarget = workingDays > 0 ? Math.ceil(perPersonTarget / workingDays) : 0;
          toInsert.push({
            kpi_id: kpiId,
            user_id: userId,
            department_id: deptIdByName[kpi.department] ?? null,
            status: "active",
            monthly_target: perPersonTarget,
            current_daily_target: dailyTarget,
            actual_total: 0,
            expected_total: 0,
            achievement_percentage: 0,
            performance_category: "warning",
            working_days_total: workingDays,
            working_days_elapsed: 0,
            working_days_remaining: workingDays,
            active_days: 0,
            year,
            month,
          });
        }
      }
      if (toInsert.length === 0) { setError("Semua kombinasi sudah memiliki penugasan aktif."); setSubmitting(false); return; }
      const { error: insertErr } = await supabase.from("kpi_assignments").insert(toInsert as any);
      if (insertErr) throw insertErr;
      // Auto-activate KPIs that were draft/hold
      const kpisToActivate = checkedKpiIds.filter((kpiId) => {
        const k = kpis.find((k) => k.id === kpiId);
        return k && (k.status === "draft" || k.status === "hold");
      });
      if (kpisToActivate.length > 0) {
        await supabase.from("kpis").update({ status: "active" }).in("id", kpisToActivate);
      }
      router.push("/dashboard/head/penugasan");
    } catch {
      setError("Gagal menugaskan KPI. Coba lagi.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-0.5">
          <button
            onClick={() => router.push("/dashboard/head/penugasan")}
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
          >
            <ChevronLeft className="h-4 w-4" /> Penugasan
          </button>
          <h2 className="text-base font-semibold">Tugaskan KPI</h2>
          <p className="text-xs text-muted-foreground">
            Langkah {step} dari 2 — {monthName(month)} {year} · {managedDepartments.join(", ")}
          </p>
        </div>
        <Input
          type="month"
          value={selectedMonth}
          onChange={(e) => { setSelectedMonth(e.target.value); setStep(1); setSelectedUserIds([]); setSelectedKpis({}); }}
          className="h-9 w-[155px] shrink-0 self-start"
          disabled={step === 2}
        />
      </div>

      {step === 1 ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Karyawan */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">Karyawan Tim</Label>
                {selectedUserIds.length > 0 && (
                  <span className="text-xs text-primary font-medium">{selectedUserIds.length} dipilih</span>
                )}
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input placeholder="Cari nama atau divisi..." value={userSearch} onChange={(e) => setUserSearch(e.target.value)} className="pl-8 h-8 text-sm" />
              </div>
              <div className="rounded-md border border-input overflow-hidden max-h-60 lg:max-h-80 overflow-y-auto">
                {filteredUsers.length === 0 ? (
                  <p className="px-3 py-4 text-xs text-muted-foreground text-center">Tidak ada karyawan di departemen ini</p>
                ) : (
                  filteredUsers.map((u) => {
                    const isSelected = selectedUserIds.includes(u.id);
                    return (
                      <button
                        key={u.id} type="button" onClick={() => toggleUser(u.id)}
                        className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-left transition-colors border-b border-border last:border-0 hover:bg-accent ${isSelected ? "bg-primary/5" : ""}`}
                      >
                        <input type="checkbox" checked={isSelected} readOnly className="h-4 w-4 rounded accent-primary shrink-0 pointer-events-none" />
                        <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                          {u.name.slice(0, 2).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium truncate">{u.name}</p>
                          <p className="text-xs text-muted-foreground truncate">{u.department ?? "—"}</p>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            {/* KPI Aktif */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">KPI Aktif Tim</Label>
                {checkedKpiCount > 0 && <span className="text-xs text-primary font-medium">{checkedKpiCount} dipilih</span>}
              </div>
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                <Input placeholder="Cari judul, tipe..." value={kpiSearch} onChange={(e) => setKpiSearch(e.target.value)} className="pl-8 h-8 text-sm" />
              </div>
              {filteredKpis.length === 0 ? (
                <div className="rounded-md border border-dashed border-border px-3 py-4 text-center text-xs text-muted-foreground">
                  {activeKpis.length === 0 ? "Belum ada KPI untuk departemen ini. Buat di Kelola KPI terlebih dahulu." : "Tidak ada KPI yang cocok"}
                </div>
              ) : (
                <div className="space-y-1.5 max-h-60 lg:max-h-80 overflow-y-auto pr-0.5">
                  {filteredKpis.map((k) => {
                    const checked = k.id in selectedKpis;
                    const assignedCount = selectedUserIds.filter((uid) => existingSet.has(`${uid}-${k.id}`)).length;
                    const allAssigned = selectedUserIds.length > 0 && assignedCount === selectedUserIds.length;
                    const someAssigned = assignedCount > 0 && !allAssigned;
                    const isNonActive = k.status !== "active";
                    return (
                      <div key={k.id} className={`flex items-center gap-2.5 rounded-md border px-3 py-2.5 transition-colors ${checked ? "border-primary/40 bg-primary/5" : "border-border"}`}>
                        <input type="checkbox" id={`kpi-${k.id}`} checked={checked} onChange={() => toggleKpi(k.id, k.monthlyTarget)} className="h-4 w-4 rounded accent-primary shrink-0" />
                        <label htmlFor={`kpi-${k.id}`} className="flex-1 min-w-0 cursor-pointer">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className={`text-xs px-1.5 py-0.5 rounded font-medium shrink-0 ${typeColor[k.type]}`}>{typeLabel[k.type]}</span>
                            <span className={`text-xs px-1.5 py-0.5 rounded border font-medium shrink-0 ${getBrandColor(k.brand)}`}>{k.brand || "Umum"}</span>
                            <span className="text-sm truncate">{k.title}</span>
                            {isNonActive && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 border border-slate-200 shrink-0">
                                {k.status === "draft" ? "Draft → aktif otomatis" : k.status === "hold" ? "Hold → aktif otomatis" : k.status}
                              </span>
                            )}
                            {allAssigned && <span className="text-[10px] px-1.5 py-0.5 rounded bg-green-50 text-green-700 border border-green-200 shrink-0">Semua sudah ditugaskan</span>}
                            {someAssigned && <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-200 shrink-0">{assignedCount}/{selectedUserIds.length} sudah ditugaskan</span>}
                          </div>
                          <p className="text-xs text-muted-foreground truncate mt-0.5">{k.department}</p>
                        </label>
                        {checked && (
                          <input
                            type="number" min="0.01" step="any" value={selectedKpis[k.id]}
                            onChange={(e) => setSelectedKpis((prev) => ({ ...prev, [k.id]: e.target.value }))}
                            placeholder="target"
                            className="w-24 rounded border border-input bg-background px-2 py-0.5 text-xs text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-ring shrink-0"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {selectedUserIds.length > 0 && checkedKpiCount > 0 && (
            <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
              <span className="font-semibold text-primary">{selectedUserIds.length} karyawan × {checkedKpiCount} KPI = {totalAssignments} penugasan</span>
              {skippedCount > 0 && <span className="text-amber-600"> · {skippedCount} sudah ada (dilewati)</span>}
            </div>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex justify-between gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={() => router.push("/dashboard/head/penugasan")}>Batal</Button>
            <Button type="button" onClick={handleNext} disabled={selectedUserIds.length === 0 || checkedKpiCount === 0}>Lanjut →</Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-xs">
            <span className="font-semibold text-primary">{newAssignmentCount} penugasan baru</span>
            {skippedCount > 0 && <span className="text-muted-foreground"> · {skippedCount} dilewati (sudah ada)</span>}
            <p className="text-muted-foreground mt-0.5">Edit target per orang jika diperlukan.</p>
          </div>

          <div className="space-y-2 max-w-2xl">
            {selectedUserIds.map((userId) => {
              const u = userMap[userId];
              const userNewCount = checkedKpiIds.filter((kpiId) => !existingSet.has(`${userId}-${kpiId}`)).length;
              return (
                <div key={userId} className={`rounded-lg border overflow-hidden ${userNewCount === 0 ? "opacity-60" : ""} border-border`}>
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-muted/30">
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${userNewCount === 0 ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary"}`}>
                      {(u?.name ?? userId).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{u?.name ?? userId}</p>
                      <p className="text-xs text-muted-foreground">{u?.department ?? "—"}</p>
                    </div>
                    {userNewCount === 0 && <span className="text-[10px] text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded shrink-0">Semua sudah ada</span>}
                  </div>
                  <div className="divide-y divide-border">
                    {checkedKpiIds.map((kpiId) => {
                      const kpi = kpiMap[kpiId];
                      if (!kpi) return null;
                      const isDuplicate = existingSet.has(`${userId}-${kpiId}`);
                      return (
                        <div key={kpiId} className={`flex items-center gap-2 px-3 py-2.5 ${isDuplicate ? "bg-muted/20" : ""}`}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${typeColor[kpi.type]}`}>{typeLabel[kpi.type]}</span>
                              <span className={`text-[10px] px-1.5 py-0.5 rounded border font-medium shrink-0 ${getBrandColor(kpi.brand)}`}>{kpi.brand || "Umum"}</span>
                              <p className="text-xs truncate">{kpi.title}</p>
                            </div>
                          </div>
                          {isDuplicate ? (
                            <span className="text-[10px] text-muted-foreground shrink-0 italic">sudah ditugaskan</span>
                          ) : (
                            <input
                              type="number" min="0.01" step="any" value={perUserTargets[userId]?.[kpiId] ?? ""}
                              onChange={(e) => setPerUserTargets((prev) => ({ ...prev, [userId]: { ...(prev[userId] ?? {}), [kpiId]: e.target.value } }))}
                              placeholder="target"
                              className="w-24 rounded border border-input bg-background px-2 py-0.5 text-xs text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-ring shrink-0"
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-border">
            <Button type="button" variant="outline" onClick={() => { setStep(1); setError(""); }}>
              <ChevronLeft className="h-4 w-4" /> Kembali
            </Button>
            <Button type="submit" disabled={submitting || newAssignmentCount === 0}>
              {submitting ? "Menyimpan..." : `Tugaskan ${newAssignmentCount} Penugasan`}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
