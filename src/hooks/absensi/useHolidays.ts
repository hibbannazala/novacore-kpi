"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Holiday } from "@/types/absensi";

export function useHolidays() {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    const fetch = async () => {
      const { data } = await supabase
        .from("holidays")
        .select("id, date, description")
        .order("date", { ascending: true });
      setHolidays(
        (data ?? []).map((r) => ({
          id: r.id as string,
          date: r.date as string,
          description: (r.description as string) ?? "",
        }))
      );
      setIsLoading(false);
    };

    fetch();

    const channel = supabase
      .channel("holidays_watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "holidays" }, fetch)
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, []);

  return { holidays, holidayDates: holidays.map((h) => h.date), isLoading };
}
