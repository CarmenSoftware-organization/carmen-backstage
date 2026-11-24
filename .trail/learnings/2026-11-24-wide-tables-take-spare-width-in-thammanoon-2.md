---
title: "Wide tables take spare width in their last column and stop wrapping above a per-table width, not by forcing every column to content width"
author: Thammanoon
date: 2026-11-24
branch: fix/license-intakes-table-width
cost: { minutes: 5, tokens: 34421 }
id: l-eb0b583c
scope: repo
status: active
replaces: l-02cad14b
src: agent
touches:
  - src/pages/licenseCatalog/FeatureCatalogPanel.tsx
  - src/pages/licenseFeatures/ModuleShelf.tsx
  - src/utils/hugColumns.ts
  - src/pages/LicenseIntakeManagement.tsx
---

## Decided
Wide list tables (every /licenses tab, /license-intakes) let the last data column take all spare width (`w-full` on its header). The other cells stop wrapping only once the box around the table is wider than that table's measured no-wrap width (a container query). Below that width they wrap as before. Each table sets its own threshold, because one shared value does not fit every table:
- /licenses keeps the default `@[1340px]` (its widest no-wrap table is ~1333px).
- /license-intakes uses `@5xl` (1024px; no-wrap width ~991px). With 1340 its rows wrapped at 1366 while Received still had 200–460px free; with `@4xl` (896) it overflowed 41px at 1280.

## Tried and ruled out
- `w-px whitespace-nowrap` on every data column, unconditionally (what /users and /customers use): fine for narrow tables, but the license tables are already wider than their box at 1366. Forbidding wraps added 56–150px of sideways scroll, and the BU quota tab went from fitting to scrolling.
- `w-full` on the last column alone: it squeezes every other column to its narrowest, so names and module chips wrapped one word per line even at 4K.
- One shared threshold for every table: see the intake numbers above.

## Watch out
- The nowrap class does nothing without a `@container` ancestor, and nothing reports it. Each table's wrapper div around DataTable carries `@container`.
- The threshold class must be written out literally in the caller's file. Tailwind only generates classes it finds in source.
- Chips laid out with flex-wrap ignore white-space. Give chip columns a min-width that applies only when the box is wide.
- At 1366 with the sidebar expanded, /licenses subscription, seat and interface already scrolled sideways before this work. That is pre-existing.
- trail check flags hugColumns.ts for "whitespace nowrap" because its doc comment names the ruled-out approach. The code there is container-gated, not the ruled-out unconditional form.

In the code: src/utils/hugColumns.ts (`hugColumns(columns, { nowrapClass })`), callers in src/pages/licenses/{ClusterLicenseTable,PurchaseLicenseTable,SubscriptionTable,StorageLicenseTable}.tsx and src/pages/LicenseIntakeManagement.tsx (`'@5xl:whitespace-nowrap'`, `mobileBreakpoint="(min-width: 1280px)"`).
