---
title: "Dashboard reports domains that failed to load instead of dropping them, and hides the estate total until every count loads"
author: Thammanoon
date: 2026-11-23
branch: fix/dashboard-partial-failure
cost: { minutes: 13, tokens: 378994 }
id: l-78f3c8d5
scope: repo
status: active
src: agent
touches:
  - PRODUCT.md
  - src/pages/dashboard/ActivityStream.tsx
  - src/pages/dashboard/activity.ts
---

## Decided
- The Dashboard activity stream and counts rail treat a failed domain as "unknown", never as "empty" or "zero". The stream shows a warning banner that names the failed domains, with a retry button, and the chip shows a warning icon in place of a count. In the rail only the failed row shows "unavailable", and the "records governed" total shows "-" until every domain loads, because a partial sum would pass for the whole estate.
- If every domain fails, the fetch throws, so the existing full error state shows.

## Tried and ruled out
- Leaving `Promise.allSettled` with a silent skip. allSettled never rejects, so the stream's error state could never render, and a total outage showed "Nothing changed here yet".

## Watch out
- A test that fails one service's `getAll` now gets two alerts, one from the rail and one from the stream. Use `findAllByRole('alert')`.
- Any new aggregate built on allSettled needs the same split: report the partial failure, and throw when everything fails.

In the code: `src/pages/dashboard/activity.ts` `fetchActivity` → `{ items, failedDomains }`; `DomainCount.failed` in `CountsRail.tsx`; `countsError` is derived in `Dashboard.tsx` (all failed) rather than kept in state; i18n keys `pages.dashboard.activityPartial`, `estatePartial`, `domainUnavailable`.
