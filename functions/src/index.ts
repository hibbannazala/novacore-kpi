import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v2";
import {
  getWorkingDaysInMonth,
  getWorkingDaysElapsed,
  getPerformanceCategory,
} from "./utils/workingDays";

admin.initializeApp();
const db = admin.firestore();

// ─── Trigger: new daily_report submitted ──────────────────────────────────────

export const onDailyReportCreated = functions.firestore.onDocumentCreated(
  "daily_reports/{reportId}",
  async (event) => {
    const report = event.data?.data();
    if (!report) return;

    const { assignmentId, actualValue, date } = report as {
      assignmentId: string;
      actualValue: number;
      date: string;
    };

    const assignmentRef = db.collection("kpi_assignments").doc(assignmentId);
    const assignmentSnap = await assignmentRef.get();
    if (!assignmentSnap.exists) return;

    const assignment = assignmentSnap.data()!;
    const { year, month, monthlyTarget, actualTotal: prevActual, activeDays } = assignment as {
      year: number;
      month: number;
      monthlyTarget: number;
      actualTotal: number;
      activeDays: number;
    };

    // Always use TODAY's real date for elapsed/remaining days calculation
    // (not the report date, which could be a backdate)
    const realToday = new Date();
    const workingDaysTotal = getWorkingDaysInMonth(year, month);
    const workingDaysElapsed = getWorkingDaysElapsed(year, month, realToday);
    const workingDaysRemaining = workingDaysTotal - workingDaysElapsed;

    const newActualTotal = prevActual + actualValue;
    const newActiveDays = activeDays + 1;

    const expectedTotal = (monthlyTarget / workingDaysTotal) * workingDaysElapsed;
    const achievementPct = expectedTotal > 0 ? (newActualTotal / expectedTotal) * 100 : 0;

    const remainingTarget = Math.max(monthlyTarget - newActualTotal, 0);
    const newDailyTarget =
      workingDaysRemaining > 0 ? remainingTarget / workingDaysRemaining : 0;

    const category = getPerformanceCategory(achievementPct);

    await assignmentRef.update({
      actualTotal: newActualTotal,
      expectedTotal,
      achievementPercentage: achievementPct,
      performanceCategory: category,
      currentDailyTarget: newDailyTarget,
      workingDaysTotal,
      workingDaysElapsed,
      workingDaysRemaining,
      activeDays: newActiveDays,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection("kpi_histories").add({
      assignmentId,
      kpiId: assignment.kpiId,
      userId: assignment.userId,
      eventType: "daily_report_submitted",
      previousValue: {
        actualTotal: prevActual,
        achievementPercentage: assignment.achievementPercentage,
        currentDailyTarget: assignment.currentDailyTarget,
      },
      newValue: {
        actualTotal: newActualTotal,
        achievementPercentage: achievementPct,
        currentDailyTarget: newDailyTarget,
      },
      triggeredBy: "system",
      notes: `Daily report on ${date}: +${actualValue}`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
);

// ─── Trigger: daily_report EDITED (update) ────────────────────────────────────

export const onDailyReportUpdated = functions.firestore.onDocumentUpdated(
  "daily_reports/{reportId}",
  async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after) return;

    const diff = after.actualValue - before.actualValue;
    if (diff === 0) return; // No actual value change, skip

    const { assignmentId, date } = after as { assignmentId: string; date: string };

    const assignmentRef = db.collection("kpi_assignments").doc(assignmentId);
    const assignmentSnap = await assignmentRef.get();
    if (!assignmentSnap.exists) return;

    const assignment = assignmentSnap.data()!;
    const { year, month, monthlyTarget, actualTotal: prevActual } = assignment as {
      year: number;
      month: number;
      monthlyTarget: number;
      actualTotal: number;
    };

    // Use real today for elapsed/remaining (not the report date)
    const realToday = new Date();
    const workingDaysTotal = getWorkingDaysInMonth(year, month);
    const workingDaysElapsed = getWorkingDaysElapsed(year, month, realToday);
    const workingDaysRemaining = workingDaysTotal - workingDaysElapsed;

    const newActualTotal = prevActual + diff; // apply the diff (can be positive or negative)
    const expectedTotal = (monthlyTarget / workingDaysTotal) * workingDaysElapsed;
    const achievementPct = expectedTotal > 0 ? (newActualTotal / expectedTotal) * 100 : 0;
    const remainingTarget = Math.max(monthlyTarget - newActualTotal, 0);
    const newDailyTarget = workingDaysRemaining > 0 ? remainingTarget / workingDaysRemaining : 0;
    const category = getPerformanceCategory(achievementPct);

    await assignmentRef.update({
      actualTotal: newActualTotal,
      expectedTotal,
      achievementPercentage: achievementPct,
      performanceCategory: category,
      currentDailyTarget: newDailyTarget,
      workingDaysTotal,
      workingDaysElapsed,
      workingDaysRemaining,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection("kpi_histories").add({
      assignmentId,
      kpiId: assignment.kpiId,
      userId: assignment.userId,
      eventType: "daily_report_updated",
      previousValue: { actualTotal: prevActual, actualValue: before.actualValue },
      newValue: { actualTotal: newActualTotal, actualValue: after.actualValue },
      triggeredBy: "system",
      notes: `Edited report on ${date}: ${before.actualValue} → ${after.actualValue}`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
);

// ─── Trigger: daily_report DELETED ─────────────────────────────────────────────

export const onDailyReportDeleted = functions.firestore.onDocumentDeleted(
  "daily_reports/{reportId}",
  async (event) => {
    const report = event.data?.data();
    if (!report) return;

    const { assignmentId, actualValue, date } = report as {
      assignmentId: string;
      actualValue: number;
      date: string;
    };

    const assignmentRef = db.collection("kpi_assignments").doc(assignmentId);
    const assignmentSnap = await assignmentRef.get();
    if (!assignmentSnap.exists) return;

    const assignment = assignmentSnap.data()!;
    const { year, month, monthlyTarget, actualTotal: prevActual, activeDays } = assignment as {
      year: number;
      month: number;
      monthlyTarget: number;
      actualTotal: number;
      activeDays: number;
    };

    // Use real today for elapsed/remaining (not the report date)
    const realToday = new Date();
    const workingDaysTotal = getWorkingDaysInMonth(year, month);
    const workingDaysElapsed = getWorkingDaysElapsed(year, month, realToday);
    const workingDaysRemaining = workingDaysTotal - workingDaysElapsed;

    const newActualTotal = Math.max(prevActual - actualValue, 0); // subtract the deleted value
    const newActiveDays = Math.max(activeDays - 1, 0);

    const expectedTotal = (monthlyTarget / workingDaysTotal) * workingDaysElapsed;
    const achievementPct = expectedTotal > 0 ? (newActualTotal / expectedTotal) * 100 : 0;
    const remainingTarget = Math.max(monthlyTarget - newActualTotal, 0);
    const newDailyTarget = workingDaysRemaining > 0 ? remainingTarget / workingDaysRemaining : 0;
    const category = getPerformanceCategory(achievementPct);

    await assignmentRef.update({
      actualTotal: newActualTotal,
      expectedTotal,
      achievementPercentage: achievementPct,
      performanceCategory: category,
      currentDailyTarget: newDailyTarget,
      workingDaysTotal,
      workingDaysElapsed,
      workingDaysRemaining,
      activeDays: newActiveDays,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await db.collection("kpi_histories").add({
      assignmentId,
      kpiId: assignment.kpiId,
      userId: assignment.userId,
      eventType: "daily_report_deleted",
      previousValue: {
        actualTotal: prevActual,
        achievementPercentage: assignment.achievementPercentage,
        currentDailyTarget: assignment.currentDailyTarget,
      },
      newValue: {
        actualTotal: newActualTotal,
        achievementPercentage: achievementPct,
        currentDailyTarget: newDailyTarget,
      },
      triggeredBy: "system",
      notes: `Deleted report on ${date}: -${actualValue}`,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
);

// ─── Scheduled: monthly summary generation ────────────────────────────────────

export const generateMonthlySummaries = functions.scheduler.onSchedule(
  { schedule: "0 23 28-31 * *", timeZone: "Asia/Jakarta" },
  async () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (tomorrow.getMonth() === now.getMonth()) return;

    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const assignmentsSnap = await db
      .collection("kpi_assignments")
      .where("year", "==", year)
      .where("month", "==", month)
      .where("status", "==", "active")
      .get();

    const byUser: Record<string, admin.firestore.DocumentData[]> = {};
    assignmentsSnap.docs.forEach((d) => {
      const data = d.data();
      if (!byUser[data.userId]) byUser[data.userId] = [];
      byUser[data.userId].push({ id: d.id, ...data });
    });

    const DEFAULT_WEIGHTS = { result: 40, activity: 30, quality: 30 };

    // Fetch all kpi_settings in one query
    const settingsSnap = await db.collection("kpi_settings").get();
    const settingsMap: Record<string, { result: number; activity: number; quality: number }> = {};
    settingsSnap.docs.forEach((d: any) => {
      const data = d.data();
      settingsMap[d.id] = {
        result: data.resultWeight ?? DEFAULT_WEIGHTS.result,
        activity: data.activityWeight ?? DEFAULT_WEIGHTS.activity,
        quality: data.qualityWeight ?? DEFAULT_WEIGHTS.quality,
      };
    });

    function calcWeighted(
      userAssignments: admin.firestore.DocumentData[],
      weights: { result: number; activity: number; quality: number }
    ) {
      const buckets: Record<string, number[]> = { result: [], activity: [], quality: [] };
      userAssignments.forEach((a) => {
        const t: string = a.kpiType ?? "result";
        if (buckets[t]) buckets[t].push(a.achievementPercentage as number);
      });
      const avg = (arr: number[]) =>
        arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
      const rAvg = avg(buckets.result);
      const aAvg = avg(buckets.activity);
      const qAvg = avg(buckets.quality);
      const total = (rAvg * weights.result + aAvg * weights.activity + qAvg * weights.quality) / 100;
      return { total, rAvg, aAvg, qAvg };
    }

    const batch = db.batch();

    for (const [userId, assignments] of Object.entries(byUser)) {
      const department = assignments[0].department as string;
      const counts = { excellent: 0, good: 0, warning: 0, critical: 0 };

      const weights = settingsMap[userId] ?? DEFAULT_WEIGHTS;
      const { total: avgAchievement, rAvg, aAvg, qAvg } = calcWeighted(assignments, weights);

      assignments.forEach((a) => {
        const cat = getPerformanceCategory(a.achievementPercentage as number);
        counts[cat]++;
      });

      const overallCategory = getPerformanceCategory(avgAchievement);

      const prevSummarySnap = await db
        .collection("performance_summaries")
        .where("userId", "==", userId)
        .where("year", "==", month === 1 ? year - 1 : year)
        .where("month", "==", month === 1 ? 12 : month - 1)
        .limit(1)
        .get();

      let consecutiveCritical = 0;
      if (!prevSummarySnap.empty) {
        const prev = prevSummarySnap.docs[0].data();
        consecutiveCritical =
          prev.overallCategory === "critical"
            ? (prev.consecutiveCriticalMonths ?? 0) + 1
            : 0;
      }
      if (overallCategory === "critical") consecutiveCritical++;

      const isFlaggedForReview = consecutiveCritical >= 3;

      const summaryRef = db.collection("performance_summaries").doc();
      batch.set(summaryRef, {
        userId,
        department,
        year,
        month,
        assignmentIds: assignments.map((a) => a.id),
        averageAchievement: avgAchievement,
        overallCategory,
        excellentCount: counts.excellent,
        goodCount: counts.good,
        warningCount: counts.warning,
        criticalCount: counts.critical,
        consecutiveCriticalMonths: consecutiveCritical,
        isFlaggedForReview,
        resultWeight: weights.result,
        activityWeight: weights.activity,
        qualityWeight: weights.quality,
        resultAvg: rAvg,
        activityAvg: aAvg,
        qualityAvg: qAvg,
        generatedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      assignments.forEach((a) => {
        const ref = db.collection("kpi_assignments").doc(a.id);
        batch.update(ref, {
          status: "completed",
          completedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });
    }

    await batch.commit();
    functions.logger.info(
      `Monthly summaries generated for ${year}-${month}: ${Object.keys(byUser).length} users`
    );
  }
);

// ─── Scheduled: daily recalculate working days & targets ─────────────────────
//     Jalan tiap hari jam 00:05 WIB — pastikan data Firestore selalu akurat
//     meskipun staff tidak submit daily report hari itu.

export const dailyRecalculateAssignments = functions.scheduler.onSchedule(
  { schedule: "5 0 * * *", timeZone: "Asia/Jakarta" },
  async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const snap = await db
      .collection("kpi_assignments")
      .where("year", "==", year)
      .where("month", "==", month)
      .where("status", "==", "active")
      .get();

    if (snap.empty) {
      functions.logger.info("dailyRecalculateAssignments: no active assignments found.");
      return;
    }

    const workingDaysTotal = getWorkingDaysInMonth(year, month);
    const workingDaysElapsed = getWorkingDaysElapsed(year, month, now);
    const workingDaysRemaining = Math.max(workingDaysTotal - workingDaysElapsed, 0);

    // Firestore batch limit = 500, chunk jika perlu
    const BATCH_SIZE = 400;
    const docs = snap.docs;

    for (let i = 0; i < docs.length; i += BATCH_SIZE) {
      const batch = db.batch();
      const chunk = docs.slice(i, i + BATCH_SIZE);

      chunk.forEach((doc) => {
        const data = doc.data() as {
          monthlyTarget: number;
          actualTotal: number;
        };
        const { monthlyTarget, actualTotal } = data;

        const expectedTotal =
          workingDaysTotal > 0
            ? (monthlyTarget / workingDaysTotal) * workingDaysElapsed
            : 0;
        const achievementPct =
          expectedTotal > 0 ? (actualTotal / expectedTotal) * 100 : 0;
        const remainingTarget = Math.max(monthlyTarget - actualTotal, 0);
        const currentDailyTarget =
          workingDaysRemaining > 0 ? remainingTarget / workingDaysRemaining : 0;
        const category = getPerformanceCategory(achievementPct);

        batch.update(doc.ref, {
          workingDaysTotal,
          workingDaysElapsed,
          workingDaysRemaining,
          expectedTotal,
          achievementPercentage: achievementPct,
          performanceCategory: category,
          currentDailyTarget,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      });

      await batch.commit();
    }

    functions.logger.info(
      `dailyRecalculateAssignments: updated ${snap.size} assignments for ${year}-${month}`
    );
  }
);

// ─── Scheduled: cleanup KPIs in trash older than 30 days ─────────────────────

export const cleanupDeletedKpis = functions.scheduler.onSchedule(
  { schedule: "0 2 * * *", timeZone: "Asia/Jakarta" },
  async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const snap = await db
      .collection("kpis")
      .where("deletedAt", "<", admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
      .get();

    if (snap.empty) return;

    const batch = db.batch();
    snap.docs.forEach((d: any) => batch.delete(d.ref));
    await batch.commit();
    functions.logger.info(`cleanupDeletedKpis: permanently deleted ${snap.size} KPIs`);
  }
);

// ─── Callable: recalculate daily target ───────────────────────────────────────

export const recalculateDailyTarget = functions.https.onCall(
  async (request) => {
    const { assignmentId } = request.data as { assignmentId: string };

    if (!request.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be authenticated.");
    }

    const assignmentRef = db.collection("kpi_assignments").doc(assignmentId);
    const snap = await assignmentRef.get();
    if (!snap.exists) {
      throw new functions.https.HttpsError("not-found", "Assignment not found.");
    }

    const data = snap.data()!;
    const { year, month, monthlyTarget, actualTotal, workingDaysElapsed } = data as {
      year: number;
      month: number;
      monthlyTarget: number;
      actualTotal: number;
      workingDaysElapsed: number;
    };

    const workingDaysTotal = getWorkingDaysInMonth(year, month);
    const remaining = workingDaysTotal - workingDaysElapsed;
    const remainingTarget = Math.max(monthlyTarget - actualTotal, 0);
    const newDailyTarget = remaining > 0 ? remainingTarget / remaining : 0;

    await assignmentRef.update({
      currentDailyTarget: newDailyTarget,
      workingDaysTotal,
      workingDaysRemaining: remaining,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { success: true, newDailyTarget };
  }
);

// ─── Callable: hold/cancel a KPI assignment ───────────────────────────────────

export const updateAssignmentStatus = functions.https.onCall(
  async (request) => {
    const { assignmentId, newStatus, notes } = request.data as {
      assignmentId: string;
      newStatus: "hold" | "cancelled";
      notes?: string;
    };

    if (!request.auth) {
      throw new functions.https.HttpsError("unauthenticated", "Must be authenticated.");
    }

    // Check kpiRole field — only HR or Executive can change assignment status
    const userSnap = await db.collection("users").doc(request.auth.uid).get();
    const kpiRole = userSnap.data()?.kpiRole;
    if (kpiRole !== "hr" && kpiRole !== "executive") {
      throw new functions.https.HttpsError("permission-denied", "HR atau Executive only.");
    }

    const assignmentRef = db.collection("kpi_assignments").doc(assignmentId);
    const assignmentSnap = await assignmentRef.get();
    if (!assignmentSnap.exists) {
      throw new functions.https.HttpsError("not-found", "Assignment not found.");
    }

    const now = admin.firestore.FieldValue.serverTimestamp();
    const updateData: Record<string, unknown> = { status: newStatus, updatedAt: now };
    if (newStatus === "hold") updateData.heldAt = now;
    if (newStatus === "cancelled") updateData.cancelledAt = now;

    await assignmentRef.update(updateData);

    const assignment = assignmentSnap.data()!;
    await db.collection("kpi_histories").add({
      assignmentId,
      kpiId: assignment.kpiId,
      userId: assignment.userId,
      eventType: "status_changed",
      previousValue: { status: assignment.status },
      newValue: { status: newStatus },
      triggeredBy: request.auth.uid,
      notes: notes ?? "",
      createdAt: now,
    });

    return { success: true };
  }
);
