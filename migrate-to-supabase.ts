/**
 * NovaCore KPI — Firebase Firestore → Supabase Migration Script
 *
 * Setup:
 *   1. npm install firebase-admin tsx --save-dev
 *   2. Place firebase-service-account.json in this folder (from Firebase Console → Project Settings → Service Accounts)
 *   3. Get Supabase service_role key from: Supabase Dashboard → Settings → API → service_role
 *
 * Run:
 *   SUPABASE_SERVICE_ROLE_KEY=your_key npx tsx migrate-to-supabase.ts
 *
 * Optional flags:
 *   --dry-run    Print what would be migrated without writing to Supabase
 *   --skip-auth  Skip creating Supabase auth users (if they already exist)
 */

import { initializeApp, cert } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getAuth } from "firebase-admin/auth";
import type { Timestamp } from "firebase-admin/firestore";
import type { UserRecord } from "firebase-admin/auth";
import { createClient } from "@supabase/supabase-js";
import * as fs from "fs";

// ─── Config ───────────────────────────────────────────────────────────────────

const SUPABASE_URL = "https://mszzvdvajhvctyyxndqq.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

const DRY_RUN = process.argv.includes("--dry-run");
const SKIP_AUTH = process.argv.includes("--skip-auth");

// ─── Init ─────────────────────────────────────────────────────────────────────

if (!fs.existsSync("./firebase-service-account.json")) {
  console.error("❌ firebase-service-account.json not found in current directory.");
  console.error("   Get it from: Firebase Console → Project Settings → Service Accounts → Generate new private key");
  process.exit(1);
}

if (!SUPABASE_SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY env var is required.");
  console.error("   Get it from: Supabase Dashboard → Settings → API → service_role key");
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync("./firebase-service-account.json", "utf8"));

initializeApp({ credential: cert(serviceAccount) });
const firestore = getFirestore();
const firebaseAuth = getAuth();

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

