/**
 * Helper utilities for Overtime (Lembur) formatting and calculations
 */

/**
 * Formats minutes into exact detailed hours and minutes (e.g., "2 Jam 00 Menit", "1 Jam 30 Menit", "0 Jam 45 Menit")
 */
export function formatDurationDetail(mins: number | null | undefined): string {
  if (mins === null || mins === undefined || isNaN(mins)) return "-";
  const h = Math.floor(Math.max(0, mins) / 60);
  const m = Math.max(0, mins) % 60;
  return `${h} Jam ${String(m).padStart(2, "0")} Menit`;
}

/**
 * Formats a schedule time range with its duration (e.g., "18:30 - 20:30 (2 Jam 00 Menit)")
 */
export function formatScheduleRange(
  startStr: string | null | undefined,
  endStr: string | null | undefined,
  durationMinutes?: number | null
): string {
  if (!startStr || !endStr) return "-";
  const start = startStr.substring(0, 5);
  const end = endStr.substring(0, 5);
  
  const dur = durationMinutes !== undefined && durationMinutes !== null
    ? durationMinutes
    : calcDurationMinutes(start, end);

  return `${start} - ${end} (${formatDurationDetail(dur)})`;
}

/**
 * Calculates duration in minutes between two "HH:mm" time strings
 */
export function calcDurationMinutes(startStr: string, endStr: string): number {
  if (!startStr || !endStr) return 0;
  const [sh, sm] = startStr.split(":").map(Number);
  const [eh, em] = endStr.split(":").map(Number);
  if (isNaN(sh) || isNaN(sm) || isNaN(eh) || isNaN(em)) return 0;
  const startMins = sh * 60 + sm;
  const endMins = eh * 60 + em;
  return Math.max(0, endMins - startMins);
}

/**
 * Returns stepper state for overtime tracking
 */
export function getOvertimeStepState(stepNumber: 1 | 2 | 3 | 4, status: string) {
  // Step 1: Pengajuan (Selalu selesai jika sudah diajukan)
  if (stepNumber === 1) return { state: "completed", label: "Diajukan" };

  // Step 2: Review Jadwal HR
  if (stepNumber === 2) {
    if (status === "pending") return { state: "current", label: "Review HR" };
    if (status === "rejected") return { state: "rejected", label: "Ditolak" };
    return { state: "completed", label: "Disetujui" };
  }

  // Step 3: Laporan Kerja (Staff)
  if (stepNumber === 3) {
    if (status === "pending" || status === "rejected") return { state: "upcoming", label: "Laporan Kerja" };
    if (status === "approved") return { state: "current", label: "Waktunya Lapor" };
    return { state: "completed", label: "Laporan Terkirim" };
  }

  // Step 4: Keputusan Final (Payroll)
  if (stepNumber === 4) {
    if (status === "finalized") return { state: "completed", label: "Final Sah" };
    if (status === "reported") return { state: "current", label: "Validasi HR" };
    return { state: "upcoming", label: "Final Payroll" };
  }

  return { state: "upcoming", label: "" };
}

/**
 * Checks if a YYYY-MM-DD date falls on a Weekend (Saturday or Sunday)
 */
export function isWeekend(dateStr: string): boolean {
  if (!dateStr) return false;
  // Parse date safely
  const [y, m, d] = dateStr.split("-").map(Number);
  if (!y || !m || !d) return false;
  const date = new Date(y, m - 1, d);
  const day = date.getDay();
  return day === 0 || day === 6; // 0 = Sunday, 6 = Saturday
}

/**
 * Counts total working days (Monday - Friday) in a given month and year
 */
export function countWorkingDaysInMonth(year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  let workingDays = 0;
  for (let d = 1; d <= daysInMonth; d++) {
    const dayOfWeek = new Date(year, month - 1, d).getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }
  }
  return Math.max(1, workingDays);
}

/**
 * Formats a number as Indonesian Rupiah currency string
 */
export function formatRp(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || isNaN(amount)) return "Rp 0";
  return `Rp ${Math.round(amount).toLocaleString("id-ID")}`;
}

/**
 * Calculates hourly base rate and default multipliers:
 * Formula: Base Salary / Working Days in Month / Hours Per Day (default 9)
 */
export function calculateOvertimeRates(baseSalary: number, workingDays: number, hoursPerDay: number = 9) {
  const safeSalary = Math.max(0, baseSalary || 0);
  const safeDays = Math.max(1, workingDays || 22);
  const safeHours = Math.max(1, hoursPerDay || 9);

  const hourlyBaseRate = Math.round(safeSalary / safeDays / safeHours);
  const firstHourRate = Math.round(hourlyBaseRate * 1.5);
  const subsequentHourRate = hourlyBaseRate;

  return {
    hourlyBaseRate,
    firstHourRate,
    subsequentHourRate,
    workingDays: safeDays,
    hoursPerDay: safeHours,
  };
}
