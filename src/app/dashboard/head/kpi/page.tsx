"use client";

import { useAuth } from "@/contexts/AuthContext";
import { useDivisionAssignments } from "@/hooks/useAssignments";
import { useDivisionMembers } from "@/hooks/useUsers";
import { useKpis } from "@/hooks/useKpis";
import { PerformanceBadge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatPercentage } from "@/lib/utils";
import { getManagedDepartments } from "@/types";

export default function HeadKpiPage() {
  const { user } = useAuth();
  const now = new Date();
  const departments = user ? getManagedDepartments(user) : [];
  const { assignments, isLoading } = useDivisionAssignments(
    departments,
    now.getFullYear(),
    now.getMonth() + 1
  );
  const { members: users } = useDivisionMembers(departments);
  const { kpis } = useKpis(now.getFullYear(), now.getMonth() + 1);

  const userMap = Object.fromEntries(users.map((u) => [u.id, u.name]));
  const kpiMap = Object.fromEntries(kpis.map((k) => [k.id, k.title]));

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
        <h2 className="text-base font-semibold">KPI Divisi</h2>
        <p className="text-sm text-muted-foreground">
          {assignments.length} KPI aktif bulan ini
        </p>
      </div>

      {assignments.length === 0 ? (
        <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border">
          <p className="text-sm text-muted-foreground">Tidak ada KPI aktif</p>
        </div>
      ) : (
        <div className="space-y-2">
          {assignments.map((a) => (
            <div key={a.id} className="rounded-xl border border-border bg-card px-4 py-3">
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">
                    {userMap[a.userId] ?? a.userId}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {kpiMap[a.kpiId] ?? "—"}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-sm font-semibold tabular-nums">
                    {formatPercentage(a.achievementPercentage)}
                  </span>
                  <PerformanceBadge category={a.performanceCategory} />
                </div>
              </div>
              <Progress value={Math.min(a.achievementPercentage, 100)} category={a.performanceCategory} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
