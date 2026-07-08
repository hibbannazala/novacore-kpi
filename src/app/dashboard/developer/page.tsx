"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function DeveloperPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard/developer/import");
  }, [router]);

  return (
    <div className="flex h-40 items-center justify-center">
      <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  );
}
