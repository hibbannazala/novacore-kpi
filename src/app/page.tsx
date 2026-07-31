"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function PortalPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (!isLoading) {
      if (!user) {
        router.replace("/login");
      } else {
        // Redirect directly to unified dashboard based on role
        if (
          user.absensiRole === "admin" ||
          user.kpiRole === "executive" ||
          user.kpiRole === "hr"
        ) {
          router.replace("/absensi/admin/dashboard");
        } else {
          router.replace("/dashboard/tim");
        }
      }
    }
  }, [user, isLoading, router]);

  if (!mounted || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[var(--ab-bg-main)]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--ab-primary)] border-t-transparent" />
      </div>
    );
  }

  // Fallback UI while redirecting
  return (
    <div className="flex h-screen items-center justify-center bg-[var(--ab-bg-main)]">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[var(--ab-primary)] border-t-transparent" />
    </div>
  );
}
