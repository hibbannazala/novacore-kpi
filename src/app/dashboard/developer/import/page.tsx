"use client";

import { useState, useMemo, useRef } from "react";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAllUsers } from "@/hooks/useUsers";
import { getKpiRole } from "@/types";
import { getWorkingDaysInMonth } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Upload, CheckCircle2, XCircle } from "lucide-react";
import type { User } from "@/types";

// ─── Types & Constants ────────────────────────────────────────────────────────

const VALID_TYPES   = ["result", "activity", "quality"]       as const;
const VALID_UNITS   = ["number", "currency", "percentage"]    as const;
const VALID_PERIODS = ["daily", "weekly", "monthly"]          as const;

type KpiTypeVal = (typeof VALID_TYPES)[number];
type UnitVal    = (typeof VALID_UNITS)[number];
type PeriodVal  = (typeof VALID_PERIODS)[number];

const SYSTEM_FIELDS = [
  { key: "userName",       label: "Nama User",      required: true  },
  { key: "Brand",          label: "Brand",          required: false },
  { key: "kpiTitle",       label: "Judul KPI",      required: true  },
  { key: "kpiDescription", label: "Deskripsi KPI",  required: false },
  { key: "kpiType",        label: "Tipe KPI",       required: true  },
  { key: "unit",           label: "Unit",           required: true  },
  { key: "period",         label: "Periode",        required: true  },
  { key: "monthlyTarget",  label: "Target Bulanan", required: true  },
  { key: "year",           label: "Tahun",          required: true  },
  { key: "month",          label: "Bulan",          required: true  },
] as const;

type FieldKey     = (typeof SYSTEM_FIELDS)[number]["key"];
type ColumnMapping = Record<FieldKey, number>; // -1 = not mapped

const EMPTY_MAPPING: ColumnMapping = {
  userName: -1, Brand: -1, kpiTitle: -1, kpiDescription: -1, kpiType: -1,
  unit: -1, period: -1, monthlyTarget: -1, year: -1, month: -1,
};

interface ImportRow {
  rawName: string;
  Brand: string;
  kpiTitle: string;
  kpiDescription: string;
  kpiType: KpiTypeVal;
  unit: UnitVal;
  period: PeriodVal;
  monthlyTarget: number;
  year: number;
  month: number;
  resolvedUser: User | null;
  errors: string[];
}

const TYPE_CFG: Record<KpiTypeVal, { label: string; cls: string }> = {
  result:   { label: "Result",   cls: "text-blue-600 bg-blue-50" },
  activity: { label: "Activity", cls: "text-amber-600 bg-amber-50" },
  quality:  { label: "Quality",  cls: "text-purple-600 bg-purple-50" },
};

// ─── CSV Helpers ──────────────────────────────────────────────────────────────

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/).find(l => l.trim() && !l.trim().startsWith("#")) ?? "";
  const commas = (firstLine.match(/,/g) ?? []).length;
  const semis  = (firstLine.match(/;/g) ?? []).length;
  return semis > commas ? ";" : ",";
}

function parseCSV(text: string, delimiter = ","): string[][] {
  const rows: string[][] = [];
  for (const line of text.trim().split(/\r?\n/)) {
    if (!line.trim()) continue;
    const fields: string[] = [];
    let cur = "";
    let inQ = false;
    for (const ch of line) {
      if (ch === '"') { inQ = !inQ; }
      else if (ch === delimiter && !inQ) { fields.push(cur.trim()); cur = ""; }
      else { cur += ch; }
    }
    fields.push(cur.trim());
    rows.push(fields);
  }
  return rows;
}

