"use client";

import { useAuth } from "@/contexts/AuthContext";
import { getKpiRole } from "@/types";
import { DailyActivityFeed } from "@/components/kpi/DailyActivityFeed";

export default function ExecutiveActivityPage() {
  const { user } = useAuth();
  if (!user) return null;
  const role = getKpiRole(user);
  if (role !== "hr" && role !== "executive" && role !== "developer") {
    return <p className="text-sm text-muted-foreground">Akses tidak diizinkan.</p>;
  }
  return <DailyActivityFeed />;
}
