---
title: "Cluster-admin Subscriptions card shows License Module chips per contract, not a feature count"
author: Thammanoon
date: 2026-10-27
branch: main
cost: { minutes: 1, tokens: 14793 }
id: l-28360f47
scope: repo
status: active
src: agent
touches:
  - src/pages/clusterAdmin/licenses/SubscriptionsCard.tsx
---

## Decided
User choice (2026-10-28): rows in SubscriptionsCard (`src/pages/clusterAdmin/licenses/SubscriptionsCard.tsx`) show every module code (`sub.groups`) as outline chips under the date range, with the full name in `title`. They no longer show "xx features", because the modules are what the customer bought. All chips wrap; there is no +N cap like SubscriptionTable has, because the card has room and you can't hover on mobile.

## Watch out
`groups` is optional. A missing field means the backend doesn't send it yet (not that there are no modules), so the card falls back to showing the feature count. An empty array shows only the date range. Rows with many modules are taller than other rows, which the user accepted.
