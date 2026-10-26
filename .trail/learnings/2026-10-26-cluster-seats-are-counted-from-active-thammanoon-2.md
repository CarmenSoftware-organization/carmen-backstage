---
title: "Cluster seats are counted from active BU links, not tb_cluster_user; deactivating a cluster member frees nothing"
author: Thammanoon
date: 2026-10-26
branch: feature/cluster-seat-management
cost: { minutes: 3, tokens: 49942 }
id: l-625928ba
scope: repo
status: active
replaces: l-756ba17e
src: agent
touches:
  - docs/superpowers/specs/2026-10-26-cluster-seat-management-design.md
---

## Decided
- Seat holder = distinct user with an active, non-deleted link (tb_user_tb_business_unit) to an active BU of the cluster, account active. Single SQL source: clusterHeadsSubquery() in micro-cluster/src/cluster/common/seat.helper.ts. Backend sends it as users_count on GET /api-system/clusters/:id.
- No cap value means "unlimited": total_max_license_users 0/null = 0 seats (user decision 2026-10-26). Spec: docs/superpowers/specs/2026-10-26-cluster-seat-management-design.md.

## Watch out
- ClusterEdit.tsx Users tab counted users.clusterUsers.length (tb_cluster_user) and treated cap 0/null as uncapped; both disagree with the gateway's evaluateSeat.
- BU-link create/update (business-unit.service.ts userBusinessUnitCreate/Update) DO call assertSeatAvailable. An earlier version of this note said they did not — that came from a grep clipped by `head`; list every call site with `grep -rn "assertSeatAvailable(" apps` before claiming a gap.
- The only route that can free a seat while a cluster is over quota is PATCH api-system/user/business-units/:id. It escapes the seat gate only because license-route-resolver regex matches literal ^/api/. Widening that regex silently removes the escape route.
