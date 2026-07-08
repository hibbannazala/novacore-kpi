"use client";

import { useKpis } from "@/hooks/useKpis";
import { useAllAssignments } from "@/hooks/useAssignments";
import { useDepartments } from "@/hooks/useDivisions";
import { useAllUsers } from "@/hooks/useUsers";
import { getKpiRole } from "@/types";
import { useAuth } from "@/contexts/AuthContext";
import { formatDateDisplay } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default function HrDashboard() {
  const { user } = useAuth();
  const now = new Date();
  const todayDisplay = formatDateDisplay(now.toISOString().split("T")[0]);
  const { kpis } = useKpis(now.getFullYear(), now.getMonth() + 1);
  const { departments } = useDepartments();
  const { users } = useAllUsers();

  const { assignments } = useAllAssignments(now.getFullYear(), now.getMonth() + 1);

  const activeKpis = kpis.filter((k) => k.status === "active");
  const draftKpis = kpis.filter((k) => k.status === "draft");
  const timUsers = users.filter((u) => getKpiRole(u) === "tim" || getKpiRole(u) === "head");

  const assignedUserIds = new Set(assignments.map((a) => a.userId));
  const unassignedUsers = timUsers.filter((u) => !assignedUserIds.has(u.id));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-white rounded-[18px] flex items-center justify-center shadow-sm border border-slate-100 shrink-0">
            <span className="text-xl font-black text-slate-800">{user?.name?.charAt(0)}</span>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Dashboard HR</p>
            <h1 className="text-xl font-black text-slate-800 tracking-tight leading-none truncate max-w-[200px]">
              {user?.name?.split(" ")[0]}
            </h1>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-bold text-slate-400 mt-2">{todayDisplay}</p>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              KPI Aktif
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{activeKpis.length}</p>
          </CardContent>
        </Card>
        <Card className="border-red-200 bg-red-50/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-red-600">
              Staff Tanpa KPI
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold text-red-700">{unassignedUsers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Total Karyawan Tim
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{timUsers.length}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">
              Departemen Aktif
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-bold">{departments.length}</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* Action Center: Staff Tanpa KPI */}
        {unassignedUsers.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-red-600">
              Perlu Tindakan: Staff Tanpa KPI ({unassignedUsers.length})
            </h2>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
              {unassignedUsers.map((u) => (
                <div
                  key={u.id}
                  className="flex items-center justify-between rounded-xl border border-red-100 bg-white px-4 py-3 shadow-sm"
                >
                  <div>
                    <p className="text-sm font-medium">{u.name}</p>
                    <p className="text-xs text-muted-foreground">{u.department}</p>
                  </div>
                  <a
                    href="/dashboard/hr/assignments"
                    className="rounded bg-red-100 px-3 py-1 text-xs font-semibold text-red-700 hover:bg-red-200 transition-colors"
                  >
                    Assign Sekarang
                  </a>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* KPI Draft */}
        {draftKpis.length > 0 && (
          <div>
            <h2 className="mb-3 text-sm font-semibold text-amber-600">
              KPI Draft — Belum Diaktifkan ({draftKpis.length})
            </h2>
            <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
              {draftKpis.map((k) => (
                <div
                  key={k.id}
                  className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{k.title}</p>
                    <p className="text-xs text-muted-foreground">{k.department}</p>
                  </div>
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                    Draft
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
