---
title: "Wide tables take spare width in their last column and stop wrapping only when the table box is wide, not by forcing every column to content width"
author: Thammanoon
date: 2026-11-24
branch: fix/customers-table-width
cost: { minutes: 17, tokens: 288342 }
id: l-02cad14b
scope: repo
status: active
src: agent
touches:
  - src/pages/CustomerManagement.tsx
  - src/utils/hugColumns.ts
  - src/pages/licenses/SubscriptionTable.tsx
  - src/pages/licenses/ClusterLicenseTable.tsx
---

## Decided
On /licenses (cluster, subscription, seat, BU quota, interface, storage tabs) the last data column takes all spare width (`w-full` on its header), and cells stop wrapping only when the box around the table is at least 1340px wide (container query). Below that they wrap as before. Values sat 200–300px apart at 1920+ before this.

## Tried and ruled out
- `w-px whitespace-nowrap` on every data column (what /users and /customers use): fine for narrow tables, but the license tables are already wider than their box at 1366. Forbidding names to wrap added 56–150px of sideways scroll and made the BU quota tab scroll when it had fitted.
- `w-full` on the last column alone: it squeezes every other column to its narrowest, so cluster/BU names and module chips wrapped one word per line even at 4K.

## Watch out
- The nowrap class does nothing without a `@container` ancestor, and nothing reports it. Each table's wrapper div around DataTable carries `@container`.
- Chips laid out with flex-wrap ignore white-space. The Modules column needs its own min-width at wide sizes.
- At 1366 with the sidebar expanded, subscription, seat and interface already scrolled sideways before this change. That is pre-existing, not a regression.

In the code: src/utils/hugColumns.ts (helper, threshold `@[1340px]` = widest nowrap license table ~1333px), applied in src/pages/licenses/{ClusterLicenseTable,PurchaseLicenseTable,SubscriptionTable,StorageLicenseTable}.tsx; Modules column meta `@[1340px]:min-w-[16rem]`.
