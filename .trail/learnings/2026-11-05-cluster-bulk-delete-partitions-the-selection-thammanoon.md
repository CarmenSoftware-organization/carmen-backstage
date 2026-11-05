---
title: "Cluster bulk delete partitions the selection before firing: clusters with BUs or already deleted are skipped and listed in the confirm dialog"
author: Thammanoon
date: 2026-11-05
branch: feature/cluster-bulk-delete
cost: { minutes: 5, tokens: 256501 }
id: l-6b44d58a
scope: repo
status: active
src: agent
touches:
  - src/pages/clusterManagement/BulkDeleteClustersDialog.tsx
---

## Decided
- /clusters bulk delete (`src/pages/clusterManagement/BulkDeleteClustersDialog.tsx`, `planBulkDelete`) applies the same guard as the single-row delete in `ClusterManagement.tsx` `handleDelete`: a cluster with `bu_count > 0` is not sent (backend does not cascade to BUs, they would be orphaned), nor is one with `deleted_at` (show-deleted toggle on). They are listed under "will be skipped" with the reason, and the confirm button is disabled when nothing is deletable. Chosen over firing everything and letting failures show up in the toast.
- `ConfirmDialog` takes a string description only and `components/ui/` must not change, so the bulk dialog is its own component built on the Dialog primitives.

## Watch out
- Selection checkboxes are gated on the global `hasPermission('cluster.delete')`; the row menu uses the cluster-scoped check. A caller with cluster-scoped rights only would see failures in the "M failed" toast rather than missing checkboxes.
- Enabling selection adds a frozen column: `stickyLeftColumns` goes 2→3 and the TableSkeleton column count +1 — the fit-content test in ClusterManagement.test.tsx asserts this.
- The selection bar is inserted above the table, so rows shift down one line on the first tick (same as UserManagement); not fixed.
