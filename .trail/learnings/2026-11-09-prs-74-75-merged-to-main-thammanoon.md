---
title: "PRs #74 + #75 MERGED to main 2026-08-06, not deployed"
author: Thammanoon
date: 2026-11-09
id: l-3cbfadab
scope: repo
status: active
touches:
  - "src/components/AuthedRoute.tsx#AuthedRoute"
  - "src/components/PrivateRoute.tsx#PrivateRoute"
  - "src/pages/Profile.tsx#Profile"
---

## Decided
**MERGED to main 2026-08-06** (merge commits `1e25d30`, `5b2aa74`), branches deleted, **NOT
deployed** — deploy is a manual `workflow_dispatch`. Merged main verified green: 1049/1049,
typecheck + lint clean.

- **#74** — the view isolation itself. Browser-verified on DEV before merge.
- **#75** — a follow-up trim of the same surface: no BU create, no `code` field anywhere in
  cluster-admin, no Default Currency picker, Calculation Method locked read-only. **Not**
  browser-verified — merged on the user's explicit call after the gap was raised.
- **backend-v2 #305** — still **OPEN**. Swaps `createBusinessUnit`'s gate from `canWriteCluster`
  to `canWriteClusterViaPlatformRole`. **Deploy it after the frontend, never before:** a
  backend-first deploy would have shown cluster admins a 403 reading "You are not an admin of
  this cluster" — false for them, since they are. The message is still wrong for that rejection
  and no better catalog entry exists; flagged in #305, not fixed.

Follows project-cluster-admin-layout (#73), which built the `/cluster-admin` space but closed
nothing on the platform side.

One check inside `PrivateRoute` covers all 30 platform routes; `/cluster-admin` moved to a new
auth-only `AuthedRoute` because under `PrivateRoute` the redirect targets the route it guards and
loops. `Profile` gained `/cluster-admin/:clusterId/profile` and picks its shell from the param.
`DEV_MOCK_EFFECTIVE_PERMISSIONS` is deleted.
…

## Watch out
when a guard reads a derived boolean, ask what that boolean says while its
inputs are still in flight, and check *every* input, not the one you happened to think of. And
before calling an unverified backend response shape a Critical, go read the backend — it is
cheaper than a browser run and it either kills the finding or promotes it.

_From Claude Code's memory of this repo, last updated Aug 5._
