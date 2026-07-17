"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import "./absensi.css";

export default function AbsensiRootLayout({ children }: { children: React.ReactNode }) {
  const { user, supabaseUser, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    if (!supabaseUser) { router.replace("/login"); return; }
    if (!user) { router.replace("/login?error=not_registered"); return; }
    if (
      user.absensiStatus === "rejected" ||
      user.absensiStatus === "resigned" ||
      user.absensiStatus === "deleted"
    ) {
      router.replace("/login?error=absensi_blocked");
    }
  }, [user, supabaseUser, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-[#F0F2F5] dark:bg-[#0f172a]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#00897B] dark:border-[#8b5cf6] border-t-transparent" />
      </div>
    );
  }

  if (!supabaseUser || !user) return null;

  // Dark class is on <html> — CSS uses html.dark .absensi-root selector
  return <div className="absensi-root">{children}</div>;
}
