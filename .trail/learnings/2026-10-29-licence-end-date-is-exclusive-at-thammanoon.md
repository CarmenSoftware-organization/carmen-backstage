---
title: "Licence end_date is exclusive at 00:00Z, so a renewal starting the day after the old end leaves a one-day expired gap"
author: Thammanoon
date: 2026-10-29
branch: fix/subscription-scheduled-state
cost: { minutes: 14, tokens: 83991 }
id: l-68a52f14
scope: repo
status: active
src: agent
touches:
  - src/pages/clusterAdmin/businessUnitForm/BuSubscriptionsCard.tsx
  - src/pages/licenses/SubscriptionTable.test.tsx
  - src/pages/licenses/SubscriptionTable.tsx
  - src/pages/licenses/sections/SubscriptionSection.tsx
  - src/pages/licenses/subscriptionEdit/IssuedSubscriptionPlate.tsx
  - src/pages/licenses/subscriptionManagement/buildAdvance.test.ts
  - src/pages/licenses/subscriptionManagement/buildAdvance.ts
  - src/types/index.ts
---

## Decided
- Subscription state now honours start_date (`deriveSubscriptionState` in packages/prisma-shared-schema-backstage takes startDate; a future start derives 'scheduled', which grants nothing). The gateway resolver skips scheduled rows, so a BU with only scheduled contracts resolves to 'none'.

## Watch out
- Dates are stored as calendar days at `YYYY-MM-DDT00:00:00.000Z` (SubscriptionForm.tsx `fromYmd`). Backend rules treat `end_date < now` as expired, and the seat pool uses `now() BETWEEN start_date AND end_date`. Either way the named end day is NOT covered after 00:00Z (07:00 Bangkok).
- A renewal written the usual way (old ends 31/12, new starts 1/1) is therefore uncovered for about 24h. When licence enforcement is on, the BU can't write during that window. Before start_date was honoured, early activation of the renewal hid this.
- The FE plate `IssuedLicensePlate.tsx` adds a day (`end + DAY_MS`) for display, so the screen can say "still valid" while the backend already says expired.
- Interface-licence create has no main-contract check. `contractStates` only fills `in_force` / `contract_state` in the response.
