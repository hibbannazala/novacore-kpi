"use client";

import { useState, useEffect, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAllUsers } from "@/hooks/useUsers";
import { useAuth } from "@/contexts/AuthContext";
import { getKpiRole } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PerformanceBadge } from "@/components/ui/badge";
import { ChevronDown } from "lucide-react";
import { cn, formatPercentage, getPerformanceCategory, monthName } from "@/lib/utils";
import type { KpiAssignment, KPI } from "@/types";

interface QualityItem {
  assignment: KpiAssignment;
  kpi: KPI;
}

export default function HeadQualityPage() {
  const { user } = useAuth();
  const { users } = useAllUsers();
  const now = new Date();

  const role = user ? getKpiRole(user) : null;
  if (role === "tim") {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border">
        <p className="text-sm text-muted-foreground">Akses tidak diizinkan.</p>
      </div>
    );
  }

  const managedDepartments: string[] =
    user?.managedDepartments && user.managedDepartments.length > 0
      ? user.managedDepartments
      : user?.department ? [user.department] : [];

  const [filterMonth, setFilterMonth] = useState(
    () => `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
  );
  const selectedYear = parseInt(filterMonth.split("-")[0]);
  const selectedMonthNum = parseInt(filterMonth.split("-")[1]);

  const [qualityItems, setQualityItems] = useState<QualityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [noteValues, setNoteValues] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const [expandedDepts, setExpandedDepts] = useState<Set<string>>(new Set());
  const [expandedUsers, setExpandedUsers] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!user || managedDepartments.length === 0 || users.length === 0) return;
    async function load() {
      setIsLoading(true);
      setInputValues({});
      setNoteValues({});
      setExpandedUsers(new Set());

      const supabase = createClient();

      // Get department IDs for managed departments
      const { data: deptRows } = await supabase
        .from("departments")
        .select("id, name")
        .in("name", managedDepartments);
      const deptIds = (deptRows ?? []).map((d: any) => d.id);

      if (deptIds.length === 0) {
        setQualityItems([]);
        setIsLoading(false);
        return;
      }

      const { data: aRows } = await supabase
        .from("kpi_assignments")
        .select("*, kpis(id, title, type, unit, monthly_target, departments(name)), monthly_scores(*)")
        .eq("year", selectedYear)
        .eq("status", "active")
        .in("department_id", deptIds);

      const items: QualityItem[] = [];
      const initNotes: Record<string, string> = {};
      const scoreKey = `${selectedYear}-${selectedMonthNum}`;

      (aRows ?? []).forEach((row: any) => {
        const kpiRow = row.kpis;
        if (!kpiRow || kpiRow.type !== "quality") return;

        const msRows = (row.monthly_scores as any[]) ?? [];
        const monthlyScores: Record<string, any> = {};
        msRows.forEach((ms: any) => {
          monthlyScores[`${ms.year}-${ms.month}`] = {
            actualTotal: ms.actual_total,
            achievementPercentage: ms.achievement_percentage,
            performanceCategory: getPerformanceCategory(ms.achievement_percentage),
            qualityNotes: ms.quality_notes ?? "",
          };
        });

        const assignment: KpiAssignment = {
          id: row.id,
          kpiId: row.kpi_id,
          userId: row.user_id,
          department: kpiRow.departments?.name ?? "",
          kpiType: "quality",
          status: row.status,
          monthlyTarget: row.monthly_target ?? 0,
          actualTotal: row.actual_total ?? 0,
          achievementPercentage: row.achievement_percentage ?? 0,
          performanceCategory: getPerformanceCategory(row.achievement_percentage ?? 0) as any,
          weight: row.weight ?? 0,
          notes: row.notes ?? "",
          year: row.year,
          month: row.month,
          currentDailyTarget: 0,
          expectedTotal: 0,
          workingDaysTotal: 0,
          workingDaysElapsed: 0,
          workingDaysRemaining: 0,
          activeDays: 0,
          heldAt: null,
          cancelledAt: null,
          completedAt: null,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          qualityNotes: row.quality_notes ?? "",
          monthlyScores: Object.keys(monthlyScores).length > 0 ? monthlyScores : undefined,
        };

        const kpi: KPI = {
          id: kpiRow.id,
          title: kpiRow.title,
          description: "",
          type: kpiRow.type,
          unit: kpiRow.unit ?? "percentage",
          period: "monthly",
          status: "active",
          department: kpiRow.departments?.name ?? "",
          createdBy: "",
          monthlyTarget: kpiRow.monthly_target ?? 0,
          year: selectedYear,
          month: selectedMonthNum,
          createdAt: "",
          updatedAt: "",
        };

        items.push({ assignment, kpi });

        const ms = monthlyScores[scoreKey];
        const note = ms?.qualityNotes ?? assignment.qualityNotes ?? "";
        if (note) initNotes[row.id] = note;
      });

      setQualityItems(items);
      setNoteValues(initNotes);
      setIsLoading(false);
    }
    load();
  }, [user, users, managedDepartments.join(","), selectedYear]);

  const grouped = useMemo(() => {
    const userMap: Record<string, string> = {};
    users.forEach((u) => { userMap[u.id] = u.name; });

    const map: Record<string, Record<string, { userName: string; items: QualityItem[] }>> = {};
    qualityItems.forEach((item) => {
      const dept = item.assignment.department || "—";
      const uid = item.assignment.userId;
      if (!map[dept]) map[dept] = {};
      if (!map[dept][uid]) map[dept][uid] = { userName: userMap[uid] ?? uid, items: [] };
      map[dept][uid].items.push(item);
    });
    return map;
  }, [qualityItems, users]);

  const deptNames = useMemo(
    () => managedDepartments.filter((d) => grouped[d]),
    [managedDepartments, grouped]
  );

  async function handleSave(assignmentId: string, monthlyTarget: number) {
    const value = parseFloat(inputValues[assignmentId]);
    if (isNaN(value) || value < 0) return;
    setSaving(assignmentId);
    try {
      const pct = monthlyTarget > 0 ? (value / monthlyTarget) * 100 : 0;
      const category = getPerformanceCategory(pct);
      const notes = noteValues[assignmentId] ?? "";
      const scoreKey = `${selectedYear}-${selectedMonthNum}`;

      const supabase = createClient();
      await supabase.from("monthly_scores").upsert({
        assignment_id: assignmentId,
        year: selectedYear,
        month: selectedMonthNum,
        actual_total: value,
        achievement_percentage: pct,
      }, { onConflict: "assignment_id,year,month" });

      await supabase.from("kpi_assignments").update({
        actual_total: value,
        achievement_percentage: pct,
        quality_notes: notes,
      } as any).eq("id", assignmentId);

      setInputValues((prev) => ({ ...prev, [assignmentId]: "" }));
      setQualityItems((prev) =>
        prev.map((q) => {
          if (q.assignment.id !== assignmentId) return q;
          const updatedMonthlyScores = {
            ...(q.assignment.monthlyScores ?? {}),
            [scoreKey]: { actualTotal: value, achievementPercentage: pct, performanceCategory: category as any, qualityNotes: notes },
          };
          return { ...q, assignment: { ...q.assignment, actualTotal: value, achievementPercentage: pct, performanceCategory: category as any, qualityNotes: notes, monthlyScores: updatedMonthlyScores } };
        })
      );
    } finally {
      setSaving(null);
    }
  }

  function toggleDept(dept: string) {
    setExpandedDepts((prev) => {
      const next = new Set(prev);
      if (next.has(dept)) {
        next.delete(dept);
        const uids = Object.keys(grouped[dept] ?? {});
        setExpandedUsers((p2) => { const n2 = new Set(p2); uids.forEach((id) => n2.delete(dept + id)); return n2; });
      } else {
        next.add(dept);
      }
      return next;
    });
  }

  function toggleUser(dept: string, uid: string) {
    const key = dept + uid;
    setExpandedUsers((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key); else next.add(key);
      return next;
    });
  }

  if (managedDepartments.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border">
        <p className="text-sm text-muted-foreground">Tidak ada departemen yang dikelola</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Input KPI Kualitas Tim</h2>
          <p className="text-sm text-muted-foreground">
            {isLoading ? "Memuat..." : `${qualityItems.length} KPI kualitas · ${monthName(selectedMonthNum)} ${selectedYear} · ${managedDepartments.join(", ")}`}
          </p>
        </div>
        <input
          type="month"
          value={filterMonth}
          onChange={(e) => setFilterMonth(e.target.value)}
          className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring self-start"
        />
      </div>

      {!isLoading && deptNames.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setExpandedDepts(new Set(deptNames))}>
            Expand Tim
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setExpandedDepts(new Set(deptNames));
              const allKeys = deptNames.flatMap((d) => Object.keys(grouped[d] ?? {}).map((uid) => d + uid));
              setExpandedUsers(new Set(allKeys));
            }}
          >
            Expand Staff
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setExpandedDepts(new Set()); setExpandedUsers(new Set()); }}>
            Collapse All
          </Button>
        </div>
      )}

      {isLoading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      ) : deptNames.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">Tidak ada KPI kualitas aktif bulan ini</p>
        </div>
      ) : (
        <div className="space-y-3">
          {deptNames.map((dept) => {
            const usersInDept = grouped[dept] ?? {};
            const isDeptOpen = expandedDepts.has(dept);
            const totalKpi = Object.values(usersInDept).reduce((s, u) => s + u.items.length, 0);

            return (
              <div key={dept} className="rounded-xl border border-border overflow-hidden">
                <button
                  onClick={() => toggleDept(dept)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-card hover:bg-accent/50 transition-colors text-left"
                >
                  <ChevronDown className={cn("h-4 w-4 text-muted-foreground shrink-0 transition-transform duration-200", isDeptOpen && "rotate-180")} />
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-semibold">{dept}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {Object.keys(usersInDept).length} staff · {totalKpi} KPI kualitas
                    </span>
                  </div>
                </button>

                {isDeptOpen && (
                  <div className="border-t border-border bg-muted/20 divide-y divide-border">
                    {Object.entries(usersInDept).map(([uid, { userName, items }]) => {
                      const userKey = dept + uid;
                      const isUserOpen = expandedUsers.has(userKey);
                      const scoreKey = `${selectedYear}-${selectedMonthNum}`;
                      const avgPct = items.length > 0
                        ? items.reduce((s, i) => {
                            const ms = i.assignment.monthlyScores?.[scoreKey];
                            return s + (ms?.achievementPercentage ?? 0);
                          }, 0) / items.length
                        : 0;
                      const cat = getPerformanceCategory(avgPct) as KpiAssignment["performanceCategory"];

                      return (
                        <div key={uid}>
                          <button
                            onClick={() => toggleUser(dept, uid)}
                            className="w-full flex items-center gap-3 px-6 py-3 hover:bg-accent/40 transition-colors text-left"
                          >
                            <ChevronDown className={cn("h-3.5 w-3.5 text-muted-foreground shrink-0 transition-transform duration-200", isUserOpen && "rotate-180")} />
                            <div className="flex-1 min-w-0">
                              <span className="text-sm font-medium">{userName}</span>
                              <span className="text-xs text-muted-foreground ml-2">{items.length} KPI kualitas</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <span className="text-sm font-semibold tabular-nums">{formatPercentage(avgPct)}</span>
                              <PerformanceBadge category={cat} />
                            </div>
                          </button>

                          {isUserOpen && (
                            <div className="px-6 pb-3 space-y-2 bg-background/50">
                              {items.map(({ assignment, kpi }) => {
                                const monthScore = assignment.monthlyScores?.[scoreKey];
                                const displayActual = monthScore?.actualTotal ?? 0;
                                const displayPct = monthScore?.achievementPercentage ?? 0;
                                const displayCat = (monthScore?.performanceCategory ?? getPerformanceCategory(displayPct)) as KpiAssignment["performanceCategory"];
                                return (
                                  <div key={assignment.id} className="rounded-lg border border-border bg-card px-4 py-3 flex flex-col gap-3">
                                    <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                                      <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium">{kpi.title}</p>
                                        <p className="text-xs text-muted-foreground">
                                          Aktual: {formatPercentage(displayActual)} / {formatPercentage(assignment.monthlyTarget)}
                                        </p>
                                      </div>
                                      <div className="flex items-center gap-2 shrink-0">
                                        <PerformanceBadge category={displayCat} />
                                        <Input
                                          type="number"
                                          inputMode="decimal"
                                          step="any"
                                          min="0"
                                          max="100"
                                          className="w-24 h-8 text-sm"
                                          placeholder="Nilai %"
                                          value={inputValues[assignment.id] ?? ""}
                                          onChange={(e) =>
                                            setInputValues((prev) => ({ ...prev, [assignment.id]: e.target.value }))
                                          }
                                        />
                                        <Button
                                          size="sm"
                                          className="h-8"
                                          disabled={saving === assignment.id || !inputValues[assignment.id]}
                                          onClick={() => handleSave(assignment.id, assignment.monthlyTarget)}
                                        >
                                          {saving === assignment.id ? "..." : "Simpan"}
                                        </Button>
                                      </div>
                                    </div>
                                    <textarea
                                      rows={2}
                                      placeholder="Catatan evaluasi (opsional)..."
                                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring resize-none"
                                      value={noteValues[assignment.id] ?? ""}
                                      onChange={(e) =>
                                        setNoteValues((prev) => ({ ...prev, [assignment.id]: e.target.value }))
                                      }
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
