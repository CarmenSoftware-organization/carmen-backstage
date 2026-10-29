---
title: "Every licence end_date (subscription, seat, interface, cluster BU-quota) is an inclusive calendar day"
author: Thammanoon
date: 2026-10-29
branch: fix/subscription-scheduled-state
cost: { minutes: 7, tokens: 37154 }
id: l-b0326dfa
scope: repo
status: active
replaces: l-2e1b7897
src: agent
touches:
  - src/utils/buLicense.ts
---

## Decided
- Owner choice (2026-10-29): end_date counts the whole end day.
  - Dates are stored as `YYYY-MM-DDT00:00:00.000Z` (SubscriptionForm.tsx `fromYmd`).
  - A licence stops counting once `now >= end_date + 1 day`, which is 07:00 Bangkok the next day.
- Where the rule is applied:
  - Subscriptions: `deriveSubscriptionState` in packages/prisma-shared-schema-backstage. It also derives 'scheduled' when start_date is in the future. Scheduled grants nothing, and a BU with only scheduled contracts resolves to 'none'.
  - Seats: view `v_business_unit_seat` (migration 20261029090000, `now() < end_date + interval '1 day'`) and micro-cluster `seatStatusBuckets`.
  - Interface licences: micro-cluster `interfaceStatusWhere` / `stateOf` and the gateway license.service.ts `covers`.
  - Cluster BU-quota:
    - view `v_cluster_bu_cap` (migration 20261029091000)
    - micro-cluster `buQuotaStatusWhere`
    - `expiringSoonClusterIds` SQL
    - `isQuotaExpiringSoon` (`daysLeft > -1`)
  - FE: `buLicense.ts`, `clusterLicense.ts`, `buildAdvance.ts` (cut at now - 1 day), `IssuedSubscriptionPlate`.

## Tried and ruled out
- Keeping end_date exclusive and requiring renewals to start on the old end date. A usual renewal (old ends 31/12, new starts 1/1) left about 24h uncovered, and with enforcement on that blocked the BU's writes.

## Watch out
- Any new date-window check on a licence table must use the same `+ 1 day` / `now - 1 day` cut. A bare `end_date > now()` reintroduces the one-day gap.
- Interface-licence create has no main-contract check. `contractStates` only fills `in_force` / `contract_state` in the response.
