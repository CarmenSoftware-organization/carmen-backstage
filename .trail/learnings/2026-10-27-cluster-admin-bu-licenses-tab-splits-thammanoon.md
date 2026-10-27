---
title: "Cluster-admin BU Licenses tab splits license types as sub-tabs under ?license=, not as top-level tabs"
author: Thammanoon
date: 2026-10-27
branch: feature/cluster-bu-license-subtabs
cost: { minutes: 5, tokens: 223417 }
id: l-ce468440
scope: repo
status: active
src: agent
touches:
  - src/pages/clusterAdmin/businessUnitForm/LicenseTypeTabs.tsx
---

## Decided
- The cluster-admin BU Edit Licenses tab shows one sub-tab per license type (User Licenses | Interface licenses) via `src/pages/clusterAdmin/businessUnitForm/LicenseTypeTabs.tsx`, a nested `TabStrip`. User picked this on 2026-10-27.
- The sub-tab is held in `?license=` (`interface`; the first tab `user` is never written), so the plain `?tab=licenses` deep links from `/cluster-admin/:id/licenses` keep opening the first type.
- `handleTabChange` in `clusterAdmin/BusinessUnitForm.tsx` deletes `license` whenever the main tab leaves `licenses`.

## Tried and ruled out
- Separate top-level tabs (User licenses / Interface licenses beside Hotel/Company): the strip would grow to 7 triggers, and every `?tab=licenses` link would need a mapping in `parseClusterBuTab`.
- Grouping a subscription's features by feature group: a bigger job, and it may need feature data the page does not load yet.

## Watch out
- Panels use `hidden`, not unmount. Both cards render from ledgers the parent page already loaded.
- The cards still draw their own h3 title, which repeats the sub-tab label. They are shared with the platform BU page, so hiding the title only here needs a new prop.