function autoDetectMapping(headers: string[]): ColumnMapping {
  const norm = (s: string) => s.trim().toLowerCase().replace(/[^a-z]/g, "");
  const aliases: Record<FieldKey, string[]> = {
    userName:       ["username", "nama", "namakaryawan", "namauser", "employee", "name"],
    Brand:          ["brand", "merek", "merk"],
    kpiTitle:       ["kpititle", "title", "judulkpi", "judul", "namakpi", "kpi"],
    kpiDescription: ["kpidescription", "description", "deskripsi", "keterangan", "desc"],
    kpiType:        ["kpitype", "type", "tipe", "tipekpi"],
    unit:           ["unit"],
    period:         ["period", "periode"],
    monthlyTarget:  ["monthlytarget", "target", "targetbulanan"],
    year:           ["year", "tahun"],
    month:          ["month", "bulan"],
  };
  const result: ColumnMapping = { ...EMPTY_MAPPING };
  headers.forEach((h, i) => {
    const n = norm(h);
    for (const [field, al] of Object.entries(aliases) as [FieldKey, string[]][]) {
      if (al.includes(n) && result[field] === -1) result[field] = i;
    }
  });
  return result;
}

function buildRows(parsed: string[][], users: User[], mapping: ColumnMapping): ImportRow[] {
  const active = users.filter(u => u.absensiStatus === "active");
  const result: ImportRow[] = [];
  for (let i = 1; i < parsed.length; i++) {
    const row = parsed[i];
    const get = (k: FieldKey) => (mapping[k] >= 0 ? (row[mapping[k]] ?? "").trim() : "");
    const rn = get("userName");
    const kt = get("kpiTitle");
    if (!rn && !kt) continue;
    if (rn.startsWith("#")) continue;
    const errors: string[] = [];
    const resolvedUser = active.find(u => u.name.trim().toLowerCase() === rn.toLowerCase()) ?? null;
    if (!resolvedUser) errors.push(`User "${rn}" tidak ditemukan`);
    if (!kt) errors.push("kpiTitle kosong");
    const ktype = get("kpiType");
    if (!VALID_TYPES.includes(ktype as KpiTypeVal)) errors.push(`kpiType "${ktype}" tidak valid (result/activity/quality)`);
    const unit = get("unit");
    if (!VALID_UNITS.includes(unit as UnitVal)) errors.push(`unit "${unit}" tidak valid (number/currency/percentage)`);
    const period = get("period");
    if (!VALID_PERIODS.includes(period as PeriodVal)) errors.push(`period "${period}" tidak valid (daily/weekly/monthly)`);
    const monthlyTarget = parseFloat(get("monthlyTarget"));
    if (isNaN(monthlyTarget) || monthlyTarget <= 0) errors.push("monthlyTarget harus angka > 0");
    const year = parseInt(get("year"));
    if (isNaN(year) || year < 2020) errors.push("year tidak valid");
    const month = parseInt(get("month"));
    if (isNaN(month) || month < 1 || month > 12) errors.push("month tidak valid (1-12)");
    result.push({
      rawName: rn,
      Brand: get("Brand"),
      kpiTitle: kt,
      kpiDescription: get("kpiDescription"),
      kpiType: ktype as KpiTypeVal,
      unit: unit as UnitVal,
      period: period as PeriodVal,
      monthlyTarget: isNaN(monthlyTarget) ? 0 : monthlyTarget,
      year: isNaN(year) ? 0 : year,
      month: isNaN(month) ? 0 : month,
      resolvedUser,
      errors,
    });
  }
  return result;
}

