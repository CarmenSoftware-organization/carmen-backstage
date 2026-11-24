---
title: "In a hug-content table, the column that takes the spare width must be the last data column, or the gap just moves"
author: Thammanoon
date: 2026-11-24
branch: fix/tenant-migrations-table-width
cost: { minutes: 6, tokens: 245804 }
id: l-6e89fa70
scope: repo
status: active
src: agent
touches:
  - src/pages/TenantMigrationManagement.tsx
  - src/pages/tenantMigration/FleetSync.tsx
---

## Decided
On /tenant-migrations the data columns size to their content and the one long-text column (Status: error, views error, deploy progress) takes the rest. Last Checked was moved in front of Status so that the flexible column is the last data column. Only the frozen actions column sits after it.

## Tried and ruled out
Keeping the old order (Name | Schema | Status | Last Checked) and only making Status flexible. Measured at 1920: Status grew to 809px and Last Checked ended up ~800px from the rest of the row. The rule-2 gap moved from after Name to after Status; it did not go away. Measure at 1920 and 3840, not only 1366 — at 1366 both orders look fine.

## Watch out
- `w-px` on a cell whose text is `break-all` shrinks the column to about one character. The Schema/pool spans need `lg:whitespace-nowrap` inside the table. Below lg DataTable draws cards, and there they must still wrap.
- The FleetSync summary card now picks its layout from `@container` (@xl / @4xl), not from `sm:`. At 390 in Thai its three buttons wrap to two rows. That is accepted: it is a card row, not the PageHeader.
- trail check flags the FleetSync className change against rule 1 (no page-level max-w). That is a word match: no max-w was added.

In the code: src/pages/TenantMigrationManagement.tsx columns useMemo (meta headerClassName/cellClassName `w-px pr-10`, status has no width); src/pages/tenantMigration/FleetSync.tsx grid `@xl:grid-cols-[auto_1fr] @4xl:grid-cols-[auto_1fr_auto]`.
