"use client";

import { useState, useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { rowToAbsensiUser, type AbsensiUser } from "@/types/absensi";
import type { AbsensiStatus } from "@/types";

export function useAbsensiUsers(statusFilter?: AbsensiStatus | AbsensiStatus[]) {
  const [users, setUsers] = useState<AbsensiUser[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    const fetch = async () => {
      let q = supabase
        .from("users")
        .select("id, name, email, department_id, absensi_role, absensi_status, leave_quota, sick_quota, is_hidden, departments(name)")
        .order("name", { ascending: true });

      if (statusFilter) {
        const statuses = Array.isArray(statusFilter) ? statusFilter : [statusFilter];
        q = q.in("absensi_status", statuses);
      }

      const { data } = await q;
      setUsers((data ?? []).map((r) => rowToAbsensiUser(r as Record<string, unknown>)));
      setIsLoading(false);
    };

    fetch();

    const channel = supabase
      .channel("absensi_users_watch")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, fetch)
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [JSON.stringify(statusFilter)]); // eslint-disable-line react-hooks/exhaustive-deps

  return { users, isLoading };
}
