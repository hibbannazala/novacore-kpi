"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User, KpiRole } from "@/types";

function rowToUser(row: Record<string, unknown>): User {
  const dept = (row.departments as { name: string } | null)?.name ?? null;
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    kpiRole: row.kpi_role as KpiRole,
    departmentId: row.department_id as string | null,
    departmentName: dept,
    department: dept,
    position: row.position as string | null,
    photoUrl: row.photo_url as string | null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

export function useDivisionMembers(department: string | string[] | undefined) {
  const [members, setMembers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const departments =
      typeof department === "string"
        ? department ? [department] : []
        : department ?? [];

    if (departments.length === 0) {
      setMembers([]);
      setIsLoading(false);
      return;
    }

    const supabase = createClient();

    async function fetch() {
      const { data } = await supabase
        .from("users")
        .select("*, departments(name)")
        .in(
          "department_id",
          // sub-select: get department IDs matching the names
          (await supabase
            .from("departments")
            .select("id")
            .in("name", departments)
          ).data?.map((d) => d.id) ?? []
        );
      setMembers((data ?? []).map(rowToUser));
      setIsLoading(false);
    }

    fetch();

    const channel = supabase
      .channel("users_division")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, fetch)
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, [JSON.stringify(department)]);

  return { members, isLoading };
}

export function useAllUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function fetch() {
      const { data } = await supabase
        .from("users")
        .select("*, departments(name)")
        .order("name");
      setUsers((data ?? []).map(rowToUser));
      setIsLoading(false);
    }

    fetch();

    const channel = supabase
      .channel("users_all")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, fetch)
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, []);

  return { users, isLoading };
}
