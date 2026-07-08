export function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

export function getWorkingDaysInMonth(year: number, month: number): number {
  const daysInMonth = new Date(year, month, 0).getDate();
  let count = 0;
  for (let day = 1; day <= daysInMonth; day++) {
    if (!isWeekend(new Date(year, month - 1, day))) count++;
  }
  return count;
}

export function getWorkingDaysElapsed(year: number, month: number, today: Date): number {
  let count = 0;
  const current = today.getDate();
  for (let day = 1; day <= current; day++) {
    if (!isWeekend(new Date(year, month - 1, day))) count++;
  }
  return count;
}

export type PerformanceCategory = "excellent" | "good" | "warning" | "critical";

export function getPerformanceCategory(pct: number): PerformanceCategory {
  if (pct >= 100) return "excellent";
  if (pct >= 80) return "good";
  if (pct >= 50) return "warning";
  return "critical";
}
