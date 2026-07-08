"use client";

import { useDepartments } from "@/hooks/useDivisions";
import { useAllUsers } from "@/hooks/useUsers";

export default function HrDivisionsPage() {
  const { departments, isLoading } = useDepartments();
  const { users } = useAllUsers();

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const usersByDepartment: Record<string, number> = {};
  users.forEach((u) => {
    if (u.department) {
      usersByDepartment[u.department] = (usersByDepartment[u.department] ?? 0) + 1;
    }
  });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Departemen</h2>
        <p className="text-sm text-muted-foreground">
          {departments.length} departemen · Dikelola melalui aplikasi absensi
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((dept) => (
          <div
            key={dept}
            className="rounded-xl border border-border bg-card px-4 py-3"
          >
            <p className="text-sm font-semibold">{dept}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              {usersByDepartment[dept] ?? 0} anggota aktif
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
