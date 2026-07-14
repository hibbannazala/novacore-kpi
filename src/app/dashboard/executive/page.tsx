"use client";

import { useState, useMemo } from "react";

import { useDepartments } from "@/hooks/useDivisions";
import { useAllUsers } from "@/hooks/useUsers";
import { useAuth } from "@/contexts/AuthContext";
import { useAssignmentsForPeriod } from "@/hooks/useAssignmentsForPeriod";
import { PeriodPicker, type Period } from "@/components/kpi/PeriodPicker";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PerformanceBadge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { getPerformanceCategory, formatPercentage, monthName, todayISODate, formatDateDisplay } from "@/lib/utils";
import { getKpiRole } from "@/types";
import type { KpiAssignment } from "@/types";

interface DeptSummary {
  department: string;
  avgAchievement: number;
  memberCount: number;
  criticalCount: number;
}

export default function ExecutiveDashboard() {
  const { user } = useAuth();
  const now = new Date();
  const monthLabel = `${monthName(now.getMonth() + 1)} ${now.getFullYear()}`;
  const today = todayISODate();
  const todayDisplay = formatDateDisplay(now.toISOString().split("T")[0]);

  const [period, setPeriod] = useState<Period>({ type: "month" });
  const { departments, isLoading: deptLoading } = useDepartments();
  const { users } = useAllUsers();
  const { assignments, reportsByAssignment, isLoading } = useAssignmentsForPeriod(period);
  const isRange = period.type === "range";

  const { summaries, companyAvg } = useMemo(() => {
    const usersByDept: Record<string, number> = {};
    users
      .filter((u) => getKpiRole(u) === "tim" || getKpiRole(u) === "head")
      .forEach((u) => {
        if (u.department) usersByDept[u.department] = (usersByDept[u.department] ?? 0) + 1;
      });

    const byDept: Record<string, KpiAssignment[]> = {};
    assignments.forEach((a) => {
      if (!byDept[a.department]) byDept[a.department] = [];
      byDept[a.department].push(a);
    });


    const allPcts: number[] = [];
    const s: DeptSummary[] = departments.map((dept) => {
      const deptAssignments = byDept[dept] ?? [];
      const pcts = deptAssignments.map((a) => {
        if (isRange) {
          const reports = reportsByAssignment[a.id] ?? [];
          const actual = reports.reduce((sum, r) => sum + r.actualValue, 0);
          return a.monthlyTarget > 0 ? (actual / a.monthlyTarget) * 100 : 0;
        }
        return a.achievementPercentage;
      });
      allPcts.push(...pcts);
      const avg = pcts.length > 0 ? pcts.reduce((s, v) => s + v, 0) / pcts.length : 0;
      const critical = pcts.filter((p) => getPerformanceCategory(p) === "critical").length;
      return { department: dept, avgAchievement: avg, memberCount: usersByDept[dept] ?? 0, criticalCount: critical };
    });

    const avg = allPcts.length > 0 ? allPcts.reduce((s, v) => s + v, 0) / allPcts.length : 0;
    return { summaries: s, companyAvg: avg };
  }, [assignments, reportsByAssignment, departments, users, isRange]);

  const dbgFirst = assignments[0];

  if (isLoading || deptLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const timUsers = users.filter((u) => getKpiRole(u) === "tim" || getKpiRole(u) === "head");
  const companyCategory = getPerformanceCategory(companyAvg);

  return (
    <div className="space-y-6">
      {/* TEMP DEBUG — hapus setelah fix */}
      <pre className="text-[10px] bg-yellow-100 text-black p-2 rounded overflow-auto">
        {`assignments: ${assignments.length} | dept: "${dbgFirst?.department}" | pct: ${dbgFirst?.achievementPercentage} | typeof: ${typeof dbgFirst?.achievementPercentage}`}
      </pre>
      <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white rounded-[18px] flex items-center justify-center shadow-sm border border-slate-100 shrink-0">
            <span className="text-xl font-black text-slate-800">{user?.name?.charAt(0)}</span>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Executive Overview</p>
            <h1 className="text-xl font-black text-slate-800 tracking-tight leading-none truncate max-w-[200px]">
              {user?.name?.split(" ")[0]}
            </h1>
          </div>
        </div>
        <div className="text-right">
          <PeriodPicker period={period} onChange={setPeriod} monthLabel={monthLabel} maxDate={today} />
          <p className="text-[10px] font-bold text-slate-400 mt-2">{todayDisplay}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Rata-rata Perusahaan
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold tabular-nums">{formatPercentage(companyAvg)}</p>
            <PerformanceBadge category={companyCategory} className="mt-1" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Karyawan Tim
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{timUsers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Departemen Aktif
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{departments.length}</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-sm font-semibold">Performa per Departemen</h2>
        <div className="space-y-2">
          {summaries
            .sort((a, b) => b.avgAchievement - a.avgAchievement)
            .map(({ department, avgAchievement, memberCount, criticalCount }) => {
              const cat = getPerformanceCategory(avgAchievement);
              return (
                <div key={department} className="rounded-xl border border-border bg-card px-4 py-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-medium">{department}</p>
                      <p className="text-xs text-muted-foreground">
                        {memberCount} anggota
                        {criticalCount > 0 && (
                          <span className="ml-2 text-red-600 font-medium">
                            · {criticalCount} critical
                          </span>
                        )}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-bold tabular-nums">
                        {formatPercentage(avgAchievement)}
                      </span>
                      <PerformanceBadge category={cat} />
                    </div>
                  </div>
                  <Progress value={Math.min(avgAchievement, 100)} category={cat} />
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
