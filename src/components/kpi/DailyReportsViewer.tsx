"use client";

import { useEffect, useState } from "react";
import { MessageSquare } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { cn, formatDateDisplay, formatNumber, formatPercentage, formatCurrency } from "@/lib/utils";
import type { Period } from "@/components/kpi/PeriodPicker";
import type { DailyReport } from "@/types";

function formatValue(value: number, unit: string) {
  if (unit === "currency") return formatCurrency(value);
  if (unit === "percentage") return formatPercentage(value);
  return formatNumber(value);
}

// Helpers for date ranges
function todayISODate() {
  const d = new Date();
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

function firstDayOfMonth(year: number, month: number) {
  const y = String(year);
  const m = String(month).padStart(2, "0");
  return `${y}-${m}-01`;
}

function lastDayOfMonth(year: number, month: number) {
  const d = new Date(year, month, 0);
  const y = String(d.getFullYear());
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

interface DailyReportsViewerProps {
  assignmentId: string;
  period: Period;
  currentYear: number;
  currentMonth: number;
  unit: string;
}

export function DailyReportsViewer({
  assignmentId,
  period,
  currentYear,
  currentMonth,
  unit,
}: DailyReportsViewerProps) {
  const [reports, setReports] = useState<DailyReport[]>([]);
  const [isLoading, setIsLoading] = useState(true);

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

    let isMounted = true;

    async function fetchReports() {
      setIsLoading(true);
      const { data } = await supabase
        .from("daily_reports")
        .select("id, assignment_id, kpi_id, user_id, date, value, notes, created_at, updated_at")
        .eq("assignment_id", assignmentId)
        .gte("date", rangeStart)
        .lte("date", rangeEnd)
        .order("date", { ascending: false });

      if (isMounted) {
        setReports(
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
        setIsLoading(false);
      }
    }

    fetchReports();

    const channel = supabase
      .channel(`reports_${assignmentId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "daily_reports", filter: `assignment_id=eq.${assignmentId}` },
        fetchReports
      )
      .subscribe();

    return () => {
      isMounted = false;
      channel.unsubscribe();
    };
  }, [assignmentId, period, currentYear, currentMonth]);

  return (
    <>
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground font-medium uppercase tracking-wide mb-2">
        <MessageSquare className="h-3 w-3" />
        Rincian Harian
        {!isLoading && reports.length > 0 && (
          <span className="text-foreground">({reports.length})</span>
        )}
      </div>

      {isLoading ? (
        <p className="text-[11px] text-muted-foreground italic mt-1 animate-pulse">
          Memuat laporan...
        </p>
      ) : reports.length === 0 ? (
        <p className="text-[11px] text-muted-foreground italic mt-1">
          Belum ada laporan di periode ini
        </p>
      ) : (
        <div className="space-y-3 max-h-48 overflow-y-auto pr-1 border-l-2 border-slate-100 ml-1.5 pl-3 py-1">
          {reports.map((r) => {
            const isPositive = r.actualValue > 0;
            return (
              <div key={r.id} className="relative">
                <div className="absolute -left-[17px] top-1.5 h-2 w-2 rounded-full bg-slate-300 ring-2 ring-white" />
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[10px] font-medium bg-white border border-slate-200 text-slate-500 px-1.5 py-0.5 rounded shadow-sm">
                    {formatDateDisplay(r.date)}
                  </span>
                  <span className={cn("text-[11px] font-bold", isPositive ? "text-teal-600" : "text-slate-400")}>
                    {isPositive ? "+" : ""}{formatValue(r.actualValue, unit)}
                  </span>
                </div>
                {r.notes && r.notes.trim().length > 0 && (
                  <div className="mt-1 relative">
                    <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-amber-300 rounded-full" />
                    <p className="text-[11px] text-muted-foreground italic bg-amber-50/50 py-1 px-2 rounded-r-md ml-1 break-words">
                      "{r.notes}"
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}
