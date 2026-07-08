"use client";

import { useAuth } from "@/contexts/AuthContext";
import { KpiFormPage } from "@/components/hr/KpiFormPage";

export default function HeadNewKpiPage() {
  const { user } = useAuth();
  const managedDepartments: string[] =
    user?.managedDepartments && user.managedDepartments.length > 0
      ? user.managedDepartments
      : user?.department ? [user.department] : [];

  return (
    <KpiFormPage
      allowedDepartments={managedDepartments}
      backHref="/dashboard/head/kpi-setup"
    />
  );
}