function tsToIso(ts: Timestamp | null | undefined): string | null {
  if (!ts || typeof (ts as any).toDate !== "function") return null;
  try { return (ts as Timestamp).toDate().toISOString(); } catch { return null; }
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

function log(msg: string) { console.log(DRY_RUN ? `[DRY] ${msg}` : msg); }

// ─── Step 1: Build UID Map (Firebase UID → Supabase UUID) ────────────────────

async function buildUidMap(): Promise<Map<string, string>> {
  log("\n[1/8] Building UID map (Firebase UID → Supabase UUID)...");

  // List all Firebase auth users
  const firebaseUsers: UserRecord[] = [];
  let pageToken: string | undefined;
  do {
    const result = await firebaseAuth.listUsers(1000, pageToken);
    firebaseUsers.push(...result.users);
    pageToken = result.pageToken;
  } while (pageToken);
  log(`  Firebase auth users: ${firebaseUsers.length}`);

  // List existing Supabase auth users
  const supabaseByEmail = new Map<string, string>(); // email → supabase_uuid
  let page = 1;
  while (true) {
    const { data } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (!data?.users?.length) break;
    data.users.forEach((u) => {
      if (u.email) supabaseByEmail.set(u.email.toLowerCase(), u.id);
    });
    if (data.users.length < 1000) break;
    page++;
  }
  log(`  Existing Supabase auth users: ${supabaseByEmail.size}`);

  const uidMap = new Map<string, string>();

  for (const fbUser of firebaseUsers) {
    const email = fbUser.email?.toLowerCase();
    if (!email) {
      log(`  ⚠️  Firebase user ${fbUser.uid} has no email — skipped`);
      continue;
    }

    let supabaseId = supabaseByEmail.get(email);

    if (!supabaseId && !SKIP_AUTH) {
      if (DRY_RUN) {
        log(`  Would create Supabase user: ${email}`);
        // Use a placeholder ID for dry-run
        supabaseId = `dry-run-${fbUser.uid}`;
      } else {
        // Create Supabase auth user
        const { data, error } = await supabase.auth.admin.createUser({
          email: fbUser.email!,
          email_confirm: true,
          user_metadata: {
            name: fbUser.displayName ?? "",
            avatar_url: fbUser.photoURL ?? "",
            full_name: fbUser.displayName ?? "",
          },
        });
        if (error) {
          console.warn(`  ⚠️  Could not create Supabase user for ${email}: ${error.message}`);
          continue;
        }
        supabaseId = data.user.id;
        log(`  ✓ Created: ${email} → ${supabaseId}`);
      }
    }

    if (supabaseId) uidMap.set(fbUser.uid, supabaseId);
  }

  log(`  UID map: ${uidMap.size} entries`);
  return uidMap;
}

// ─── Step 2: Migrate Departments ─────────────────────────────────────────────

async function migrateDepartments(): Promise<Map<string, string>> {
  log("\n[2/8] Migrating departments...");

  // Try system/divisions document first
  let deptNames: string[] = [];
  try {
    const divDoc = await firestore.doc("system/divisions").get();
    if (divDoc.exists) {
      const data = divDoc.data()!;
      deptNames = data.divisions ?? data.departments ?? data.list ?? [];
    }
  } catch { /* collection may not exist */ }

  // Fallback: collect unique department names from users
  if (deptNames.length === 0) {
    const usersSnap = await firestore.collection("users").get();
    const depts = new Set<string>();
    usersSnap.docs.forEach((d) => {
      const dept = d.data().department;
      if (dept) depts.add(dept);
    });
    deptNames = [...depts].sort();
  }

  log(`  Found departments: ${deptNames.join(", ")}`);

  // Get existing Supabase departments
  const { data: existing } = await supabase.from("departments").select("id, name");
  const deptMap = new Map<string, string>(); // name → supabase_id
  (existing ?? []).forEach((d: any) => deptMap.set(d.name, d.id));

  const toInsert = deptNames.filter((name) => !deptMap.has(name));
  if (toInsert.length > 0) {
    log(`  Inserting ${toInsert.length} new departments...`);
    if (!DRY_RUN) {
      const { data, error } = await supabase
        .from("departments")
        .insert(toInsert.map((name) => ({ name })))
        .select("id, name");
      if (error) throw error;
      (data ?? []).forEach((d: any) => deptMap.set(d.name, d.id));
    }
  }

  log(`  Done: ${deptMap.size} departments`);
  return deptMap;
}

// ─── Step 3: Migrate User Profiles ───────────────────────────────────────────

async function migrateUsers(uidMap: Map<string, string>): Promise<void> {
  log("\n[3/8] Migrating user profiles...");

  const snap = await firestore.collection("users").get();
  log(`  Firebase users docs: ${snap.size}`);

  const rows = snap.docs.map((doc) => {
    const data = doc.data();
    const supabaseId = uidMap.get(doc.id);
    if (!supabaseId) return null;
    return {
      id: supabaseId,
      email: data.email ?? "",
      name: data.name ?? "",
      department: data.department ?? null,
      kpi_role: data.kpiRole ?? "tim",
      managed_departments: data.managedDepartments ?? [],
      status: data.status ?? "active",
      created_at: tsToIso(data.createdAt) ?? new Date().toISOString(),
    };
  }).filter(Boolean) as Record<string, unknown>[];

  log(`  Mapped: ${rows.length} profiles`);

  if (!DRY_RUN) {
    for (const ch of chunk(rows, 50)) {
      const { error } = await supabase.from("users").upsert(ch, { onConflict: "id" });
      if (error) console.warn(`  ⚠️  Users chunk error: ${error.message}`);
    }
  }

  log(`  Done: ${rows.length} user profiles`);
}

// ─── Step 4: Migrate KPIs ────────────────────────────────────────────────────

async function migrateKpis(uidMap: Map<string, string>): Promise<Map<string, string>> {
  log("\n[4/8] Migrating KPIs...");

  const snap = await firestore.collection("kpis").get();
  log(`  Firebase KPI docs: ${snap.size}`);

  type KpiRow = { _fbId: string; [key: string]: unknown };
  const rows: KpiRow[] = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      _fbId: doc.id,
      title: data.title ?? "",
      brand: data.brand ?? "",
      description: data.description ?? "",
      type: data.type ?? "result",
      unit: data.unit ?? "number",
      period: data.period ?? "monthly",
      department: data.department ?? "",
      monthly_target: data.monthlyTarget ?? 0,
      year: data.year ?? new Date().getFullYear(),
      month: data.month ?? new Date().getMonth() + 1,
      status: data.status ?? "draft",
      created_by: uidMap.get(data.createdBy ?? "") ?? null,
      deleted_at: tsToIso(data.deletedAt),
      created_at: tsToIso(data.createdAt) ?? new Date().toISOString(),
      updated_at: tsToIso(data.updatedAt) ?? new Date().toISOString(),
    };
  });

  const kpiIdMap = new Map<string, string>(); // firebase_id → supabase_id

  if (DRY_RUN) {
    rows.forEach((r) => kpiIdMap.set(r._fbId as string, `dry-run-${r._fbId}`));
    log(`  Would insert ${rows.length} KPIs`);
    return kpiIdMap;
  }

  for (const ch of chunk(rows, 50)) {
    const dbRows = ch.map(({ _fbId, ...rest }) => rest);
    const { data, error } = await supabase.from("kpis").insert(dbRows).select("id");
    if (error) { console.error(`  ⚠️  KPIs chunk error: ${error.message}`); continue; }
    ch.forEach((item, i) => {
      if (data?.[i]) kpiIdMap.set(item._fbId as string, data[i].id);
    });
  }

  log(`  Done: ${kpiIdMap.size} KPIs`);
  return kpiIdMap;
}

