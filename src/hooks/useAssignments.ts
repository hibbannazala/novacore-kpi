"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ASSIGNMENT_SELECT, rowToAssignmentWithDetails, sortAssignments } from "@/lib/supabase/assignmentHelpers";
import type { KpiAssignment, KpiAssignmentWithDetails } from "@/types";

export function useMyAssignments(userId: string | undefined, year: number, month: number) {
  const [assignments, setAssignments] = useState<KpiAssignmentWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setAssignments([]);
      setIsLoading(false);
      return;
    }

    const supabase = createClient();
    const now = new Date();
    const isPastMonth =
      year < now.getFullYear() ||
      (year === now.getFullYear() && month < now.getMonth() + 1);

    async function fetch() {
      const statusFilter = isPastMonth ? ["active", "completed"] : ["active"];
      const { data } = await supabase
        .from("kpi_assignments")
        .select(ASSIGNMENT_SELECT)
        .eq("user_id", userId!)
        .eq("year", year)
        .eq("month", month)
        .in("status", statusFilter);

      setAssignments(sortAssignments((data ?? []).map(rowToAssignmentWithDetails as any)));
      setIsLoading(false);
    }

    fetch();

    const channel = supabase
      .channel(`my_assignments_${userId}_${year}_${month}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "kpi_assignments", filter: `user_id=eq.${userId}` },
        fetch
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "monthly_scores" }, fetch)
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [userId, year, month]);

  return { assignments, isLoading };
}

export function useAllAssignments(year: number, month: number) {
  const [assignments, setAssignments] = useState<KpiAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function fetch() {
      const { data } = await supabase
        .from("kpi_assignments")
        .select("*")
        .eq("year", year)
        .eq("month", month);
      setAssignments(
        (data ?? []).map((row) => rowToAssignmentWithDetails(row as any) as KpiAssignment)
      );
      setIsLoading(false);
    }

    fetch();

    const channel = supabase
      .channel(`all_assignments_${year}_${month}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "kpi_assignments" }, fetch)
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [year, month]);

  return { assignments, isLoading };
}

export function useDivisionAssignments(
  department: string | string[] | undefined,
  year: number,
  month: number
) {
  const [assignments, setAssignments] = useState<KpiAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const departments =
      typeof department === "string"
        ? department ? [department] : []
        : department ?? [];

    if (departments.length === 0) {
      setAssignments([]);
      setIsLoading(false);
      return;
    }

    const supabase = createClient();

    async function fetch() {
      // Get department IDs first
      const { data: deptRows } = await supabase
        .from("departments")
        .select("id")
        .in("name", departments);
      const deptIds = (deptRows ?? []).map((d) => d.id);
      if (deptIds.length === 0) { setAssignments([]); setIsLoading(false); return; }

      const { data } = await supabase
        .from("kpi_assignments")
        .select("*")
        .eq("year", year)
        .eq("month", month)
        .eq("status", "active")
        .in("department_id", deptIds);

      setAssignments(
        (data ?? []).map((row) => rowToAssignmentWithDetails(row as any) as KpiAssignment)
      );
      setIsLoading(false);
    }

    fetch();

    const channel = supabase
      .channel(`division_assignments_${year}_${month}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "kpi_assignments" }, fetch)
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [JSON.stringify(department), year, month]);

  return { assignments, isLoading };
}
