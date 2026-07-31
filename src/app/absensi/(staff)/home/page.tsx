"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function OldAbsensiHome() {
  const router = useRouter();
  
  useEffect(() => {
    // Redirect to the unified dashboard (the portal root handles the role-based routing)
    router.replace("/");
  }, [router]);

  return null;
}
