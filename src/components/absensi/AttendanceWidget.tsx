"use client";

import { useState, useEffect, useCallback, useRef } from "react";
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
  Lock, Info, X, Navigation, Compass, MapPinOff,
  AlertTriangle, RotateCw,
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

interface AllowedLocation {
  id: string;
  name: string;
  lat: number;
  lng: number;
  radius: number;
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
export function AttendanceWidget() {
  const { user } = useAuth();
  const router = useRouter();
  const { attendance, isLoading } = useAttendanceToday(user?.id ?? null);
  const { settings } = useAbsensiSettings();
  const { holidayDates } = useHolidays();

  const [isProcessing, setIsProcessing] = useState(false);
  const [locationPerm, setLocationPerm] = useState<LocationPerm>("prompt");
  const [showLocationGuide, setShowLocationGuide] = useState(false);
  const [allowedLocations, setAllowedLocations] = useState<AllowedLocation[]>([]);
  const allowedLocationsRef = useRef<AllowedLocation[]>([]);

  const fetchLocs = useCallback(async () => {
    if (!user?.departmentId) return [];
    try {
      const supabase = createClient();
      // Fetch locations assigned to this user's department
      const { data } = await supabase
        .from('department_locations' as any)
        .select('office_locations(id, name, lat, lng, radius)')
        .eq('department_id', user.departmentId as string);
      if (data && data.length > 0) {
        const locs = data.map((d: any) => d.office_locations).filter(Boolean);
        setAllowedLocations(locs);
        allowedLocationsRef.current = locs;
        return locs;
      } else {
        setAllowedLocations([]);
        allowedLocationsRef.current = [];
        return [];
      }
    } catch {
      return [];
    }
  }, [user?.departmentId]);

  useEffect(() => {
    fetchLocs();
  }, [fetchLocs]);

  const getNearestLocation = useCallback((
    loc: { lat: number; lng: number },
    overrideLocs?: AllowedLocation[]
  ) => {
    const locs = (overrideLocs && overrideLocs.length > 0)
      ? overrideLocs
      : allowedLocationsRef.current.length > 0
      ? allowedLocationsRef.current
      : allowedLocations;

    if (locs.length > 0) {
      let minDist = Infinity;
      let minRadius = 100;
      let bestOffice: { lat: number; lng: number; name: string } | null = null;
      for (const al of locs) {
        if (!al) continue;
        const dist = calcDist(loc.lat, loc.lng, al.lat, al.lng);
        if (dist < minDist) {
          minDist = dist;
          minRadius = al.radius;
          bestOffice = { lat: al.lat, lng: al.lng, name: al.name };
        }
      }
      return { dist: minDist, radius: minRadius, office: bestOffice, noLocationError: false };
    } else if (settings.officeLat && settings.officeLng) {
      // Fallback to default office settings if department locations not configured or still loading
      const dist = calcDist(loc.lat, loc.lng, settings.officeLat, settings.officeLng);
      return {
        dist,
        radius: settings.officeRadius || 100,
        office: { lat: settings.officeLat, lng: settings.officeLng, name: "Kantor Utama" },
        noLocationError: false
      };
    } else {
      return { dist: Infinity, radius: 0, office: null, noLocationError: true };
    }
  }, [allowedLocations, settings]);

  // ─ Live GPS Tracking State ─────────────────────────────────────────────────
  type LiveGpsStatus = "detecting" | "inside" | "outside" | "blocked" | "unavailable";
  const [liveGpsStatus, setLiveGpsStatus] = useState<LiveGpsStatus>("detecting");
  const [liveLoc, setLiveLoc] = useState<{ lat: number; lng: number } | null>(null);
  const [liveDist, setLiveDist] = useState<number | null>(null);
  const [liveOffice, setLiveOffice] = useState<string | null>(null);
  const [isLiveSyncing, setIsLiveSyncing] = useState(false);
  const [showConfirmBlockedModal, setShowConfirmBlockedModal] = useState(false);
  const [showConfirmOutsideModal, setShowConfirmOutsideModal] = useState(false);

  const [pendingLocation, setPendingLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [pendingDistance, setPendingDistance] = useState(0);
  const [showCheckoutConfirm, setShowCheckoutConfirm] = useState(false);
  const [showEarlyPrompt, setShowEarlyPrompt] = useState(false);
  const [showLateReasonPrompt, setShowLateReasonPrompt] = useState(false);
  const [selectedView, setSelectedView] = useState<SummaryView>(null);
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

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

  // ─ Location permission & Live Tracking ──────────────────────────────────────
  const syncLocation = useCallback(async (isUserTriggered = false) => {
    if (typeof navigator === "undefined" || !("geolocation" in navigator)) {
      setLiveGpsStatus("unavailable");
      if (isUserTriggered) toast.error("Browser Anda tidak mendukung fitur lokasi GPS.");
      return;
    }

    setIsLiveSyncing(true);
    if (isUserTriggered) toast.loading("Mendeteksi sinyal GPS...", { id: "gps-sync" });

    let activeLocs = allowedLocationsRef.current;
    if (activeLocs.length === 0 && user?.departmentId) {
      activeLocs = await fetchLocs();
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setIsLiveSyncing(false);
        if (isUserTriggered) toast.dismiss("gps-sync");
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLiveLoc(loc);
        setLocationPerm("granted");

        const nearest = getNearestLocation(loc, activeLocs);
        if (nearest.noLocationError) {
          setLiveGpsStatus("unavailable");
          if (isUserTriggered) toast.error("Lokasi kantor untuk divisi Anda belum diatur Admin.");
          return;
        }

        if (nearest && isFinite(nearest.dist)) {
          const rounded = Math.round(nearest.dist);
          setLiveDist(rounded);
          setLiveOffice(nearest.office?.name || "Kantor");

          if (nearest.dist <= nearest.radius) {
            setLiveGpsStatus("inside");
            if (isUserTriggered) toast.success(`Lokasi Terverifikasi: Dalam Area (${nearest.office?.name || "Kantor"} - ${rounded}m)`);
          } else {
            setLiveGpsStatus("outside");
            if (isUserTriggered) toast.error(`Di Luar Area: ${rounded}m dari ${nearest.office?.name || "Kantor"}`);
          }
        }
      },
      (err) => {
        setIsLiveSyncing(false);
        if (isUserTriggered) toast.dismiss("gps-sync");
        if (err.code === 1) {
          setLocationPerm("denied");
          setLiveGpsStatus("blocked");
          if (isUserTriggered) setShowLocationGuide(true);
        } else {
          setLiveGpsStatus("unavailable");
          if (isUserTriggered) toast.error("Sinyal GPS tidak dapat membaca koordinat. Pastikan GPS HP Anda aktif.");
        }
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  }, [user?.departmentId, fetchLocs, getNearestLocation]);

  const checkPerm = useCallback(async () => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) return;
    try {
      const res = await navigator.permissions.query({ name: "geolocation" });
      setLocationPerm(res.state as LocationPerm);
      if (res.state === "denied") {
        setLiveGpsStatus("blocked");
      }
      res.onchange = () => {
        setLocationPerm(res.state as LocationPerm);
        if (res.state === "denied") {
          setLiveGpsStatus("blocked");
        } else if (res.state === "granted") {
          syncLocation(false);
        }
      };
    } catch {}
  }, [syncLocation]);

  useEffect(() => {
    requestAnimationFrame(() => checkPerm());
    window.addEventListener("focus", checkPerm);
    return () => window.removeEventListener("focus", checkPerm);
  }, [checkPerm]);

  // Continuous background GPS tracking until check-in
  useEffect(() => {
    if (!attendance) {
      syncLocation(false);

      if (typeof navigator !== "undefined" && "geolocation" in navigator) {
        const watchId = navigator.geolocation.watchPosition(
          (pos) => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setLiveLoc(loc);
            setLocationPerm("granted");
            const nearest = getNearestLocation(loc, allowedLocationsRef.current);
            if (nearest && !nearest.noLocationError && isFinite(nearest.dist)) {
              const rounded = Math.round(nearest.dist);
              setLiveDist(rounded);
              setLiveOffice(nearest.office?.name || "Kantor");
              if (nearest.dist <= nearest.radius) {
                setLiveGpsStatus("inside");
              } else {
                setLiveGpsStatus("outside");
              }
            }
          },
          (err) => {
            if (err.code === 1) setLiveGpsStatus("blocked");
            else setLiveGpsStatus("unavailable");
          },
          { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 }
        );

        return () => navigator.geolocation.clearWatch(watchId);
      }
    }
  }, [attendance, syncLocation, getNearestLocation]);

