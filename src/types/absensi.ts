import type { AbsensiRole, AbsensiStatus } from "./index";

// ─── Attendance ───────────────────────────────────────────────────────────────

export type AttendanceStatus = "on_time" | "late" | "very_late" | "auto_checkout";
export type AttendanceType = "WFO" | "WFA";
export type LateReasonStatus = "pending" | "accepted" | "rejected";

export interface Attendance {
  id: string;
  userId: string;
  date: string;           // YYYY-MM-DD
  checkIn: string | null; // HH:MM
  checkOut: string | null;
  status: AttendanceStatus;
  type: AttendanceType;
  locationIn: { lat: number; lng: number } | null;
  locationStatus: string | null;
  lateFine: number;
  lateReason: string;
  lateReasonStatus: LateReasonStatus | null;
  radiusPenalty: number;
  earlyCheckout: boolean;
  earlyReason: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Leave Request ────────────────────────────────────────────────────────────

export type LeaveRequestType = "leave" | "sick" | "wfa";
export type LeaveRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface LeaveRequest {
  id: string;
  userId: string;
  type: LeaveRequestType;
  dates: string[];       // ['YYYY-MM-DD', ...]
  reason: string;
  status: LeaveRequestStatus;
  processedBy: string | null;
  processedAt: string | null;
  deductedSick: number;
  deductedLeave: number;
  cancellationRequested: boolean;
  cancellationReason: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Settings ─────────────────────────────────────────────────────────────────

export interface AbsensiSettings {
  workStart: string;     // HH:MM
  workEnd: string;
  maxLate: string;
  maxTimeSick: string;
  maxTimeLeave: string;
  maxTimeWfa: string;
  officeLat: number;
  officeLng: number;
  officeRadius: number;
  lastSyncDate: string | null;
}

// ─── Holiday ──────────────────────────────────────────────────────────────────

export interface Holiday {
  id: string;
  date: string;          // YYYY-MM-DD
  description: string;
}

// ─── Log ─────────────────────────────────────────────────────────────────────

export interface AbsensiLog {
  id: string;
  actor: string;
  action: string;
  targetUserId: string | null;
  details: string | null;
  createdAt: string;
}

// ─── AbsensiUser (public.users with absensi columns) ─────────────────────────

export interface AbsensiUser {
  id: string;
  name: string;
  email: string;
  department: string | null;
  departmentId: string | null;
  absensiRole: AbsensiRole;
  absensiStatus: AbsensiStatus;
  leaveQuota: number;
  sickQuota: number;
  isHidden: boolean;
}

// ─── DB row helpers (snake_case → camelCase) ──────────────────────────────────

export function rowToAttendance(row: Record<string, unknown>): Attendance {
  return {
    id:               row.id as string,
    userId:           row.user_id as string,
    date:             row.date as string,
    checkIn:          row.check_in as string | null,
    checkOut:         row.check_out as string | null,
    status:           row.status as AttendanceStatus,
    type:             row.type as AttendanceType,
    locationIn:       row.location_in as { lat: number; lng: number } | null,
    locationStatus:   row.location_status as string | null,
    lateFine:         (row.late_fine as number) ?? 0,
    lateReason:       (row.late_reason as string) ?? "",
    lateReasonStatus: row.late_reason_status as LateReasonStatus | null,
    radiusPenalty:    (row.radius_penalty as number) ?? 0,
    earlyCheckout:    (row.early_checkout as boolean) ?? false,
    earlyReason:      (row.early_reason as string) ?? "",
    notes:            row.notes as string | null,
    createdAt:        row.created_at as string,
    updatedAt:        row.updated_at as string,
  };
}

export function rowToLeaveRequest(row: Record<string, unknown>): LeaveRequest {
  return {
    id:                    row.id as string,
    userId:                row.user_id as string,
    type:                  row.type as LeaveRequestType,
    dates:                 (row.dates as string[]) ?? [],
    reason:                (row.reason as string) ?? "",
    status:                row.status as LeaveRequestStatus,
    processedBy:           row.processed_by as string | null,
    processedAt:           row.processed_at as string | null,
    deductedSick:          (row.deducted_sick as number) ?? 0,
    deductedLeave:         (row.deducted_leave as number) ?? 0,
    cancellationRequested: (row.cancellation_requested as boolean) ?? false,
    cancellationReason:    row.cancellation_reason as string | null,
    createdAt:             row.created_at as string,
    updatedAt:             row.updated_at as string,
  };
}

export function rowToAbsensiUser(row: Record<string, unknown>): AbsensiUser {
  const deptName = (row.departments as { name: string } | null)?.name ?? null;
  return {
    id:            row.id as string,
    name:          row.name as string,
    email:         row.email as string,
    department:    deptName,
    departmentId:  row.department_id as string | null,
    absensiRole:   (row.absensi_role as AbsensiRole) ?? "staff",
    absensiStatus: (row.absensi_status as AbsensiStatus) ?? "pending",
    leaveQuota:    (row.leave_quota as number) ?? 12,
    sickQuota:     (row.sick_quota as number) ?? 14,
    isHidden:      (row.is_hidden as boolean) ?? false,
  };
}

export function rowToSettings(row: Record<string, unknown>): AbsensiSettings {
  return {
    workStart:     (row.work_start as string) ?? "08:00",
    workEnd:       (row.work_end as string) ?? "18:00",
    maxLate:       (row.max_late as string) ?? "08:15",
    maxTimeSick:   (row.max_time_sick as string) ?? "12:00",
    maxTimeLeave:  (row.max_time_leave as string) ?? "23:59",
    maxTimeWfa:    (row.max_time_wfa as string) ?? "12:00",
    officeLat:     (row.office_lat as number) ?? -6.241586,
    officeLng:     (row.office_lng as number) ?? 106.628055,
    officeRadius:  (row.office_radius as number) ?? 100,
    lastSyncDate:  row.last_sync_date as string | null,
  };
}
