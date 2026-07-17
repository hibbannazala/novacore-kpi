import type {
  KpiAssignment,
  KpiAssignmentWithDetails,
  KPI,
  User,
  KpiType,
  KpiRole,
  AssignmentStatus,
  QualityMonthScore,
} from "@/types";
import { getPerformanceCategory } from "@/lib/utils";

export const ASSIGNMENT_SELECT = `
  *,
  kpis (*, departments (name)),
  users!user_id (*, departments (name)),
  monthly_scores (*)
` as const;

function rowToKpi(kpi: Record<string, unknown>): KPI {
  const dept = (kpi.departments as { name: string } | null)?.name ?? "";
  return {
    id: kpi.id as string,
    title: kpi.title as string,
    description: (kpi.description as string) ?? "",
    type: (kpi.type as KpiType) ?? "result",
    unit: (kpi.unit as KPI["unit"]) ?? "number",
    period: (kpi.period as KPI["period"]) ?? "monthly",
    status: (kpi.status as KPI["status"]) ?? "active",
    department: dept,
    brand: (kpi.brand as string | undefined) ?? undefined,
    createdBy: (kpi.created_by as string) ?? "",
    monthlyTarget: (kpi.monthly_target as number) ?? 0,
    year: (kpi.year as number) ?? 0,
    month: (kpi.month as number) ?? 0,
    createdAt: kpi.created_at as KPI["createdAt"],
    updatedAt: kpi.updated_at as KPI["updatedAt"],
  };
}

function rowToUser(u: Record<string, unknown>): User {
  const dept = (u.departments as { name: string } | null)?.name ?? null;
  return {
    id: u.id as string,
    name: u.name as string,
    email: u.email as string,
    kpiRole: u.kpi_role as KpiRole,
    departmentId: u.department_id as string | null,
    departmentName: dept,
    department: dept,
    position: u.position as string | null,
    photoUrl: u.photo_url as string | null,
    absensiRole: (u.absensi_role as "staff" | "admin") ?? "staff",
    absensiStatus: (u.absensi_status as User["absensiStatus"]) ?? "pending",
    leaveQuota: (u.leave_quota as number) ?? 12,
    sickQuota: (u.sick_quota as number) ?? 14,
    isHidden: (u.is_hidden as boolean) ?? false,
    createdAt: u.created_at as string,
    updatedAt: u.updated_at as string,
  };
}

export function rowToAssignmentWithDetails(row: Record<string, unknown>): KpiAssignmentWithDetails {
  const kpiRow = row.kpis as Record<string, unknown> | null;
  const userRow = row.users as Record<string, unknown> | null;
  const msRows = (row.monthly_scores as Array<Record<string, unknown>>) ?? [];

  const monthlyScores: Record<string, QualityMonthScore> = {};
  msRows.forEach((ms) => {
    const key = `${ms.year}-${ms.month}`;
    monthlyScores[key] = {
      actualTotal: ms.actual_total as number,
      achievementPercentage: ms.achievement_percentage as number,
      performanceCategory: getPerformanceCategory(ms.achievement_percentage as number),
    };
  });

  const achievement = (row.achievement_percentage as number) ?? 0;

  const assignment: KpiAssignment = {
    id: row.id as string,
    kpiId: row.kpi_id as string,
    userId: row.user_id as string,
    department: kpiRow
      ? ((kpiRow.departments as { name: string } | null)?.name ?? "")
      : "",
    kpiType: kpiRow ? ((kpiRow.type as KpiType) ?? undefined) : undefined,
    status: (row.status as AssignmentStatus) ?? "active",
    monthlyTarget: (row.monthly_target as number) ?? 0,
    actualTotal: (row.actual_total as number) ?? 0,
    achievementPercentage: achievement,
    performanceCategory: getPerformanceCategory(achievement),
    weight: (row.weight as number) ?? 0,
    notes: (row.notes as string) ?? "",
    year: row.year as number,
    month: row.month as number,
    currentDailyTarget: 0,
    expectedTotal: 0,
    workingDaysTotal: 0,
    workingDaysElapsed: 0,
    workingDaysRemaining: 0,
    activeDays: 0,
    heldAt: null,
    cancelledAt: null,
    completedAt: null,
    createdAt: row.created_at as KpiAssignment["createdAt"],
    updatedAt: row.updated_at as KpiAssignment["updatedAt"],
    qualityNotes: "",
    monthlyScores: Object.keys(monthlyScores).length > 0 ? monthlyScores : undefined,
  };

  return {
    ...assignment,
    kpi: kpiRow ? rowToKpi(kpiRow) : (null as unknown as KPI),
    user: userRow ? rowToUser(userRow) : (null as unknown as User),
  };
}

const TYPE_ORDER: Record<string, number> = { result: 1, activity: 2, quality: 3 };

export function sortAssignments(list: KpiAssignmentWithDetails[]): KpiAssignmentWithDetails[] {
  return [...list].sort((a, b) => {
    const brandA = a.kpi?.brand ?? "";
    const brandB = b.kpi?.brand ?? "";
    if (brandA !== brandB) return brandA.localeCompare(brandB);

    const orderA = TYPE_ORDER[a.kpi?.type ?? a.kpiType ?? ""] ?? 99;
    const orderB = TYPE_ORDER[b.kpi?.type ?? b.kpiType ?? ""] ?? 99;
    if (orderA !== orderB) return orderA - orderB;

    return (a.kpi?.title ?? "").localeCompare(b.kpi?.title ?? "");
  });
}