  // Immediate status re-evaluation once allowed locations load
  useEffect(() => {
    if (liveLoc) {
      const nearest = getNearestLocation(liveLoc);
      if (nearest && !nearest.noLocationError && isFinite(nearest.dist)) {
        const rounded = Math.round(nearest.dist);
        setLiveDist(rounded);
        setLiveOffice(nearest.office?.name || "Kantor");
        if (nearest.dist <= nearest.radius) {
          setLiveGpsStatus("inside");
        } else {
          setLiveGpsStatus("outside");
        }
      }
    }
  }, [allowedLocations, settings, liveLoc, getNearestLocation]);

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
      lateFine = diffMins; // lateFine is now storing late minutes
      if (!lateReason) {
        return { requireLateReason: true, location, arrStat, lateFine };
      }
    }

    // Check if user has an approved WFA request for today
    let isApprovedWfa = false;
    try {
      const { data: wfaReq } = await supabase
        .from("leave_requests")
        .select("id")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .eq("type", "wfa")
        .contains("dates", [getToday()])
        .limit(1);
      if (wfaReq && wfaReq.length > 0) {
        isApprovedWfa = true;
      }
    } catch {
      // ignore
    }

    let locationStatus = isApprovedWfa ? "Dalam Area (WFA)" : "Lokasi Keblokir";
    let radiusPenalty = 0;
    let locationToSave: any = location;
    if (location) {
      let activeLocs = allowedLocationsRef.current;
      if (activeLocs.length === 0 && user?.departmentId) {
        activeLocs = await fetchLocs();
      }

      const nearest = getNearestLocation(location, activeLocs);
      const isFiniteDist = isFinite(nearest.dist);
      const roundedDist = isFiniteDist ? Math.round(nearest.dist) : null;

      if (isApprovedWfa) {
        locationStatus = "Dalam Area (WFA)";
        radiusPenalty = 0;
      } else if (isFiniteDist && nearest.dist <= nearest.radius) {
        locationStatus = "Dalam Area";
        radiusPenalty = 0;
      } else {
        locationStatus = "Di Luar Area";
        if (isFiniteDist && nearest.dist > 500) radiusPenalty = 2;
        else if (!isFiniteDist) radiusPenalty = 2;
      }

      locationToSave = {
        lat: location.lat,
        lng: location.lng,
        distance: roundedDist,
        officeLat: nearest.office?.lat,
        officeLng: nearest.office?.lng,
        officeName: nearest.office?.name
      };
    }

    const { error } = await supabase.from("attendance").insert({
      user_id: user.id,
      date: getToday(),
      check_in: getNowTime(),
      status: arrStat,
      type: isApprovedWfa ? "WFA" : "WFO",
      location_in: locationToSave,
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
  }, [user, settings, fetchLocs, getNearestLocation]);

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
        toast.error(`Anda telat ${result.lateFine} Menit! (Menunggu review HR)`, { duration: 5000 });
      } else {
        toast.success(`Berhasil Check-In pukul ${result.time}!`);
      }
    } else {
      toast.error(result.error || "Gagal Check-In");
    }
    setIsProcessing(false);
    setPendingLocation(null);
    setShowConfirmOutsideModal(false);
    setShowConfirmBlockedModal(false);
    setShowLateReasonPrompt(false);
  };

  const processCheckIn = async (
    confirmedLocation: { lat: number; lng: number } | null | undefined = undefined,
    lateReason = ""
  ) => {
    if (isProcessing && confirmedLocation === undefined && !lateReason) return;

    // Direct check-in with explicit location or late reason
    if (confirmedLocation !== undefined || lateReason) {
      setIsProcessing(true);
      const locToUse = confirmedLocation !== undefined ? confirmedLocation : pendingLocation;
      const result = await doCheckIn(locToUse, lateReason);
      finalizeCheckIn(result);
      return;
    }

    if (!("geolocation" in navigator)) {
      toast.error("Browser Anda tidak mendukung GPS.");
      return;
    }

    setIsProcessing(true);
    const toastId = toast.loading("Mendeteksi Lokasi...");
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        toast.dismiss(toastId);
        const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setLiveLoc(loc);
        setLocationPerm("granted");

        let activeLocs = allowedLocationsRef.current;
        if (activeLocs.length === 0 && user?.departmentId) {
          activeLocs = await fetchLocs();
        }
        const nearest = getNearestLocation(loc, activeLocs);
        if (nearest.noLocationError) {
          toast.error("Lokasi absen divisi Anda belum diatur oleh Admin. Hubungi HR.");
          setIsProcessing(false);
          return;
        }

        const rounded = Math.round(nearest.dist);
        setLiveDist(rounded);
        setLiveOffice(nearest.office?.name || "Kantor");

        if (nearest.dist > nearest.radius) {
          setLiveGpsStatus("outside");
          setPendingLocation(loc);
          setPendingDistance(rounded);
          setShowConfirmOutsideModal(true);
          setIsProcessing(false);
          return;
        }

        setLiveGpsStatus("inside");
        const result = await doCheckIn(loc);
        if ("requireLateReason" in result) setPendingLocation(loc);
        finalizeCheckIn(result);
      },
      async (err) => {
        toast.dismiss(toastId);
        if (err.code === 1) {
          // Permission denied - NEVER auto submit!
          setLocationPerm("denied");
          setLiveGpsStatus("blocked");
          setIsProcessing(false);
          setShowConfirmBlockedModal(true);
        } else if (err.code === 2) {
          // Position unavailable
          setLiveGpsStatus("unavailable");
          toast.error("GPS tidak tersedia. Pastikan GPS HP aktif lalu coba lagi.", { duration: 5000 });
          setIsProcessing(false);
        } else if (err.code === 3) {
          // Timeout
          toast.error("GPS timeout. Sinyal GPS lemah atau koneksi lambat. Coba lagi.", { duration: 5000 });
          setIsProcessing(false);
        } else {
          toast.error("Gagal mendapatkan lokasi GPS. Pastikan izin lokasi aktif.");
          setIsProcessing(false);
        }
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: 12000 }
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
    
    // Safety timeout in case it gets stuck
    setTimeout(() => {
      setIsProcessing(false);
    }, 15000);

    if (!attendance) {
      if (liveGpsStatus === "inside" && liveLoc) {
        // Direct seamless check-in with verified coordinates
        processCheckIn(liveLoc);
      } else if (liveGpsStatus === "outside" && liveLoc) {
        setPendingLocation(liveLoc);
        setPendingDistance(liveDist || 0);
        setShowConfirmOutsideModal(true);
      } else if (liveGpsStatus === "blocked" || locationPerm === "denied") {
        setShowConfirmBlockedModal(true);
      } else {
        processCheckIn();
      }
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
  const btnBg = "var(--ab-primary)";
  const btnShadow = "0 20px 40px -12px var(--ab-primary-glow)";

  return (
    <div className="space-y-6 pb-4 ab-animate-fadeIn">
      {/* Clock Widget */}
      <div className="bg-white/10 dark:bg-slate-800/40 p-6 rounded-[35px] backdrop-blur-2xl border border-slate-200 dark:border-slate-700 shadow-sm relative z-10 w-full mb-2">
        <div className="flex flex-col items-center">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-70 mb-2 text-center text-slate-500 dark:text-slate-400">
            {currentTime.toLocaleDateString("id-ID", {
              weekday: "long", day: "numeric", month: "long", year: "numeric",
            })}
          </p>
          <h1 className="text-7xl md:text-8xl font-black tracking-tight font-mono text-slate-800 dark:text-white drop-shadow-md">
            {currentTime
              .toLocaleTimeString("id-ID", { hour12: false, hour: "2-digit", minute: "2-digit" })
              .replace(/\./g, ":")}
          </h1>
          <p className="text-sm font-black font-mono text-[var(--ab-primary)] mt-1 animate-pulse">
            {currentTime.toLocaleTimeString("id-ID", { hour12: false, second: "2-digit" })} SEC
          </p>
          <div className="mt-5 w-full max-w-sm flex items-center justify-center gap-4 bg-slate-100 dark:bg-slate-900/50 py-3 px-5 rounded-[22px] border border-slate-200 dark:border-slate-800">
            <Clock size={18} className="text-primary animate-pulse" />
            <div className="flex flex-col">
              <span className="text-[8px] font-black uppercase tracking-[0.2em] leading-none opacity-50 mb-0.5 text-slate-500 dark:text-slate-400">
                Official Work Hours
              </span>
              <span className="text-[13px] font-black tracking-tight text-slate-800 dark:text-slate-200">
                {settings?.workStart ?? "08:00"} — {settings?.workEnd ?? "18:00"}
              </span>
            </div>
          </div>
        </div>
      </div>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center overflow-hidden ab-nm-button shrink-0">
            <img src="/logos/logo-nova-core-app-512px.webp" alt="NovaCore" className="w-full h-full object-cover" />
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
      <div className="rounded-3xl p-1 shadow-lg overflow-hidden mb-6" style={{ background: "var(--ab-primary)" }}>
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
                {settings?.workStart ?? "08:00"} — {settings?.workEnd ?? "18:00"}
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

        {/* Live GPS Status & Radar (Active before check-in) */}
        {!attendance && (
          <div className="mb-2">
            {liveGpsStatus === "inside" && (
              <div className="p-4 rounded-2xl border bg-emerald-500/10 border-emerald-500/30 dark:bg-emerald-950/20 dark:border-emerald-700/40 flex items-center justify-between gap-3 transition-all shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-500 text-white shrink-0 shadow-md shadow-emerald-500/20">
                    <Compass size={20} className="animate-spin" style={{ animationDuration: "6s" }} />
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-400 border-2 border-white rounded-full animate-ping" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[9px] font-black tracking-widest uppercase text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                        ✓ Dalam Area
                      </span>
                      <span className="text-[10px] text-emerald-700 dark:text-emerald-300 font-bold truncate">
                        {liveOffice || "Kantor"}
                      </span>
                    </div>
                    <p className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1">
                      <span>Jarak: ±{liveDist ?? 0}m</span>
                      <span className="text-[10px] text-slate-400 font-normal">| Siap Mulai Shift</span>
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => syncLocation(true)}
                  disabled={isLiveSyncing}
                  title="Sinkronkan ulang GPS"
                  className="p-2.5 rounded-xl bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:text-emerald-600 border border-slate-200 dark:border-slate-700 shadow-sm active:scale-95 transition-all shrink-0"
                >
                  <RotateCw size={14} className={isLiveSyncing ? "animate-spin text-emerald-600" : ""} />
                </button>
              </div>
            )}

            {liveGpsStatus === "outside" && (
              <div className="p-4 rounded-2xl border bg-amber-500/10 border-amber-500/30 dark:bg-amber-950/20 dark:border-amber-700/40 flex items-center justify-between gap-3 transition-all shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative flex items-center justify-center w-10 h-10 rounded-xl bg-amber-500 text-white shrink-0 shadow-md shadow-amber-500/20">
                    <MapPin size={20} />
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 border-2 border-white rounded-full animate-ping" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[9px] font-black tracking-widest uppercase text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                        Di Luar Area
                      </span>
                      <span className="text-[10px] text-amber-700 dark:text-amber-300 font-bold truncate">
                        {liveOffice || "Kantor"}
                      </span>
                    </div>
                    <p className="text-xs font-black text-slate-800 dark:text-slate-100">
                      Jarak: ±{liveDist ?? 0}m dari kantor
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => syncLocation(true)}
                  disabled={isLiveSyncing}
                  title="Sinkronkan ulang GPS"
                  className="px-3 py-2 rounded-xl bg-amber-500 text-white font-black text-[10px] uppercase tracking-wider shadow-sm hover:bg-amber-600 active:scale-95 transition-all shrink-0 flex items-center gap-1.5"
                >
                  <RotateCw size={12} className={isLiveSyncing ? "animate-spin" : ""} />
                  <span>{isLiveSyncing ? "Sync..." : "Sinkronkan"}</span>
                </button>
              </div>
            )}

            {liveGpsStatus === "blocked" && (
              <div className="p-4 rounded-2xl border bg-rose-500/10 border-rose-500/30 dark:bg-rose-950/20 dark:border-rose-700/40 flex items-center justify-between gap-3 transition-all shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-rose-500 text-white shrink-0 shadow-md shadow-rose-500/20">
                    <MapPinOff size={20} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <span className="text-[9px] font-black tracking-widest uppercase text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-full">
                        Akses Terblokir
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100">
                      Izin GPS Ditolak Browser
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={() => setShowLocationGuide(true)}
                    className="px-2.5 py-2 rounded-xl bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-200 dark:border-slate-700 font-bold text-[10px] hover:bg-slate-50 active:scale-95 transition-all"
                  >
                    Bantuan 🔒
                  </button>
                  <button
                    onClick={() => syncLocation(true)}
                    disabled={isLiveSyncing}
                    className="px-3 py-2 rounded-xl bg-rose-600 text-white font-black text-[10px] uppercase tracking-wider shadow-sm hover:bg-rose-700 active:scale-95 transition-all flex items-center gap-1.5"
                  >
                    <RotateCw size={12} className={isLiveSyncing ? "animate-spin" : ""} />
                    <span>{isLiveSyncing ? "..." : "Sinkronkan"}</span>
                  </button>
                </div>
              </div>
            )}

            {liveGpsStatus === "detecting" && (
              <div className="p-4 rounded-2xl border bg-blue-500/10 border-blue-500/30 dark:bg-blue-950/20 dark:border-blue-700/40 flex items-center justify-between gap-3 transition-all shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-blue-500 text-white shrink-0 shadow-md shadow-blue-500/20">
                    <RotateCw size={20} className="animate-spin" />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] font-black tracking-widest uppercase text-blue-600 dark:text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded-full">
                      Mendeteksi GPS...
                    </span>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                      Mengunci koordinat lokasi Anda
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => syncLocation(true)}
                  disabled={isLiveSyncing}
                  className="px-3 py-2 rounded-xl bg-blue-600 text-white font-black text-[10px] uppercase tracking-wider shadow-sm hover:bg-blue-700 active:scale-95 transition-all shrink-0"
                >
                  Paksa Sync
                </button>
              </div>
            )}

            {liveGpsStatus === "unavailable" && (
              <div className="p-4 rounded-2xl border bg-slate-500/10 border-slate-500/30 dark:bg-slate-800/40 dark:border-slate-700/40 flex items-center justify-between gap-3 transition-all shadow-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-slate-500 text-white shrink-0">
                    <AlertTriangle size={20} />
                  </div>
                  <div className="min-w-0">
                    <span className="text-[9px] font-black tracking-widest uppercase text-slate-600 dark:text-slate-400 bg-slate-500/10 px-2 py-0.5 rounded-full">
                      Sinyal GPS Lemah / Mati
                    </span>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-100 mt-0.5">
                      Aktifkan Lokasi di HP Anda
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => syncLocation(true)}
                  disabled={isLiveSyncing}
                  className="px-3 py-2 rounded-xl bg-slate-700 text-white font-black text-[10px] uppercase tracking-wider shadow-sm hover:bg-slate-800 active:scale-95 transition-all shrink-0 flex items-center gap-1.5"
                >
                  <RotateCw size={12} className={isLiveSyncing ? "animate-spin" : ""} />
                  <span>{isLiveSyncing ? "..." : "Coba Lagi"}</span>
                </button>
              </div>
            )}

            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-medium text-center mt-2 px-2">
              💡 Pastikan badge hijau <strong className="text-emerald-500 font-bold">&quot;Dalam Area&quot;</strong> terlihat sebelum menekan Mulai Shift.
            </p>
          </div>
        )}

        <div className="relative flex justify-center py-6 px-2">
          <button
            onClick={onAbsenClick}
            disabled={isProcessing || (attendance ? !!attendance.checkOut : false)}
            className="group relative w-full h-16 md:h-20 rounded-[24px] shadow-2xl transition-all hover:scale-[1.02] active:scale-95 disabled:opacity-50 disabled:grayscale overflow-hidden flex items-center justify-center gap-4 text-white"
            style={{ 
              background: btnBg, 
              boxShadow: "0 15px 40px -10px var(--ab-primary-glow)",
              border: "2px solid rgba(255,255,255,0.1)"
            }}
          >
            <Fingerprint
              size={32}
              className="group-hover:scale-110 group-active:scale-90 transition-transform duration-300"
            />
            <div className="text-left flex flex-col justify-center">
              <p className="text-[10px] opacity-80 font-black tracking-[0.2em] mb-1 leading-none uppercase">
                Presensi Digital
              </p>
              <p className="text-sm md:text-base font-black uppercase tracking-tight leading-none">
                {!attendance
                  ? "Mulai Shift Sekarang"
                  : attendance.checkOut
                    ? "Shift Selesai"
                    : "Akhiri Shift (Tap Pulang)"}
              </p>
            </div>
          </button>
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

      {/* Quota Cards removed from widget to be placed globally */}

      {/* Confirm Blocked Modal */}
      {showConfirmBlockedModal && (
        <div
          className="ab-confirm-overlay fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: 99999, background: "rgba(2, 8, 23, 0.65)", backdropFilter: "blur(8px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowConfirmBlockedModal(false); }}
        >
          <div className="w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden ab-animate-scaleIn border border-[var(--ab-border)]" style={{ background: "var(--ab-bg-surface)" }}>
            <div className="p-7 text-center">
              <div className="w-16 h-16 bg-rose-100 dark:bg-rose-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-rose-50 dark:border-rose-800/50">
                <MapPinOff size={28} className="text-rose-600 dark:text-rose-400" />
              </div>
              <h3 className="text-xl font-black text-[var(--ab-text-main)] uppercase tracking-tight mb-2">
                Akses Lokasi Diblokir
              </h3>
              <p className="text-xs text-[var(--ab-text-dim)] font-medium leading-relaxed mb-4">
                Browser Anda memblokir izin lokasi GPS. Jika Anda melanjutkan presensi sekarang, status akan tercatat sebagai <strong className="text-rose-600 font-bold">&quot;Lokasi Keblokir&quot;</strong>.
              </p>

              {/* Instructions Box */}
              <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 rounded-2xl p-4 mb-5 text-left space-y-2">
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-700 dark:text-amber-400">
                  Cara Mengaktifkan Kembali:
                </p>
                <div className="text-[11px] text-slate-700 dark:text-slate-300 space-y-1.5 font-medium">
                  <p className="flex items-center gap-2">
                    <span>1.</span> Klik ikon <strong>{isIOS ? '"AA"' : 'Gembok 🔒'}</strong> di sebelah kiri alamat website di atas.
                  </p>
                  <p className="flex items-center gap-2">
                    <span>2.</span> Buka <strong>{isIOS ? 'Website Settings' : 'Permissions / Izin Situs'}</strong>.
                  </p>
                  <p className="flex items-center gap-2">
                    <span>3.</span> Ubah <strong>Lokasi (Location)</strong> ke <strong>&quot;Allow / Izinkan&quot;</strong>.
                  </p>
                </div>
              </div>

              <div className="space-y-2.5">
                <button
                  onClick={() => syncLocation(true)}
                  disabled={isLiveSyncing}
                  className="w-full bg-blue-600 text-white py-3.5 rounded-2xl font-black uppercase tracking-wider text-[11px] shadow-lg hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <RotateCw size={14} className={isLiveSyncing ? "animate-spin" : ""} />
                  {isLiveSyncing ? "Menghubungkan GPS..." : "🛰️ Coba Sinkronkan Sekarang"}
                </button>

                <button
                  onClick={() => {
                    setShowConfirmBlockedModal(false);
                    setShowLocationGuide(true);
                  }}
                  className="w-full bg-[var(--ab-bg-main)] text-[var(--ab-text-main)] py-3 rounded-2xl font-bold text-[11px] border border-[var(--ab-border)] hover:bg-[var(--ab-bg-surface)] active:scale-95 transition-all"
                >
                  📖 Lihat Panduan Lengkap Browser
                </button>

                <div className="pt-2 border-t border-[var(--ab-border)] flex gap-2">
                  <button
                    onClick={() => {
                      setShowConfirmBlockedModal(false);
                      setIsProcessing(true);
                      doCheckIn(null).then(finalizeCheckIn);
                    }}
                    className="flex-1 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900/50 py-3 rounded-2xl font-black uppercase tracking-wider text-[10px] hover:bg-rose-100 active:scale-95 transition-all"
                  >
                    ⚠️ Tetap Lanjutkan (Tanpa GPS)
                  </button>
                  <button
                    onClick={() => setShowConfirmBlockedModal(false)}
                    className="flex-1 bg-[var(--ab-bg-main)] text-[var(--ab-text-dim)] py-3 rounded-2xl font-bold text-[10px] border border-[var(--ab-border)] active:scale-95 transition-all"
                  >
                    Batal
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Outside Modal */}
      {showConfirmOutsideModal && (
        <div
          className="ab-confirm-overlay fixed inset-0 flex items-center justify-center p-4"
          style={{ zIndex: 99999, background: "rgba(2, 8, 23, 0.65)", backdropFilter: "blur(8px)" }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowConfirmOutsideModal(false); }}
        >
          <div className="w-full max-w-md rounded-[40px] shadow-2xl overflow-hidden ab-animate-scaleIn border border-[var(--ab-border)]" style={{ background: "var(--ab-bg-surface)" }}>
            <div className="p-7 text-center">
              <div className="w-16 h-16 bg-amber-100 dark:bg-amber-900/30 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-amber-50 dark:border-amber-800/50">
                <MapPin size={28} className="text-amber-600 dark:text-amber-400" />
              </div>
              <h3 className="text-xl font-black text-[var(--ab-text-main)] uppercase tracking-tight mb-2">
                Di Luar Area Kantor
              </h3>
              <p className="text-xs text-[var(--ab-text-dim)] font-medium leading-relaxed mb-4">
                Koordinat Anda terdeteksi berjarak <strong className="text-amber-600 font-bold">{pendingDistance || liveDist || 0} meter</strong> dari <strong>{liveOffice || "kantor"}</strong>.
              </p>

              <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/60 rounded-2xl p-4 mb-5 text-xs text-blue-700 dark:text-blue-300 font-medium">
                💡 Jika Anda sudah sampai di kantor, sinyal GPS perangkat mungkin sedang lambat menyesuaikan. Klik sinkronkan ulang untuk update koordinat terbaru.
              </div>

              <div className="space-y-2.5">
                <button
                  onClick={() => syncLocation(true)}
                  disabled={isLiveSyncing}
                  className="w-full bg-blue-600 text-white py-3.5 rounded-2xl font-black uppercase tracking-wider text-[11px] shadow-lg hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <RotateCw size={14} className={isLiveSyncing ? "animate-spin" : ""} />
                  {isLiveSyncing ? "Menyinkronkan..." : "🔄 Sinkronkan Ulang GPS"}
                </button>

                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setShowConfirmOutsideModal(false);
                      setIsProcessing(true);
                      processCheckIn(pendingLocation || liveLoc);
                    }}
                    className="flex-1 bg-amber-500 text-white py-3 rounded-2xl font-black uppercase tracking-wider text-[10px] shadow-md hover:bg-amber-600 active:scale-95 transition-all"
                  >
                    ⚡ Tetap Absen (Luar Area)
                  </button>
                  <button
                    onClick={() => {
                      setShowConfirmOutsideModal(false);
                      router.push("/absensi/requests");
                    }}
                    className="flex-1 bg-[var(--ab-bg-main)] text-[var(--ab-text-main)] py-3 rounded-2xl font-bold text-[10px] border border-[var(--ab-border)] hover:bg-[var(--ab-bg-surface)] active:scale-95 transition-all"
                  >
                    📝 Ajukan WFA
                  </button>
                </div>

                <button
                  onClick={() => setShowConfirmOutsideModal(false)}
                  className="w-full text-[10px] font-bold text-[var(--ab-text-dim)] py-2 hover:text-slate-600 transition-colors"
                >
                  Tutup / Batal
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Location Guide Modal */}
      {showLocationGuide && (
          <div className="ab-confirm-overlay fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999, background: "rgba(2, 8, 23, 0.65)", backdropFilter: "blur(8px)" }} onClick={(e) => { if (e.target === e.currentTarget) setShowLocationGuide(false); }}>
            <div className="w-full max-w-md rounded-[50px] shadow-2xl overflow-hidden ab-animate-scaleIn border border-[var(--ab-border)]" style={{ background: "var(--ab-bg-surface)" }}>
              <div className="p-8 text-center">
                <div className="w-20 h-20 bg-orange-100 dark:bg-orange-900/30 rounded-full flex items-center justify-center mx-auto mb-6 border-4 border-orange-50 dark:border-orange-800 animate-bounce">
                  <Lock size={32} className="text-orange-600" />
                </div>
                <h3 className="text-2xl font-black text-[var(--ab-text-main)] uppercase tracking-tight mb-3">
                  Akses Lokasi Diblokir
                </h3>
                <p className="text-sm text-[var(--ab-text-dim)] font-medium leading-relaxed mb-6">
                  Browser Anda memblokir izin lokasi. Presensi wajib menggunakan GPS untuk validasi area kantor.
                </p>
                <div className="space-y-4 text-left bg-[var(--ab-bg-main)] p-6 rounded-[35px] border border-[var(--ab-border)] mb-6">
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
                      text: `Klik ikon ${isIOS ? '"AA"' : "Gembok (Lock) 🔒"} di sebelah alamat URL.`,
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

                <div className="space-y-3">
                  <button
                    onClick={() => {
                      syncLocation(true);
                      setShowLocationGuide(false);
                    }}
                    disabled={isLiveSyncing}
                    className="w-full bg-blue-600 text-white py-4 rounded-[22px] font-black uppercase tracking-widest text-[11px] shadow-lg hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
                  >
                    <RotateCw size={14} className={isLiveSyncing ? "animate-spin" : ""} />
                    {isLiveSyncing ? "Mendeteksi..." : "🔄 Coba Sinkronkan Sekarang"}
                  </button>

                  <button
                    onClick={() => window.location.reload()}
                    className="w-full bg-[var(--ab-bg-main)] text-[var(--ab-text-main)] py-3 rounded-[20px] font-bold uppercase tracking-wider text-[10px] border border-[var(--ab-border)] hover:bg-[var(--ab-bg-surface)] transition-all active:scale-95"
                  >
                    Refresh Halaman
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

      {/* Summary Detail Modal */}
      {selectedView && (
          <div className="ab-confirm-overlay fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 99999, background: "rgba(2, 8, 23, 0.65)", backdropFilter: "blur(8px)" }} onClick={(e) => { if (e.target === e.currentTarget) setSelectedView(null); }}>
            <div className="w-full max-w-sm rounded-[40px] shadow-2xl overflow-hidden ab-animate-scaleIn border border-[var(--ab-border)]" style={{ background: "var(--ab-bg-surface)" }}>
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
          </div>
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
      <PromptDialog
        isOpen={showLateReasonPrompt}
        title="Konfirmasi Telat"
        message="Anda terlambat masuk kerja. Silakan isi alasan keterlambatan Anda agar bisa di-review oleh HR:"
        placeholder="Misal: Ban bocor, macet parah, dll..."
        onConfirm={(reason) => processCheckIn(pendingLocation, reason)}
        onCancel={() => {
          setShowLateReasonPrompt(false);
          setPendingLocation(null);
          setIsProcessing(false);
        }}
      />
      <div className="text-center mt-2 opacity-30 text-[8px] font-mono">
        v.2.0.1
      </div>
    </div>
  );
}
