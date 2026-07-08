"use client";

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useMyAssignments } from "@/hooks/useAssignments";
import { useKpiSettings } from "@/hooks/useKpiSettings";
import { KpiCard } from "@/components/kpi/KpiCard";
import { DailyInputForm } from "@/components/kpi/DailyInputForm";
import { WeightedScoreCard } from "@/components/kpi/WeightedScoreCard";
import { PeriodPicker, type Period } from "@/components/kpi/PeriodPicker";
import { StaffTour } from "@/components/kpi/StaffTour";
import { Input } from "@/components/ui/input";
import { Search, HelpCircle } from "lucide-react";
import { formatDateDisplay, calcWeightedScore, monthName, todayISODate } from "@/lib/utils";
import type { KpiAssignmentWithDetails } from "@/types";

export default function TimDashboard() {
  const { user } = useAuth();
  const now = new Date();
  const monthLabel = `${monthName(now.getMonth() + 1)} ${now.getFullYear()}`;
  const today = todayISODate();

  const { assignments, isLoading } = useMyAssignments(
    user?.id,
    now.getFullYear(),
    now.getMonth() + 1
  );
  const { weights } = useKpiSettings(user?.id);
  const [selected, setSelected] = useState<KpiAssignmentWithDetails | null>(null);
  const [period, setPeriod] = useState<Period>({ type: "month" });
  const [searchQuery, setSearchQuery] = useState("");
  const [showTour, setShowTour] = useState(false);

  const filteredAssignments = assignments.filter((a) =>
    a.kpi && a.kpi.title?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 bg-slate-200 rounded-[18px]" />
          <div className="space-y-2">
            <div className="h-3 w-16 bg-slate-200 rounded" />
            <div className="h-5 w-32 bg-slate-200 rounded" />
          </div>
        </div>
        <div className="h-32 w-full bg-slate-200 rounded-xl" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-48 bg-slate-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const todayDisplay = formatDateDisplay(now.toISOString().split("T")[0]);
  const weightedScore = assignments.length > 0 ? calcWeightedScore(assignments, weights) : null;
  const firstAssignment = filteredAssignments[0];

  return (
    <div className="space-y-6">
      {/* Tour */}
      {showTour && filteredAssignments.length > 0 && (
        <StaffTour
          onFinish={() => setShowTour(false)}
          onOpenForm={() => setSelected(filteredAssignments[0])}
          onCloseForm={() => setSelected(null)}
        />
      )}

      <div className="flex items-center justify-between flex-wrap gap-4 mb-4">
        <div className="flex items-center gap-3" id="tour-greeting">
          <div className="w-12 h-12 bg-white rounded-[18px] flex items-center justify-center shadow-sm border border-slate-100 shrink-0">
            <span className="text-xl font-black text-slate-800">{user?.name?.charAt(0)}</span>
          </div>
          <div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Halo,</p>
            <h1 className="text-xl font-black text-slate-800 tracking-tight leading-none truncate max-w-[200px]">
              {user?.name?.split(" ")[0]}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Tutorial Button */}
          <button
            onClick={() => setShowTour(true)}
            className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-500 shadow-sm hover:text-primary hover:border-primary/40 hover:bg-primary/5 transition-all duration-200"
            title="Mulai Tutorial"
          >
            <HelpCircle className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Panduan</span>
          </button>
          <div className="text-right" id="tour-period-picker">
            <PeriodPicker period={period} onChange={setPeriod} monthLabel={monthLabel} maxDate={today} />
            <p className="text-[10px] font-bold text-slate-400 mt-2">{todayDisplay}</p>
          </div>
        </div>
      </div>

      {/* Weighted score breakdown — always shows monthly aggregate */}
      {weightedScore && period.type === "month" && (
        <div id="tour-weighted-score">
          <WeightedScoreCard score={weightedScore} />
        </div>
      )}

      {/* Quick input prompt */}
      {assignments.length > 0 && (
        <div id="tour-quick-prompt" className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 rounded-lg border border-border bg-muted/30 px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Klik KPI di bawah untuk input realisasi hari ini.
          </p>
          <a
            id="tour-history-link"
            href="/dashboard/tim/history"
            className="text-xs font-semibold text-primary hover:underline shrink-0"
          >
            Ada yang salah input? Edit Riwayat &rarr;
          </a>
        </div>
      )}

      {/* KPI grid & Search */}
      {assignments.length === 0 ? (
        <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-border text-center">
          <p className="text-sm font-medium">Belum ada KPI bulan ini</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Hubungi HR jika ada yang salah.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="relative" id="tour-search">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Cari KPI berdasarkan judul..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-10 w-full md:max-w-md"
            />
          </div>

          {filteredAssignments.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Tidak ada KPI yang cocok dengan pencarian.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {filteredAssignments.map((a, idx) => (
                <div
                  key={a.id}
                  id={idx === 0 ? "tour-kpi-card" : undefined}
                >
                  <KpiCard
                    assignment={a}
                    onClick={() => setSelected(a)}
                    period={period}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Daily input dialog */}
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


