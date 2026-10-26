---
title: "Return-to-page after sign-in rides ?next=, because every session teardown is a full page reload"
author: Thammanoon
date: 2026-10-26
branch: feature/login-return-to
cost: { minutes: 5, tokens: 113206 }
id: l-e0cb4dbc
scope: repo
status: active
src: agent
touches:
  - src/components/AuthedRoute.tsx
  - src/components/ClusterAdminRoute.tsx
  - src/components/PrivateRoute.tsx
  - src/context/AuthContext.tsx
  - src/pages/Login.tsx
  - src/services/api.ts
  - src/services/tokenRefresh.ts
  - src/utils/resolveNextPath.ts
---

## Decided
- Every redirect to /login carries `?next=<pathname+search+hash>` via `loginPathFor` / `loginPathForCurrentPage` (src/utils/resolveNextPath.ts). Login.tsx reads it through `resolveNextPath` and falls back to /dashboard.
- Users with no backstage authority (cluster admin only) still bounce to /cluster-admin from PrivateRoute after returning; a missing permission still renders <Forbidden /> in place. The user chose this on 2026-10-26.
- Explicit logout (Layout.tsx) stays a bare `/login`; nobody should be sent back to the page they just left.

## Tried and ruled out
- Router `location.state` / sessionStorage: api.ts, tokenRefresh.ts and AuthContext tear the session down with `window.location.href` (a full reload), which drops router state. The Google flow (Login.handleGoogle → AuthCallback) already speaks `next`.

## Watch out
- A new redirect to /login must use `loginPathFor*`, or that path silently lands on /dashboard again. The public-path list in `loginPathFor` mirrors AuthContext's `publicPaths`, so keep the two in sync.
