---
title: Cluster-admin layout split
author: Thammanoon
date: 2026-11-09
id: l-3ccdb0a1
scope: repo
status: active
touches:
  - "src/context/AuthContext.tsx#AuthProvider.hasPermission"
---

## Decided
Split the single 16-item admin nav into a focused `/cluster-admin/:clusterId/*` route-space.
**BOTH SIDES MERGED TO MAIN 2026-08-05** — BE PR #303 (`ca9464b1b`), FE PR #73 (`e9da218`),
branches deleted. **NOT DEPLOYED, and the browser verification has NEVER RUN.**

- Spec: `carmen-platform/docs/superpowers/specs/2026-08-05-cluster-admin-layout-design.md`
- BE plan carries a **Deploy Runbook**; FE plan carries **Before merge / before deploy**. Both
  list what is still owed. Read them before shipping.
- Deploy order: **backend to DEV first** — until then `GET /api-system/me/admin-clusters` does
  not exist and the FE browser steps cannot run.

**Two things closed by reasoning, not observation — verify when DEV is live:**
inviting an address that already has a *pending* invitation must land on the Invitations tab
(the 409 discriminator was derived from source, never seen); and a membership-only admin must be
able to sign in and see exactly three nav items.

**The `cluster_admin` seeded-role trap is closed at the service layer** — BE PR #304
(`dc2a44af6`) added `hasPlatformWidePermission` and gated `createCluster` / `deleteCluster`, the
two routes #303 left relying on the coarse `PlatformPermissionGuard` alone. The role still grants
`["*"]` (33 perms, 0 users assigned on DEV) and the guard is still coarse, so: membership
(`tb_cluster_user.role='admin'`), **not** that role, is how you make a cluster admin.
…

## Watch out
when touching anything cluster-scoped, check which of the two a given
endpoint enforces before assuming the frontend's `hasPermission()` reflects it. Three facts
worth not rediscovering:

- A pure membership admin **cannot log into carmen-platform today** — `AuthContext.tsx:138-140`
  rejects when both `platform` and `clusters` are empty.
- `PlatformPermissionGuard` is coarse **by design** (its own header comment says so): it passes
  on the key existing in platform scope *or any cluster scope*, so it can never scope to a
…

_From Claude Code's memory of this repo, last updated Aug 5._
