"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useKpis } from "@/hooks/useKpis";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatNumber, formatCurrency, formatPercentage, getBrandColor } from "@/lib/utils";
import type { KPI } from "@/types";
import { Plus, Pencil, Trash2, RotateCcw, CheckCircle, PauseCircle, Archive, Search, XCircle, CheckCircle2, FileEdit } from "lucide-react";

const statusLabel: Record<string, string> = {
  draft: "Draft",
  active: "Aktif",
  adjusted: "Adjusted",
  hold: "Hold",
  cancelled: "Dibatalkan",
  completed: "Selesai",
  archived: "Arsip",
};

const statusVariant: Record<string, "default" | "secondary" | "outline" | "destructive"> = {
  draft: "secondary",
  active: "default",
  hold: "outline",
  cancelled: "destructive",
  completed: "secondary",
  archived: "outline",
};

const StatusBadge = ({ status }: { status: string }) => {
  const variant = statusVariant[status] ?? "outline";
  const label = statusLabel[status] ?? status;
  
  return (
    <Badge variant={variant} className="text-xs">
      {status === "active" && <span className="mr-1.5 flex h-2 w-2 rounded-full bg-green-500 animate-pulse" />}
      {status === "hold" && <PauseCircle className="mr-1 h-3 w-3" />}
      {status === "cancelled" && <XCircle className="mr-1 h-3 w-3" />}
      {status === "completed" && <CheckCircle2 className="mr-1 h-3 w-3" />}
      {status === "draft" && <FileEdit className="mr-1 h-3 w-3" />}
      {status === "archived" && <Archive className="mr-1 h-3 w-3" />}
      {label}
    </Badge>
  );
};

const typeLabel: Record<string, string> = { result: "Result", activity: "Activity", quality: "Quality" };
const typeColor: Record<string, string> = {
  result: "text-blue-600 bg-blue-50",
  activity: "text-amber-600 bg-amber-50",
  quality: "text-purple-600 bg-purple-50",
};

function formatTarget(kpi: KPI): string {
  if (kpi.unit === "currency") return formatCurrency(kpi.monthlyTarget);
  if (kpi.unit === "percentage") return formatPercentage(kpi.monthlyTarget);
  return formatNumber(kpi.monthlyTarget);
}

function daysAgo(deletedAt: unknown): number {
  if (!deletedAt) return 0;
  return Math.floor((Date.now() - new Date(deletedAt as string).getTime()) / 86400000);
}