// ─── Step 5: Migrate KPI Assignments + Monthly Scores ────────────────────────

async function migrateAssignments(
  uidMap: Map<string, string>,
  kpiIdMap: Map<string, string>,
  deptMap: Map<string, string>
): Promise<Map<string, string>> {
  log("\n[5/8] Migrating KPI assignments...");

  const snap = await firestore.collection("kpi_assignments").get();
  log(`  Firebase assignment docs: ${snap.size}`);

  type AssignRow = { _fbId: string; _monthlyScores: Record<string, any>; [key: string]: unknown };
  const rows: AssignRow[] = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      _fbId: doc.id,
      _monthlyScores: data.monthlyScores ?? {},
      kpi_id: kpiIdMap.get(data.kpiId ?? ""),
      user_id: uidMap.get(data.userId ?? ""),
      department_id: deptMap.get(data.department ?? "") ?? null,
      status: data.status ?? "active",
      monthly_target: data.monthlyTarget ?? 0,
      current_daily_target: data.currentDailyTarget ?? 0,
      actual_total: data.actualTotal ?? 0,
      expected_total: data.expectedTotal ?? 0,
      achievement_percentage: data.achievementPercentage ?? 0,
      performance_category: data.performanceCategory ?? "warning",
      working_days_total: data.workingDaysTotal ?? 0,
      working_days_elapsed: data.workingDaysElapsed ?? 0,
      working_days_remaining: data.workingDaysRemaining ?? 0,
      active_days: data.activeDays ?? 0,
      year: data.year ?? new Date().getFullYear(),
      month: data.month ?? new Date().getMonth() + 1,
      quality_notes: data.qualityNotes ?? null,
      held_at: tsToIso(data.heldAt),
      cancelled_at: tsToIso(data.cancelledAt),
      completed_at: tsToIso(data.completedAt),
      created_at: tsToIso(data.createdAt) ?? new Date().toISOString(),
      updated_at: tsToIso(data.updatedAt) ?? new Date().toISOString(),
    };
  }).filter((r) => r.kpi_id && r.user_id);

  const skipped = snap.size - rows.length;
  if (skipped > 0) log(`  ⚠️  Skipped ${skipped} assignments (missing kpi_id or user_id — KPI may have been deleted)`);

  const assignmentIdMap = new Map<string, string>(); // firebase_id → supabase_id
  const monthlyScoreRows: Record<string, unknown>[] = [];

  if (DRY_RUN) {
    rows.forEach((r) => {
      assignmentIdMap.set(r._fbId as string, `dry-run-${r._fbId}`);
      Object.entries(r._monthlyScores).forEach(([key, val]: [string, any]) => {
        const [y, m] = key.split("-").map(Number);
        if (y && m) monthlyScoreRows.push({ assignment_id: `dry-run-${r._fbId}`, year: y, month: m });
      });
    });
    log(`  Would insert ${rows.length} assignments + ${monthlyScoreRows.length} monthly scores`);
    return assignmentIdMap;
  }

  for (const ch of chunk(rows, 50)) {
    const dbRows = ch.map(({ _fbId, _monthlyScores, ...rest }) => rest);
    const { data, error } = await supabase.from("kpi_assignments").insert(dbRows).select("id");
    if (error) { console.error(`  ⚠️  Assignments chunk error: ${error.message}`); continue; }

    ch.forEach((item, i) => {
      if (!data?.[i]) return;
      const supabaseId = data[i].id;
      assignmentIdMap.set(item._fbId as string, supabaseId);

      // Extract monthly scores from the Firebase map field (e.g. "2026-7": {...})
      Object.entries(item._monthlyScores).forEach(([key, val]: [string, any]) => {
        const parts = key.split("-");
        const msYear = parseInt(parts[0]);
        const msMonth = parseInt(parts[1]);
        if (!isNaN(msYear) && !isNaN(msMonth) && msMonth >= 1 && msMonth <= 12) {
          monthlyScoreRows.push({
            assignment_id: supabaseId,
            year: msYear,
            month: msMonth,
            actual_total: val.actualTotal ?? 0,
            achievement_percentage: val.achievementPercentage ?? 0,
            quality_notes: val.qualityNotes ?? null,
          });
        }
      });
    });
  }

  // Insert monthly scores
  if (monthlyScoreRows.length > 0) {
    log(`  Inserting ${monthlyScoreRows.length} monthly score records...`);
    for (const ch of chunk(monthlyScoreRows, 100)) {
      const { error } = await supabase
        .from("monthly_scores")
        .upsert(ch, { onConflict: "assignment_id,year,month" });
      if (error) console.warn(`  ⚠️  Monthly scores error: ${error.message}`);
    }
  }

  log(`  Done: ${assignmentIdMap.size} assignments, ${monthlyScoreRows.length} monthly scores`);
  return assignmentIdMap;
}

