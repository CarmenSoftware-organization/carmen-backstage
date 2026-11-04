---
title: "Subscription rows show License Module chips, not a feature count — cluster-admin card and Cluster Edit card alike"
author: Thammanoon
date: 2026-11-04
branch: feature/cluster-subscription-modules
cost: { minutes: 2, tokens: 182081 }
id: l-34cb6a1e
scope: repo
status: active
replaces: l-28360f47
src: agent
touches:
  - src/i18n/en.ts
  - src/i18n/th.ts
  - src/pages/TenantMigrationManagement.tsx
  - src/pages/clusterAdmin/licenses/SubscriptionsCard.tsx
  - src/pages/clusterEdit/sections/SubscriptionCard.tsx
---

## Decided
User choice (2026-10-28, extended 2026-11-04): subscription rows show every module code (`sub.groups`) as outline mono chips with the full name in `title`, never "xx features" — the modules are what the customer bought.
- `src/pages/clusterAdmin/licenses/SubscriptionsCard.tsx` (cluster-admin Licences page): chips under the date range; all wrap, no +N cap.
- `src/pages/clusterEdit/sections/SubscriptionCard.tsx` (platform /clusters/:id/edit Licensing tab): summary line is `Expires {date} · used/cap seats`, chips on the next line. `pages.clusters.subscriptionSummaryPlural` was removed; `subscriptionSummary` no longer takes `count`.

## Watch out
`groups` is optional. A missing field means the backend doesn't send it yet (not "no modules"), so both cards fall back to `pages.licenseFeatureGroups.featuresOnly`. An empty array shows no chips and no count.
