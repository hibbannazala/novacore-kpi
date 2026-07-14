"use client";

import { useEffect, useState, useMemo } from "react";
import { createClient } from "@/lib/supabase/client";
import { ASSIGNMENT_SELECT, rowToAssignmentWithDetails } from "@/lib/supabase/assignmentHelpers";
import { todayISODate, getPerformanceCategory } from "@/lib/utils";
import type { KpiAssignment, KPI, DailyReport } from "@/types";
import type { Period } from "@/components/kpi/PeriodPicker";

function firstDayOfMonth(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, "0")}-01`;
}

function lastDayOfMonth(year: number, month: number): string {
  const last = new Date(year, month, 0).getDate();
  return `${year}-${String(month).padStart(2, "0")}-${String(last).padStart(2, "0")}`;
}

function parseISODate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return { year, month, day };
}

export function useAssignmentsForPeriod(period: Period, department?: string | string[]) {
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1;

  const [assignments, setAssignments] = useState<KpiAssignment[]>([]);
  const [kpisMap, setKpisMap] = useState<Record<string, KPI>>({});
  const [assignmentsLoading, setAssignmentsLoading] = useState(true);
  const [dailyReports, setDailyReports] = useState<DailyReport[]>([]);

  useEffect(() => {
    setAssignmentsLoading(true);
    setAssignments([]);

    const departments =
      typeof department === "string"
        ? department ? [department] : []
        : department ?? [];
    const filterByDept = department !== undefined;

    const supabase = createClient();

    async function fetchDeptIds(): Promise<string[]> {
      if (!filterByDept || departments.length === 0) return [];
      const { data } = await supabase
        .from("departments")
        .select("id")
        .in("name", departments);
      return (data ?? []).map((d) => d.id);
    }

    async function fetchAll() {
      const deptIds = await fetchDeptIds();

      if (filterByDept && deptIds.length === 0) {
        setAssignments([]);
        setKpisMap({});
        setAssignmentsLoading(false);
        return;
      }

      if (period.type === "month") {
        let q = supabase
          .from("kpi_assignments")
          .select(ASSIGNMENT_SELECT)
          .eq("year", currentYear)
          .eq("month", currentMonth)
          .eq("status", "active");

        if (filterByDept) q = q.in("department_id", deptIds);

        const { data } = await q;
        const rows = (data ?? []).map(rowToAssignmentWithDetails as any) as KpiAssignment[];
        setAssignments(rows);

        const map: Record<string, KPI> = {};
        rows.forEach((a: any) => { if (a.kpi) map[a.kpiId] = a.kpi; });
        setKpisMap(map);
      } else {
        // Range mode: fetch all months in range
        const start = parseISODate(period.start);
        const end = parseISODate(period.end);

        // Build list of (year, month) pairs in range
        const monthPairs: Array<[number, number]> = [];
        let y = start.year, m = start.month;
        while (y < end.year || (y === end.year && m <= end.month)) {
          monthPairs.push([y, m]);
          m++; if (m > 12) { m = 1; y++; }
        }

        const uniqueYears = [...new Set(monthPairs.map(([y]) => y))];
        const monthsByYear: Record<number, number[]> = {};
        monthPairs.forEach(([y, m]) => {
          monthsByYear[y] = monthsByYear[y] ?? [];
          if (!monthsByYear[y].includes(m)) monthsByYear[y].push(m);
        });

        const queries = Object.entries(monthsByYear).map(([yearStr, months]) => {
          let q = supabase
            .from("kpi_assignments")
            .select(ASSIGNMENT_SELECT)
            .eq("year", Number(yearStr))
            .in("month", months)
            .in("status", ["active", "completed"]);

          if (filterByDept) q = q.in("department_id", deptIds);
          return q;
        });

        // Also fetch quality assignments (they don't have a month in range, they span via monthlyScores)
        const qualityQueries = uniqueYears.map((y) => {
          let q = supabase
            .from("kpi_assignments")
            .select(ASSIGNMENT_SELECT)
            .eq("year", y)
            .eq("status", "active");

          if (filterByDept) q = q.in("department_id", deptIds);
          return q;
        });

        const results = await Promise.all([...queries, ...qualityQueries]);
        const allRows = results.flatMap((r) =>
          (r.data ?? []).map(rowToAssignmentWithDetails as any)
        );
        // Deduplicate by id
        const seen = new Set<string>();
        const unique = allRows.filter((a: any) => {
          if (seen.has(a.id)) return false;
          seen.add(a.id);
          return true;
        });

        setAssignments(unique as KpiAssignment[]);

        const map: Record<string, KPI> = {};
        unique.forEach((a: any) => { if (a.kpi) map[a.kpiId] = a.kpi; });
        setKpisMap(map);
      }

      setAssignmentsLoading(false);
    }

    fetchAll();

    // Realtime: re-fetch when assignments or monthly_scores change
    const channel = supabase
      .channel(`period_assignments_${period.type}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "kpi_assignments" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "monthly_scores" }, fetchAll)
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [
    currentYear,
    currentMonth,
    period.type,
    period.type === "range" ? period.start : "",
    period.type === "range" ? period.end : "",
    JSON.stringify(department),
  ]);

  // Fetch daily_reports for the period (for Rincian Harian display)
  useEffect(() => {
    const supabase = createClient();
    const today = todayISODate();

    const rangeStart = period.type === "range"
      ? period.start
      : firstDayOfMonth(currentYear, currentMonth);
    const monthEnd = lastDayOfMonth(currentYear, currentMonth);
    const rangeEnd = period.type === "range"
      ? period.end
      : (today < monthEnd ? today : monthEnd);

    async function fetchReports() {
      const { data } = await supabase
        .from("daily_reports")
        .select("id, assignment_id, kpi_id, user_id, date, value, notes, created_at, updated_at")
        .gte("date", rangeStart)
        .lte("date", rangeEnd);

      setDailyReports(
        (data ?? []).map((r: any) => ({
          id: r.id,
          assignmentId: r.assignment_id,
          kpiId: r.kpi_id ?? "",
          userId: r.user_id,
          date: r.date,
          actualValue: r.value,
          notes: r.notes ?? "",
          createdAt: r.created_at,
          updatedAt: r.updated_at,
        }))
      );
    }

    fetchReports();

    const channel = supabase
      .channel(`daily_reports_${period.type}_${rangeStart}_${rangeEnd}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_reports" }, fetchReports)
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [
    currentYear,
    currentMonth,
    period.type,
    period.type === "range" ? period.start : "",
    period.type === "range" ? period.end : "",
  ]);

  // Build date range for daily reports
  const { rangeStart, rangeEnd } = useMemo(() => {
    if (period.type === "range") {
      return { rangeStart: period.start, rangeEnd: period.end };
    }
    const today = todayISODate();
    const monthEnd = lastDayOfMonth(currentYear, currentMonth);
    return {
      rangeStart: firstDayOfMonth(currentYear, currentMonth),
      rangeEnd: today < monthEnd ? today : monthEnd,
    };
  }, [period, currentYear, currentMonth]);

  const reportsByAssignment = useMemo(() => {
    const map: Record<string, DailyReport[]> = {};
    dailyReports.forEach((r) => {
      if (!map[r.assignmentId]) map[r.assignmentId] = [];
      map[r.assignmentId].push(r);
    });
    return map;
  }, [dailyReports]);

  // Sync quality KPI scores from monthlyScores
  const syncedAssignments = useMemo(() => {
    return assignments.map((a) => {
      const kpiType = a.kpiType ?? kpisMap[a.kpiId]?.type;

      if (kpiType === "quality") {
        let scoreKey: string;
        if (period.type === "month") {
          scoreKey = `${currentYear}-${currentMonth}`;
        } else {
          const endDate = parseISODate(period.end);
          scoreKey = `${endDate.year}-${endDate.month}`;
        }
        const ms = a.monthlyScores?.[scoreKey];
        return {
          ...a,
          actualTotal: ms?.actualTotal ?? 0,
          achievementPercentage: ms?.achievementPercentage ?? 0,
          performanceCategory: (ms?.performanceCategory ?? getPerformanceCategory(0)) as KpiAssignment["performanceCategory"],
          qualityNotes: ms?.qualityNotes ?? "",
        };
      }

      return a;
    });
  }, [assignments, period, kpisMap, currentYear, currentMonth]);

  return {
    assignments: syncedAssignments,
    kpisMap,
    reportsByAssignment,
    isLoading: assignmentsLoading,
  };
}
