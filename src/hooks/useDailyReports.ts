"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { DailyReport } from "@/types";

function rowToReport(row: Record<string, unknown>): DailyReport {
  return {
    id: row.id as string,
    assignmentId: row.assignment_id as string,
    kpiId: (row.kpi_id as string) ?? "",
    userId: row.user_id as string,
    department: "",
    date: row.date as string,
    actualValue: row.value as number,   // DB column is "value", type uses "actualValue"
    notes: (row.notes as string) ?? "",
    isHolidayRollover: false,
    originalDate: null,
    createdAt: row.created_at as DailyReport["createdAt"],
    updatedAt: row.updated_at as DailyReport["updatedAt"],
  };
}

export function useDailyReportsForAssignment(
  assignmentId: string | undefined,
  userId: string | undefined
) {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!assignmentId || !userId) {
      setReports([]);
      setIsLoading(false);
      return;
    }

    const supabase = createClient();

    async function fetch() {
      const { data } = await supabase
        .from("daily_reports")
        .select("*")
        .eq("assignment_id", assignmentId!)
        .eq("user_id", userId!)
        .order("date", { ascending: false });
      setReports((data ?? []).map(rowToReport as any));
      setIsLoading(false);
    }

    fetch();

    const channel = supabase
      .channel(`reports_${assignmentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_reports", filter: `assignment_id=eq.${assignmentId}` },
        fetch
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [assignmentId, userId]);

  return { reports, isLoading };
}

export function useDailyReportsInRange(
  startDate: string,
  endDate: string,
  options?: { userId?: string; assignmentIds?: string[] }
) {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!startDate || !endDate) {
      setReports([]);
      setIsLoading(false);
      return;
    }

    const supabase = createClient();

    async function fetch() {
      let q = supabase
        .from("daily_reports")
        .select("*")
        .gte("date", startDate)
        .lte("date", endDate)
        .order("date", { ascending: false });

      if (options?.userId) {
        q = q.eq("user_id", options.userId);
      }
      if (options?.assignmentIds && options.assignmentIds.length > 0) {
        q = q.in("assignment_id", options.assignmentIds);
      }

      const { data } = await q;
      setReports((data ?? []).map(rowToReport as any));
      setIsLoading(false);
    }

    fetch();

    const channel = supabase
      .channel(`reports_range_${startDate}_${endDate}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "daily_reports" }, fetch)
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [startDate, endDate, options?.userId, JSON.stringify(options?.assignmentIds)]);

  return { reports, isLoading };
}
