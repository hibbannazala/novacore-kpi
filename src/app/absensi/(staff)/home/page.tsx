"use client";

import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAttendanceToday } from "@/hooks/absensi/useAttendanceToday";
import { useAbsensiSettings } from "@/hooks/absensi/useAbsensiSettings";
import { useHolidays } from "@/hooks/absensi/useHolidays";
import ConfirmDialog from "@/components/absensi/ConfirmDialog";
import PromptDialog from "@/components/absensi/PromptDialog";
import CountUp from "@/components/absensi/CountUp";
import {
  Fingerprint, Laptop, Umbrella, Stethoscope,
  Clock, CheckCircle2, AlertCircle, MapPin,
  Lock, Info, X,
} from "lucide-react";
import { toast } from "sonner";

// ─ Haversine ──────────────────────────────────────────────────────────────────
function calcDist(la1: number, lo1: number, la2: number, lo2: number) {
  const R = 6371e3;
  const f1 = (la1 * Math.PI) / 180, f2 = (la2 * Math.PI) / 180;
  const df = ((la2 - la1) * Math.PI) / 180, dl = ((lo2 - lo1) * Math.PI) / 180;
  const a = Math.sin(df / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function getToday() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getNowTime() {
  const n = new Date();
  return `${String(n.getHours()).padStart(2, "0")}:${String(n.getMinutes()).padStart(2, "0")}`;
}

function fmtTime(t: string | null) {
  if (!t) return "--:--";
  return t.substring(0, 5); // "08:30:00" → "08:30"
}

// ─ Types ──────────────────────────────────────────────────────────────────────
type LocationPerm = "granted" | "denied" | "prompt";
type SummaryView = { type: string; names: string[]; color: string } | null;
type SummaryEntry = { count: number; names: string[] };
type Summary = { wfo: SummaryEntry; wfa: SummaryEntry; leave: SummaryEntry; missed: SummaryEntry };

type CheckInResult =
  | { requireLateReason: true; location: { lat: number; lng: number } | null; arrStat: string; lateFine: number }
  | { success: true; status: string; time: string; locationStatus: string; lateFine: number; radiusPenalty: number }
  | { success: false; error: string };

// ─ Main component ─────────────────────────────────────────────────────────────
export default function StaffHomePage() {
  const { user } = useAuth();
  const router = useRouter();
  const { attendance, isLoading } = useAttendanceToday(user?.id ?? null);
  const { settings } = useAbsensiSettings();
  const { holidayDates } = useHolidays();

  const [isProcessing, setIsProcessing] = useState(false);
  const [locationPerm, setLocationPerm] = useState<LocationPerm>("prompt");
  const [showLocationGuide, setShowLocationGuide] = useState(false);
  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);
  const [showEarlyPrompt, setShowEarlyPrompt] = useState(false);
  const [showRadiusWarning, setShowRadiusWarning] = useState(false);
  const [showLateReasonPrompt, setShowLateReasonPrompt] = useState(false);
  const [selectedView, setSelectedView] = useState<SummaryView>(null);
  const [summary, setSummary] = useState<Summary>({
    wfo: { count: 0, names: [] },
    wfa: { count: 0, names: [] },
    leave: { count: 0, names: [] },
    missed: { count: 0, names: [] },
  });

  const [isIOS] = useState(() =>
    typeof navigator !== "undefined" &&
    (/iPad|iPhone|iPod/.test(navigator.userAgent) ||
      (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1))
  );

  const today = getToday();
  const isHoliday = holidayDates.includes(today);

  // ─ Location permission ───────────────────────────────────────────────────────
  const checkPerm = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return;
    try {
      const res = await navigator.permissions.query({ name: "geolocation" });
      setLocationPerm(res.state as LocationPerm);
      res.onchange = () => setLocationPerm(res.state as LocationPerm);
    } catch {}
  }, []);

  useEffect(() => {
    requestAnimationFrame(() => checkPerm());
    window.addEventListener("focus", checkPerm);
    return () => window.removeEventListener("focus", checkPerm);
  }, [checkPerm]);

  // ─ Realtime summary ──────────────────────────────────────────────────────────
  useEffect(() => {
    const supabase = createClient();
    type URow = { id: string; name: string; isHidden: boolean };
    type ARow = { userId: string; type: string };
    type RRow = { userId: string; dates: string[] };
    let uList: URow[] = [];
    let aList: ARow[] = [];
    let rList: RRow[] = [];

    const updateStats = () => {
      const active = uList.filter((u) => !u.isHidden);
      const presentIds = new Set(aList.map((a) => a.userId));
      const leaveIds = new Set(rList.filter((r) => r.dates?.includes(today)).map((r) => r.userId));

      const wfoNames = aList.filter((a) => a.type === "WFO")
        .map((a) => active.find((u) => u.id === a.userId)?.name).filter(Boolean) as string[];
      const wfaNames = aList.filter((a) => a.type === "WFA")
        .map((a) => active.find((u) => u.id === a.userId)?.name).filter(Boolean) as string[];
      const leaveNames = active.filter((u) => leaveIds.has(u.id)).map((u) => u.name);
      const missedNames = active.filter((u) => !presentIds.has(u.id) && !leaveIds.has(u.id)).map((u) => u.name);

      setSummary({
        wfo: { count: wfoNames.length, names: wfoNames },
        wfa: { count: wfaNames.length, names: wfaNames },
        leave: { count: leaveNames.length, names: leaveNames },
        missed: { count: missedNames.length, names: missedNames },
      });
    };

    const fetchUsers = async () => {
      const { data } = await supabase.from("users").select("id, name, is_hidden").eq("absensi_status", "active");
      uList = (data ?? []).map((r) => ({ id: r.id as string, name: r.name as string, isHidden: (r.is_hidden as boolean) ?? false }));
      updateStats();
    };
    const fetchAtt = async () => {
      const { data } = await supabase.from("attendance").select("user_id, type").eq("date", today);
      aList = (data ?? []).map((r) => ({ userId: r.user_id as string, type: r.type as string }));
      updateStats();
    };
    const fetchReqs = async () => {
      const { data } = await supabase.from("leave_requests").select("user_id, dates").eq("status", "approved").contains("dates", [today]);
      rList = (data ?? []).map((r) => ({ userId: r.user_id as string, dates: (r.dates as string[]) ?? [] }));
      updateStats();
    };

    Promise.all([fetchUsers(), fetchAtt(), fetchReqs()]);

    const uCh = supabase.channel("sh_users").on("postgres_changes", { event: "*", schema: "public", table: "users" }, fetchUsers).subscribe();
    const aCh = supabase.channel("sh_att").on("postgres_changes", { event: "*", schema: "public", table: "attendance" }, fetchAtt).subscribe();
    const rCh = supabase.channel("sh_reqs").on("postgres_changes", { event: "*", schema: "public", table: "leave_requests" }, fetchReqs).subscribe();

    return () => { uCh.unsubscribe(); aCh.unsubscribe(); rCh.unsubscribe(); };
  }, [today]);

  // ─ Check-in ─────────────────────────────────────────────────────────────────
  const doCheckIn = useCallback(async (
    location: { lat: number; lng: number } | null,
    lateReason = ""
  ): Promise<CheckInResult> => {
    if (!user) return { success: false, error: "User tidak ditemukan." };
    const supabase = createClient();
    const now = new Date();

    const [lH, lM] = (settings.maxLate || "08:15").split(":").map(Number);
    const lateLim = new Date(); lateLim.setHours(lH, lM, 0, 0);

    let arrStat: "on_time" | "late" | "very_late" = "on_time";
    let lateFine = 0;
    if (now > lateLim) {
      const vLim = new Date(); vLim.setHours(10, 0, 0, 0);
      arrStat = now > vLim ? "very_late" : "late";
      const diffMins = Math.floor((now.getTime() - lateLim.getTime()) / 60000);
      lateFine = Math.ceil(diffMins / 10) * 30000;
      if (!lateReason) {
        return { requireLateReason: true, location, arrStat, lateFine };
      }
    }

    let locationStatus = "Lokasi Keblokir";
    let radiusPenalty = 0;
    if (location) {
      const dist = calcDist(location.lat, location.lng, settings.officeLat, settings.officeLng);
      if (dist <= (settings.officeRadius || 100)) {
        locationStatus = "Dalam Area";
      } else {
        locationStatus = "Di Luar Area";
        if (dist > 500) radiusPenalty = 2;
      }
    }

    const { error } = await supabase.from("attendance").insert({
      user_id: user.id,
      date: getToday(),
      check_in: getNowTime(),
      status: arrStat,
      type: "WFO",
      location_in: location,
      location_status: locationStatus,
      late_fine: lateFine,
      late_reason: lateReason,
      late_reason_status: lateReason ? "pending" : null,
      radius_penalty: radiusPenalty,
    });

    if (error) {
      if (error.code === "23505") return { success: false, error: "Anda sudah absen hari ini." };
      return { success: false, error: "Gagal menyimpan data ke sistem." };
    }
    return { success: true, status: arrStat, time: getNowTime(), locationStatus, lateFine, radiusPenalty };
  }, [user, settings]);

  // ─ Check-out ────────────────────────────────────────────────────────────────
  const doCheckOut = useCallback(async (earlyReason = "") => {
    if (!user) return { success: false, error: "User tidak ditemukan." };
    const supabase = createClient();
    const now = new Date();
    const [eH, eM] = (settings.workEnd || "18:00").split(":").map(Number);
    const endLim = new Date(); endLim.setHours(eH, eM, 0, 0);

    const { error } = await supabase.from("attendance")
      .update({ check_out: getNowTime(), early_checkout: now < endLim, early_reason: earlyReason })
      .eq("user_id", user.id)
      .eq("date", getToday());

    if (error) return { success: false, error: "Gagal melakukan check-out." };
    return { success: true, time: getNowTime() };
  }, [user, settings]);

  // ─ UI handlers ────────────────────────────────────────────────────────────────
  const finalizeCheckIn = (result: CheckInResult) => {
    if ("requireLateReason" in result) {
      setShowLateReasonPrompt(true);
      setIsProcessing(false);
      return;
    }
    if (result.success) {
      if (result.radiusPenalty > 0) {
        toast.error("Presensi di luar radius kantor. Status: Kedisiplinan Terpengaruh.", { duration: 6000 });
      } else if (result.lateFine > 0) {
        toast.error(`Anda telat! Denda: Rp ${result.lateFine.toLocaleString("id-ID")} (Menunggu review HR)`, { duration: 5000 });
      } else {
        toast.success(`Berhasil Check-In pukul ${result.time}!`);
      }
    } else {
      toast.error(result.error || "Gagal Check-In");
    }
    setIsProcessing(false);
    setPendingLocation(null);
    setShowRadiusWarning(false);
    setShowLateReasonPrompt(false);
  };

  const processCheckIn = async (
    confirmedLocation: { lat: number; lng: number } | null = null,
    lateReason = ""
  ) => {
    if (isProcessing && !confirmedLocation && !lateReason) return;
    if (!("geolocation" in navigator) && !confirmedLocation) {
      toast.error("Browser Anda tidak mendukung GPS.");
      return;
    }

    if (confirmedLocation || lateReason) {
      setIsProcessing(true);
      const result = await doCheckIn(confirmedLocation ?? pendingLocation, lateReason);
      finalizeCheckIn(result);
      return;
    }

    setIsProcessing(true);
    const toastId = toast.loading("Mendeteksi Lokasi...");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        toast.dismiss(toastId);
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        const dist = calcDist(loc.lat, loc.lng, settings.officeLat, settings.officeLng);
        if (dist > 500) {
          setPendingLocation(loc);
          setShowRadiusWarning(true);
          setIsProcessing(false);
          return;
        }
        const result = await doCheckIn(loc);
        if ("requireLateReason" in result) setPendingLocation(loc);
        finalizeCheckIn(result);
      },
      async (err) => {
        toast.dismiss(toastId);
        if (err.code === 1) {
          setLocationPerm("denied");
          const result = await doCheckIn(null);
          if ("requireLateReason" in result) setPendingLocation(null);
          finalizeCheckIn(result);
          if (!("requireLateReason" in result)) setShowLocationGuide(true);
        } else {
          toast.error("Gagal mendapatkan lokasi GPS. Pastikan izin lokasi aktif.");
          setIsProcessing(false);
        }
      },
      { enableHighAccuracy: true }
    );
  };

  const processCheckOut = async (reason = "") => {
    setIsProcessing(true);
    try {
      const result = await doCheckOut(reason);
      if (result.success) {
        toast.success("Berhasil Check-Out! Sampai besok.");
      } else {
        toast.error(result.error || "Gagal Check-Out");
      }
    } finally {
      setIsProcessing(false);
      setShowCheckoutConfirm(false);
      setShowEarlyPrompt(false);
    }
  };

  const onAbsenClick = () => {
    if (isProcessing) return;
    if (!attendance) {
      processCheckIn();
    } else if (!attendance.checkOut) {
      const [eH, eM] = (settings.workEnd || "18:00").split(":").map(Number);
      const endLim = new Date(); endLim.setHours(eH, eM, 0, 0);
      if (new Date() < endLim) {
        setShowEarlyPrompt(true);
      } else {
        setShowCheckoutConfirm(true);
      }
    }
  };

  // ─ Loading skeleton ──────────────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="p-6 space-y-6 animate-pulse">
        <div className="flex justify-between items-center h-12">
          <div className="w-1/2 h-8 bg-[var(--ab-bg-surface)] rounded-xl"></div>
          <div className="w-12 h-12 bg-[var(--ab-bg-surface)] rounded-full"></div>
        </div>
        <div className="h-16 bg-[var(--ab-bg-surface)] rounded-3xl"></div>
        <div className="h-52 bg-[var(--ab-bg-surface)] rounded-[40px]"></div>
        <div className="h-40 bg-[var(--ab-bg-surface)] rounded-[40px]"></div>
        <div className="grid grid-cols-2 gap-4">
          <div className="h-24 bg-[var(--ab-bg-surface)] rounded-3xl"></div>
          <div className="h-24 bg-[var(--ab-bg-surface)] rounded-3xl"></div>
        </div>
      </div>
    );
  }

  // ─ Render ─────────────────────────────────────────────────────────────────────
  const isLocationDenied = !attendance && locationPerm === "denied";
  const btnBg = isLocationDenied ? "#FFAB00" : "var(--ab-primary)";
  const btnShadow = isLocationDenied ? "0 20px 40px -12px rgba(255,171,0,0.4)" : "0 20px 40px -12px var(--ab-primary-glow)";

  return (
    <div className="space-y-6 pb-24 ab-animate-fadeIn">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[var(--ab-bg-surface)] rounded-xl flex items-center justify-center p-1.5 ab-nm-button">
            <img src="/logo-icon.png" alt="NovaCore" className="w-full h-full object-contain" />
          </div>
          <div>
            <h1 className="text-xl font-black text-[var(--ab-text-main)] tracking-tight leading-none">
              NovaCore Portal
            </h1>
            <p className="text-[9px] font-bold text-[var(--ab-text-dim)] uppercase tracking-widest mt-1">
              Employee Experience
            </p>
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] font-black text-[var(--ab-text-dim)] uppercase tracking-widest leading-none mb-1">Halo,</p>
          <p className="text-xs font-black truncate max-w-[120px]" style={{ color: "var(--ab-primary)" }}>
            {user?.name?.split(" ")[0]}
          </p>
        </div>
      </div>

      {/* Shift Banner */}
      <div className="rounded-3xl p-1 shadow-lg overflow-hidden" style={{ background: "var(--ab-primary)" }}>
        <div className="bg-white/10 backdrop-blur-sm p-4 rounded-[22px] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-white/10 p-2.5 rounded-xl text-white">
              <Clock size={14} className="animate-pulse" />
            </div>
            <div>
              <p className="text-[9px] font-black text-white/60 uppercase tracking-widest leading-none mb-1">
                Shift Operational
              </p>
              <p className="text-sm font-black text-white">
                {settings.workStart} — {settings.workEnd}
              </p>
            </div>
          </div>
          {isHoliday ? (
            <span className="bg-rose-500 text-white text-[9px] font-black px-3 py-1.5 rounded-full uppercase border border-white/20 animate-pulse">
              Hari Libur
            </span>
          ) : (
            <div className="text-right">
              <p className="text-[9px] font-black text-white/60 uppercase tracking-widest leading-none mb-1">Status</p>
              <p className="text-[10px] font-black text-white uppercase bg-white/10 px-3 py-1 rounded-lg border border-white/20">
                Hari Kerja
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Attendance Card */}
      <div className="ab-card-tactile relative overflow-hidden">
        {/* Top indicator strip */}
        <div
          className="absolute top-0 right-10 w-24 h-1.5 rounded-b-full shadow-lg transition-colors"
          style={{
            background: !attendance
              ? "var(--ab-border)"
              : attendance.checkOut
                ? "#22c55e"
                : "var(--ab-primary)",
          }}
        />

        <div className="flex justify-between items-center mb-6">
          <h3 className="text-xs font-black text-[var(--ab-text-dim)] uppercase tracking-[0.15em]">
            Laporan Presensi
          </h3>
          <div className="flex gap-2 flex-wrap justify-end">
            {attendance && (
              <span className={`text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest border ${
                attendance.status === "on_time"
                  ? "bg-green-50 text-green-600 border-green-100 dark:bg-green-900/30 dark:border-green-800/50 dark:text-green-400"
                  : "bg-orange-50 text-orange-600 border-orange-100 dark:bg-orange-900/30 dark:border-orange-800/50 dark:text-orange-400"
              }`}>
                {attendance.status.replace("_", " ")}
              </span>
            )}
            {attendance?.locationStatus && (
              <span className={`text-[10px] font-black px-3 py-1.5 rounded-full uppercase tracking-widest border ${
                attendance.locationStatus === "Dalam Area"
                  ? "bg-blue-50 text-blue-600 border-blue-100 dark:bg-blue-900/30 dark:border-blue-800/50 dark:text-blue-400"
                  : attendance.locationStatus === "Lokasi Keblokir"
                    ? "bg-amber-50 text-amber-600 border-amber-100 dark:bg-amber-900/30 dark:border-amber-800/50 dark:text-amber-400"
                    : "bg-rose-50 text-rose-600 border-rose-100 dark:bg-rose-900/30 dark:border-rose-800/50 dark:text-rose-400"
              }`}>
                {attendance.locationStatus}
              </span>
            )}
          </div>
        </div>

        {attendance?.type === "WFA" && (
          <div className="mb-5 bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300 p-4 rounded-2xl text-xs font-bold flex items-center gap-3 border border-purple-100 dark:border-purple-800">
            <Laptop size={20} />
            <div>
              <p className="font-black uppercase tracking-widest text-[9px] mb-0.5">Mode WFA Aktif</p>
              <p className="opacity-80">Pastikan koneksi internet stabil.</p>
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3 mb-6">
          <div className="bg-[var(--ab-bg-main)] p-4 rounded-3xl text-center border border-[var(--ab-border)]">
            <div className="flex flex-col items-center">
              <CheckCircle2 size={10} className="text-blue-400 mb-1.5" />
              <p className="text-[8px] font-black text-[var(--ab-text-dim)] uppercase tracking-widest mb-0.5 leading-none">
                Check In
              </p>
              <p className="font-black text-[var(--ab-text-main)] text-2xl font-mono tracking-tighter">
                {fmtTime(attendance?.checkIn ?? null)}
              </p>
            </div>
          </div>
          <div className="bg-[var(--ab-bg-main)] p-4 rounded-3xl text-center border border-[var(--ab-border)]">
            <div className="flex flex-col items-center">
              <AlertCircle size={10} className="text-orange-400 mb-1.5" />
              <p className="text-[8px] font-black text-[var(--ab-text-dim)] uppercase tracking-widest mb-0.5 leading-none">
                Check Out
              </p>
              <p className="font-black text-[var(--ab-text-main)] text-2xl font-mono tracking-tighter">
                {fmtTime(attendance?.checkOut ?? null)}
              </p>
            </div>
          </div>
        </div>

        <div className="relative">
          <button
            onClick={onAbsenClick}
            disabled={isProcessing || (attendance ? !!attendance.checkOut : isHoliday)}
            className="group relative w-full py-8 rounded-[35px] font-black text-xl shadow-2xl transition-all active:scale-95 disabled:opacity-50 disabled:grayscale overflow-hidden text-white"
            style={{ background: btnBg, boxShadow: btnShadow }}
          >
            <div className="flex items-center justify-center gap-4 relative z-10 uppercase tracking-tighter">
              {isLocationDenied ? (
                <AlertCircle size={36} className="animate-pulse" />
              ) : (
                <Fingerprint
                  size={36}
                  className="group-hover:scale-110 group-active:scale-90 transition-transform duration-300"
                />
              )}
              <div className="text-left">
                <p className="text-[10px] opacity-60 font-black tracking-widest mb-0.5 leading-none">
                  {isLocationDenied ? "Izin Diblokir" : "Presensi Digital"}
                </p>
                <p className="text-sm">
                  {isLocationDenied
                    ? "Buka Kunci Lokasi"
                    : !attendance
                      ? "Tap Untuk Masuk"
                      : attendance.checkOut
                        ? "Presensi Selesai"
                        : "Tap Untuk Pulang"}
                </p>
              </div>
            </div>
          </button>
          {!attendance && !isHoliday && (
            <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 bg-blue-500 text-white text-[8px] font-black px-4 py-1 rounded-full uppercase tracking-widest shadow-lg animate-bounce whitespace-nowrap">
              Mulai Shift Sekarang
            </div>
          )}
        </div>
      </div>

      {/* Real-time Summary */}
      <div className="ab-card-tactile">
        <div className="flex justify-between items-center mb-6">
          <h3 className="text-[10px] font-black text-[var(--ab-text-dim)] uppercase tracking-[0.2em]">
            Real-time Overview
          </h3>
          <div className="flex items-center gap-2">
            <span className="text-[8px] font-bold text-green-500 uppercase tracking-widest">Live Sync</span>
            <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-ping" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {([
            { key: "wfo",    label: "WFO",   col: "var(--ab-primary)", icon: <MapPin size={12} />,      data: summary.wfo,    view: "emerald" },
            { key: "wfa",    label: "WFA",   col: "#a855f7",           icon: <Laptop size={12} />,      data: summary.wfa,    view: "purple"  },
            { key: "leave",  label: "Cuti",  col: "#f97316",           icon: <Umbrella size={12} />,    data: summary.leave,  view: "orange"  },
            { key: "missed", label: "Alpha", col: "#f43f5e",           icon: <AlertCircle size={12} />, data: summary.missed, view: "rose"    },
          ] as const).map(({ key, label, col, icon, data, view }) => (
            <button
              key={key}
              onClick={() => setSelectedView({ type: label, names: data.names, color: view })}
              className="bg-[var(--ab-bg-main)] p-3 rounded-[24px] border border-[var(--ab-border)] flex items-center gap-3 active:scale-95 transition-transform text-left"
            >
              <div
                className="text-white p-1.5 rounded-lg text-xs shrink-0"
                style={{ background: col, boxShadow: `0 4px 12px -3px ${col}55` }}
              >
                {icon}
              </div>
              <div>
                <p className="text-[7px] font-black text-[var(--ab-text-dim)] uppercase tracking-widest mb-0.5 leading-none">
                  {label}
                </p>
                <p className="text-lg font-black text-[var(--ab-text-main)] font-mono leading-none">
                  <CountUp end={data.count} />
                </p>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Quota Cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="ab-card-tactile !p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full" style={{ background: "var(--ab-primary)" }} />
          <Umbrella size={14} className="mb-3" style={{ color: "var(--ab-primary)" }} />
          <p className="text-[9px] font-black text-[var(--ab-text-dim)] uppercase tracking-widest mb-1 leading-none">
            Cuti Biasa
          </p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-[var(--ab-text-main)] font-mono tracking-tighter">
              {user?.leaveQuota ?? 0}
            </span>
            <span className="text-[9px] font-black text-[var(--ab-text-dim)] uppercase tracking-widest">Hari</span>
          </div>
        </div>
        <div className="ab-card-tactile !p-5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-rose-500" />
          <Stethoscope size={14} className="text-rose-400 mb-3" />
          <p className="text-[9px] font-black text-[var(--ab-text-dim)] uppercase tracking-widest mb-1 leading-none">
            Cuti Sakit
          </p>
          <div className="flex items-baseline gap-1">
            <span className="text-2xl font-black text-[var(--ab-text-main)] font-mono tracking-tighter">
              {user?.sickQuota ?? 0}
            </span>
            <span className="text-[9px] font-black text-[var(--ab-text-dim)] uppercase tracking-widest">Hari</span>
          </div>
        </div>
      </div>

      {/* Location Guide Modal */}
      {showLocationGuide &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="ab-confirm-overlay">
            <div className="absolute inset-0" onClick={() => setShowLocationGuide(false)} />
            <div className="bg-[var(--ab-bg-surface)] w-full max-w-md rounded-[50px] shadow-2xl relative overflow-hidden ab-animate-scaleIn border border-[var(--ab-border)]">
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-orange-50 dark:border-orange-800 animate-bounce">
                  <Lock size={32} className="text-orange-600" />
                </div>
                <h3 className="text-2xl font-black text-[var(--ab-text-main)] uppercase tracking-tight mb-3">
                  Akses Lokasi Diblokir
                </h3>
                <p className="text-sm text-[var(--ab-text-dim)] font-medium leading-relaxed mb-8">
                  Browser Anda memblokir izin lokasi. Presensi wajib menggunakan GPS untuk validasi area kantor.
                </p>
                <div className="space-y-4 text-left bg-[var(--ab-bg-main)] p-6 rounded-[35px] border border-[var(--ab-border)] mb-8">
                  <p className="text-[10px] font-black uppercase tracking-widest text-blue-600 mb-2">
                    Cara Mengaktifkan Kembali:
                  </p>
                  {[
                    {
                      icon: isIOS ? (
                        <span className="text-blue-600 font-black text-xs px-1">AA</span>
                      ) : (
                        <Lock size={14} className="text-blue-500" />
                      ),
                      text: `Klik ikon ${isIOS ? '"AA"' : "Gembok (Lock)"} di sebelah alamat URL.`,
                    },
                    {
                      icon: <Info size={14} className="text-green-500" />,
                      text: `Pilih ${isIOS ? "Website Settings" : "Permissions / Site Settings"}.`,
                    },
                    {
                      icon: <MapPin size={14} className="text-orange-500" />,
                      text: "Ubah status Location menjadi Allow / Izinkan.",
                    },
                  ].map((step, i) => (
                    <div key={i} className="flex items-start gap-4">
                      <div className="bg-[var(--ab-bg-surface)] p-2.5 rounded-2xl border border-[var(--ab-border)] shrink-0">
                        {step.icon}
                      </div>
                      <p className="text-xs font-bold text-[var(--ab-text-main)]">{step.text}</p>
                    </div>
                  ))}
                </div>
                <button
                  onClick={() => window.location.reload()}
                  className="w-full bg-blue-600 text-white py-5 rounded-[25px] font-black uppercase tracking-widest text-xs shadow-xl hover:bg-blue-700 transition-all active:scale-95 mb-6"
                >
                  Refresh Halaman Sekarang
                </button>
                <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-3xl border border-blue-100 dark:border-blue-800">
                  <p className="text-[10px] font-bold text-blue-700 dark:text-blue-300 leading-relaxed italic">
                    💡 Masih bingung? Silakan hubungi Admin HR atau tanyakan ke rekan tim.
                  </p>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Summary Detail Modal */}
      {selectedView &&
        typeof document !== "undefined" &&
        createPortal(
          <div className="ab-confirm-overlay">
            <div className="absolute inset-0" onClick={() => setSelectedView(null)} />
            <div className="bg-[var(--ab-bg-surface)] w-full max-w-sm rounded-[40px] shadow-2xl relative overflow-hidden ab-animate-scaleIn border border-[var(--ab-border)]">
              <div className="p-6 border-b border-[var(--ab-border)] flex justify-between items-center">
                <div className="flex items-center gap-3">
                  <div
                    className="text-white p-2 rounded-xl"
                    style={{
                      background:
                        selectedView.color === "emerald" ? "var(--ab-primary)"
                          : selectedView.color === "purple" ? "#a855f7"
                            : selectedView.color === "orange" ? "#f97316"
                              : "#f43f5e",
                    }}
                  >
                    {selectedView.type === "WFO"   && <MapPin size={14} />}
                    {selectedView.type === "WFA"   && <Laptop size={14} />}
                    {selectedView.type === "Cuti"  && <Umbrella size={14} />}
                    {selectedView.type === "Alpha" && <AlertCircle size={14} />}
                  </div>
                  <h3 className="text-sm font-black text-[var(--ab-text-main)] uppercase tracking-tight">
                    {selectedView.type}
                  </h3>
                </div>
                <button onClick={() => setSelectedView(null)} className="text-[var(--ab-text-dim)] hover:text-red-500 transition-colors">
                  <X size={20} />
                </button>
              </div>
              <div className="p-6 max-h-[60vh] overflow-y-auto ab-scrollbar bg-[var(--ab-bg-main)]">
                {selectedView.names.length === 0 ? (
                  <p className="text-center py-10 text-[10px] font-black text-[var(--ab-text-dim)] uppercase tracking-widest italic">
                    Tidak ada data untuk kategori ini.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 gap-2">
                    {selectedView.names.map((name, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 bg-[var(--ab-bg-surface)] p-3 rounded-2xl border border-[var(--ab-border)]"
                      >
                        <div className="w-8 h-8 bg-[var(--ab-bg-main)] text-[var(--ab-text-main)] rounded-lg flex items-center justify-center font-black text-xs">
                          {name.substring(0, 1)}
                        </div>
                        <span className="text-[11px] font-bold text-[var(--ab-text-main)] opacity-80">{name}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-[var(--ab-border)] text-center">
                <p className="text-[9px] font-black text-[var(--ab-text-dim)] uppercase tracking-widest">
                  Total: {selectedView.names.length} Orang
                </p>
              </div>
            </div>
          </div>,
          document.body
        )}

      {/* Dialogs */}
      <ConfirmDialog
        isOpen={showCheckoutConfirm}
        title="Konfirmasi Pulang"
        message="Pastikan pekerjaan hari ini sudah selesai. Ingin melakukan Check-Out sekarang?"
        onConfirm={() => processCheckOut()}
        onCancel={() => setShowCheckoutConfirm(false)}
      />
      <PromptDialog
        isOpen={showEarlyPrompt}
        title="Pulang Lebih Awal"
        message="Waktu kerja belum selesai. Silakan isi alasan mengapa Anda harus pulang lebih awal:"
        placeholder="Misal: Urusan keluarga mendesak, sakit, dll..."
        onConfirm={(reason) => processCheckOut(reason)}
        onCancel={() => setShowEarlyPrompt(false)}
      />
      <ConfirmDialog
        isOpen={showRadiusWarning}
        title="Peringatan Kedisiplinan"
        message="Anda melebihi radius 500 meter dari kantor. Apakah Anda sudah mengajukan WFA? Jika belum, silakan ajukan agar datanya rapih. Tetap lanjutkan atau ingin ajukan WFA terlebih dahulu?"
        type="warning"
        confirmLabel="Tetap Lanjutkan"
        cancelLabel="Ajukan WFA"
        onConfirm={() => processCheckIn(pendingLocation)}
        onCancel={() => {
          setShowRadiusWarning(false);
          setPendingLocation(null);
          router.push("/absensi/requests");
        }}
      />
      <PromptDialog
        isOpen={showLateReasonPrompt}
        title="Konfirmasi Telat"
        message="Anda terlambat masuk kerja. Silakan isi alasan keterlambatan Anda agar bisa di-review oleh HR:"
        placeholder="Misal: Ban bocor, macet parah, dll..."
        onConfirm={(reason) => processCheckIn(null, reason)}
        onCancel={() => {
          setShowLateReasonPrompt(false);
          setPendingLocation(null);
          setIsProcessing(false);
        }}
      />
    </div>
  );
}
