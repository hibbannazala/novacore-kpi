"use client";

import { PerformanceBadge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatPercentage, getPerformanceCategory } from "@/lib/utils";
import type { KpiAssignment, User, WeightedScore } from "@/types";

interface MemberPerformanceRowProps {
  user: User;
  assignments: KpiAssignment[];
  weightedScore?: WeightedScore;
  onClick?: () => void;
}

const typeLabel: Record<string, string> = {
  result: "R",
  activity: "A",
  quality: "Q",
};

const typeColor: Record<string, string> = {
  result: "text-blue-600",
  activity: "text-amber-600",
  quality: "text-purple-600",
};

export function MemberPerformanceRow({ user, assignments, weightedScore, onClick }: MemberPerformanceRowProps) {
  const flatAvg =
    assignments.length > 0
      ? assignments.reduce((s, a) => s + a.achievementPercentage, 0) / assignments.length
      : 0;

  const displayScore = weightedScore ? weightedScore.total : flatAvg;
  const category = weightedScore ? weightedScore.category : getPerformanceCategory(flatAvg);

  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      className={`flex items-center gap-4 rounded-xl border border-border bg-card px-4 py-3 w-full text-left${onClick ? " hover:bg-accent transition-colors cursor-pointer" : ""}`}
      {...(onClick ? { onClick } : {})}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold uppercase">
        {user.name.slice(0, 2)}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <p className="text-sm font-medium truncate">{user.name}</p>
          <div className="flex items-center gap-2 shrink-0">
            <span className="text-sm font-semibold tabular-nums">
              {formatPercentage(displayScore)}
            </span>
            <PerformanceBadge category={category} />
          </div>
        </div>
        <Progress value={Math.min(displayScore, 100)} category={category} />
        {weightedScore ? (
          <div className="mt-1 flex items-center gap-3">
            {(
              [
                { key: "result", avg: weightedScore.resultAvg, count: weightedScore.resultCount },
                { key: "activity", avg: weightedScore.activityAvg, count: weightedScore.activityCount },
                { key: "quality", avg: weightedScore.qualityAvg, count: weightedScore.qualityCount },
              ] as { key: string; avg: number; count: number }[]
            )
              .filter((r) => r.count > 0)
              .map((r) => (
                <span key={r.key} className={`text-xs tabular-nums ${typeColor[r.key]}`}>
                  {typeLabel[r.key]} {formatPercentage(r.avg)}
                </span>
              ))}
            <span className="text-xs text-muted-foreground ml-auto">
              {assignments.length} KPI
            </span>
          </div>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground">{assignments.length} KPI aktif</p>
        )}
      </div>
    </Wrapper>
  );
}
