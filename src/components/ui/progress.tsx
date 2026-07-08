"use client";

import * as React from "react";
import { cn } from "@/lib/utils";
import type { PerformanceCategory } from "@/types";

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value: number; // 0–100 (percentage)
  category?: PerformanceCategory;
  showLabel?: boolean;
  markerValue?: number; // 0-100 (percentage) for target pace
}

const categoryColor: Record<PerformanceCategory, string> = {
  excellent: "bg-emerald-500",
  good: "bg-blue-500",
  warning: "bg-amber-500",
  critical: "bg-red-500",
};

function Progress({ value, category, showLabel, markerValue, className, ...props }: ProgressProps) {
  const clampedValue = Math.min(Math.max(value, 0), 100);
  const barColor = category ? categoryColor[category] : "bg-primary";

  return (
    <div className={cn("relative w-full", className)} {...props}>
      <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className={cn("h-full rounded-full transition-all", barColor)}
          style={{ width: `${clampedValue}%` }}
        />
        {typeof markerValue === "number" && (
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-foreground/40 z-10"
            style={{ left: `${Math.min(Math.max(markerValue, 0), 100)}%` }}
            title={`Target Hari Ini: ${markerValue.toFixed(1)}%`}
          />
        )}
      </div>
      {showLabel && (
        <span className="mt-1 text-xs text-muted-foreground">
          {value.toFixed(1)}%
        </span>
      )}
    </div>
  );
}

export { Progress };
