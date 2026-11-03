---
title: "BU Edit Licenses tab cards share LicenseSectionHeader; group timeline only when >1 licence; storage settings live in a details disclosure"
author: Thammanoon
date: 2026-11-03
branch: feature/bu-licenses-tab-ledger
cost: { minutes: 5, tokens: 80898 }
id: l-56db740a
scope: repo
status: active
src: agent
touches:
  - src/i18n/en.ts
  - src/i18n/th.ts
  - src/pages/businessUnitEdit/BusinessUnitInterfaceLicensesCard.tsx
  - src/pages/businessUnitEdit/BusinessUnitLicensesCard.tsx
  - src/pages/businessUnitEdit/LicenseSectionHeader.tsx
  - src/pages/clusterAdmin/businessUnitForm/BuStorageQuotaCard.tsx
  - src/pages/clusterAdmin/businessUnitForm/StorageMeter.tsx
---

## Decided
- All three cards on the platform BU Edit Licenses tab (BusinessUnitLicensesCard, BusinessUnitInterfaceLicensesCard, BuStorageQuotaCard) render their header via `src/pages/businessUnitEdit/LicenseSectionHeader.tsx`: title text-sm, one facts line text-xs, actions right. At most one solid button per card = the create action (New subscription / Add interface / Issue storage licence); everything else outline.
- The header-level `LicenseTimeline variant="group"` renders only when the card has MORE than one licence: with one it is pixel-identical to the row bar.
- An empty interface card renders header only; the empty message is the facts line.
- BuStorageQuotaCard: Exempt, Internal note, Reclaim + job status sit in a native `<details>` "Enforcement & maintenance" (keyboard/screen reader for free, no new ui primitive). Summary row carries Exempt / reclaim-status badges so the collapsed state still tells the truth; `apply()` force-opens it when the saved quota has exempt or a note (open-only, never closes on save).
- Measured time is shown once in the header (relative, full date in title) when every kind shares `measured_at`; StorageMeter `showMeasuredAt` re-enables the per-meter line when they differ.

## Watch out
- The cluster-admin BU form cards (`clusterAdmin/businessUnitForm/BuSubscriptionsCard.tsx`, `BuInterfaceLicensesCard.tsx`) still hand-roll their own headers and the always-on group timeline; they were out of scope for PR #439. Converge them on LicenseSectionHeader rather than re-inventing a third grammar.
- No `shrink-0` on the header action row: Thai labels are longer and the buttons get clipped silently inside the Card's overflow-hidden.
