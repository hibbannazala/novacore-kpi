"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import type { OvertimeRequest } from "@/types/absensi";
import {
  formatDurationDetail,
  isWeekend,
  countWorkingDaysInMonth,
  calculateOvertimeRates,
  formatRp,
} from "@/lib/overtimeHelpers";
import {
  X,
  Calculator,
  CalendarDays,
  Clock,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Info,
  DollarSign,
  User,
  RefreshCw,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";

interface OvertimeFinalizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  overtime: OvertimeRequest | null;
  baseSalary?: number;
  onSuccess: () => void;
}

export default function OvertimeFinalizeModal({
  isOpen,
  onClose,
  overtime,
  baseSalary = 0,
  onSuccess,
}: OvertimeFinalizeModalProps) {
  const { user } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form states
  const [finalHours, setFinalHours] = useState(0);
  const [finalMinutes, setFinalMinutes] = useState(0);
  const [dayType, setDayType] = useState<"weekday" | "weekend" | "holiday">("weekday");
  
  // Rate & Pay states (all editable)
  const [hourlyBaseRate, setHourlyBaseRate] = useState(0);
  const [firstHourPay, setFirstHourPay] = useState(0);
  const [subsequentHourRate, setSubsequentHourRate] = useState(0);
  const [totalPayOverride, setTotalPayOverride] = useState<number | null>(null);
  const [maxPayCap, setMaxPayCap] = useState<number | null>(null);
  const [finalNotes, setFinalNotes] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  // Initialize form whenever modal opens or overtime changes
  useEffect(() => {
    if (!isOpen || !overtime) return;

    // 1. Initial duration from actual, approved, requested, or already finalized
    const defaultMins =
      overtime.finalDurationMinutes ??
      overtime.actualDurationMinutes ??
      overtime.approvedDurationMinutes ??
      overtime.requestedDurationMinutes ??
      0;

    const initialHours = Math.floor(defaultMins / 60);
    const initialMins = defaultMins % 60;
    setFinalHours(initialHours);
    setFinalMinutes(initialMins);

    // 2. Day type (weekday vs weekend)
    const isWeekendDay = isWeekend(overtime.overtimeDate);
    const initialDayType =
      overtime.dayType || (isWeekendDay ? "weekend" : "weekday");
    setDayType(initialDayType);

    // 3. Calculate benchmark rate
    const [yStr, mStr] = (overtime.overtimeDate || "").split("-");
    const y = parseInt(yStr, 10) || new Date().getFullYear();
    const m = parseInt(mStr, 10) || new Date().getMonth() + 1;
    const workingDays = countWorkingDaysInMonth(y, m);

    const calculated = calculateOvertimeRates(baseSalary, workingDays, 9);

    // Check if this overtime request was previously finalized with legitimate > 0 pay
    const hasLegitimateSavedPay =
      overtime.status === "finalized" &&
      typeof overtime.totalOvertimePay === "number" &&
      overtime.totalOvertimePay > 0;

    if (hasLegitimateSavedPay) {
      const baseRate =
        (overtime.hourlyBaseRate && overtime.hourlyBaseRate > 0)
          ? overtime.hourlyBaseRate
          : calculated.hourlyBaseRate;
      const fPay = overtime.firstHourPay && overtime.firstHourPay > 0 ? overtime.firstHourPay : calculated.firstHourRate;
      const sRate = overtime.subsequentHourRate && overtime.subsequentHourRate > 0 ? overtime.subsequentHourRate : calculated.subsequentHourRate;

      setHourlyBaseRate(baseRate);
      setFirstHourPay(fPay);
      setSubsequentHourRate(sRate);

      // Only preserve override if it was explicitly flagged as manual override
      const savedSubHoursDecimal = Math.max(0, (defaultMins / 60) - 1);
      const activeFPay = defaultMins > 0 ? fPay : 0;
      const expectedCalc = activeFPay + Math.round(savedSubHoursDecimal * sRate);
      const wasManualOverride = overtime.calculationBreakdown?.isOverride === true ||
        (typeof overtime.totalOvertimePay === "number" && Math.abs(overtime.totalOvertimePay - expectedCalc) > 5);

      setTotalPayOverride(wasManualOverride ? overtime.totalOvertimePay! : null);
    } else {
      // Fresh finalize or previously zero: automatically prefill with calculated benchmark
      setHourlyBaseRate(calculated.hourlyBaseRate);
      setFirstHourPay(calculated.firstHourRate);
      setSubsequentHourRate(calculated.subsequentHourRate);
      setTotalPayOverride(null);
    }

    const savedCap = overtime.calculationBreakdown?.maxPayCap ?? null;
    setMaxPayCap(typeof savedCap === "number" && savedCap > 0 ? savedCap : null);

    setFinalNotes(overtime.finalNotes || "");
  }, [isOpen, overtime, baseSalary]);

  // Lock body scroll
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  if (!mounted || !isOpen || !overtime || typeof document === "undefined") return null;

  // Calculation values
  const totalDurationMinutes = Math.max(0, finalHours * 60 + finalMinutes);
  const totalHoursDecimal = totalDurationMinutes / 60;

  // Sisa jam (setelah 1 jam pertama)
  const subsequentHoursDecimal = Math.max(0, totalHoursDecimal - 1);
  const subsequentPayCalculated = Math.round(subsequentHoursDecimal * subsequentHourRate);

  // If total duration is 0, total is 0. If duration is less than 1 hour, first hour pro-rated or full
  const activeFirstHourPay = totalDurationMinutes > 0 ? firstHourPay : 0;
  const uncappedCalculatedPay = activeFirstHourPay + subsequentPayCalculated;

  // Plafon / Budget Cap logic
  const isCapActive = maxPayCap !== null && maxPayCap > 0;
  const isOverCap = isCapActive && uncappedCalculatedPay > maxPayCap;
  const cappedCalculatedPay = isOverCap ? maxPayCap : uncappedCalculatedPay;

  const finalTotalPay = totalPayOverride !== null ? totalPayOverride : cappedCalculatedPay;

  // Working days context
  const [yStr, mStr] = (overtime.overtimeDate || "").split("-");
  const y = parseInt(yStr, 10) || new Date().getFullYear();
  const m = parseInt(mStr, 10) || new Date().getMonth() + 1;
  const workingDays = countWorkingDaysInMonth(y, m);
  const standardCalculated = calculateOvertimeRates(baseSalary, workingDays, 9);
  const standardFirstHourPay = totalDurationMinutes > 0 ? standardCalculated.firstHourRate : 0;
  const standardSubsequentPay = Math.round(subsequentHoursDecimal * standardCalculated.subsequentHourRate);
  const standardTotalPay = standardFirstHourPay + standardSubsequentPay;

  const resetToFormula = () => {
    setHourlyBaseRate(standardCalculated.hourlyBaseRate);
    setFirstHourPay(standardCalculated.firstHourRate);
    setSubsequentHourRate(standardCalculated.subsequentHourRate);
    setTotalPayOverride(null);
    setMaxPayCap(null);
    toast.success("Berhasil menghitung ulang tarif berdasarkan Gaji Pokok!");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    if (totalDurationMinutes <= 0) {
      toast.error("Durasi lembur harus lebih dari 0 menit.");
      return;
    }

    setSaving(true);
    const tid = toast.loading("Menyimpan finalisasi & upah lembur...");

    try {
      const supabase = createClient();
      const payload = {
        status: "finalized",
        final_duration_minutes: totalDurationMinutes,
        finalized_by: user.id,
        finalized_date: new Date().toISOString(),
        final_notes: finalNotes.trim() || null,
        day_type: dayType,
        is_holiday: dayType === "holiday",
        hourly_base_rate: hourlyBaseRate,
        first_hour_rate: firstHourPay,
        first_hour_pay: activeFirstHourPay,
        subsequent_hour_rate: subsequentHourRate,
        subsequent_hour_pay: subsequentPayCalculated,
        total_overtime_pay: finalTotalPay,
        calculation_breakdown: {
          baseSalary,
          workingDays,
          hoursPerDay: 9,
          hourlyBaseRate,
          totalDurationMinutes,
          firstHourPay: activeFirstHourPay,
          subsequentHours: subsequentHoursDecimal,
          subsequentHourRate,
          subsequentPay: subsequentPayCalculated,
          uncappedTotalPay: uncappedCalculatedPay,
          maxPayCap: isCapActive ? maxPayCap : null,
          isCapped: isOverCap,
          budgetSaved: isOverCap ? uncappedCalculatedPay - maxPayCap : 0,
          totalOvertimePay: finalTotalPay,
          isOverride: totalPayOverride !== null,
        },
      };

      const { error } = await supabase
        .from("overtime_requests" as any)
        .update(payload)
        .eq("id", overtime.id);

      if (error) throw error;

      toast.success(
        `Lembur disahkan: ${formatDurationDetail(totalDurationMinutes)} (${formatRp(finalTotalPay)})!`,
        { id: tid }
      );
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error("Error finalizing overtime:", err);
      toast.error("Gagal finalisasi: " + err.message, { id: tid });
    } finally {
      setSaving(false);
    }
  };

  return createPortal(
    <div
      className="fixed inset-0 z-[99999] bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-5 overflow-y-auto overscroll-contain animate-in fade-in duration-200"
      onClick={(e) => {
        if (e.target === e.currentTarget && !saving) onClose();
      }}
    >
      <div
        className="w-full max-w-xl my-auto bg-[var(--ab-bg-surface)] rounded-[32px] p-5 sm:p-7 border border-[var(--ab-border)] shadow-2xl space-y-5 max-h-[92vh] overflow-y-auto relative box-border"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-start border-b border-[var(--ab-border)] pb-3.5">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                <Calculator size={18} />
              </div>
              <h3 className="text-base sm:text-lg font-black text-[var(--ab-text-main)] uppercase tracking-tight">
                Finalisasi & Upah Lembur
              </h3>
            </div>
            <p className="text-xs text-[var(--ab-text-dim)] flex items-center gap-2 flex-wrap font-medium">
              <span className="font-bold text-[var(--ab-text-main)] flex items-center gap-1">
                <User size={13} className="text-amber-500" /> {overtime.userName}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <CalendarDays size={13} className="text-blue-500" /> {overtime.overtimeDate}
              </span>
            </p>
          </div>
          <button
            type="button"
            disabled={saving}
            onClick={onClose}
            className="p-2 rounded-full text-[var(--ab-text-dim)] hover:text-[var(--ab-text-main)] hover:bg-[var(--ab-bg-main)] transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Day Type Badge / Switcher */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
          <div className="flex items-center gap-2">
            <Sparkles size={16} className="text-amber-500 shrink-0" />
            <div>
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 block">
                Konteks Hari Pelaksanaan
              </span>
              <p className="text-xs font-bold text-[var(--ab-text-main)]">
                {dayType === "weekday"
                  ? "Hari Kerja Biasa (Weekdays)"
                  : dayType === "weekend"
                  ? "Akhir Pekan (Weekend: Sabtu/Minggu)"
                  : "Tanggal Merah / Libur Nasional"}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1 bg-[var(--ab-bg-surface)] p-1 rounded-xl border border-[var(--ab-border)] shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={() => {
                setDayType("weekday");
                setTotalPayOverride(null);
              }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                dayType === "weekday"
                  ? "bg-amber-500 text-white shadow-sm"
                  : "text-[var(--ab-text-dim)] hover:text-[var(--ab-text-main)]"
              }`}
            >
              Weekday
            </button>
            <button
              type="button"
              onClick={() => {
                setDayType("weekend");
                setTotalPayOverride(null);
              }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                dayType === "weekend"
                  ? "bg-purple-600 text-white shadow-sm"
                  : "text-[var(--ab-text-dim)] hover:text-[var(--ab-text-main)]"
              }`}
            >
              Weekend
            </button>
            <button
              type="button"
              onClick={() => {
                setDayType("holiday");
                setTotalPayOverride(null);
              }}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all ${
                dayType === "holiday"
                  ? "bg-rose-600 text-white shadow-sm"
                  : "text-[var(--ab-text-dim)] hover:text-[var(--ab-text-main)]"
              }`}
            >
              Libur
            </button>
          </div>
        </div>

        {/* Reminder Box: Acuan Gaji Pokok */}
        <div className="p-3.5 bg-[var(--ab-bg-main)] rounded-2xl border border-[var(--ab-border)] text-xs space-y-2">
          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider text-[var(--ab-text-dim)] flex-wrap gap-2">
            <span className="flex items-center gap-1">
              <Info size={13} className="text-blue-500" /> Acuan Rumus Sistem (Reminder)
            </span>
            <div className="flex items-center gap-2">
              <span className="text-blue-500 font-mono">
                {workingDays} Hari Kerja • 9 Jam/Hari
              </span>
              <button
                type="button"
                onClick={resetToFormula}
                className="px-2 py-0.5 rounded-lg bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 font-black text-[9px] uppercase tracking-wider flex items-center gap-1 border border-amber-500/30 transition-colors"
                title="Hitung ulang otomatis tarif berdasarkan gaji pokok"
              >
                <RefreshCw size={11} />
                Hitung Ulang Rumus
              </button>
            </div>
          </div>

          <div className="p-2.5 bg-[var(--ab-bg-surface)] rounded-xl border border-[var(--ab-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <span className="text-[9px] font-bold text-[var(--ab-text-dim)] block">
                Gaji Pokok Karyawan
              </span>
              <span className="font-mono font-black text-[var(--ab-text-main)] text-sm">
                {formatRp(baseSalary)}
              </span>
            </div>
            <div className="text-left sm:text-right">
              <span className="text-[9px] font-bold text-[var(--ab-text-dim)] block">
                Estimasi Rate Per Jam (Gaji ÷ {workingDays} ÷ 9)
              </span>
              <span className="font-mono font-bold text-amber-600 dark:text-amber-400 text-xs">
                ~ {formatRp(hourlyBaseRate)} / Jam
              </span>
            </div>
          </div>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* 1. Durasi Final */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-[var(--ab-text-dim)] flex items-center justify-between">
              <span>Durasi Final yang Sah & Diakui</span>
              <span className="text-amber-500 font-bold">
                {formatDurationDetail(totalDurationMinutes)}
              </span>
            </label>
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex items-center gap-2 bg-[var(--ab-bg-main)] p-2 rounded-xl border border-[var(--ab-border)]">
                <input
                  type="number"
                  min="0"
                  max="24"
                  value={finalHours}
                  onChange={(e) => {
                    setFinalHours(Math.max(0, parseInt(e.target.value) || 0));
                    setTotalPayOverride(null);
                  }}
                  className="ab-input text-center text-sm font-black py-1.5 w-full bg-[var(--ab-bg-surface)] font-mono"
                />
                <span className="text-xs font-bold text-[var(--ab-text-dim)] pr-1">Jam</span>
              </div>
              <div className="flex items-center gap-2 bg-[var(--ab-bg-main)] p-2 rounded-xl border border-[var(--ab-border)]">
                <input
                  type="number"
                  min="0"
                  max="59"
                  step="5"
                  value={finalMinutes}
                  onChange={(e) => {
                    setFinalMinutes(Math.max(0, Math.min(59, parseInt(e.target.value) || 0)));
                    setTotalPayOverride(null);
                  }}
                  className="ab-input text-center text-sm font-black py-1.5 w-full bg-[var(--ab-bg-surface)] font-mono"
                />
                <span className="text-xs font-bold text-[var(--ab-text-dim)] pr-1">Menit</span>
              </div>
            </div>
          </div>

          {/* 2. Breakdown Form Komponen Lembur (Editable) */}
          <div className="space-y-3 p-3.5 bg-[var(--ab-bg-main)] rounded-2xl border border-[var(--ab-border)]">
            <span className="text-[10px] font-black uppercase tracking-wider text-[var(--ab-text-dim)] block">
              Rincian Perhitungan Upah (Bisa Diedit Bebas oleh HR)
            </span>

            {/* Komponen 1 Jam Pertama */}
            <div className="space-y-1 bg-[var(--ab-bg-surface)] p-3 rounded-xl border border-[var(--ab-border)]">
              <div className="flex justify-between items-center text-xs">
                <span className="font-black text-[var(--ab-text-main)] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  1 Jam Pertama {dayType === "weekday" ? "(x1.5)" : "(Khusus)"}
                </span>
                <span className="text-[10px] font-bold text-[var(--ab-text-dim)]">
                  Nominal 1 Jam Pertama
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs font-bold text-[var(--ab-text-dim)]">Rp</span>
                <input
                  type="number"
                  value={firstHourPay}
                  onChange={(e) => {
                    setFirstHourPay(Math.max(0, parseInt(e.target.value) || 0));
                    setTotalPayOverride(null); // reset override so calculated takes over
                  }}
                  className="ab-input text-xs font-mono font-bold py-1.5 px-3 w-full"
                  placeholder="0"
                />
              </div>
              {/* Indicator if different from salary benchmark */}
              {baseSalary > 0 && firstHourPay !== standardCalculated.firstHourRate && (
                <div className="pt-1 text-[10px] font-bold">
                  {firstHourPay < standardCalculated.firstHourRate ? (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5 flex-wrap">
                      <span>⚠️ Nominal sesuai gaji perjamnya = {formatRp(standardCalculated.firstHourRate)}</span>
                      <span className="text-[8.5px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30">
                        (Anda set {formatRp(standardCalculated.firstHourRate - firstHourPay)} lebih rendah)
                      </span>
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 flex-wrap">
                      <span>✨ Nominal sesuai gaji perjamnya = {formatRp(standardCalculated.firstHourRate)}</span>
                      <span className="text-[8.5px] px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30">
                        (Anda set {formatRp(firstHourPay - standardCalculated.firstHourRate)} lebih tinggi)
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Komponen Jam Berikutnya */}
            <div className="space-y-1 bg-[var(--ab-bg-surface)] p-3 rounded-xl border border-[var(--ab-border)]">
              <div className="flex justify-between items-center text-xs">
                <span className="font-black text-[var(--ab-text-main)] flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-blue-500" />
                  Sisa Jam Berikutnya ({subsequentHoursDecimal.toFixed(1)} Jam)
                </span>
                <span className="text-[10px] font-bold text-blue-500">
                  Subtotal: {formatRp(subsequentPayCalculated)}
                </span>
              </div>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[10px] font-bold text-[var(--ab-text-dim)] whitespace-nowrap">
                  Tarif / Jam: Rp
                </span>
                <input
                  type="number"
                  value={subsequentHourRate}
                  onChange={(e) => {
                    setSubsequentHourRate(Math.max(0, parseInt(e.target.value) || 0));
                    setTotalPayOverride(null);
                  }}
                  className="ab-input text-xs font-mono font-bold py-1.5 px-3 w-full"
                  placeholder="0"
                />
              </div>
              <p className="text-[9.5px] font-medium text-[var(--ab-text-dim)] italic pt-0.5">
                Hitungan: {subsequentHoursDecimal.toFixed(1)} jam × {formatRp(subsequentHourRate)} = {formatRp(subsequentPayCalculated)}
              </p>
              {/* Indicator if different from salary benchmark */}
              {baseSalary > 0 && subsequentHourRate !== standardCalculated.subsequentHourRate && (
                <div className="pt-0.5 text-[10px] font-bold">
                  {subsequentHourRate < standardCalculated.subsequentHourRate ? (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5 flex-wrap">
                      <span>⚠️ Nominal sesuai gaji perjamnya = {formatRp(standardCalculated.subsequentHourRate)} / jam</span>
                      <span className="text-[8.5px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30">
                        (Anda set {formatRp(standardCalculated.subsequentHourRate - subsequentHourRate)} lebih rendah)
                      </span>
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 flex-wrap">
                      <span>✨ Nominal sesuai gaji perjamnya = {formatRp(standardCalculated.subsequentHourRate)} / jam</span>
                      <span className="text-[8.5px] px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30">
                        (Anda set {formatRp(subsequentHourRate - standardCalculated.subsequentHourRate)} lebih tinggi)
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Total Final Nominal */}
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/25 rounded-xl space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                  Total Nominal Lembur Sesi Ini
                </span>
                {totalPayOverride !== null && (
                  <button
                    type="button"
                    onClick={() => setTotalPayOverride(null)}
                    className="text-[9px] font-bold text-amber-600 hover:underline"
                  >
                    Reset ke Hitungan Otomatis
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">Rp</span>
                <input
                  type="number"
                  value={finalTotalPay}
                  onChange={(e) => setTotalPayOverride(Math.max(0, parseInt(e.target.value) || 0))}
                  className="ab-input text-sm font-mono font-black py-2 px-3 w-full text-emerald-700 dark:text-emerald-300 bg-[var(--ab-bg-surface)]"
                  placeholder="0"
                />
              </div>
              <p className="text-[9px] font-bold text-[var(--ab-text-dim)]">
                {totalPayOverride !== null
                  ? "✏️ Anda meng-override total secara manual."
                  : isOverCap
                  ? `⚠️ Dibatasi oleh Plafon Maksimal (${formatRp(maxPayCap)}) dari hitungan normal (${formatRp(uncappedCalculatedPay)})`
                  : `Total = 1 Jam Pertama (${formatRp(activeFirstHourPay)}) + Sisa Jam (${formatRp(subsequentPayCalculated)})`}
              </p>
              {/* Indicator if final total differs from standard salary formula */}
              {baseSalary > 0 && finalTotalPay !== standardTotalPay && (
                <div className="pt-0.5 text-[10px] font-bold">
                  {finalTotalPay < standardTotalPay ? (
                    <span className="text-amber-600 dark:text-amber-400 flex items-center gap-1.5 flex-wrap">
                      <span>⚠️ Total sesuai hitungan gaji = {formatRp(standardTotalPay)}</span>
                      <span className="text-[8.5px] px-1.5 py-0.5 rounded bg-amber-500/15 border border-amber-500/30">
                        (Total {formatRp(standardTotalPay - finalTotalPay)} lebih rendah dari standar)
                      </span>
                    </span>
                  ) : (
                    <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1.5 flex-wrap">
                      <span>✨ Total sesuai hitungan gaji = {formatRp(standardTotalPay)}</span>
                      <span className="text-[8.5px] px-1.5 py-0.5 rounded bg-emerald-500/15 border border-emerald-500/30">
                        (Total {formatRp(finalTotalPay - standardTotalPay)} lebih tinggi dari standar)
                      </span>
                    </span>
                  )}
                </div>
              )}
            </div>

            {/* Plafon Maksimal Lembur Sesi Ini (Budget Cap) */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/25 rounded-xl space-y-1.5">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-300 flex items-center gap-1.5">
                  <ShieldAlert size={13} className="text-amber-500" />
                  Batas Maksimal Upah Sesi Ini (Plafon / Budget Cap)
                </span>
                {maxPayCap !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setMaxPayCap(null);
                      setTotalPayOverride(null);
                    }}
                    className="text-[9px] font-bold text-amber-600 hover:underline"
                  >
                    Hapus Plafon
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[var(--ab-text-dim)]">Rp</span>
                <input
                  type="number"
                  value={maxPayCap ?? ""}
                  onChange={(e) => {
                    const val = e.target.value;
                    setMaxPayCap(val === "" ? null : Math.max(0, parseInt(val) || 0));
                    setTotalPayOverride(null);
                  }}
                  className="ab-input text-xs font-mono font-bold py-1.5 px-3 w-full bg-[var(--ab-bg-surface)]"
                  placeholder="Opsional (contoh: 100000 agar biaya operasional kantor tidak membengkak)"
                />
              </div>
              <p className="text-[9px] text-[var(--ab-text-dim)]">
                Kebijakan operasional: batasi nominal maksimal sesi ini jika kalkulasi jam kerja melebihi alokasi anggaran kantor.
              </p>
              {/* Live Feedback Indicator */}
              {isCapActive && (
                <div className="pt-0.5 text-[10px] font-bold">
                  {isOverCap ? (
                    <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-300 bg-amber-500/15 p-1.5 rounded-lg border border-amber-500/30">
                      <span>⚠️ <strong>Plafon Aktif:</strong> Upah di-cap maksimal {formatRp(maxPayCap)}</span>
                      <span className="text-[8.5px] px-1.5 py-0.5 rounded bg-amber-600 text-white ml-auto">
                        Hemat {formatRp(uncappedCalculatedPay - maxPayCap)}
                      </span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                      <span>✓ Nominal hitungan ({formatRp(uncappedCalculatedPay)}) masih di bawah batas plafon maksimal.</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* 3. Catatan Final HR */}
          <div className="space-y-1">
            <label className="text-[10px] font-black uppercase tracking-wider text-[var(--ab-text-dim)]">
              Catatan Keputusan Final HR (Opsional)
            </label>
            <textarea
              rows={2}
              value={finalNotes}
              onChange={(e) => setFinalNotes(e.target.value)}
              placeholder="Contoh: Lembur disahkan 4 jam sesuai hasil laporan kampanye..."
              className="ab-input text-xs py-2 px-3 w-full resize-none rounded-xl"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-[var(--ab-border)]">
            <button
              type="button"
              disabled={saving}
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider text-[var(--ab-text-dim)] hover:bg-[var(--ab-bg-main)] transition-colors"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-500 hover:bg-emerald-600 text-white shadow-lg shadow-emerald-500/20 flex items-center gap-2 transition-all active:scale-95 disabled:opacity-50"
            >
              <CheckCircle2 size={15} />
              {saving ? "Menyimpan..." : "Sahkan & Masuk Payroll"}
            </button>
          </div>
        </form>
      </div>
    </div>,
    document.body
  );
}
