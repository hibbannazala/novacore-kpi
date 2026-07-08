"use client";

import { Progress } from "@/components/ui/progress";
import { PerformanceBadge } from "@/components/ui/badge";
import { formatPercentage } from "@/lib/utils";
import type { WeightedScore } from "@/types";

interface Props {
  score: WeightedScore;
  compact?: boolean;
}

const typeLabel: Record<string, string> = {
  result: "Result",
  activity: "Activity",
  quality: "Quality",
};

const typeColor: Record<string, string> = {
  result: "text-blue-600",
  activity: "text-amber-600",
  quality: "text-purple-600",
};

interface Row {
  key: "result" | "activity" | "quality";
  avg: number;
  weight: number;
  count: number;
}

export function WeightedScoreCard({ score, compact = false }: Props) {
  const rows: Row[] = [
    { key: "result", avg: score.resultAvg, weight: score.resultWeight, count: score.resultCount },
    { key: "activity", avg: score.activityAvg, weight: score.activityWeight, count: score.activityCount },
    { key: "quality", avg: score.qualityAvg, weight: score.qualityWeight, count: score.qualityCount },
  ];

  const activeRows = rows.filter((r) => r.count > 0);

  if (compact) {
    return (
      <div className="space-y-1">
        {activeRows.map((r) => (
          <div key={r.key} className="flex items-center gap-2">
            <span className={`text-xs w-16 shrink-0 ${typeColor[r.key]}`}>
              {typeLabel[r.key]} <span className="text-muted-foreground">({r.weight}%)</span>
            </span>
            <Progress
              value={Math.min(r.avg, 100)}
              category={score.category}
              className="h-1.5 flex-1"
            />
            <span className="text-xs tabular-nums w-12 text-right">
              {formatPercentage(r.avg)}
            </span>
          </div>
        ))}
        <div className="flex items-center justify-between pt-1 border-t border-border">
          <span className="text-xs text-muted-foreground">Total Weighted</span>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold tabular-nums">{formatPercentage(score.total)}</span>
            <PerformanceBadge category={score.category} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card px-4 py-3 space-y-3">
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.key} className="space-y-0.5">
            <div className="flex items-center justify-between text-xs">
              <span className={`font-medium ${typeColor[r.key]}`}>
                {typeLabel[r.key]}
                <span className="text-muted-foreground font-normal ml-1">
                  {r.weight}% · {r.count} KPI
                </span>
              </span>
              <span className="tabular-nums">
                {r.count > 0 ? formatPercentage(r.avg) : "—"}
              </span>
            </div>
            <Progress
              value={r.count > 0 ? Math.min(r.avg, 100) : 0}
              category={score.category}
              className="h-1.5"
            />
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-border">
        <span className="text-xs text-muted-foreground">Total Weighted Score</span>
        <div className="flex items-center gap-2">
          <span className="text-base font-bold tabular-nums">{formatPercentage(score.total)}</span>
          <PerformanceBadge category={score.category} />
        </div>
      </div>
    </div>
  );
}
