/**
 * migrate-absensi.mjs
 *
 * Migrates Firestore absensi data → Supabase
 *
 * SETUP:
 *   1. Download Firebase service account:
 *      Firebase Console → Project Settings → Service Accounts → Generate new private key
 *      Simpan sebagai: D:\NOVA-CORE-SYSTEM\Task-Management-NovaCore\firebase-service-account.json
 *
 *   2. Isi SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY di bawah
 *      (service role key ada di Supabase → Project Settings → API → service_role)
 *
 *   3. Jalankan SQL absensi-schema.sql di Supabase SQL Editor terlebih dahulu
 *
 *   4. node migrate-absensi.mjs
 *
 * CATATAN:
 *   - User yang belum punya akun Supabase akan otomatis dibuatkan.
 *   - Waktu mereka login Google OAuth nanti, Supabase link otomatis by email.
 *   - Tidak perlu minta semua staf login dulu.
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ─── CONFIG ──────────────────────────────────────────────────────────────────

const SUPABASE_URL          = "https://mszzvdvajhvctyyxndqq.supabase.co";
const SUPABASE_SERVICE_KEY  = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1zenp2ZHZhamh2Y3R5eXhuZHFxIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc4MzQ4NjYxMCwiZXhwIjoyMDk5MDYyNjEwfQ.9gdHNl9Z05PYqq8HvSdJrShWgb43jPlO29w5IuY7IMA";
const SERVICE_ACCOUNT_PATH  = join(__dirname, "firebase-service-account.json");

// ─── INIT ────────────────────────────────────────────────────────────────────

let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(SERVICE_ACCOUNT_PATH, "utf8"));
} catch {
  console.error("❌  File firebase-service-account.json tidak ditemukan.");
  console.error("    Download dari Firebase Console → Project Settings → Service Accounts");
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db  = getFirestore();
const sup = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// ─── HELPERS ─────────────────────────────────────────────────────────────────

function tsToIso(val) {
  if (!val) return null;
  if (val._seconds != null)        return new Date(val._seconds * 1000).toISOString();
  if (val.seconds != null)         return new Date(val.seconds   * 1000).toISOString();
  if (val.toDate instanceof Function) return val.toDate().toISOString();
  if (typeof val === "string")     return new Date(val).toISOString();
  return null;
}

// Normalise time string: "08.22" or "08:22" → "08:22"; null/undefined → null
function normaliseTime(val) {
  if (!val) return null;
  const s = String(val).trim().replace(".", ":");
  return /^\d{2}:\d{2}(:\d{2})?$/.test(s) ? s : null;
}

function toDate(val) {
  if (!val) return null;
  const iso = tsToIso(val);
  return iso ? iso.split("T")[0] : null;
}

function log(msg)  { console.log(`  ✓  ${msg}`); }
function warn(msg) { console.warn(`  ⚠  ${msg}`); }
function section(title) { console.log(`\n─── ${title} ${"─".repeat(50 - title.length)}`); }

// ─── STEP 1: Build UID → Supabase UUID mapping ────────────────────────────────
// Kalau user belum ada di Supabase, buatkan auth user baru.
// Waktu login Google OAuth nanti, Supabase otomatis link by email.

async function buildUserMap() {
  section("User Mapping (Firebase UID → Supabase UUID)");

  const snap = await db.collection("users").get();
  const firestoreUsers = snap.docs.map(d => ({ uid: d.id, ...d.data() }));
  console.log(`  Firestore users: ${firestoreUsers.length}`);

  // Fetch ALL existing Supabase auth users (paginate, 1000/page)
  const emailToSupaId = new Map();
  let page = 1;
  while (true) {
    const { data: pageData, error } = await sup.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw new Error("Gagal fetch Supabase auth users: " + error.message);
    const pageUsers = pageData?.users ?? [];
    for (const u of pageUsers) {
      if (u.email) emailToSupaId.set(u.email.toLowerCase(), u.id);
    }
    if (pageUsers.length < 1000) break;
    page++;
  }
  console.log(`  Supabase auth users (existing): ${emailToSupaId.size}`);

  const uidToSupaId   = new Map();
  const uidToFireData = new Map();

  for (const fu of firestoreUsers) {
    const email = fu.email?.toLowerCase();
    if (!email) { warn(`User ${fu.uid} tidak punya email, skip.`); continue; }

    let supId = emailToSupaId.get(email);

    if (!supId) {
      // Belum ada di Supabase — buat auth user baru
      const { data: created, error: createErr } = await sup.auth.admin.createUser({
        email,
        email_confirm: true,
        user_metadata: { name: fu.name ?? "" },
      });
      if (createErr) {
        if (createErr.message?.includes("already been registered")) {
          // Race / pagination miss — lookup by email dari public.users
          const { data: existing } = await sup.from("users").select("id").eq("email", email).single();
          if (existing) {
            supId = existing.id;
            log(`FALLBACK LOOKUP: ${fu.name ?? email} → ${supId}`);
          } else {
            warn(`Tidak bisa resolve user ${email}, skip.`);
            continue;
          }
        } else {
          warn(`Gagal buat user ${email}: ${createErr.message}`);
          continue;
        }
      } else {
        supId = created.user.id;
        log(`CREATED auth user: ${fu.name ?? email} → ${supId}`);
      }
    } else {
      log(`EXISTING: ${fu.name ?? email} → ${supId}`);
    }

    uidToSupaId.set(fu.uid, supId);
    uidToFireData.set(fu.uid, fu);
  }

  return { uidToSupaId, uidToFireData };
}

// ─── STEP 2: Update Supabase users dengan data absensi ───────────────────────

async function migrateUsers(uidToSupaId, uidToFireData) {
  section("Migrate Users (absensi fields)");

  const statusMap = { active: "active", pending: "pending", rejected: "rejected", resigned: "resigned", deleted: "deleted" };

  for (const [uid, supId] of uidToSupaId) {
    const fu = uidToFireData.get(uid);
    const payload = {
      absensi_role:   fu.role   === "admin" ? "admin" : "staff",
      absensi_status: statusMap[fu.status]  ?? "pending",
      leave_quota:    fu.leave  ?? 12,
      sick_quota:     fu.sick   ?? 14,
      urgent_balance: fu.urgent ?? fu.urgentQuota ?? 0,
      urgent_quota:   fu.urgentQuota ?? 1,
      is_hidden:      fu.isHidden ?? false,
    };

    // Set department by name lookup
    if (fu.department) {
      const { data: deptRow } = await sup.from("departments").select("id").eq("name", fu.department).single();
      if (deptRow) payload.department_id = deptRow.id;
    }

    const { error } = await sup.from("users").update(payload).eq("id", supId);
    if (error) warn(`Update user ${fu.email}: ${error.message}`);
    else log(`Updated ${fu.name ?? fu.email}`);
  }
}

// ─── STEP 3: Migrate attendance ───────────────────────────────────────────────

async function migrateAttendance(uidToSupaId) {
  section("Migrate Attendance");

  const snap = await db.collection("attendance").get();
  console.log(`  Total records: ${snap.docs.length}`);

  let ok = 0, skip = 0, fail = 0;

  for (const doc of snap.docs) {
    const d  = doc.data();
    const supId = uidToSupaId.get(d.userId);
    if (!supId) { skip++; continue; }

    const row = {
      user_id:            supId,
      date:               d.date,
      check_in:           normaliseTime(d.checkIn),
      check_out:          normaliseTime(d.checkOut),
      status:             d.status === "early_checkout" ? "auto_checkout" : (d.status ?? "on_time"),
      type:               d.type      ?? "WFO",
      location_in:        d.locationIn ?? null,
      location_status:    d.locationStatus ?? null,
      late_fine:          d.lateFine  ?? 0,
      late_reason:        d.lateReason ?? "",
      late_reason_status: d.lateReasonStatus ?? null,
      radius_penalty:     d.radiusPenalty ?? 0,
      early_checkout:     d.earlyCheckout ?? false,
      early_reason:       d.earlyReason ?? "",
      notes:              d.notes ?? null,
    };

    const { error } = await sup.from("attendance").upsert(row, { onConflict: "user_id,date" });
    if (error) { warn(`attendance ${doc.id}: ${error.message}`); fail++; }
    else ok++;
  }

  console.log(`  → OK: ${ok}, Skipped (no user): ${skip}, Failed: ${fail}`);
}

// ─── STEP 4: Migrate leave_requests ──────────────────────────────────────────

async function migrateLeaveRequests(uidToSupaId, uidToFireData) {
  section("Migrate Leave Requests");

  // Hapus semua data lama sebelum insert ulang (supaya tidak duplikat)
  const { error: delErr } = await sup.from("leave_requests").delete().gte("created_at", "2000-01-01");
  if (delErr) { warn(`Gagal hapus leave_requests lama: ${delErr.message}`); return; }
  log("Cleared existing leave_requests");

  const snap = await db.collection("requests").get();
  console.log(`  Total records: ${snap.docs.length}`);

  let ok = 0, skip = 0, fail = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    const supId = uidToSupaId.get(d.userId);
    if (!supId) { skip++; continue; }

    const row = {
      user_id:                supId,
      type:                   d.type === "sakit" ? "sick" : (d.type ?? "leave"),
      dates:                  Array.isArray(d.dates) ? d.dates : [],
      reason:                 d.reason ?? "",
      status:                 d.status ?? "pending",
      processed_by:           d.processedBy ?? null,
      processed_at:           tsToIso(d.processedAt),
      deducted_sick:          d.deductedSick   ?? 0,
      deducted_leave:         d.deductedLeave  ?? 0,
      deducted_urgent:        d.deductedUrgent ?? 0,
      cancellation_requested: d.cancellationRequested ?? false,
      cancellation_reason:    d.cancellationReason ?? null,
      created_at:             tsToIso(d.timestamp) ?? new Date().toISOString(),
    };

    const { error } = await sup.from("leave_requests").insert(row);
    if (error) { warn(`request ${doc.id}: ${error.message}`); fail++; }
    else ok++;
  }

  console.log(`  → OK: ${ok}, Skipped (no user): ${skip}, Failed: ${fail}`);
}

// ─── STEP 5: Migrate holidays ─────────────────────────────────────────────────

async function migrateHolidays() {
  section("Migrate Holidays");

  const snap = await db.collection("holidays").get();
  console.log(`  Total records: ${snap.docs.length}`);

  let ok = 0, fail = 0;

  for (const doc of snap.docs) {
    const d = doc.data();
    const row = {
      date:        d.date,
      description: d.desc ?? d.description ?? "",
    };

    const { error } = await sup.from("holidays").upsert(row, { onConflict: "date" });
    if (error) { warn(`holiday ${d.date}: ${error.message}`); fail++; }
    else ok++;
  }

  console.log(`  → OK: ${ok}, Failed: ${fail}`);
}

// ─── STEP 6: Migrate settings ─────────────────────────────────────────────────

async function migrateSettings() {
  section("Migrate Settings");

  const [settingsDoc, officeDoc] = await Promise.all([
    db.collection("system").doc("settings").get(),
    db.collection("system").doc("office").get(),
  ]);

  const s = settingsDoc.exists ? settingsDoc.data() : {};
  const o = officeDoc.exists   ? officeDoc.data()   : {};

  const row = {
    id:             1,
    work_start:     s.workStart     ?? "08:00",
    work_end:       s.workEnd       ?? "18:00",
    max_late:       s.maxLate       ?? "08:15",
    max_time_sick:  s.maxTimeSick   ?? "12:00",
    max_time_leave: s.maxTimeLeave  ?? "23:59",
    max_time_wfa:   s.maxTimeWfa    ?? "12:00",
    office_lat:     o.lat           ?? -6.241586,
    office_lng:     o.lng           ?? 106.628055,
    office_radius:  o.radius        ?? 100,
  };

  const { error } = await sup.from("absensi_settings").upsert(row, { onConflict: "id" });
  if (error) warn(`settings: ${error.message}`);
  else log(`Settings: workStart=${row.work_start}, maxLate=${row.max_late}, radius=${row.office_radius}m`);
}

// ─── STEP 7: Migrate logs ─────────────────────────────────────────────────────

async function migrateLogs(uidToSupaId) {
  section("Migrate Logs");

  // Hapus logs lama sebelum insert ulang
  await sup.from("absensi_logs").delete().gte("created_at", "2000-01-01");
  log("Cleared existing absensi_logs");

  const snap = await db.collection("logs").orderBy("timestamp", "desc").limit(500).get();
  console.log(`  Total records: ${snap.docs.length} (max 500)`);

  let ok = 0, fail = 0;

  for (const doc of snap.docs) {
    const d = doc.data();

    // Logs bisa punya 2 format berbeda dari Firebase
    const actor   = d.actor ?? d.userName ?? "SYSTEM";
    const action  = d.action ?? d.event ?? "-";
    const details = d.details ?? d.description ?? null;
    const targetId = d.uid ? uidToSupaId.get(d.uid) ?? null : null;
    const createdAt = tsToIso(d.timestamp ?? d.serverTime);

    const row = {
      actor,
      action,
      target_user_id: targetId,
      details,
      created_at: createdAt ?? new Date().toISOString(),
    };

    const { error } = await sup.from("absensi_logs").insert(row);
    if (error) { warn(`log ${doc.id}: ${error.message}`); fail++; }
    else ok++;
  }

  console.log(`  → OK: ${ok}, Failed: ${fail}`);
}

// ─── MAIN ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("╔══════════════════════════════════════════╗");
  console.log("║   Migrate Absensi: Firestore → Supabase  ║");
  console.log("╚══════════════════════════════════════════╝");
  console.log(`  Firebase project : absensi-tracker-tnt`);
  console.log(`  Supabase project : mszzvdvajhvctyyxndqq`);

  try {
    const { uidToSupaId, uidToFireData } = await buildUserMap();

    if (uidToSupaId.size === 0) {
      console.error("\n❌  Tidak ada user yang bisa dimapping. Pastikan user sudah login ke app baru minimal sekali.");
      process.exit(1);
    }

    await migrateUsers(uidToSupaId, uidToFireData);
    await migrateAttendance(uidToSupaId);
    await migrateLeaveRequests(uidToSupaId, uidToFireData);
    await migrateHolidays();
    await migrateSettings();
    await migrateLogs(uidToSupaId);

    console.log("\n╔══════════════════════════════════════════╗");
    console.log("║   ✅  MIGRASI SELESAI                     ║");
    console.log("╚══════════════════════════════════════════╝\n");
  } catch (err) {
    console.error("\n❌  Error:", err.message);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

main();
