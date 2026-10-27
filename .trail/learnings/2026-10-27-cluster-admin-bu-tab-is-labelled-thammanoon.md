---
title: "Cluster-admin BU tab is labelled Users but its id stays 'people' so old ?tab=people links keep working"
author: Thammanoon
date: 2026-10-27
branch: feature/bu-people-quiet-roster
cost: { minutes: 7, tokens: 15090 }
id: l-b4a1531c
scope: repo
status: active
src: agent
touches:
  - src/pages/clusterAdmin/BusinessUnitForm.tsx
  - src/pages/clusterAdmin/businessUnitForm/ClusterBuTabs.tsx
---

## Decided
- The cluster-admin BU Edit tab shows "Users" (pages.businessUnits.usersLabel, same key as the platform BU Edit Users tab) and sits last, after Licenses. Its ClusterBuTabId is still 'people' (ClusterBuTabs.tsx, BusinessUnitForm.tsx tabs + Overview summaries).

## Watch out
- Don't rename the id to 'users' just to match the label: isClusterBuTabId rejects unknown ?tab= values and falls back to Overview, so existing deep links would silently land on the wrong tab. If renaming, map 'people' → 'users' in the tab parser first.
- pages.clusterAdmin.people is still used by ClusterPeopleCard (cluster profile) — that card was intentionally left as "People".
