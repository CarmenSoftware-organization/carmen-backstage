---
title: "Licence dates are calendar days at 00:00Z; subscription end_date is inclusive, seat and interface end_date are not"
author: Thammanoon
date: 2026-10-29
branch: fix/subscription-scheduled-state
cost: { minutes: 4, tokens: 25511 }
id: l-1ee97918
scope: repo
status: active
replaces: l-68a52f14
src: agent
---

## Decided
- Owner choice (2026-10-29): a subscription's end_date is inclusive. `deriveSubscriptionState` (packages/prisma-shared-schema-backstage) treats a contract as expired only when `now >= end_date + 1 day`. A future start_date derives 'scheduled', which grants nothing. The gateway resolver skips scheduled rows, so a BU with only scheduled contracts resolves to 'none'.
- The FE filter `buildAdvance.ts` mirrors the backend rule with a cut at `now - 1 day`. `IssuedSubscriptionPlate` counts days left to the end of the end day.

## Tried and ruled out
- Keeping end_date exclusive and asking for renewals to start on the old end date. Rejected because the usual renewal (old ends 31/12, new starts 1/1) left about 24h uncovered. With licence enforcement on, that blocks the BU's writes.

## Watch out
- Dates are stored as `YYYY-MM-DDT00:00:00.000Z` (SubscriptionForm.tsx `fromYmd`).
- The seat pool (`now() BETWEEN start_date AND end_date` in the seat views) and interface licences (gateway license.service.ts `covers`) still end at 00:00Z of the end day. A seat or interface renewal that starts the day after the old end still has the one-day gap.
- Interface-licence create has no main-contract check. `contractStates` only fills `in_force` / `contract_state` in the response.
