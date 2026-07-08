"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { KPI, KpiType } from "@/types";

function rowToKpi(row: Record<string, unknown>): KPI {
  const dept = (row.departments as { name: string } | null)?.name ?? "";
  return {
    id: row.id as string,
    title: row.title as string,
    description: (row.description as string) ?? "",
    type: (row.type as KpiType) ?? "result",
    unit: (row.unit as KPI["unit"]) ?? "number",
    period: (row.period as KPI["period"]) ?? "monthly",
    status: (row.status as KPI["status"]) ?? "active",
    department: dept,
    brand: (row.brand as string | undefined) ?? undefined,
    createdBy: (row.created_by as string) ?? "",
    monthlyTarget: (row.monthly_target as number) ?? 0,
    year: (row.year as number) ?? 0,
    month: (row.month as number) ?? 0,
    createdAt: row.created_at as KPI["createdAt"],
    updatedAt: row.updated_at as KPI["updatedAt"],
  };
}

export function useKpis(year: number, month: number) {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function fetch() {
      const { data } = await supabase
        .from("kpis")
        .select("*, departments(name)")
        .eq("year", year)
        .eq("month", month)
        .order("created_at", { ascending: false });
      setKpis((data ?? []).map(rowToKpi));
      setIsLoading(false);
    }

    fetch();
  }, [year, month]);

  return { kpis, isLoading };
}

export function useDepartmentKpis(
  department: string | undefined,
  year: number,
  month: number
) {
  const [kpis, setKpis] = useState<KPI[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!department) {
      setKpis([]);
      setIsLoading(false);
      return;
    }

    const supabase = createClient();

    async function fetch() {
      // Get department id first
      const { data: deptRow } = await supabase
        .from("departments")
        .select("id")
        .eq("name", department)
        .single();

      if (!deptRow) {
        setKpis([]);
        setIsLoading(false);
        return;
      }

      const { data } = await supabase
        .from("kpis")
        .select("*, departments(name)")
        .eq("department_id", deptRow.id)
        .eq("year", year)
        .eq("month", month);

      setKpis((data ?? []).map(rowToKpi));
      setIsLoading(false);
    }

    fetch();
  }, [department, year, month]);

  return { kpis, isLoading };
}

export { rowToKpi };
