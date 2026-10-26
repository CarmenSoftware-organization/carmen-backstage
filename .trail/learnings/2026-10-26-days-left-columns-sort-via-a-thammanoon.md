---
title: Days Left columns sort via a FE-only id that handleSortChange rewrites to the date key on the wire
author: Thammanoon
date: 2026-10-26
branch: feature/purchase-license-days-left
cost: { minutes: 11, tokens: 72872 }
id: l-20f38560
scope: repo
status: active
src: agent
touches:
  - src/pages/licenses/PurchaseLicenseTable.tsx
  - src/i18n/en.ts
  - src/i18n/th.ts
  - src/pages/licenses/ClusterLicenseTable.tsx
  - src/pages/licenses/SubscriptionTable.tsx
  - src/pages/licenses/SubscriptionTable.test.tsx
  - src/types/index.ts
---

## Decided
- Every /licenses tab has a Days Left column (SubscriptionTable, ClusterLicenseTable, PurchaseLicenseTable for seat/bu-quota/interface). Column id is `days_left`; each table's handleSortChange rewrites `days_left:` to `end_date` (subscription, purchase tables) or `bu_cap_end_date` (cluster table) before it is sent. DataTable sends the column id as the sort key, and two columns cannot share the id `end_date`.
- The warning colour uses the same threshold as that tab's existing expiring-soon badge (subscription_days / bu_quota_days / seat_days / interface_days). Never add a separate threshold.

## Watch out
- Do not add `days_left` to backend sort keys. The ordering is the same as the date column, so the wire rewrite is the whole contract.
- In PurchaseLicenseTable, FleetLicenseRow.end_date is already a display string (fmtDate output, or the "No expiry" label). Count days from `end_iso` instead.
