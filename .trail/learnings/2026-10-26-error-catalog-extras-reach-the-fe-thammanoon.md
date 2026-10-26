---
title: Error-catalog extras reach the FE only as details (4th arg of errorFromCatalog); data is dropped by the microservice envelope
author: Thammanoon
date: 2026-10-26
branch: main
cost: { minutes: 69, tokens: 220830 }
id: l-24a32965
scope: repo
status: active
src: agent
touches:
  - src/components/clusterSeat/SeatOverQuotaBanner.tsx
  - src/components/clusterSeat/useSeatActions.ts
  - src/i18n/en.ts
  - src/i18n/th.ts
  - src/pages/clusterAdmin/ClusterUsers.tsx
  - src/pages/clusterAdmin/MembersTable.tsx
  - src/pages/clusterEdit/sections/UsersSection.tsx
  - src/pages/clusterEdit/sections/UsersSection.test.tsx
  - src/pages/ClusterEdit.tsx
  - src/components/clusterSeat/SeatActions.tsx
---

## Decided
- micro-cluster TryCatch now passes SEAT_LIMIT_REACHED {used, cap, adding} as both `data` and `details` (backend 9f193c9). The FE reads them from the gateway body's `data` field (StdResponse.error puts `details` there) in src/components/clusterSeat/useSeatActions.ts.

## Watch out
- `Result.errorFromCatalog(entry, params?, data, details?)`: buildErrorResponse in packages/nest-result base-microservice-controller.ts forwards only `details`. Anything passed as `data` silently never reaches the gateway — the seat-limit counts were lost this way since 2026-08 (also on invitation accept).
- A 403 SEAT_LIMIT_REACHED passes through src/services/api.ts untouched (no logout); a 401 from AppIdGuard (missing app-id allow-list key) does log the user out.
