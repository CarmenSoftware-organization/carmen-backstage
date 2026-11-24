---
title: "Table headers never wrap unless the column asks for whitespace-normal, and fixed column widths on the module catalog were what starved the name column"
author: Thammanoon
date: 2026-11-24
branch: fix/license-modules-table-width
cost: { minutes: 8, tokens: 62892 }
id: l-4be543bf
scope: repo
status: active
src: agent
touches:
  - src/pages/licenses/ClusterLicenseTable.tsx
  - src/pages/licenses/PurchaseLicenseTable.tsx
  - src/pages/licenses/StorageLicenseTable.tsx
  - src/pages/licenses/SubscriptionTable.tsx
  - src/utils/hugColumns.ts
  - src/pages/licenseCatalog/GroupCatalogPanel.tsx
  - src/components/ui/table.tsx
---

## Decided
On the license module catalog the short columns (sort order, code, contracts) size to their content and Status, the last data column, takes the spare width. The name column sits in a 12–16rem frame and the description is truncated with a title. The features column keeps a fixed width (now w-44) because every row's bar must share one scale. Below 1340px the table shows as cards, the same value /clusters uses.

## Tried and ruled out
- Leaving the fixed widths (w-24 / w-48 / w-44) on sort order, code and contracts: they took more than their content, so at 1366 the name column fell to 122px with 103px rows, and at 1920 it stretched to 676px.
- Keeping the Interface badge on the same line as the code: it made the code column 221px and the table overflowed 48px at 1366.

## Watch out
- The shared table header style already sets `whitespace-nowrap` on every header. Dropping nowrap from a column's headerClassName changes nothing. A header that should wrap ("Sort order") needs `whitespace-normal`.

In the code: src/pages/licenseCatalog/GroupCatalogPanel.tsx (column meta, `mobileBreakpoint="(min-width: 1340px)"`, search `sm:max-w-sm` + actions `sm:ml-auto`); base th classes in src/components/ui/table.tsx.
