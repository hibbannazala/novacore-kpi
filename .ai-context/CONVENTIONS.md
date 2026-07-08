# CONVENTIONS.md — Konvensi Kode NovaCore KPI

## Penamaan

### Komponen & File
- **Komponen React:** PascalCase — `KpiCard.tsx`, `CreateKpiForm.tsx`
- **Hooks:** camelCase dengan prefix `use` — `useAllUsers.ts`, `useKpiSettings.ts`
- **Halaman:** `page.tsx` (standar Next.js App Router)
- **Layout:** `layout.tsx` (standar Next.js App Router)
- **Utility:** camelCase — `utils.ts`, `client.ts`, `collections.ts`

### Variabel & Fungsi
```typescript
// Variabel: camelCase
const workingDays = getWorkingDaysInMonth(year, month);
const userMap = Object.fromEntries(users.map(u => [u.id, u]));

// Fungsi: camelCase, kata kerja deskriptif
function handleAssign(e: React.FormEvent) { ... }
function handleStatusChange(a: KpiAssignment, newStatus: ...) { ... }
async function handleEditTarget(a: KpiAssignment, newTarget: number) { ... }
function resetForm() { ... }
function toggleUser(userId: string) { ... }

// Handler event: prefix "handle"
// Toggle: prefix "toggle"
// State setter: prefix "set" (bawaan React)
```

### State Variables
```typescript
// Boolean loading: isLoading, submitting, importing
const [isLoading, setIsLoading] = useState(true);
const [submitting, setSubmitting] = useState(false);

// Dialog open/close: open, setOpen
const [open, setOpen] = useState(false);

// Selected item: selectedXxx atau confirmXxx
const [selectedKpi, setSelectedKpi] = useState("");
const [confirmDelete, setConfirmDelete] = useState<{ kpi: KPI; assignmentCount: number } | null>(null);

// Error message: error, fileError, deleteError
const [error, setError] = useState("");
```

### Map / Record Variables
```typescript
// Map dari id ke entity: xMap
const kpiMap = Object.fromEntries(kpis.map(k => [k.id, k]));
const userMap = Object.fromEntries(users.map(u => [u.id, u]));

// Group by userId: groupedByUser atau xByY
const groupedByUser = useMemo(() => { ... }, [assignments]);

// Nested Record: Record<string, Entity[]>
const assignmentsMap: Record<string, KpiAssignment[]> = {};
```

---

## Struktur Komponen / Halaman

Urutan dalam file:
1. `"use client"` directive
2. Imports (React, Next.js, Firebase, hooks, components, utils, types)
3. Constants & local types
4. Helper functions murni (di luar komponen)
5. Komponen default (`export default function XxxPage()`)
6. State declarations
7. Computed/memoized values (`useMemo`)
8. Loading & guard renders (early return)
9. Event handlers
10. JSX return

```typescript
"use client";

import { useState, useMemo } from "react";
import { ... } from "firebase/firestore";
import { useAuth } from "@/contexts/AuthContext";
import { useXxx } from "@/hooks/useXxx";
import { Button } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";
import type { KPI } from "@/types";

// Constants
const STATUS_LABEL: Record<string, string> = { ... };

// Helper functions
function formatTarget(kpi: KPI): string { ... }

export default function HrKpiPage() {
  // 1. Hooks
  const { user } = useAuth();
  const { kpis, isLoading } = useKpis(year, month);

  // 2. State
  const [open, setOpen] = useState(false);

  // 3. Computed
  const activeKpis = useMemo(() => kpis.filter(...), [kpis]);

  // 4. Early returns
  if (isLoading) return <Spinner />;
  if (!user) return null;

  // 5. Handlers
  async function handleSubmit() { ... }

  // 6. JSX
  return ( ... );
}
```

---

## Struktur Import

Urutan (tidak ada enforcer, tapi pola konsisten):
```typescript
// 1. React & Next.js
import { useState, useMemo, useRef } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

// 2. Firebase
import { addDoc, updateDoc, Timestamp } from "firebase/firestore";

// 3. Internal: contexts & hooks
import { useAuth } from "@/contexts/AuthContext";
import { useAllUsers } from "@/hooks/useUsers";

// 4. Internal: Firebase utils
import { kpisRef, COLLECTIONS } from "@/lib/firebase/collections";

// 5. Internal: UI components
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// 6. Internal: domain components
import { KpiCard } from "@/components/kpi/KpiCard";

// 7. Internal: utils & types
import { formatNumber, calcWeightedScore } from "@/lib/utils";
import type { KPI, KpiAssignment } from "@/types";

// 8. External UI
import { Plus, Trash2 } from "lucide-react";
```

---

## Firestore Query Patterns

```typescript
// Selalu filter deletedAt == null untuk KPI aktif
query(kpisRef(), where("year", "==", year), where("month", "==", month), where("deletedAt", "==", null))

// Assignment aktif
query(kpiAssignmentsRef(), where("userId", "==", uid), where("status", "==", "active"))

// Update dengan timestamp
updateDoc(ref, { field: value, updatedAt: Timestamp.now() })

// Soft delete
updateDoc(ref, { deletedAt: Timestamp.now(), updatedAt: Timestamp.now() })
```

---

## Tailwind / Styling

- Gunakan `cn()` dari `@/lib/utils` untuk conditional classes
- Performance category colors sudah ada sebagai custom tokens:
  ```
  bg-excellent / text-excellent
  bg-good / text-good
  bg-warning / text-warning
  bg-critical / text-critical
  ```
- Design tokens via CSS variables (sudah di `globals.css`): `--primary`, `--background`, `--foreground`, dll.
- Dark mode: class-based (`dark:`)

### Pola Badge Tipe KPI (dipakai di banyak tempat)
```typescript
const typeColor: Record<string, string> = {
  result:   "text-blue-600 bg-blue-50",
  activity: "text-amber-600 bg-amber-50",
  quality:  "text-purple-600 bg-purple-50",
};
```

---

## Error Handling

- Form errors: state `error: string`, tampil di atas DialogFooter
- Async errors: try/catch, set error state, tidak throw ke luar komponen
- Loading: state `submitting` atau `isLoading`, disable tombol + teks "Menyimpan..."
- Firestore errors: catch di handler, tidak pakai error boundary

---

## Bahasa UI

- Label dan teks UI: **Bahasa Indonesia** (sesuai target pengguna)
- Kode, variable names, komentar teknis: **Bahasa Inggris**
- Error messages ke user: Bahasa Indonesia
- Contoh: `"Gagal menugaskan KPI. Coba lagi."`, `"Pilih minimal 1 karyawan."`
