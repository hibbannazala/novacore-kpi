"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMyAssignments } from "@/hooks/useAssignments";
import { KpiCard } from "@/components/kpi/KpiCard";
import { DailyInputForm } from "@/components/kpi/DailyInputForm";
import { PeriodPicker, type Period } from "@/components/kpi/PeriodPicker";
import { monthName, todayISODate } from "@/lib/utils";
import type { KpiAssignmentWithDetails } from "@/types";

export default function TimKpiPage() {
  const { user } = useAuth();
  const now = new Date();
  const today = todayISODate();
  const currentMonthLabel = `${monthName(now.getMonth() + 1)} ${now.getFullYear()}`;

  const [filterMonth, setFilterMonth] = useState(() => {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const selectedYear = parseInt(filterMonth.split("-")[0]);
  const selectedMonthNum = parseInt(filterMonth.split("-")[1]);
  const monthLabel = `${monthName(selectedMonthNum)} ${selectedYear}`;

  const { assignments, isLoading } = useMyAssignments(
    user?.id,
    selectedYear,
    selectedMonthNum
  );
  const [selected, setSelected] = useState<KpiAssignmentWithDetails | null>(null);
  const [period, setPeriod] = useState<Period>({ type: "month" });

  function handleFilterMonthChange(value: string) {
    setFilterMonth(value);
    setPeriod({ type: "month" });
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
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-base font-semibold">KPI — {monthLabel}</h2>
          <p className="text-sm text-muted-foreground">{assignments.length} KPI</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="month"
            value={filterMonth}
            onChange={(e) => handleFilterMonthChange(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <PeriodPicker period={period} onChange={setPeriod} monthLabel={currentMonthLabel} maxDate={today} />
        </div>
      </div>

      {assignments.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-border text-center">
          <p className="text-sm font-medium">Belum ada KPI untuk bulan ini</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map((a) => (
            <KpiCard
              key={a.id}
              assignment={a}
              onClick={() => setSelected(a)}
              period={period}
            />
          ))}
        </div>
      )}

      {selected && user && (
        <DailyInputForm
          assignment={selected}
          open={!!selected}
          onClose={() => setSelected(null)}
          userId={user.id}
        />
      )}
    </div>
  );
}
