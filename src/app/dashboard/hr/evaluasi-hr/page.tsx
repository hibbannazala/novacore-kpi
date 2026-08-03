"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAllUsers } from "@/hooks/useUsers";
import { useAuth } from "@/contexts/AuthContext";
import { getKpiRole } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPercentage, getPerformanceCategory } from "@/lib/utils";
import { PerformanceBadge } from "@/components/ui/badge";
import type { KpiAssignment, KPI } from "@/types";

interface EvaluasiHrAssignment {
  assignment: KpiAssignment;
  kpi: KPI;
  userName: string;
}

export default function EvaluasiHrPage() {
  const { user } = useAuth();
  const { users } = useAllUsers();
  const now = new Date();

  const role = user ? getKpiRole(user) : null;
  if (role && role !== "hr" && role !== "executive" && role !== "developer") {
    return (
      <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border">
        <p className="text-sm text-muted-foreground">Akses tidak diizinkan. Hanya HR yang bisa mengakses halaman ini.</p>
      </div>
    );
  }

  const [assignments, setAssignments] = useState<EvaluasiHrAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [inputValues, setInputValues] = useState<Record<string, string>>({});
  const [inputNotes, setInputNotes] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  const selectedYear = now.getFullYear();
  const selectedMonth = now.getMonth() + 1;

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: aRows } = await supabase
        .from("kpi_assignments")
        .select("*, kpis(id, title, type, unit, monthly_target, departments(name)), monthly_scores(*)")
        .eq("year", selectedYear)
        .eq("month", selectedMonth)
        .eq("status", "active")
        .in("kpis.type", ["lead_tim", "hr"]);

      const userMap: Record<string, string> = {};
      users.forEach((u) => { userMap[u.id] = u.name; });

      const items: EvaluasiHrAssignment[] = [];
      (aRows ?? []).forEach((row: any) => {
        const kpiRow = row.kpis;
        // Supabase sometimes returns rows where inner join filter fails but keeps the row with kpis=null if not inner joined properly, but .in("kpis.type", ...) might work.
        // Let's filter client side just in case
        if (!kpiRow || (kpiRow.type !== "lead_tim" && kpiRow.type !== "hr")) return;

        const assignment: KpiAssignment = {
          id: row.id,
          kpiId: row.kpi_id,
          userId: row.user_id,
          department: kpiRow.departments?.name ?? "",
          kpiType: kpiRow.type,
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
          month: selectedMonth,
          createdAt: "",
          updatedAt: "",
        };

        items.push({ assignment, kpi, userName: userMap[row.user_id] ?? row.user_id });
      });

      setAssignments(items);
      setIsLoading(false);
    }

    if (users.length > 0) load();
  }, [users, selectedYear, selectedMonth]);

  async function handleSave(assignmentId: string, monthlyTarget: number) {
    const value = parseFloat(inputValues[assignmentId]);
    const notes = inputNotes[assignmentId] ?? "";
    if (isNaN(value) || value < 0) return;
    setSaving(assignmentId);
    try {
      const pct = monthlyTarget > 0 ? (value / monthlyTarget) * 100 : 0;
      const supabase = createClient();

      await supabase.from("monthly_scores").upsert({
        assignment_id: assignmentId,
        year: selectedYear,
        month: selectedMonth,
        actual_total: value,
        achievement_percentage: pct,
      }, { onConflict: "assignment_id,year,month" });

      await supabase.from("kpi_assignments").update({
        actual_total: value,
        achievement_percentage: pct,
        notes: notes,
      }).eq("id", assignmentId);

      setInputValues((prev) => ({ ...prev, [assignmentId]: "" }));
      setInputNotes((prev) => ({ ...prev, [assignmentId]: "" }));
      
      setAssignments((prev) =>
        prev.map((q) =>
          q.assignment.id === assignmentId
            ? { ...q, assignment: { ...q.assignment, actualTotal: value, achievementPercentage: pct, performanceCategory: getPerformanceCategory(pct) as any, notes: notes } }
            : q
        )
      );
    } finally {
      setSaving(null);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Evaluasi HR (Personality & Work Behavior)</h2>
        <p className="text-sm text-muted-foreground">{assignments.length} KPI Lead Tim / HR aktif bulan ini</p>
      </div>

      {assignments.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">Tidak ada KPI Personality (Lead Tim / HR) aktif bulan ini</p>
        </div>
      ) : (
        <div className="space-y-2">
          {assignments.map(({ assignment, kpi, userName }) => (
            <div key={assignment.id} className="rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex flex-col sm:flex-row sm:items-center gap-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{kpi.title}</p>
                  <p className="text-xs text-muted-foreground">{userName} · {assignment.department}</p>
                  <div className="mt-1 flex items-center gap-2">
                    <span className="text-[10px] uppercase font-bold tracking-widest text-primary/80 bg-primary/10 px-2 py-0.5 rounded-full">
                      {kpi.type === 'lead_tim' ? 'Lead Tim' : 'HR'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      Aktual: {formatPercentage(assignment.actualTotal)} / {formatPercentage(assignment.monthlyTarget)}
                    </span>
                  </div>
                  {assignment.notes && (
                    <div className="mt-2 text-xs bg-slate-50 dark:bg-slate-800/50 p-2 rounded border border-slate-100 dark:border-slate-800">
                      <span className="font-semibold text-slate-500">Note: </span>
                      <span className="italic">{assignment.notes}</span>
                    </div>
                  )}
                </div>
                <div className="flex flex-col gap-2 shrink-0 sm:w-64">
                  <div className="flex items-center gap-2 justify-end">
                    <PerformanceBadge category={assignment.performanceCategory} />
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
                  </div>
                  <Input
                    type="text"
                    className="h-8 text-sm w-full"
                    placeholder="Catatan / Note"
                    value={inputNotes[assignment.id] ?? ""}
                    onChange={(e) =>
                      setInputNotes((prev) => ({ ...prev, [assignment.id]: e.target.value }))
                    }
                  />
                  <Button
                    size="sm"
                    className="h-8 w-full"
                    disabled={saving === assignment.id || !inputValues[assignment.id]}
                    onClick={() => handleSave(assignment.id, assignment.monthlyTarget)}
                  >
                    {saving === assignment.id ? "Menyimpan..." : "Simpan & Update"}
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
