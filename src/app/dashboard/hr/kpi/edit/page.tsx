"use client";

import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { KpiFormPage } from "@/components/hr/KpiFormPage";

function EditKpiContent() {
  const searchParams = useSearchParams();
  const id = searchParams.get("id") ?? undefined;
  return <KpiFormPage kpiId={id} />;
}

export default function EditKpiPage() {
  return (
    <Suspense>
      <EditKpiContent />
    </Suspense>
  );
}
