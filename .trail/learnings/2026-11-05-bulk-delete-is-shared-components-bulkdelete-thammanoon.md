---
title: "Bulk delete is shared (components/bulkDelete/): each page partitions its selection into deletable/skipped before firing"
author: Thammanoon
date: 2026-11-05
branch: feature/bu-bulk-delete
cost: { minutes: 4, tokens: 40681 }
id: l-ca720a55
scope: repo
status: active
replaces: l-6b44d58a
src: agent
touches:
  - src/i18n/en.ts
  - src/i18n/th.ts
  - src/pages/ClusterManagement.test.tsx
  - src/pages/ClusterManagement.tsx
---

## Decided
- Bulk delete lives in `src/components/bulkDelete/`: `BulkDeleteDialog` (lists to-delete and skipped-with-reason; confirm disabled when nothing is deletable), `BulkSelectionBar`, `usePageSelection(resultKey)` and `summarizeBulkDelete`. Used by `ClusterManagement.tsx` and `BusinessUnitManagement.tsx`. Shared strings are `common.bulk.*`; title/description/toast strings stay per page.
- Each page builds its own `BulkDeletePlan` with the same rule as its single-row delete. Clusters skip `bu_count > 0` (backend does not cascade, BUs would be orphaned) and `deleted_at`; BUs skip only `deleted_at` — the single-row BU delete has no client guard, so backend refusals land in the "failed" toast.
- `ConfirmDialog` takes a string description only and `components/ui/` must not change, hence a separate dialog on the Dialog primitives.

## Watch out
- Checkboxes are gated on the global `hasPermission('cluster.delete')` (BU delete also uses `cluster.delete`); the row menus use the cluster-scoped check. A caller with cluster-scoped rights only sees failures in the toast, not missing checkboxes.
- `usePageSelection` must get a key that changes with page/perpage/search/sort/advance, or TanStack keeps off-page rows selected and deletable.
- Enabling selection adds a frozen column: `stickyLeftColumns` 2→3 and TableSkeleton +1; the fit-content tests in both page test files assert this.
- The selection bar is inserted above the table, so rows shift down one line on the first tick (same as UserManagement); not fixed.
