---
title: "Cluster-admin Licences page: coverage rows show a timeline and badge only when expiring soon; no per-row status badge"
author: Thammanoon
date: 2026-10-27
branch: feature/cluster-admin-licenses-design-pass
cost: { minutes: 5, tokens: 70818 }
id: l-0fed1230
scope: repo
status: active
src: agent
touches:
  - src/i18n/en.ts
  - src/i18n/th.ts
  - src/pages/clusterAdmin/ClusterAdminLicenses.tsx
  - src/pages/clusterAdmin/licenses/CoverageCard.tsx
  - src/pages/clusterAdmin/licenses/InterfaceLicensesCard.tsx
  - src/pages/clusterAdmin/licenses/SeatsByBuTable.tsx
  - src/pages/clusterAdmin/licenses/SubscriptionsCard.tsx
---

## Decided
- CoverageCard (SubscriptionsCard + InterfaceLicensesCard) draws only in-force rows, so a per-row status badge always said "Active". It was removed (the `badge` field is gone from CoverageRowItem). The per-row LicenseTimeline and the "N days left" badge render only for rows inside the expiry threshold; those rows get a border-warning/40 bg-warning/5 tint. The header timeline still covers the whole card.
- Rows use `flex` with a shrink-0 tail, not `flex-wrap`. The old wrap pushed the bar and badge onto a second line only on rows with long text, so row heights were ragged.
- SeatsByBuTable: the share bar is each BU's seats divided by the sum of the loaded BUs' seats. It uses a neutral colour, because capacity status colour already lives on CapacityStrip. The slack width goes to the last column (`w-full` on Ends) so the BU name sits next to its number at 1440px.
- The page header drops the "· {code}" subtitle when the cluster code equals its name.

## Watch out
- The share bar is hidden whenever any BU's licences failed to load. A partial sum makes every bar too long, the same "unknown is not zero" rule as useClusterSeatLicenses.
- The "Licences" spelling on this page is deliberate (see the comments in en.ts). Do not "fix" it to match nav "Licenses" without asking.
- The expiring-soon row styling has not been seen on real data: ZEBRA on DEV has no licence inside the threshold.
