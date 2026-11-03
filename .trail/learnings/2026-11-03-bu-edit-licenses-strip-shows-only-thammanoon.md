---
title: "BU Edit Licenses strip shows only what needs attention; a cell's big number and its meter must measure the same quantity"
author: Thammanoon
date: 2026-11-03
branch: main
cost: { minutes: 7, tokens: 63430 }
id: l-85f2c9a5
scope: repo
status: active
src: agent
touches:
  - src/i18n/en.ts
  - src/i18n/th.ts
  - src/pages/ClusterEdit.test.tsx
  - src/pages/businessUnitEdit/BusinessUnitDocument.test.tsx
  - src/pages/businessUnitEdit/BusinessUnitLicensesCard.test.tsx
  - src/pages/businessUnitEdit/LicenseSummaryStrip.tsx
  - src/pages/clusterAdmin/businessUnitForm/StorageMeter.tsx
  - src/utils/storageQuota.ts
  - src/pages/businessUnitEdit/BusinessUnitLicensesCard.tsx
  - src/pages/businessUnitEdit/SubscriptionRows.tsx
---

## Decided
- User picked option A (2026-11-03, PR #441): `src/pages/businessUnitEdit/LicenseSummaryStrip.tsx` shows status/attention only (pool fullness, next expiry, quota state). Byte counts, licence numbers and start dates live in the cards below and must not be echoed back into the strip.
- When `clusterSeat` exists, the Seats cell's big number is the pool `used/cap`, matching its meter. The BU's own seat count is the secondary line ("This BU: N seats"). Before this, "10 seats" (BU) sat on top of an 8/10 bar (cluster pool), which read as "this BU used 80%".
- Storage cell: `fmtPct` + fullest kind name as the unit + Within quota / Nearly full (≥80) / Over quota (≥100) / Blocking.
- `meterWidth()` in `src/utils/storageQuota.ts` gives any value >0 a 2px minimum. `fmtPct()` shows `<0.1%` so the number never says 0.0% next to a visible sliver. Use both for every new usage bar.
- Platform BU Edit subscription rows now show licence-module chips instead of "N features" (`showGroups` + `showFeatureCount={false}`), the same as cluster-admin.

## Tried and ruled out
- B (hide the strip when every card fits in the first viewport): the layout changes with the licence count, so the page becomes unpredictable.
- C (keep the strip, strip the cards' facts lines): leaves card headers with only a title.

## Watch out
- `SubscriptionRows` with `showGroups` falls back to the feature count for a row whose `groups` is undefined (old backend), even when `showFeatureCount` is false. Undefined ≠ "no modules".
- `common.action.manageLicences` is now US "Manage licenses" and is shared with ClusterEdit and cluster-admin LicenseTypeTabs. About 40 other en.ts strings still say "licence" (storage licence, BU quota licences). That inconsistency is known and out of scope.
- Module chips here show `g.name` (code in title), while cluster-admin SubscriptionsCard shows `g.code` (name in title). Not yet reconciled.
