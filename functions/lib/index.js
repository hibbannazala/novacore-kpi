"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.updateAssignmentStatus = exports.recalculateDailyTarget = exports.cleanupDeletedKpis = exports.generateMonthlySummaries = exports.onDailyReportUpdated = exports.onDailyReportCreated = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v2"));
const workingDays_1 = require("./utils/workingDays");
admin.initializeApp();
const db = admin.firestore();
// ─── Trigger: new daily_report submitted ──────────────────────────────────────
exports.onDailyReportCreated = functions.firestore.onDocumentCreated("daily_reports/{reportId}", async (event) => {
    const report = event.data?.data();
    if (!report)
        return;
    const { assignmentId, actualValue, date } = report;
    const assignmentRef = db.collection("kpi_assignments").doc(assignmentId);
    const assignmentSnap = await assignmentRef.get();
    if (!assignmentSnap.exists)
        return;
    const assignment = assignmentSnap.data();
    const { year, month, monthlyTarget, actualTotal: prevActual, activeDays } = assignment;
    // Always use TODAY's real date for elapsed/remaining days calculation
    // (not the report date, which could be a backdate)
    const realToday = new Date();
    const workingDaysTotal = (0, workingDays_1.getWorkingDaysInMonth)(year, month);
    const workingDaysElapsed = (0, workingDays_1.getWorkingDaysElapsed)(year, month, realToday);
    const workingDaysRemaining = workingDaysTotal - workingDaysElapsed;
    const newActualTotal = prevActual + actualValue;
    const newActiveDays = activeDays + 1;
    const expectedTotal = (monthlyTarget / workingDaysTotal) * workingDaysElapsed;
    const achievementPct = expectedTotal > 0 ? (newActualTotal / expectedTotal) * 100 : 0;
    const remainingTarget = Math.max(monthlyTarget - newActualTotal, 0);
    const newDailyTarget = workingDaysRemaining > 0 ? remainingTarget / workingDaysRemaining : 0;
    const category = (0, workingDays_1.getPerformanceCategory)(achievementPct);
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
});
// ─── Trigger: daily_report EDITED (update) ────────────────────────────────────
exports.onDailyReportUpdated = functions.firestore.onDocumentUpdated("daily_reports/{reportId}", async (event) => {
    const before = event.data?.before.data();
    const after = event.data?.after.data();
    if (!before || !after)
        return;
    const diff = after.actualValue - before.actualValue;
    if (diff === 0)
        return; // No actual value change, skip
    const { assignmentId, date } = after;
    const assignmentRef = db.collection("kpi_assignments").doc(assignmentId);
    const assignmentSnap = await assignmentRef.get();
    if (!assignmentSnap.exists)
        return;
    const assignment = assignmentSnap.data();
    const { year, month, monthlyTarget, actualTotal: prevActual } = assignment;
    // Use real today for elapsed/remaining (not the report date)
    const realToday = new Date();
    const workingDaysTotal = (0, workingDays_1.getWorkingDaysInMonth)(year, month);
    const workingDaysElapsed = (0, workingDays_1.getWorkingDaysElapsed)(year, month, realToday);
    const workingDaysRemaining = workingDaysTotal - workingDaysElapsed;
    const newActualTotal = prevActual + diff; // apply the diff (can be positive or negative)
    const expectedTotal = (monthlyTarget / workingDaysTotal) * workingDaysElapsed;
    const achievementPct = expectedTotal > 0 ? (newActualTotal / expectedTotal) * 100 : 0;
    const remainingTarget = Math.max(monthlyTarget - newActualTotal, 0);
    const newDailyTarget = workingDaysRemaining > 0 ? remainingTarget / workingDaysRemaining : 0;
    const category = (0, workingDays_1.getPerformanceCategory)(achievementPct);
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
});
// ─── Scheduled: monthly summary generation ────────────────────────────────────
exports.generateMonthlySummaries = functions.scheduler.onSchedule({ schedule: "0 23 28-31 * *", timeZone: "Asia/Jakarta" }, async () => {
    const now = new Date();
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    if (tomorrow.getMonth() === now.getMonth())
        return;
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const assignmentsSnap = await db
        .collection("kpi_assignments")
        .where("year", "==", year)
        .where("month", "==", month)
        .where("status", "==", "active")
        .get();
    const byUser = {};
    assignmentsSnap.docs.forEach((d) => {
        const data = d.data();
        if (!byUser[data.userId])
            byUser[data.userId] = [];
        byUser[data.userId].push({ id: d.id, ...data });
    });
    const DEFAULT_WEIGHTS = { result: 40, activity: 30, quality: 30 };
    // Fetch all kpi_settings in one query
    const settingsSnap = await db.collection("kpi_settings").get();
    const settingsMap = {};
    settingsSnap.docs.forEach((d) => {
        const data = d.data();
        settingsMap[d.id] = {
            result: data.resultWeight ?? DEFAULT_WEIGHTS.result,
            activity: data.activityWeight ?? DEFAULT_WEIGHTS.activity,
            quality: data.qualityWeight ?? DEFAULT_WEIGHTS.quality,
        };
    });
    function calcWeighted(userAssignments, weights) {
        const buckets = { result: [], activity: [], quality: [] };
        userAssignments.forEach((a) => {
            const t = a.kpiType ?? "result";
            if (buckets[t])
                buckets[t].push(a.achievementPercentage);
        });
        const avg = (arr) => arr.length > 0 ? arr.reduce((s, v) => s + v, 0) / arr.length : 0;
        const rAvg = avg(buckets.result);
        const aAvg = avg(buckets.activity);
        const qAvg = avg(buckets.quality);
        const total = (rAvg * weights.result + aAvg * weights.activity + qAvg * weights.quality) / 100;
        return { total, rAvg, aAvg, qAvg };
    }
    const batch = db.batch();
    for (const [userId, assignments] of Object.entries(byUser)) {
        const department = assignments[0].department;
        const counts = { excellent: 0, good: 0, warning: 0, critical: 0 };
        const weights = settingsMap[userId] ?? DEFAULT_WEIGHTS;
        const { total: avgAchievement, rAvg, aAvg, qAvg } = calcWeighted(assignments, weights);
        assignments.forEach((a) => {
            const cat = (0, workingDays_1.getPerformanceCategory)(a.achievementPercentage);
            counts[cat]++;
        });
        const overallCategory = (0, workingDays_1.getPerformanceCategory)(avgAchievement);
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
        if (overallCategory === "critical")
            consecutiveCritical++;
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
    functions.logger.info(`Monthly summaries generated for ${year}-${month}: ${Object.keys(byUser).length} users`);
});
// ─── Scheduled: cleanup KPIs in trash older than 30 days ─────────────────────
exports.cleanupDeletedKpis = functions.scheduler.onSchedule({ schedule: "0 2 * * *", timeZone: "Asia/Jakarta" }, async () => {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const snap = await db
        .collection("kpis")
        .where("deletedAt", "<", admin.firestore.Timestamp.fromDate(thirtyDaysAgo))
        .get();
    if (snap.empty)
        return;
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    functions.logger.info(`cleanupDeletedKpis: permanently deleted ${snap.size} KPIs`);
});
// ─── Callable: recalculate daily target ───────────────────────────────────────
exports.recalculateDailyTarget = functions.https.onCall(async (request) => {
    const { assignmentId } = request.data;
    if (!request.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Must be authenticated.");
    }
    const assignmentRef = db.collection("kpi_assignments").doc(assignmentId);
    const snap = await assignmentRef.get();
    if (!snap.exists) {
        throw new functions.https.HttpsError("not-found", "Assignment not found.");
    }
    const data = snap.data();
    const { year, month, monthlyTarget, actualTotal, workingDaysElapsed } = data;
    const workingDaysTotal = (0, workingDays_1.getWorkingDaysInMonth)(year, month);
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
});
// ─── Callable: hold/cancel a KPI assignment ───────────────────────────────────
exports.updateAssignmentStatus = functions.https.onCall(async (request) => {
    const { assignmentId, newStatus, notes } = request.data;
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
    const updateData = { status: newStatus, updatedAt: now };
    if (newStatus === "hold")
        updateData.heldAt = now;
    if (newStatus === "cancelled")
        updateData.cancelledAt = now;
    await assignmentRef.update(updateData);
    const assignment = assignmentSnap.data();
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
});
//# sourceMappingURL=index.js.map