function getInitials(name: string) {
  return name.split(" ").slice(0, 2).map(w => w[0]?.toUpperCase() ?? "").join("");
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function KpiImportPage() {
  const { user } = useAuth();
  const { users, isLoading: usersLoading } = useAllUsers();
  const fileRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<"upload" | "mapping" | "preview" | "done">("upload");
  const [rawParsed, setRawParsed] = useState<string[][]>([]);
  const [detectedDelimiter, setDetectedDelimiter] = useState(",");
  const [columnMapping, setColumnMapping] = useState<ColumnMapping>({ ...EMPTY_MAPPING });
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; skipped: number } | null>(null);
  const [fileError, setFileError] = useState("");

  // ─── Derived ───────────────────────────────────────────────────────────────

  const validWithIdx = useMemo(
    () => rows.map((r, i) => ({ row: r, idx: i })).filter(({ row }) => row.errors.length === 0 && row.monthlyTarget > 0),
    [rows]
  );
  const errorWithIdx = useMemo(
    () => rows.map((r, i) => ({ row: r, idx: i })).filter(({ row }) => row.errors.length > 0 || row.monthlyTarget <= 0),
    [rows]
  );
  const grouped = useMemo(() => {
    const map: Record<string, { u: User; entries: { row: ImportRow; idx: number }[] }> = {};
    for (const { row, idx } of validWithIdx) {
      const uid = row.resolvedUser!.id;
      if (!map[uid]) map[uid] = { u: row.resolvedUser!, entries: [] };
      map[uid].entries.push({ row, idx });
    }
    return map;
  }, [validWithIdx]);

  // ─── Guards ────────────────────────────────────────────────────────────────

  if (usersLoading) {
    return (
      <div className="flex h-40 items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    );
  }
  if (!user || getKpiRole(user) !== "developer") {
    return (
      <div className="flex h-40 items-center justify-center">
        <p className="text-sm text-muted-foreground">Akses tidak diizinkan.</p>
      </div>
    );
  }

  // ─── Handlers ──────────────────────────────────────────────────────────────

  function handleDownloadTemplate() {
    const timUsers = users.filter(u => (getKpiRole(u) === "tim" || getKpiRole(u) === "head") && u.absensiStatus === "active");
    const now = new Date();
    const yr = now.getFullYear();
    const mo = now.getMonth() + 1;
    const header = "userName,Brand,kpiTitle,kpiDescription,kpiType,unit,period,monthlyTarget,year,month,divisi";
    const hint   = `# CONTOH (hapus baris ini): Budi Santoso,Brand A,Target Penjualan,,result,currency,monthly,5000000,${yr},${mo}`;
    const dataRows = timUsers.map(u => `${u.name},,,,,,,,${yr},${mo},${u.department ?? "-"}`);
    const csv = [header, hint, ...dataRows].join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `template-kpi-${yr}-${String(mo).padStart(2, "0")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handleFile(file: File) {
    setFileError("");
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = (e.target?.result as string) ?? "";
      const delim = detectDelimiter(text);
      setDetectedDelimiter(delim);
      const parsed = parseCSV(text, delim);
      if (parsed.length < 2) { setFileError("CSV kosong atau hanya berisi header."); return; }
      setRawParsed(parsed);
      setColumnMapping(autoDetectMapping(parsed[0]));
      setStep("mapping");
    };
    reader.readAsText(file);
  }

  function handleConfirmMapping() {
    const built = buildRows(rawParsed, users, columnMapping);
    if (built.length === 0) { setFileError("Tidak ada baris data ditemukan."); setStep("upload"); return; }
    setRows(built);
    setStep("preview");
  }

  function updateTarget(idx: number, val: number) {
    setRows(prev => prev.map((r, i) => (i === idx ? { ...r, monthlyTarget: val } : r)));
  }

  async function handleImport() {
    setImporting(true);
    try {
      const supabase = createClient();

      const allDepts = [...new Set(validWithIdx.map(({ row }) => row.resolvedUser!.department ?? "").filter(Boolean))];
      const { data: deptRows } = await supabase.from("departments").select("id, name").in("name", allDepts);
      const deptIdByName: Record<string, string> = {};
      (deptRows ?? []).forEach((d: any) => { deptIdByName[d.name] = d.id; });

      const kpiMap = new Map<string, { id: string; type: KpiTypeVal }>();
      const kpiGroups = new Map<string, { row: ImportRow; dept: string }>();
      const kpiTargetSum = new Map<string, number>();

      for (const { row } of validWithIdx) {
        const dept = row.resolvedUser!.department ?? "";
        const key = `${row.kpiTitle.toLowerCase().trim()}|${row.kpiType}|${row.unit}|${row.period}|${dept.toLowerCase()}|${row.year}|${row.month}|${row.Brand.toLowerCase().trim()}`;
        kpiTargetSum.set(key, (kpiTargetSum.get(key) ?? 0) + row.monthlyTarget);
        if (!kpiGroups.has(key)) kpiGroups.set(key, { row, dept });
      }

      for (const [key, { row, dept }] of kpiGroups) {
        const { data: existingKpis } = await supabase.from("kpis")
          .select("id, title, type, unit, period, brand, monthly_target")
          .eq("year", row.year)
          .eq("month", row.month)
          .eq("department_id", deptIdByName[dept] ?? "")
          .is("deleted_at", null);

        const existing = (existingKpis ?? []).find((k: any) =>
          k.title.trim().toLowerCase() === row.kpiTitle.toLowerCase().trim() &&
          k.type === row.kpiType &&
          k.unit === row.unit &&
          k.period === row.period &&
          (k.brand ?? "").toLowerCase().trim() === row.Brand.toLowerCase().trim()
        );

        if (existing) {
          kpiMap.set(key, { id: existing.id, type: existing.type as KpiTypeVal });
          const additionalTarget = kpiTargetSum.get(key) ?? row.monthlyTarget;
          await supabase.from("kpis").update({
            monthly_target: existing.monthly_target + additionalTarget,
          }).eq("id", existing.id);
        } else {
          const { data: newKpi, error } = await supabase.from("kpis").insert({
            title: row.kpiTitle,
            brand: row.Brand || "",
            description: row.kpiDescription,
            type: row.kpiType,
            unit: row.unit,
            period: row.period,
            department_id: deptIdByName[dept] ?? null,
            monthly_target: kpiTargetSum.get(key) ?? row.monthlyTarget,
            year: row.year,
            month: row.month,
            status: "active",
            created_by: user!.id,
            deleted_at: null,
          }).select("id").single();
          if (error) throw error;
          kpiMap.set(key, { id: newKpi.id, type: row.kpiType });
        }
      }

      const assignmentsToInsert: Record<string, unknown>[] = [];
      for (const { row } of validWithIdx) {
        const dept = row.resolvedUser!.department ?? "";
        const key = `${row.kpiTitle.toLowerCase().trim()}|${row.kpiType}|${row.unit}|${row.period}|${dept.toLowerCase()}|${row.year}|${row.month}|${row.Brand.toLowerCase().trim()}`;
        const kpi = kpiMap.get(key)!;
        const workingDays = getWorkingDaysInMonth(row.year, row.month);
        const dailyTarget = workingDays > 0 ? Math.ceil(row.monthlyTarget / workingDays) : 0;
        assignmentsToInsert.push({
          kpi_id: kpi.id,
          user_id: row.resolvedUser!.id,
          department_id: deptIdByName[dept] ?? null,
          status: "active",
          monthly_target: row.monthlyTarget,
          current_daily_target: dailyTarget,
          actual_total: 0,
          expected_total: 0,
          achievement_percentage: 0,
          performance_category: "warning",
          working_days_total: workingDays,
          working_days_elapsed: 0,
          working_days_remaining: workingDays,
          active_days: 0,
          year: row.year,
          month: row.month,
        });
      }

      const { error: assignErr } = await supabase.from("kpi_assignments").insert(assignmentsToInsert as any);
      if (assignErr) throw assignErr;

      setImportResult({ success: validWithIdx.length, skipped: errorWithIdx.length });
      setStep("done");
    } catch (err) {
      console.error("Import error:", err);
    } finally {
      setImporting(false);
    }
  }

  function resetAll() {
    setStep("upload");
    setRows([]);
    setRawParsed([]);
    setColumnMapping({ ...EMPTY_MAPPING });
    setImportResult(null);
    setFileError("");
  }

  // ─── Render: Upload ────────────────────────────────────────────────────────

  if (step === "upload") {
    return (
      <div className="space-y-6 max-w-2xl">
        <div>
          <h2 className="text-base font-semibold">Import KPI via CSV</h2>
          <p className="text-sm text-muted-foreground">Developer tool — bulk import KPI dan assignment sekaligus.</p>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">1. Download Template</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Template berisi nama semua staff aktif. Isi satu baris per KPI per orang.
            </p>
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-md bg-blue-50 px-3 py-2 text-xs text-blue-700">
                <p className="font-semibold mb-1">kpiType</p>
                <p className="font-mono">result</p>
                <p className="font-mono">activity</p>
                <p className="font-mono">quality</p>
              </div>
              <div className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
                <p className="font-semibold mb-1">unit</p>
                <p className="font-mono">number</p>
                <p className="font-mono">currency</p>
                <p className="font-mono">percentage</p>
              </div>
              <div className="rounded-md bg-purple-50 px-3 py-2 text-xs text-purple-700">
                <p className="font-semibold mb-1">period</p>
                <p className="font-mono">daily</p>
                <p className="font-mono">weekly</p>
                <p className="font-mono">monthly</p>
              </div>
            </div>
            <Button variant="outline" size="sm" onClick={handleDownloadTemplate}>
              <Download className="h-4 w-4 mr-2" />
              Download Template CSV
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">2. Upload CSV yang Sudah Diisi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div
              className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-border p-10 cursor-pointer hover:bg-accent/30 transition-colors"
              onClick={() => fileRef.current?.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-sm font-medium">Klik atau drag & drop file CSV</p>
                <p className="text-xs text-muted-foreground mt-0.5">Mendukung pemisah koma (,) dan titik koma (;)</p>
              </div>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={e => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = ""; }}
            />
            {fileError && <p className="text-sm text-destructive">{fileError}</p>}
          </CardContent>
        </Card>
      </div>
    );
  }

  // ─── Render: Mapping ───────────────────────────────────────────────────────

  if (step === "mapping") {
    const headers     = rawParsed[0] ?? [];
    const dataPreview = rawParsed.slice(1).filter(r => r[0]?.trim() && !r[0].trim().startsWith("#")).slice(0, 3);
    const requiredOk  = SYSTEM_FIELDS.filter(f => f.required).every(f => columnMapping[f.key] >= 0);

    return (
      <div className="space-y-5 max-w-2xl">
        <div>
          <h2 className="text-base font-semibold">Cocokkan Kolom CSV</h2>
          <p className="text-sm text-muted-foreground">
            {headers.length} kolom terdeteksi · pemisah:{" "}
            <span className="font-mono font-medium text-foreground">
              {detectedDelimiter === ";" ? "titik koma ( ; )" : "koma ( , )"}
            </span>
          </p>
        </div>

        <Card>
          <CardContent className="pt-4 space-y-2.5">
            {SYSTEM_FIELDS.map(field => {
              const sampleVal = columnMapping[field.key] >= 0
                ? (dataPreview[0]?.[columnMapping[field.key]] ?? "")
                : "";
              return (
                <div key={field.key} className="flex items-center gap-3">
                  <div className="w-32 shrink-0 text-right">
                    <span className="text-sm">{field.label}</span>
                    {field.required && <span className="text-destructive ml-0.5 text-xs">*</span>}
                  </div>
                  <select
                    value={columnMapping[field.key]}
                    onChange={e => setColumnMapping(prev => ({ ...prev, [field.key]: Number(e.target.value) }))}
                    className="flex-1 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                  >
                    <option value={-1}>— tidak dipetakan —</option>
                    {headers.map((h, i) => (
                      <option key={i} value={i}>{h || `Kolom ${i + 1}`}</option>
                    ))}
                  </select>
                  <span
                    className="w-28 shrink-0 truncate text-[11px] text-muted-foreground font-mono"
                    title={sampleVal}
                  >
                    {sampleVal || ""}
                  </span>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {dataPreview.length > 0 && (
          <div className="rounded-xl border border-border overflow-hidden">
            <p className="text-xs font-semibold text-muted-foreground px-4 py-2 border-b border-border bg-muted/30">
              Pratinjau 3 baris data
            </p>
            <div className="overflow-x-auto">
              <table className="text-[11px] w-full">
                <thead className="border-b border-border bg-muted/20">
                  <tr>
                    {SYSTEM_FIELDS.map(f => (
                      <th key={f.key} className="px-3 py-2 text-left font-medium text-muted-foreground whitespace-nowrap">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {dataPreview.map((row, ri) => (
                    <tr key={ri}>
                      {SYSTEM_FIELDS.map(f => {
                        const val = columnMapping[f.key] >= 0 ? (row[columnMapping[f.key]] ?? "") : "";
                        return (
                          <td key={f.key} className="px-3 py-2 whitespace-nowrap max-w-[110px] truncate" title={val}>
                            {val || <span className="text-muted-foreground/30">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={resetAll}>Batal</Button>
          <Button onClick={handleConfirmMapping} disabled={!requiredOk}>
            Lanjutkan →
            <span className="ml-1.5 text-xs opacity-60">{rawParsed.length - 1} baris</span>
          </Button>
        </div>
      </div>
    );
  }

  // ─── Render: Preview ───────────────────────────────────────────────────────

  if (step === "preview") {
    return (
      <div className="space-y-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-base font-semibold">Konfirmasi Import</h2>
            <p className="text-sm text-muted-foreground">
              {validWithIdx.length} KPI untuk {Object.keys(grouped).length} karyawan
              {errorWithIdx.length > 0 && (
                <> · <span className="text-destructive font-medium">{errorWithIdx.length} baris error (di-skip)</span></>
              )}
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button variant="outline" size="sm" onClick={resetAll}>Batal</Button>
            <Button size="sm" onClick={handleImport} disabled={importing || validWithIdx.length === 0}>
              {importing ? "Mengimpor..." : `Confirm Import ${validWithIdx.length} KPI`}
            </Button>
          </div>
        </div>

        <div className="space-y-3">
          {Object.values(grouped).map(({ u, entries }) => (
            <div key={u.id} className="rounded-xl border border-border overflow-hidden">
              <div className="flex items-center gap-3 px-4 py-3 bg-card">
                <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                  <span className="text-xs font-semibold text-primary">{getInitials(u.name)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.department ?? "—"} · {entries.length} KPI</p>
                </div>
              </div>
              <div className="divide-y divide-border border-t border-border">
                {entries.map(({ row, idx }) => (
                  <div key={idx} className="flex items-center gap-3 px-4 py-2.5">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${TYPE_CFG[row.kpiType]?.cls ?? ""}`}>
                      {TYPE_CFG[row.kpiType]?.label ?? row.kpiType}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{row.kpiTitle}</p>
                      <p className="text-xs text-muted-foreground">{row.unit} · {row.period}</p>
                    </div>
                    <input
                      type="number"
                      min="0.01"
                      step="any"
                      value={row.monthlyTarget || ""}
                      onChange={e => updateTarget(idx, parseFloat(e.target.value) || 0)}
                      className="w-32 rounded-md border border-border bg-background px-2 py-1 text-right text-sm tabular-nums focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {errorWithIdx.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-destructive uppercase tracking-wide">Baris Error — di-skip saat import</p>
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 overflow-hidden divide-y divide-destructive/20">
              {errorWithIdx.map(({ row, idx }) => (
                <div key={idx} className="flex items-start gap-3 px-4 py-2.5">
                  <XCircle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-destructive truncate">
                      {row.rawName || "(kosong)"}{row.kpiTitle ? ` — ${row.kpiTitle}` : ""}
                    </p>
                    <ul className="mt-0.5 space-y-0.5">
                      {row.errors.map((e, ei) => (
                        <li key={ei} className="text-xs text-destructive/80">{e}</li>
                      ))}
                      {row.errors.length === 0 && row.monthlyTarget <= 0 && (
                        <li className="text-xs text-destructive/80">monthlyTarget harus angka &gt; 0</li>
                      )}
                    </ul>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  // ─── Render: Done ──────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col items-center justify-center gap-6 py-16 max-w-sm mx-auto text-center">
      <div className="h-16 w-16 rounded-full bg-emerald-100 flex items-center justify-center">
        <CheckCircle2 className="h-8 w-8 text-emerald-600" />
      </div>
      <div>
        <h2 className="text-base font-semibold">Import Selesai</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {importResult?.success ?? 0} assignment berhasil dibuat
          {(importResult?.skipped ?? 0) > 0 && ` · ${importResult!.skipped} baris di-skip`}
        </p>
      </div>
      <Button variant="outline" onClick={resetAll}>Import Lagi</Button>
    </div>
  );
}
