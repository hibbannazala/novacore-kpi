"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { rowToLeaveRequest, type LeaveRequest } from "@/types/absensi";

export function useMyLeaveRequests(userId: string | null) {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!userId) { setIsLoading(false); return; }
    const supabase = createClient();

    const fetch = async () => {
      const { data } = await supabase
        .from("leave_requests")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false });
      setRequests((data ?? []).map((r) => rowToLeaveRequest(r as Record<string, unknown>)));
      setIsLoading(false);
    };

    fetch();

    const channel = supabase
      .channel(`leave_requests_${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "leave_requests", filter: `user_id=eq.${userId}` },
        fetch
      )
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [userId]);

  return { requests, isLoading };
}

export function useAllLeaveRequests(status?: "pending" | "approved" | "rejected" | "cancelled") {
  const [requests, setRequests] = useState<LeaveRequest[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    const fetch = async () => {
      let q = supabase
        .from("leave_requests")
        .select("*")
        .order("created_at", { ascending: false });
      if (status) q = q.eq("status", status);
      const { data } = await q;
      setRequests((data ?? []).map((r) => rowToLeaveRequest(r as Record<string, unknown>)));
      setIsLoading(false);
    };

    fetch();

    const channel = supabase
      .channel("all_leave_requests")
      .on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, fetch)
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [status]);

  return { requests, isLoading };
}
