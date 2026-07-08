"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function RootPage() {
  const { user, kpiRole, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/login");
      return;
    }
    const roleRoutes: Record<string, string> = {
      tim: "/dashboard/tim",
      head: "/dashboard/head",
      hr: "/dashboard/hr",
      executive: "/dashboard/executive",
      developer: "/dashboard/developer/import",
    };
    router.replace(roleRoutes[kpiRole ?? ""] ?? "/login");
  }, [user, kpiRole, isLoading, router]);

  return (
    <div className="flex h-screen items-center justify-center">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
