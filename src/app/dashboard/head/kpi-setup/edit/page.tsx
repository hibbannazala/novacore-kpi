"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { KpiFormPage } from "@/components/hr/KpiFormPage";

function EditContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? undefined;
  const { user } = useAuth();
  const managedDepartments: string[] =
    user?.managedDepartments && user.managedDepartments.length > 0
      ? user.managedDepartments
      : user?.department ? [user.department] : [];

  return (
    <KpiFormPage
      kpiId={id}
      allowedDepartments={managedDepartments}
      backHref="/dashboard/head/kpi-setup"
    />
  );
}

export default function HeadEditKpiPage() {
  return <Suspense><EditContent /></Suspense>;
}
