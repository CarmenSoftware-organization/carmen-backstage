---
title: "Staff-only cluster data must gate on backstage RBAC, never readableClusterScope or the generic activity-logs"
author: Thammanoon
date: 2026-10-26
branch: feature/cluster-notes
cost: { minutes: 19, tokens: 173490 }
id: l-64e93ced
scope: repo
status: active
src: agent
touches:
  - docs/superpowers/plans/2026-10-26-cluster-notes.md
  - docs/superpowers/specs/2026-10-26-cluster-notes-design.md
  - ".superpowers/brainstorm/47153-1792985325/content/notes-tab-layout.html"
  - ".superpowers/brainstorm/47153-1792985325/content/waiting.html"
  - ".superpowers/brainstorm/47153-1792985325/content/waiting-2.html"
  - ".superpowers/sdd/2026-10-26-cluster-notes/progress.md"
  - ".superpowers/sdd/2026-10-26-cluster-notes/implementer-rules.md"
---

## Decided
- Cluster Notes (spec docs/superpowers/specs/2026-10-26-cluster-notes-design.md) gate every route with BackstagePermissionGuard + @RequireBackstagePermission('cluster_note.*') plus a per-route resolveAllowedClusterIds check on :clusterId. The guard is coarse (passes if the key is held in ANY cluster), so the per-cluster check is required.
- Note history is served by the notes module itself (cluster-notes.history), and the generic activity-logs record/:id and :id/detail refuse entity_type cluster_note for everyone.
- Removed attachments stay in the note's JSONB with removed_at, so /url can verify token ownership inside micro-cluster.

## Tried and ruled out
- Verifying file ownership via micro-file tags (reference_type/reference_id): files.info does not return tags, so it would need a change in a third repo.
- Reusing activity-logs for note history: /:activity_log_id/detail exposes full old text to anyone holding activity_log.detail, and its ownership fallback ('backstage' kind) still admits backstage-wide grants.

## Watch out
- ClusterAdminAuthzService.readableClusterScope() admits membership cluster admins (customers). Use it only for data customers may see.
- CLUSTER_OWNED keys in entity-ownership.ts have no tb_ prefix.
