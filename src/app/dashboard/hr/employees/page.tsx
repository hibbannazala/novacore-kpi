"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAllUsers } from "@/hooks/useUsers";
import { useDepartments } from "@/hooks/useDivisions";
import { useAuth } from "@/contexts/AuthContext";
import { getKpiRole, DEFAULT_KPI_WEIGHTS } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Pencil, MessageSquare, SlidersHorizontal } from "lucide-react";
import type { User, KpiRole } from "@/types";

const kpiRoleLabel: Record<KpiRole, string> = {
  executive: "Executive",
  hr: "HR",
  head: "Head",
  tim: "Tim",
  developer: "Developer",
};

const kpiRoleVariant: Record<KpiRole, "default" | "secondary" | "outline"> = {
  executive: "default",
  hr: "default",
  head: "secondary",
  tim: "outline",
  developer: "default",
};

export default function HrEmployeesPage() {
  const { user: currentUser } = useAuth();
  const { users, isLoading } = useAllUsers();

  // Role edit state
  const { departments, isLoading: departmentsLoading } = useDepartments();
  const [editUser, setEditUser] = useState<User | null>(null);
  const [selectedRole, setSelectedRole] = useState<KpiRole | "">("");
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [roleError, setRoleError] = useState("");
  const [departmentError, setDepartmentError] = useState("");

  // Notes state (feature stubbed — no notes table in schema)
  const [notesUser, setNotesUser] = useState<User | null>(null);

  // Weight settings state
  const [weightUser, setWeightUser] = useState<User | null>(null);
  const [resultW, setResultW] = useState("");
  const [activityW, setActivityW] = useState("");
  const [qualityW, setQualityW] = useState("");
  const [weightLoading, setWeightLoading] = useState(false);
  const [weightSaving, setWeightSaving] = useState(false);
  const [weightError, setWeightError] = useState("");

  function openEditRole(u: User) {
    setEditUser(u);
    setSelectedRole(getKpiRole(u));
    setSelectedDepartments(
      getKpiRole(u) === "head"
        ? u.managedDepartments?.length
          ? u.managedDepartments
          : u.department
            ? [u.department]
            : []
        : []
    );
    setRoleError("");
    setDepartmentError("");
  }

  function toggleDepartment(department: string) {
    setSelectedDepartments((prev) =>
      prev.includes(department)
        ? prev.filter((d) => d !== department)
        : [...prev, department]
    );
    setDepartmentError("");
  }

  async function handleSaveRole() {
    if (!editUser || !selectedRole) return;
    if (selectedRole === "head" && selectedDepartments.length === 0) {
      setRoleError("");
      setDepartmentError("Pilih minimal satu divisi untuk role Head.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("users").update({
        kpi_role: selectedRole,
        managed_departments: selectedRole === "head" ? selectedDepartments : [],
      }).eq("id", editUser.id);
      if (error) throw error;
      setEditUser(null);
    } catch {
      setRoleError("Gagal menyimpan. Coba lagi.");
    } finally {
      setSaving(false);
    }
  }

  function openNotes(u: User) {
    setNotesUser(u);
  }

  async function openWeights(u: User) {
    setWeightUser(u);
    setWeightError("");
    setWeightLoading(true);
    const supabase = createClient();
    const { data } = await supabase.from("kpi_settings").select("*").eq("user_id", u.id).maybeSingle();
    if (data) {
      setResultW(String(data.result_weight));
      setActivityW(String(data.activity_weight));
      setQualityW(String(data.quality_weight));
    } else {
      setResultW(String(DEFAULT_KPI_WEIGHTS.result));
      setActivityW(String(DEFAULT_KPI_WEIGHTS.activity));
      setQualityW(String(DEFAULT_KPI_WEIGHTS.quality));
    }
    setWeightLoading(false);
  }

  async function handleSaveWeights() {
    if (!weightUser || !currentUser) return;
    const r = parseInt(resultW) || 0;
    const a = parseInt(activityW) || 0;
    const q = parseInt(qualityW) || 0;
    if (r + a + q !== 100) {
      setWeightError("Total bobot harus 100%.");
      return;
    }
    if (r < 0 || a < 0 || q < 0) {
      setWeightError("Bobot tidak boleh negatif.");
      return;
    }
    setWeightSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.from("kpi_settings").upsert({
        user_id: weightUser.id,
        result_weight: r,
        activity_weight: a,
        quality_weight: q,
        updated_by: currentUser.id,
      }, { onConflict: "user_id" });
      if (error) throw error;
      setWeightUser(null);
    } catch {
      setWeightError("Gagal menyimpan. Coba lagi.");
    } finally {
      setWeightSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-base font-semibold">Karyawan</h2>
        <p className="text-sm text-muted-foreground">
          {users.length} akun aktif
        </p>
      </div>

      <div className="space-y-2">
        {users.map((u) => {
          const role = getKpiRole(u);
          return (
            <div
              key={u.id}
              className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">{u.name}</p>
                <p className="text-xs text-muted-foreground">
                  {u.email}
                  {u.department ? ` · ${u.department}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0 ml-3">
                <Badge variant={kpiRoleVariant[role]}>{kpiRoleLabel[role]}</Badge>
                <button
                  onClick={() => openWeights(u)}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  title="Bobot KPI"
                >
                  <SlidersHorizontal className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => openNotes(u)}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  title="Catatan"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => openEditRole(u)}
                  className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                  title="Edit role KPI"
                >
                  <Pencil className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Edit Role Dialog */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Set Role KPI</DialogTitle>
          </DialogHeader>
          {editUser && (
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium">{editUser.name}</p>
                <p className="text-xs text-muted-foreground">{editUser.email}</p>
              </div>
              <div className="space-y-1.5">
                <p className="text-sm font-medium">Role KPI</p>
                <Select
                  value={selectedRole}
                  onValueChange={(v) => {
                    setSelectedRole(v as KpiRole);
                    if (v !== "head") {
                      setSelectedDepartments([]);
                      setDepartmentError("");
                    } else if (selectedDepartments.length === 0 && editUser?.department) {
                      setSelectedDepartments([editUser.department]);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih role" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="tim">Tim</SelectItem>
                    <SelectItem value="head">Head</SelectItem>
                    <SelectItem value="hr">HR</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {selectedRole === "head" && (
                <div className="space-y-2">
                  <p className="text-sm font-medium">Divisi yang dikelola</p>
                  <div className="grid gap-2 rounded-md border border-input bg-background p-3">
                    {departmentsLoading ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <span className="h-3 w-3 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                        Memuat divisi...
                      </div>
                    ) : departments.length === 0 ? (
                      <p className="text-sm text-muted-foreground">Belum ada data divisi.</p>
                    ) : (
                      departments.map((dept) => (
                        <label key={dept} className="flex cursor-pointer items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={selectedDepartments.includes(dept)}
                            onChange={() => toggleDepartment(dept)}
                            className="h-4 w-4 rounded border-input text-primary focus:ring-primary"
                          />
                          <span>{dept}</span>
                        </label>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Pilih minimal satu divisi untuk Head. Jika tidak dipilih, Head tidak akan memiliki area pengawasan spesifik.
                  </p>
                  {departmentError && <p className="text-sm text-destructive">{departmentError}</p>}
                </div>
              )}

              {roleError && <p className="text-sm text-destructive">{roleError}</p>}
            </div>
          )}
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setEditUser(null)}>Batal</Button>
            <Button onClick={handleSaveRole} disabled={saving || !selectedRole}>
              {saving ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Weight Settings Dialog */}
      <Dialog open={!!weightUser} onOpenChange={(o) => !o && setWeightUser(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Bobot KPI — {weightUser?.name}</DialogTitle>
            <p className="text-xs text-muted-foreground">Total harus 100%</p>
          </DialogHeader>
          {weightLoading ? (
            <div className="flex h-20 items-center justify-center">
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-3 mt-1">
              {(
                [
                  { label: "Result", value: resultW, set: setResultW },
                  { label: "Activity", value: activityW, set: setActivityW },
                  { label: "Quality", value: qualityW, set: setQualityW },
                ] as { label: string; value: string; set: (v: string) => void }[]
              ).map(({ label, value, set }) => (
                <div key={label} className="flex items-center gap-3">
                  <span className="text-sm w-20 shrink-0">{label}</span>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={value}
                    onChange={(e) => { set(e.target.value); setWeightError(""); }}
                    className="h-8 text-sm"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              ))}
              {(() => {
                const total = (parseInt(resultW) || 0) + (parseInt(activityW) || 0) + (parseInt(qualityW) || 0);
                return (
                  <div className={`text-xs font-medium ${total === 100 ? "text-green-600" : "text-amber-600"}`}>
                    Total: {total}%{total === 100 ? " ✓" : " (harus 100%)"}
                  </div>
                );
              })()}
              {weightError && <p className="text-sm text-destructive">{weightError}</p>}
            </div>
          )}
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="outline" onClick={() => setWeightUser(null)}>Batal</Button>
            <Button onClick={handleSaveWeights} disabled={weightSaving || weightLoading}>
              {weightSaving ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Notes Dialog */}
      <Dialog open={!!notesUser} onOpenChange={(o) => !o && setNotesUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Catatan — {notesUser?.name}</DialogTitle>
            <p className="text-xs text-muted-foreground">{notesUser?.department ?? "—"}</p>
          </DialogHeader>
          <div className="py-4 text-center text-sm text-muted-foreground">
            Fitur catatan belum tersedia.
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
