---
title: "Licence end_date is an inclusive calendar day for subscriptions, seats and interface licences; cluster BU-quota is still exclusive"
author: Thammanoon
date: 2026-10-29
branch: fix/subscription-scheduled-state
cost: { minutes: 3, tokens: 27121 }
id: l-2e1b7897
scope: repo
status: active
replaces: l-1ee97918
src: agent
touches:
  - src/pages/licenses/SubscriptionTable.test.tsx
  - src/pages/licenses/subscriptionEdit/IssuedSubscriptionPlate.tsx
  - src/pages/licenses/subscriptionManagement/buildAdvance.test.ts
  - src/pages/licenses/subscriptionManagement/buildAdvance.ts
---

## Decided
- Owner choice (2026-10-29): end_date counts the whole end day.
  - Dates are stored as `YYYY-MM-DDT00:00:00.000Z` (SubscriptionForm.tsx `fromYmd`).
  - A licence stops counting once `now >= end_date + 1 day`, which is 07:00 Bangkok the next day.
- Where the rule is applied:
  - Subscriptions: `deriveSubscriptionState` in packages/prisma-shared-schema-backstage. It also derives 'scheduled' when start_date is in the future; scheduled grants nothing, and a BU with only scheduled contracts resolves to 'none'.
  - Seats: view `v_business_unit_seat`, migration 20261029090000_seat_end_date_inclusive, `now() < end_date + interval '1 day'`; micro-cluster `seatStatusBuckets`.
  - Interface licences: micro-cluster `interfaceStatusWhere` / `stateOf`, and gateway license.service.ts `covers`.
  - FE: `buLicense.ts` `licenseStatus`, `buildAdvance.ts` (cut at now - 1 day), `IssuedSubscriptionPlate` days left.

## Tried and ruled out
- Keeping end_date exclusive and requiring renewals to start on the old end date. The usual renewal (old ends 31/12, new starts 1/1) then had about 24h uncovered. With enforcement on, the BU could not write during that window.

## Watch out
- Cluster BU-quota licences (`cluster-license.service.ts` `inWindow`, view `v_cluster_bu_cap`) still use `end_date > now`. They were not changed in this round.
- Interface-licence create has no main-contract check. `contractStates` only fills `in_force` / `contract_state` in the response.
