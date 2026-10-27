---
title: "Cluster-admin BU tab ids are read through parseClusterBuTab, which maps renamed ids so bookmarks survive"
author: Thammanoon
date: 2026-10-27
branch: feature/bu-people-quiet-roster
cost: { minutes: 1, tokens: 1640 }
id: l-0c0a2876
scope: repo
status: active
replaces: l-b4a1531c
src: agent
---

## Decided
- The cluster-admin BU Edit "Users" tab (label pages.businessUnits.usersLabel, same key as the platform BU Edit Users tab) has ClusterBuTabId 'users' and sits last. It was 'people'.
- Renamed tab ids go in LEGACY_CLUSTER_BU_TAB_IDS (ClusterBuTabs.tsx); parseClusterBuTab maps them before validating, and BusinessUnitForm rewrites the URL to the current id with replace, because shared links and bookmarks carry the old id.

## Watch out
- Read ?tab= through parseClusterBuTab, never isClusterBuTabId directly: the latter rejects unknown values and the page falls back to Overview with no error, so a renamed tab's old links would quietly land on the wrong tab.
- pages.clusterAdmin.people is still used by ClusterPeopleCard (cluster profile), intentionally left as "People".