// ─── Step 6: Migrate Daily Reports ───────────────────────────────────────────

async function migrateDailyReports(
  uidMap: Map<string, string>,
  kpiIdMap: Map<string, string>,
  assignmentIdMap: Map<string, string>
): Promise<void> {
  log("\n[6/8] Migrating daily reports...");

  const snap = await firestore.collection("daily_reports").get();
  log(`  Firebase daily report docs: ${snap.size}`);

  const rows = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      kpi_id: kpiIdMap.get(data.kpiId ?? ""),
      user_id: uidMap.get(data.userId ?? ""),
      assignment_id: assignmentIdMap.get(data.assignmentId ?? ""),
      date: data.date ?? "",
      value: data.actualValue ?? 0, // Firebase: actualValue → Supabase: value
      notes: data.notes ?? null,
      created_at: tsToIso(data.createdAt) ?? new Date().toISOString(),
      updated_at: tsToIso(data.updatedAt) ?? new Date().toISOString(),
    };
  }).filter((r) => r.kpi_id && r.user_id && r.assignment_id && r.date);

  const skipped = snap.size - rows.length;
  if (skipped > 0) log(`  ⚠️  Skipped ${skipped} daily reports (missing FK references)`);

  if (!DRY_RUN) {
    let count = 0;
    for (const ch of chunk(rows, 200)) {
      const { error } = await supabase.from("daily_reports").insert(ch);
      if (error) console.warn(`  ⚠️  Daily reports chunk error: ${error.message}`);
      else count += ch.length;
    }
    log(`  Done: ${count} daily reports`);
  } else {
    log(`  Would insert ${rows.length} daily reports`);
  }
}

// ─── Step 7: Migrate KPI Settings ────────────────────────────────────────────

async function migrateKpiSettings(uidMap: Map<string, string>): Promise<void> {
  log("\n[7/8] Migrating KPI settings...");

  const snap = await firestore.collection("kpi_settings").get();
  log(`  Firebase kpi_settings docs: ${snap.size}`);

  const rows = snap.docs.map((doc) => {
    const data = doc.data();
    const supabaseUserId = uidMap.get(doc.id);
    if (!supabaseUserId) return null;
    return {
      user_id: supabaseUserId,
      result_weight: data.resultWeight ?? 40,
      activity_weight: data.activityWeight ?? 40,
      quality_weight: data.qualityWeight ?? 20,
      updated_by: uidMap.get(data.updatedBy ?? "") ?? null,
    };
  }).filter(Boolean) as Record<string, unknown>[];

  log(`  Mapped: ${rows.length} settings`);

  if (!DRY_RUN && rows.length > 0) {
    const { error } = await supabase.from("kpi_settings").upsert(rows, { onConflict: "user_id" });
    if (error) console.error(`  ⚠️  KPI settings error: ${error.message}`);
  }

  log(`  Done: ${rows.length} settings`);
}

