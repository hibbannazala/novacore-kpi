"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { useHolidays } from "@/hooks/absensi/useHolidays";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DAY_LABELS = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

interface DayData {
  wfo: number;
  wfa: number;
  leave: number;
}

export default function StaffTeamPage() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [dayData, setDayData] = useState<Record<string, DayData>>({});
  const [isLoading, setIsLoading] = useState(true);
  const { holidays } = useHolidays();

  const year  = currentDate.getFullYear();
  const month = currentDate.getMonth();

  useEffect(() => {
    setIsLoading(true);
    const supabase = createClient();

    const mm      = String(month + 1).padStart(2, "0");
    const lastDay = new Date(year, month + 1, 0).getDate();
    const start   = `${year}-${mm}-01`;
    const end     = `${year}-${mm}-${String(lastDay).padStart(2, "0")}`;

    const fetchData = async () => {
      const [attRes, reqRes] = await Promise.all([
        supabase.from("attendance").select("date, type").gte("date", start).lte("date", end),
        supabase.from("leave_requests").select("dates, type").eq("status", "approved"),
      ]);

      const data: Record<string, DayData> = {};
      const ensure = (d: string) => { if (!data[d]) data[d] = { wfo: 0, wfa: 0, leave: 0 }; };

      (attRes.data ?? []).forEach((r) => {
        const d = (r.date as string).substring(0, 10);
        ensure(d);
        if (r.type === "WFA") data[d].wfa++; else data[d].wfo++;
      });

      (reqRes.data ?? []).forEach((r) => {
        const dates = (r.dates as string[]) ?? [];
        const isLeave = r.type === "leave" || r.type === "sick";
        const isWfa   = r.type === "wfa";
        dates.forEach((d) => {
          if (d >= start && d <= end) {
            ensure(d);
            if (isLeave) data[d].leave++;
            else if (isWfa) data[d].wfa++;
          }
        });
      });

      setDayData(data);
      setIsLoading(false);
    };

    fetchData();

    const attCh = supabase.channel("team_att_" + start)
      .on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, fetchData)
      .subscribe();
    const reqCh = supabase.channel("team_req_" + start)
      .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, fetchData)
      .subscribe();

    return () => { attCh.unsubscribe(); reqCh.unsubscribe(); };
  }, [year, month]);

  const changeMonth = (offset: number) =>
    setCurrentDate(new Date(year, month + offset, 1));

  const todayStr = new Date().toISOString().split("T")[0];
  const holidayDates = new Set(holidays.map((h) => h.date));

  const renderCells = () => {
    const firstDay   = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: React.ReactNode[] = [];

    for (let i = 0; i < firstDay; i++) {
      cells.push(
        <div
          key={`e-${i}`}
          className="h-14 border border-[var(--ab-border)] bg-[var(--ab-bg-main)]/30"
        />
      );
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const mm      = String(month + 1).padStart(2, "0");
      const dd      = String(day).padStart(2, "0");
      const dateStr = `${year}-${mm}-${dd}`;
      const dow     = new Date(year, month, day).getDay();
      const isToday   = dateStr === todayStr;
      const isHoliday = holidayDates.has(dateStr);
      const isWeekend = dow === 0 || dow === 6;
      const d         = dayData[dateStr];

      cells.push(
        <div
          key={day}
          className={`h-14 border border-[var(--ab-border)] relative p-1 ${isToday ? "bg-[var(--ab-primary)]/5" : ""}`}
        >
          {isToday && (
            <div className="absolute top-0 left-0 w-full h-0.5" style={{ background: "var(--ab-primary)" }} />
          )}
          <span
            className={`text-[10px] font-bold ${
              isHoliday || isWeekend
                ? "text-red-400"
                : "text-[var(--ab-text-dim)]"
            }`}
          >
            {day}
          </span>
          <div className="flex flex-wrap gap-0.5 mt-1">
            {Array.from({ length: d?.wfo ?? 0 }).map((_, i) => (
              <span key={`w-${i}`} className="w-1.5 h-1.5 rounded-full bg-green-500" />
            ))}
            {Array.from({ length: d?.wfa ?? 0 }).map((_, i) => (
              <span key={`f-${i}`} className="w-1.5 h-1.5 rounded-full bg-purple-500" />
            ))}
            {Array.from({ length: d?.leave ?? 0 }).map((_, i) => (
              <span key={`l-${i}`} className="w-1.5 h-1.5 rounded-full bg-orange-500" />
            ))}
          </div>
        </div>
      );
    }

    return cells;
  };

  const monthYear = currentDate.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  return (
    <div className="space-y-6 pb-24 ab-animate-fadeIn">
      <h2 className="text-2xl font-black text-[var(--ab-text-main)] uppercase tracking-tight">
        Kalender Tim
      </h2>

      <div className="ab-card-tactile !p-8 relative overflow-hidden">
        {/* Month Navigator */}
        <div className="flex justify-between items-center mb-10">
          <button
            onClick={() => changeMonth(-1)}
            className="p-3 bg-[var(--ab-bg-main)] text-[var(--ab-text-dim)] hover:text-[var(--ab-primary)] rounded-2xl transition-all active:scale-90 ab-nm-button"
          >
            <ChevronLeft size={16} />
          </button>
          <div className="text-center">
            <h3 className="text-xl font-black text-[var(--ab-text-main)] uppercase tracking-tight">
              {monthYear}
            </h3>
            <p className="text-[10px] font-bold text-[var(--ab-text-dim)] uppercase tracking-widest mt-0.5">
              Ringkasan Aktivitas Tim
            </p>
          </div>
          <button
            onClick={() => changeMonth(1)}
            className="p-3 bg-[var(--ab-bg-main)] text-[var(--ab-text-dim)] hover:text-[var(--ab-primary)] rounded-2xl transition-all active:scale-90 ab-nm-button"
          >
            <ChevronRight size={16} />
          </button>
        </div>

        {/* Day labels */}
        <div className="grid grid-cols-7 text-center mb-4">
          {DAY_LABELS.map((d) => (
            <div key={d} className="text-[10px] font-black uppercase text-[var(--ab-text-dim)] py-2 opacity-50">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        {isLoading ? (
          <div className="grid grid-cols-7 gap-0 border border-[var(--ab-border)] rounded-3xl overflow-hidden animate-pulse">
            {Array.from({ length: 35 }).map((_, i) => (
              <div key={i} className="h-14 bg-[var(--ab-bg-main)]" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7 border border-[var(--ab-border)] rounded-3xl overflow-hidden bg-[var(--ab-bg-main)]/10">
            {renderCells()}
          </div>
        )}

        {/* Legend */}
        <div className="mt-10 flex flex-wrap gap-4 text-[10px] text-[var(--ab-text-dim)] font-black uppercase tracking-widest justify-center">
          {[
            { color: "#22c55e", label: "Hadir WFO",  glow: "rgba(34,197,94,0.4)"   },
            { color: "#a855f7", label: "WFA",         glow: "rgba(168,85,247,0.4)" },
            { color: "#f97316", label: "Cuti/Sakit",  glow: "rgba(249,115,22,0.4)" },
            { color: "#ef4444", label: "Libur",       glow: "rgba(239,68,68,0.4)"  },
          ].map(({ color, label, glow }) => (
            <div
              key={label}
              className="flex items-center gap-2.5 bg-[var(--ab-bg-main)] px-4 py-2 rounded-2xl border border-[var(--ab-border)]"
            >
              <span
                className="w-2.5 h-2.5 rounded-full"
                style={{ background: color, boxShadow: `0 0 10px ${glow}` }}
              />
              {label}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
