"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const ROLE_HOME: Record<string, string> = {
  tim: "/dashboard/tim",
  head: "/dashboard/head",
  hr: "/dashboard/hr",
  executive: "/dashboard/executive",
  developer: "/dashboard/developer", // Note: layout.tsx handles devMode specifically, but this is a safe default fallback
};

export default function DashboardRootPage() {
  const { user, kpiRole, devMode, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (user && kpiRole) {
      let route = ROLE_HOME[kpiRole] ?? "/dashboard/tim";
      if (kpiRole === "developer") {
        route = devMode === "employee" ? "/dashboard/tim" : "/dashboard/executive";
      }
      router.replace(route);
    }
  }, [user, kpiRole, devMode, isLoading, router]);

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
