# AGENT.md — Quick Reference for AI Agents

## What This Project Is

Internal KPI tracking system for a company called NovaCore/TNT.
Employees log daily KPI progress. Managers and HR view performance analytics.

**Tech:** Next.js 15 static export + Firebase Firestore + TypeScript + Tailwind CSS
**Deploy:** `npm run build` → `firebase deploy --only hosting`
**Live:** https://tnt-operational-system.web.app

---

## Role Hierarchy

```
developer > executive > hr > head > tim
```

Each role has its own `/dashboard/{role}` routes. The `developer` role can toggle between `tim` and `executive` views for testing.

---

## Key Files to Read First

| Question | File to Read |
|---|---|
| What types exist? | `src/types/index.ts` |
| What Firestore collections? | `src/lib/firebase/collections.ts` |
| How is auth/role handled? | `src/contexts/AuthContext.tsx` |
| How is weighted score calculated? | `src/lib/utils.ts` → `calcWeightedScore` |
| How does manual assignment work? | `src/app/dashboard/hr/assignments/page.tsx` |
| How does CSV import work? | `src/app/dashboard/developer/import/page.tsx` |
| How are achievement % updated? | `functions/src/index.ts` → `onDailyReportCreated` |

---

## Critical Invariants (Never Break These)

1. `kpi.monthlyTarget` = **total** across all assignees
2. `assignment.monthlyTarget` = **per person** (can differ per assignee)
3. KPI dedup key = `title|type|unit|period|dept|year|month` (no target in key)
4. CSV parser uses **header mapping** — columns matched by name, not position
5. All KPI queries must include `where("deletedAt", "==", null)`
6. All Firestore writes must include `updatedAt: Timestamp.now()`
7. Dashboard layout has auth guard — don't remove it
8. `achievementPercentage` stored in Firestore = **pace rate** (actual vs expected by now), NOT completion rate
9. KpiCard displays **completion rate** (`actualTotal / monthlyTarget × 100`) — calculated locally, not from stored `achievementPercentage`

---

## Common Patterns

### Creating an assignment
```typescript
await addDoc(kpiAssignmentsRef(), {
  kpiId, kpiType, userId, department,
  status: "active",
  monthlyTarget: perPersonTarget,
  currentDailyTarget: Math.ceil(perPersonTarget / workingDays),
  actualTotal: 0, expectedTotal: 0,
  achievementPercentage: 0,
  performanceCategory: "warning",
  workingDaysTotal: workingDays,
  workingDaysElapsed: 0, workingDaysRemaining: workingDays, activeDays: 0,
  year, month,
  heldAt: null, cancelledAt: null, completedAt: null,
  createdAt: Timestamp.now(), updatedAt: Timestamp.now(),
});
```

### Checking role access
```typescript
const { user } = useAuth();
if (!user || getKpiRole(user) !== "hr") return <p>Akses tidak diizinkan.</p>;
```

### Querying active assignments for a user
```typescript
query(
  kpiAssignmentsRef(),
  where("userId", "==", userId),
  where("year", "==", year),
  where("month", "==", month),
  where("status", "==", "active")
)
```

### Assignable users (for assignment dialog)
```typescript
// ALL active, non-hidden users — not filtered by kpiRole
users.filter(u => u.status === "active" && !u.isHidden)
```

---

## What NOT to Do

- Don't add server-side code (API routes, server components that fetch) — static export only
- Don't rename Firestore collections or document fields that have production data
- Don't change CSV column mapping logic without updating `autoDetectMapping()` aliases
- Don't import Firebase Admin SDK in frontend code
- Don't bypass the auth guard in dashboard layout
- Don't use `getDocs` for user-facing data that needs real-time updates — use `onSnapshot` via hooks
- Don't display `achievementPercentage` from Firestore directly as "Pencapaian" — it's pace rate, not completion rate

---

## Build & Deploy Commands

```bash
# From D:\Task-Management-NovaCore

npm run build              # TypeScript check + static export to out/
firebase deploy --only hosting          # Upload out/ to Firebase Hosting
firebase deploy --only firestore:rules  # Deploy security rules only
firebase deploy --only functions        # Deploy Cloud Functions only
```

Build must have 0 TypeScript errors before deploying.
