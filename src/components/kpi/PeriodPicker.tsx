"use client";

import { Calendar, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type Period =
  | { type: "month" }
  | { type: "range"; start: string; end: string };

interface PeriodPickerProps {
  period: Period;
  onChange: (period: Period) => void;
  monthLabel: string;
  maxDate?: string;
}

export function PeriodPicker({ period, onChange, monthLabel, maxDate }: PeriodPickerProps) {
  const isMonth = period.type === "month";
  const start = period.type === "range" ? period.start : "";
  const end = period.type === "range" ? period.end : "";

  function setStart(value: string) {
    if (!value) return;
    const e = end && value <= end ? end : value;
    onChange({ type: "range", start: value, end: e });
  }

  function setEnd(value: string) {
    if (!value) return;
    const s = start && start <= value ? start : value;
    onChange({ type: "range", start: s, end: value });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={() => onChange({ type: "month" })}
        className={cn(
          "flex items-center gap-1.5 rounded-md border px-2.5 h-8 text-xs font-medium transition-colors",
          isMonth
            ? "border-primary bg-primary text-primary-foreground"
            : "border-input text-muted-foreground hover:bg-accent"
        )}
      >
        <Calendar className="h-3.5 w-3.5" />
        Bulan Ini ({monthLabel})
      </button>

      <div className="flex items-center gap-1.5">
        <Input
          type="date"
          value={start}
          max={end || maxDate}
          onChange={(e) => setStart(e.target.value)}
          className="h-8 text-xs w-[150px]"
          aria-label="Dari tanggal"
        />
        <span className="text-xs text-muted-foreground">→</span>
        <Input
          type="date"
          value={end}
          min={start}
          max={maxDate}
          onChange={(e) => setEnd(e.target.value)}
          className="h-8 text-xs w-[150px]"
          aria-label="Sampai tanggal"
        />
      </div>

      {!isMonth && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onChange({ type: "month" })}
          className="h-8 px-2"
          title="Reset ke Bulan Ini"
        >
          <RotateCcw className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