export default function HrKpiPage() {
  const router = useRouter();
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(() => {
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });
  const [copying, setCopying] = useState(false);
  const year = parseInt(selectedMonth.split("-")[0]);
  const month = parseInt(selectedMonth.split("-")[1]);
  const { kpis, isLoading } = useKpis(year, month);

  const [tab, setTab] = useState<"list" | "trash">("list");
  const [selectedKpis, setSelectedKpis] = useState<Set<string>>(new Set());
  const [trashSelected, setTrashSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState<{ kpis: KPI[]; assignmentCount: number } | null>(null);
  const [confirmPermanent, setConfirmPermanent] = useState<KPI | null>(null);
  const [confirmBulkPermanent, setConfirmBulkPermanent] = useState(false);
  const [statusLoading, setStatusLoading] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  const activeKpis = useMemo(() => {
    let list = kpis.filter((k) => !k.deletedAt);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter((k) => k.title.toLowerCase().includes(q) || k.department.toLowerCase().includes(q));
    }
    if (filterType !== "all") list = list.filter((k) => k.type === filterType);
    if (filterStatus !== "all") list = list.filter((k) => k.status === filterStatus);
    return list;
  }, [kpis, search, filterType, filterStatus]);

  const trashedKpis = useMemo(() => kpis.filter((k) => !!k.deletedAt), [kpis]);

  async function setStatus(kpiId: string, status: string) {
    setStatusLoading(kpiId);
    try {
      const supabase = createClient();
      await supabase.from("kpis").update({ status }).eq("id", kpiId);
    } finally {
      setStatusLoading(null);
    }
  }

  async function handleSoftDelete(kpisToDelete: KPI[]) {
    setDeleteError("");
    let totalAssignments = 0;
    const supabase = createClient();
    for (const kpi of kpisToDelete) {
      const { count } = await supabase
        .from("kpi_assignments")
        .select("id", { count: "exact", head: true })
        .eq("kpi_id", kpi.id)
        .in("status", ["active", "hold"]);
      totalAssignments += count ?? 0;
    }
    setConfirmDelete({ kpis: kpisToDelete, assignmentCount: totalAssignments });
  }

  async function executeSoftDelete() {
    if (!confirmDelete) return;
    const { kpis: kpisToDelete } = confirmDelete;
    setStatusLoading("bulk-delete");
    try {
      const supabase = createClient();
      const now = new Date().toISOString();
      for (const kpi of kpisToDelete) {
        await supabase.from("kpi_assignments")
          .update({ status: "cancelled", cancelled_at: now })
          .eq("kpi_id", kpi.id)
          .in("status", ["active", "hold"]);
        await supabase.from("kpis").update({ deleted_at: now }).eq("id", kpi.id);
      }
      toast.success(`${kpisToDelete.length} KPI berhasil dipindah ke sampah`);
      setSelectedKpis(new Set());
      setConfirmDelete(null);
    } finally {
      setStatusLoading(null);
    }
  }

  function toggleSelectKpi(id: string) {
    const newSet = new Set(selectedKpis);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedKpis(newSet);
  }

  function toggleSelectAll() {
    if (selectedKpis.size === activeKpis.length && activeKpis.length > 0) {
      setSelectedKpis(new Set());
    } else {
      setSelectedKpis(new Set(activeKpis.map(k => k.id)));
    }
  }

  async function handleRestore(kpi: KPI) {
    setStatusLoading(kpi.id);
    try {
      const supabase = createClient();
      await supabase.from("kpi_assignments")
        .update({ status: "active", cancelled_at: null })
        .eq("kpi_id", kpi.id)
        .eq("status", "cancelled");
      await supabase.from("kpis").update({ deleted_at: null }).eq("id", kpi.id);
      toast.success("KPI berhasil dipulihkan");
    } finally {
      setStatusLoading(null);
    }
  }

  async function handleBulkRestore() {
    setStatusLoading("bulk-restore");
    try {
      const supabase = createClient();
      await Promise.all(
        [...trashSelected].map(async (id) => {
          await supabase.from("kpi_assignments")
            .update({ status: "active", cancelled_at: null })
            .eq("kpi_id", id)
            .eq("status", "cancelled");
          return supabase.from("kpis").update({ deleted_at: null }).eq("id", id);
        })
      );
      toast.success(`${trashSelected.size} KPI berhasil dipulihkan`);
      setTrashSelected(new Set());
    } finally {
      setStatusLoading(null);
    }
  }

  async function performDeepDelete(kpiId: string) {
    const supabase = createClient();
    await supabase.from("daily_reports").delete().eq("kpi_id", kpiId);
    await supabase.from("kpi_assignments").delete().eq("kpi_id", kpiId);
    await supabase.from("kpis").delete().eq("id", kpiId);
  }

  async function handlePermanentDelete(kpi: KPI) {
    setStatusLoading(kpi.id);
    try {
      await performDeepDelete(kpi.id);
      toast.success("KPI berhasil dihapus permanen");
      setConfirmPermanent(null);
    } finally {
      setStatusLoading(null);
    }
  }

  async function handleBulkPermanentDelete() {
    setStatusLoading("bulk-perm-delete");
    try {
      await Promise.all([...trashSelected].map((id) => performDeepDelete(id)));
      toast.success(`${trashSelected.size} KPI berhasil dihapus permanen`);
      setTrashSelected(new Set());
      setConfirmBulkPermanent(false);
    } finally {
      setStatusLoading(null);
    }
  }

  function toggleTrashItem(id: string) {
    const next = new Set(trashSelected);
    if (next.has(id)) next.delete(id); else next.add(id);
    setTrashSelected(next);
  }

  function toggleTrashAll() {
    if (trashSelected.size === trashedKpis.length && trashedKpis.length > 0) {
      setTrashSelected(new Set());
    } else {
      setTrashSelected(new Set(trashedKpis.map((k) => k.id)));
    }
  }

  async function handleCopyFromLastMonth() {
    const prevDate = new Date(year, month - 2, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth() + 1;

    setCopying(true);
    try {
      const supabase = createClient();
      const { data: prevKpis } = await supabase.from("kpis")
        .select("*")
        .eq("year", prevYear)
        .eq("month", prevMonth)
        .is("deleted_at", null);

      if (!prevKpis || prevKpis.length === 0) {
        toast.error(`Tidak ada KPI di bulan sebelumnya (${prevYear}-${String(prevMonth).padStart(2, "0")})`);
        return;
      }

      const existingTitles = new Set(kpis.filter((k) => !k.deletedAt).map((k) => k.title + "|" + k.department));
      const toCopy = prevKpis.filter((k: any) => !existingTitles.has(k.title + "|" + k.department));

      if (toCopy.length === 0) {
        toast.info("Semua KPI dari bulan sebelumnya sudah ada di bulan ini.");
        return;
      }

      const { error } = await supabase.from("kpis").insert(
        toCopy.map((k: any) => ({
          title: k.title,
          brand: k.brand ?? "",
          description: k.description ?? "",
          type: k.type,
          unit: k.unit,
          period: k.period ?? "monthly",
          department: k.department,
          monthly_target: k.monthly_target,
          year,
          month,
          status: "draft",
          deleted_at: null,
        }))
      );
      if (error) throw error;

      toast.success(`${toCopy.length} KPI berhasil disalin sebagai Draft dari bulan sebelumnya.`);
    } catch (err) {
      console.error("Copy KPI failed:", err);
      toast.error("Gagal menyalin KPI.");
    } finally {
      setCopying(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="flex justify-between items-center">
          <div className="space-y-2">
            <div className="h-5 w-40 bg-slate-200 rounded" />
            <div className="h-3 w-24 bg-slate-200 rounded" />
          </div>
          <div className="h-9 w-24 bg-slate-200 rounded-md" />
        </div>
        <div className="h-10 w-48 bg-slate-200 rounded-md" />
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-20 w-full bg-slate-200 rounded-xl" />
          ))}
        </div>
      </div>
    );
  }

  const isReadOnly = (k: KPI) => ["archived", "cancelled", "completed"].includes(k.status);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-base font-semibold">Manajemen KPI</h2>
          <p className="text-sm text-muted-foreground">{activeKpis.length} KPI — {year}/{String(month).padStart(2, "0")}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={handleCopyFromLastMonth}
            disabled={copying}
            title="Salin KPI dari bulan sebelumnya sebagai Draft"
          >
            {copying ? "Menyalin..." : "Copy dari Bulan Lalu"}
          </Button>
          <Button size="sm" onClick={() => router.push("/dashboard/hr/kpi/new")}>
            <Plus className="h-4 w-4" />
            Buat KPI
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-lg bg-muted p-1 w-fit">
        <button
          onClick={() => setTab("list")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${tab === "list" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          KPI Bulan Ini
        </button>
        <button
          onClick={() => setTab("trash")}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5 ${tab === "trash" ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
        >
          Sampah
          {trashedKpis.length > 0 && (
            <span className="rounded-full bg-destructive/20 text-destructive text-xs px-1.5">{trashedKpis.length}</span>
          )}
        </button>
      </div>

      {deleteError && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {deleteError}
          <button onClick={() => setDeleteError("")} className="ml-2 underline text-xs">Tutup</button>
        </div>
      )}

      {tab === "list" && (
        <>
          {/* Search + Filter */}
          <div className="flex flex-wrap gap-2">
            <div className="relative flex-1 min-w-40">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Cari judul atau departemen..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-8 h-8 text-sm"
              />
            </div>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-8 text-sm w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Tipe</SelectItem>
                <SelectItem value="result">Result</SelectItem>
                <SelectItem value="activity">Activity</SelectItem>
                <SelectItem value="quality">Quality</SelectItem>
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-8 text-sm w-36">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="active">Aktif</SelectItem>
                <SelectItem value="hold">Hold</SelectItem>
                <SelectItem value="archived">Arsip</SelectItem>
              </SelectContent>
            </Select>

            {selectedKpis.size > 0 && (
              <Button 
                variant="destructive" 
                size="sm" 
                className="h-8 ml-auto"
                onClick={() => handleSoftDelete(activeKpis.filter(k => selectedKpis.has(k.id)))}
              >
                <Trash2 className="h-4 w-4 mr-1.5" />
                Hapus ({selectedKpis.size})
              </Button>
            )}
          </div>

          {/* Select All Row */}
          {activeKpis.length > 0 && (
            <div className="flex items-center gap-2 px-1">
              <input 
                type="checkbox" 
                className="h-4 w-4 rounded border-gray-300 text-primary cursor-pointer"
                checked={selectedKpis.size === activeKpis.length && activeKpis.length > 0}
                onChange={toggleSelectAll}
              />
              <span className="text-xs text-muted-foreground font-medium cursor-pointer" onClick={toggleSelectAll}>
                Pilih Semua
              </span>
            </div>
          )}

          {/* KPI List */}
          {activeKpis.length === 0 ? (
            <div className="flex h-40 flex-col items-center justify-center rounded-xl border border-dashed border-border">
              <p className="text-sm text-muted-foreground">
                {kpis.filter((k) => !k.deletedAt).length === 0 ? "Belum ada KPI bulan ini" : "Tidak ada hasil yang cocok"}
              </p>
              {kpis.filter((k) => !k.deletedAt).length === 0 && (
                <Button size="sm" variant="outline" className="mt-3" onClick={() => router.push("/dashboard/hr/kpi/new")}>
                  Buat KPI pertama
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              {activeKpis.map((k) => (
                <div key={k.id} className="rounded-xl border border-border bg-card px-4 py-3 space-y-2">
                  <div className="flex items-start gap-3">
                    <div className="mt-1">
                      <input 
                        type="checkbox" 
                        className="h-4 w-4 rounded border-gray-300 text-primary cursor-pointer"
                        checked={selectedKpis.has(k.id)}
                        onChange={() => toggleSelectKpi(k.id)}
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-medium">{k.title || <span className="text-muted-foreground italic">Tanpa judul</span>}</p>
                        <StatusBadge status={k.status} />
                        <span className={`text-xs px-1.5 py-0.5 rounded font-medium ${typeColor[k.type] ?? ""}`}>
                          {typeLabel[k.type] ?? k.type}
                        </span>
                        <span className={`text-xs px-1.5 py-0.5 rounded border font-medium ${getBrandColor(k.brand)}`}>
                          {k.brand || "Umum"}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {k.department} · Target: {formatTarget(k)}
                      </p>
                    </div>
                    {/* Action buttons */}
                    <div className="flex items-center gap-1 shrink-0">
                      {!isReadOnly(k) && (
                        <button
                          onClick={() => router.push(`/dashboard/hr/kpi/edit?id=${k.id}`)}
                          className="rounded p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground"
                          title="Edit KPI"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      )}
                      <button
                        onClick={() => handleSoftDelete([k])}
                        className="rounded p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                        title="Pindah ke sampah"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* Status action buttons */}
                  {!isReadOnly(k) && (
                    <div className="flex gap-1.5 flex-wrap ml-7">
                      {k.status === "draft" && (
                        <button
                          onClick={() => setStatus(k.id, "active")}
                          disabled={statusLoading === k.id}
                          className="flex items-center gap-1 rounded px-2 py-1 text-xs text-green-600 hover:bg-green-50 disabled:opacity-50 border border-green-200"
                        >
                          <CheckCircle className="h-3 w-3" /> Aktifkan
                        </button>
                      )}
                      {k.status === "active" && (
                        <>
                          <button
                            onClick={() => setStatus(k.id, "hold")}
                            disabled={statusLoading === k.id}
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-amber-600 hover:bg-amber-50 disabled:opacity-50 border border-amber-200"
                          >
                            <PauseCircle className="h-3 w-3" /> Hold
                          </button>
                          <button
                            onClick={() => setStatus(k.id, "archived")}
                            disabled={statusLoading === k.id}
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50 border border-border"
                          >
                            <Archive className="h-3 w-3" /> Arsipkan
                          </button>
                        </>
                      )}
                      {k.status === "hold" && (
                        <>
                          <button
                            onClick={() => setStatus(k.id, "active")}
                            disabled={statusLoading === k.id}
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-green-600 hover:bg-green-50 disabled:opacity-50 border border-green-200"
                          >
                            <CheckCircle className="h-3 w-3" /> Aktifkan
                          </button>
                          <button
                            onClick={() => setStatus(k.id, "archived")}
                            disabled={statusLoading === k.id}
                            className="flex items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground hover:bg-muted disabled:opacity-50 border border-border"
                          >
                            <Archive className="h-3 w-3" /> Arsipkan
                          </button>
                        </>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === "trash" && (
        <div className="space-y-3">
          {trashedKpis.length === 0 ? (
            <div className="flex h-40 items-center justify-center rounded-xl border border-dashed border-border">
              <p className="text-sm text-muted-foreground">Sampah kosong</p>
            </div>
          ) : (
            <>
              {/* Toolbar: Select All + Bulk Actions */}
              <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/30 px-4 py-2.5">
                <label className="flex items-center gap-2.5 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={trashSelected.size === trashedKpis.length && trashedKpis.length > 0}
                    onChange={toggleTrashAll}
                    className="h-4 w-4 rounded border-slate-300 accent-primary cursor-pointer"
                  />
                  <span className="text-sm font-medium text-slate-700">
                    {trashSelected.size === 0
                      ? `${trashedKpis.length} item di sampah`
                      : `${trashSelected.size} dari ${trashedKpis.length} dipilih`}
                  </span>
                </label>
                {trashSelected.size > 0 && (
                  <div className="flex items-center gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600 border-green-200 hover:bg-green-50 h-8 text-xs"
                      disabled={statusLoading === "bulk-restore"}
                      onClick={handleBulkRestore}
                    >
                      <RotateCcw className="h-3.5 w-3.5 mr-1" />
                      Pulihkan ({trashSelected.size})
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8 text-xs"
                      disabled={statusLoading === "bulk-perm-delete"}
                      onClick={() => setConfirmBulkPermanent(true)}
                    >
                      <Trash2 className="h-3.5 w-3.5 mr-1" />
                      Hapus Permanen ({trashSelected.size})
                    </Button>
                  </div>
                )}
              </div>

              {/* Trash Items */}
              {trashedKpis.map((k) => {
                const days = k.deletedAt ? daysAgo(k.deletedAt) : 0;
                const remaining = Math.max(30 - days, 0);
                const isSelected = trashSelected.has(k.id);
                return (
                  <div
                    key={k.id}
                    className={`rounded-xl border bg-card px-4 py-3 transition-colors cursor-pointer ${
                      isSelected ? "border-primary/50 bg-primary/5" : "border-border"
                    }`}
                    onClick={() => toggleTrashItem(k.id)}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleTrashItem(k.id)}
                        onClick={(e) => e.stopPropagation()}
                        className="h-4 w-4 rounded border-slate-300 accent-primary cursor-pointer shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-muted-foreground line-through truncate">
                          {k.title || "Tanpa judul"}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {k.department} · Dihapus {days} hari lalu · auto-delete dalam {remaining} hari
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleRestore(k)}
                          disabled={!!statusLoading}
                          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-green-600 hover:bg-green-50 disabled:opacity-50"
                          title="Pulihkan"
                        >
                          <RotateCcw className="h-3 w-3" /> Pulihkan
                        </button>
                        <button
                          onClick={() => setConfirmPermanent(k)}
                          disabled={!!statusLoading}
                          className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-destructive hover:bg-destructive/10 disabled:opacity-50"
                        >
                          <Trash2 className="h-3 w-3" /> Hapus
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>
      )}

      {/* Soft delete confirmation */}
      <Dialog open={!!confirmDelete} onOpenChange={(o) => !o && setConfirmDelete(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Pindah ke Sampah?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            {confirmDelete?.kpis.length === 1 ? (
              <p>
                KPI <span className="font-medium text-foreground">"{confirmDelete.kpis[0].title}"</span> akan dipindah ke sampah.
                Bisa dipulihkan dalam 30 hari sebelum dihapus permanen.
              </p>
            ) : (
              <p>
                <span className="font-medium text-foreground">{confirmDelete?.kpis.length} KPI</span> terpilih akan dipindah ke sampah.
                Bisa dipulihkan dalam 30 hari sebelum dihapus permanen.
              </p>
            )}
            {(confirmDelete?.assignmentCount ?? 0) > 0 && (
              <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-amber-700">
                <strong>{confirmDelete!.assignmentCount} penugasan</strong> aktif/hold akan ikut dibatalkan.
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>Batal</Button>
            <Button
              variant="destructive"
              onClick={executeSoftDelete}
              disabled={statusLoading === "bulk-delete"}
            >
              {(confirmDelete?.assignmentCount ?? 0) > 0 ? "Batalkan Penugasan & Hapus" : "Pindah ke Sampah"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permanent delete confirmation (single) */}
      <Dialog open={!!confirmPermanent} onOpenChange={(o) => !o && setConfirmPermanent(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600">Hapus Permanen Sepenuhnya?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              KPI <span className="font-bold text-foreground">"{confirmPermanent?.title}"</span> akan dihapus.
            </p>
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700 font-medium">
              <p>PERINGATAN KERAS! Data berikut akan LENYAP:</p>
              <ul className="list-disc list-inside mt-1 ml-1 space-y-0.5 text-xs">
                <li>Master data KPI</li>
                <li>Seluruh <b>Penugasan (Assignments)</b> staf</li>
                <li>Seluruh <b>Laporan Harian (Daily Reports)</b> staf</li>
                <li>Perhitungan poin/skor terkait KPI ini</li>
              </ul>
            </div>
            <p className="font-semibold text-destructive">Tindakan ini mutlak tidak dapat dibatalkan.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmPermanent(null)}>Batal</Button>
            <Button variant="destructive" onClick={() => confirmPermanent && handlePermanentDelete(confirmPermanent)}>
              Hapus Permanen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Permanent delete confirmation (bulk) */}
      <Dialog open={confirmBulkPermanent} onOpenChange={(o) => !o && setConfirmBulkPermanent(false)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-red-600">Hapus {trashSelected.size} KPI Secara Permanen?</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm text-muted-foreground">
            <p>
              <span className="font-bold text-foreground">{trashSelected.size} KPI</span> yang dipilih akan dihapus.
            </p>
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700 font-medium">
              <p>PERINGATAN KERAS! Data berikut akan LENYAP:</p>
              <ul className="list-disc list-inside mt-1 ml-1 space-y-0.5 text-xs">
                <li>Master data KPI</li>
                <li>Seluruh <b>Penugasan (Assignments)</b> staf</li>
                <li>Seluruh <b>Laporan Harian (Daily Reports)</b> staf</li>
                <li>Perhitungan poin/skor terkait KPI ini</li>
              </ul>
            </div>
            <p className="font-semibold text-destructive">Tindakan ini mutlak tidak dapat dibatalkan.</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmBulkPermanent(false)}>Batal</Button>
            <Button
              variant="destructive"
              disabled={statusLoading === "bulk-perm-delete"}
              onClick={handleBulkPermanentDelete}
            >
              {statusLoading === "bulk-perm-delete" ? "Menghapus..." : `Hapus ${trashSelected.size} KPI`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
