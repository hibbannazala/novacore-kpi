"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PerformanceBadge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  formatNumber,
  formatCurrency,
  formatPercentage,
  formatDateDisplay,
  getPerformanceCategory,
  getLiveWorkingDaysRemaining,
  getBrandColor,
  cn,
} from "@/lib/utils";
import { useDailyReportsForAssignment } from "@/hooks/useDailyReports";
import { MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import type { KpiAssignmentWithDetails } from "@/types";
import type { Period } from "@/components/kpi/PeriodPicker";

interface KpiCardProps {
  assignment: KpiAssignmentWithDetails;
  onClick?: () => void;
  showNotes?: boolean;
  period?: Period;
}

function formatValue(value: number, unit: string): string {
  if (unit === "currency") return formatCurrency(value);
  if (unit === "percentage") return formatPercentage(value);
  return formatNumber(value);
}

// Removed local getBrandColorClass logic to use global utility

const typeLabel: Record<string, string> = { result: "Result", activity: "Activity", quality: "Quality" };
const typeColor: Record<string, string> = {
  result: "text-blue-700 bg-blue-50 border-blue-200",
  activity: "text-amber-700 bg-amber-50 border-amber-200",
  quality: "text-purple-700 bg-purple-50 border-purple-200",
};

export function KpiCard({ assignment, onClick, showNotes = true, period }: KpiCardProps) {
  const { kpi, performanceCategory, actualTotal, monthlyTarget } = assignment;
  const [expandNotes, setExpandNotes] = useState(false);
  const [expandDesc, setExpandDesc] = useState(false);
  const isRange = period?.type === "range";

  // Hitung live — tidak pakai nilai statis dari Firestore
  const liveWorkingDaysRemaining = getLiveWorkingDaysRemaining(assignment.year, assignment.month);
  const liveCurrentDailyTarget =
    liveWorkingDaysRemaining > 0
      ? Math.max(monthlyTarget - actualTotal, 0) / liveWorkingDaysRemaining
      : 0;

  // In range mode, always fetch reports to recompute actuals. Otherwise lazy-load on expand.
  const { reports } = useDailyReportsForAssignment(
    showNotes && (expandNotes || isRange) ? assignment.id : undefined,
    showNotes && (expandNotes || isRange) ? assignment.userId : undefined
  );

  if (!kpi) return null;

  const unit = kpi.unit;

  // Range mode: filter reports to selected period and recompute
  const displayReports =
    isRange && period?.type === "range"
      ? reports.filter((r) => r.date >= period.start && r.date <= period.end)
      : reports;

  const actualInPeriod = displayReports.reduce((s, r) => s + r.actualValue, 0);
  const displayActual = isRange ? actualInPeriod : actualTotal;
  const displayPct = isRange
    ? monthlyTarget > 0 ? (actualInPeriod / monthlyTarget) * 100 : 0
    : monthlyTarget > 0 ? (actualTotal / monthlyTarget) * 100 : 0;
  const displayCategory = isRange ? getPerformanceCategory(displayPct) : performanceCategory;

  const sortedReports = expandNotes
    ? [...displayReports].sort((x, y) => (x.date < y.date ? 1 : -1))
    : [];

  const expectedPct = monthlyTarget > 0 ? (assignment.expectedTotal / monthlyTarget) * 100 : 0;

  const isCompleted = displayPct >= 100;

  return (
    <Card
      className={cn(
        "rounded-3xl border bg-card transition-all duration-300 relative overflow-hidden",
        onClick ? "cursor-pointer hover:-translate-y-1 hover:shadow-md" : "",
        isCompleted ? "border-green-300 bg-gradient-to-br from-green-50/40 to-white shadow-[0_4px_16px_rgba(34,197,94,0.15)]" : "border-border shadow-sm"
      )}
      onClick={onClick}
    >
      {/* Decorative top border */}
      <div className={cn("absolute top-0 left-0 right-0 h-1", isCompleted ? "bg-gradient-to-r from-green-400 to-emerald-500" : "bg-gradient-to-r from-slate-200 to-slate-100 hover:from-primary/20 hover:to-primary/10 transition-colors")} />
      <CardHeader className="pb-3 px-5 pt-5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap gap-1.5 mb-2">
              {kpi.brand && (
                <span className={cn("inline-block px-2 py-0.5 rounded-lg border text-[10px] font-black uppercase tracking-wider", getBrandColor(kpi.brand))}>
                  {kpi.brand}
                </span>
              )}
              <span className={cn("inline-block px-2 py-0.5 rounded-lg border text-[10px] font-black uppercase tracking-wider", typeColor[kpi.type] || "text-slate-600 bg-slate-50 border-slate-200")}>
                {typeLabel[kpi.type] || kpi.type}
              </span>
            </div>
            <CardTitle className="text-base font-extrabold leading-tight text-slate-800">{kpi.title}</CardTitle>
            
            {kpi.description && (
              <div className="mt-2 text-[11px] text-slate-500">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); setExpandDesc((v) => !v); }}
                  className="flex items-center gap-1 font-medium hover:text-slate-700 transition-colors"
                >
                  {expandDesc ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                  {expandDesc ? "Tutup Deskripsi" : "Lihat Deskripsi KPI"}
                </button>
                {expandDesc && (
                  <p className="mt-1.5 leading-relaxed whitespace-pre-wrap">{kpi.description}</p>
                )}
              </div>
            )}
          </div>
          <PerformanceBadge category={displayCategory} />
        </div>
      </CardHeader>

      <CardContent className="px-5 pb-5 space-y-0">
        {/* Progress bar */}
        <div className="pt-2">
          <div className="mb-2">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Pencapaian KPI</span>
          </div>
          <div className="flex items-baseline gap-2 mb-3">
            <span className="text-4xl font-extrabold text-slate-800 tracking-tight">
              {formatPercentage(displayPct)}
            </span>
          </div>
          <Progress 
            value={Math.min(displayPct, 100)} 
            category={displayCategory} 
            className={cn("h-3 bg-slate-100", isCompleted && "shadow-[0_0_12px_rgba(34,197,94,0.4)]")}
            markerValue={!isRange ? expectedPct : undefined}
          />
        </div>

        {/* Stats */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
            <span className="block text-[10px] uppercase font-bold text-slate-500 mb-1">
              {isRange ? "Aktual Periode" : "Total Aktual"}
            </span>
            <span className="block text-sm font-bold text-slate-800 truncate" title={formatValue(displayActual, unit)}>
              {formatValue(displayActual, unit)}
            </span>
          </div>
          <div className="rounded-xl bg-slate-50 p-3 border border-slate-100">
            <span className="block text-[10px] uppercase font-bold text-slate-500 mb-1">Target Bulan Ini</span>
            <span className="block text-sm font-bold text-slate-800 truncate" title={formatValue(monthlyTarget, unit)}>
              {formatValue(monthlyTarget, unit)}
            </span>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-[11px] px-1 font-medium text-slate-500">
            <span>Tgt Harian: <strong className="text-slate-800">{formatValue(liveCurrentDailyTarget, unit)}</strong></span>
            <span>Sisa: <strong className="text-slate-800">{liveWorkingDaysRemaining} hari</strong></span>
        </div>

        {/* Quality Notes — shown for quality KPIs */}
        {kpi?.type === "quality" && assignment.qualityNotes && (
          <div className="mt-5 pt-4 border-t border-slate-100">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <MessageSquare className="h-3.5 w-3.5" />
              Catatan Kualitas
            </p>
            <div className="relative">
              <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-purple-300 rounded-full" />
              <div className="ml-2.5 bg-purple-50/60 rounded-r-lg rounded-bl-sm py-2 px-3 border border-purple-100/50">
                <p className="text-xs text-purple-900/90 whitespace-pre-wrap break-words leading-relaxed italic">
                  "{assignment.qualityNotes}"
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Day-by-Day Reports Section (Timeline Design) */}
        {showNotes && kpi?.type !== "quality" && (
          <div className="mt-5 pt-4 border-t border-slate-100">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setExpandNotes((v) => !v); }}
              className="flex items-center justify-between w-full text-[11px] uppercase tracking-wider font-bold text-slate-400 hover:text-slate-700 transition-colors"
            >
              <span className="flex items-center gap-2">
                <MessageSquare className="h-3.5 w-3.5" />
                Rincian Harian
                {isRange && expandNotes && sortedReports.length > 0 && (
                  <span className="text-foreground">({sortedReports.length})</span>
                )}
              </span>
              {expandNotes ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {expandNotes && (
              <div className="mt-3.5 space-y-3.5 max-h-56 overflow-y-auto pr-2 border-l-2 border-slate-100 ml-1.5 pl-4 py-1">
                {sortedReports.length === 0 ? (
                  <p className="text-xs text-muted-foreground italic">
                    Belum ada laporan di periode ini.
                  </p>
                ) : (
                  sortedReports.map((r) => {
                    const isPositive = r.actualValue > 0;
                    return (
                      <div key={r.id} className="relative">
                        <div className="absolute -left-[23px] top-1.5 h-2.5 w-2.5 rounded-full bg-slate-300 ring-4 ring-white" />
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[10px] font-medium bg-white border border-slate-200 text-slate-500 px-2 py-0.5 rounded shadow-sm">
                            {formatDateDisplay(r.date)}
                          </span>
                          <span className={cn("text-xs font-bold", isPositive ? "text-teal-600" : "text-slate-400")}>
                            {isPositive ? "+" : ""}{formatValue(r.actualValue, unit)}
                          </span>
                        </div>
                        {r.notes && r.notes.trim().length > 0 && (
                          <div className="mt-1.5 relative">
                            <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-amber-300 rounded-full" />
                            <div className="ml-1.5 bg-amber-50/60 rounded-r-lg rounded-bl-sm py-2 px-3 shadow-sm border border-amber-100/50">
                              <p className="text-xs text-amber-900/90 whitespace-pre-wrap break-words leading-relaxed italic">
                                "{r.notes}"
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
