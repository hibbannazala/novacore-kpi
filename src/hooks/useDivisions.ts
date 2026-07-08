"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function useDepartments() {
  const [departments, setDepartments] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();

    async function fetch() {
      const { data } = await supabase
        .from("departments")
        .select("name")
        .order("name");
      setDepartments((data ?? []).map((d) => d.name));
      setIsLoading(false);
    }

    fetch();

    const channel = supabase
      .channel("departments_changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "departments" }, fetch)
      .subscribe();

    return () => { channel.unsubscribe(); };
  }, []);

  return { departments, isLoading };
}