// ─── Step 8: Migrate Feedbacks ────────────────────────────────────────────────

async function migrateFeedbacks(uidMap: Map<string, string>): Promise<void> {
  log("\n[8/8] Migrating feedbacks...");

  const snap = await firestore.collection("feedbacks").get();
  log(`  Firebase feedback docs: ${snap.size}`);

  const rows = snap.docs.map((doc) => {
    const data = doc.data();
    return {
      user_id: uidMap.get(data.userId ?? "") ?? null,
      user_name: data.userName ?? "",
      department: data.department ?? null,
      role: data.role ?? null,
      type: data.type ?? "general",
      message: data.message ?? "",
      status: data.status ?? "open",
      created_at: tsToIso(data.createdAt) ?? new Date().toISOString(),
      updated_at: tsToIso(data.updatedAt) ?? new Date().toISOString(),
    };
  });

  if (!DRY_RUN && rows.length > 0) {
    for (const ch of chunk(rows, 100)) {
      const { error } = await supabase.from("feedbacks").insert(ch);
      if (error) console.warn(`  ⚠️  Feedbacks chunk error: ${error.message}`);
    }
  }

  log(`  Done: ${rows.length} feedbacks`);
}

// ─── Preflight Check ──────────────────────────────────────────────────────────

async function preflightCheck(): Promise<boolean> {
  log("\n[Pre-flight] Checking Supabase tables...");

  const tables = ["kpis", "kpi_assignments", "daily_reports"];
  for (const table of tables) {
    const { count } = await supabase.from(table).select("id", { count: "exact", head: true });
    if ((count ?? 0) > 0) {
      console.warn(`  ⚠️  Table "${table}" already has ${count} rows.`);
      console.warn(`     Re-running migration will create duplicates.`);
      console.warn(`     Truncate tables first if you want a clean migration:`);
      console.warn(`       TRUNCATE daily_reports, monthly_scores, kpi_assignments, kpis CASCADE;`);
      if (!DRY_RUN) {
        const proceed = process.argv.includes("--force");
        if (!proceed) {
          console.error("\n  ❌ Aborting. Use --force to override this check.");
          return false;
        }
        console.warn("  ⚠️  --force flag detected — proceeding despite existing data.");
      }
    }
  }
  return true;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🚀 NovaCore KPI — Firebase → Supabase Migration");
  console.log("=".repeat(52));
  if (DRY_RUN) console.log("📋 DRY RUN mode — no writes to Supabase");
  if (SKIP_AUTH) console.log("⏭️  SKIP_AUTH — will not create Supabase auth users");

  const ok = await preflightCheck();
  if (!ok) process.exit(1);

  const uidMap = await buildUidMap();
  const deptMap = await migrateDepartments();
  await migrateUsers(uidMap);
  const kpiIdMap = await migrateKpis(uidMap);
  const assignmentIdMap = await migrateAssignments(uidMap, kpiIdMap, deptMap);
  await migrateDailyReports(uidMap, kpiIdMap, assignmentIdMap);
  await migrateKpiSettings(uidMap);
  await migrateFeedbacks(uidMap);

  console.log("\n" + "=".repeat(52));
  console.log("✅ Migration complete!");
  console.log("\nNext steps:");
  console.log("  1. Verify row counts in Supabase Dashboard → Table Editor");
  console.log("  2. Fix Google OAuth client secret in Supabase:");
  console.log("     Dashboard → Authentication → Providers → Google");
  console.log("     Client Secret: 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");
  console.log("  3. Deploy to Vercel (Phase 6):");
  console.log("     git push → auto-deploy on Vercel");

  process.exit(0);
}

main().catch((err) => {
  console.error("\n❌ Migration failed:", err.message ?? err);
  process.exit(1);
});
