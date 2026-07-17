"use client";

import { useState, useEffect, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { rowToAttendance, type Attendance } from "@/types/absensi";

function todayDate() {
  return new Date().toISOString().split("T")[0];
}

export function useAttendanceToday(userId: string | null) {
  const [attendance, setAttendance] = useState<Attendance | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetch = useCallback(async () => {
    if (!userId) { setIsLoading(false); return; }
    const supabase = createClient();
    const { data } = await supabase
      .from("attendance")
      .select("*")
      .eq("user_id", userId)
      .eq("date", todayDate())
      .maybeSingle();
    setAttendance(data ? rowToAttendance(data as Record<string, unknown>) : null);
    setIsLoading(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    fetch();

    const supabase = createClient();
    const channel = supabase
      .channel(`attendance_today_${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance", filter: `user_id=eq.${userId}` },
        fetch
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [userId, fetch]);

  return { attendance, isLoading, refetch: fetch };
}
