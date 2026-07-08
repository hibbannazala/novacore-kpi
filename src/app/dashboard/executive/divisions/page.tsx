"use client";

import { useDepartments } from "@/hooks/useDivisions";
import { useAllUsers } from "@/hooks/useUsers";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getKpiRole } from "@/types";

export default function ExecutiveDivisionsPage() {
  const { departments, isLoading } = useDepartments();
  const { users } = useAllUsers();

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  const usersByDept: Record<string, number> = {};
  const headByDept: Record<string, string> = {};
  users.forEach((u) => {
    if (u.department) {
      usersByDept[u.department] = (usersByDept[u.department] ?? 0) + 1;
      if (getKpiRole(u) === "head" && !headByDept[u.department]) {
        headByDept[u.department] = u.name;
      }
    }
  });

  return (
    <div className="space-y-6">
      <h2 className="text-base font-semibold">Departemen</h2>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {departments.map((dept) => (
          <Card key={dept}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">{dept}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1 text-sm">
              <p className="text-muted-foreground">
                Head: {headByDept[dept] ?? "—"}
              </p>
              <p className="text-muted-foreground">
                Anggota: {usersByDept[dept] ?? 0}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
