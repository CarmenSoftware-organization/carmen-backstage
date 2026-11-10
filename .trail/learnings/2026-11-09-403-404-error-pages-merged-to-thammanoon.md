---
title: "403/404 error pages MERGED to main (PR #64) plus the soft-delete count fix (backend #262)"
author: Thammanoon
date: 2026-11-09
id: l-5bcf8881
scope: repo
status: active
touches:
  - src/context/AuthContext.tsx
  - "src/context/AuthContext.tsx#useAuth"
  - "src/utils/dialogXmlEdit.test.ts#read"
---

## Decided
PR #64 `feature/403-404-error-pages` **MERGED to carmen-platform main 2026-07-29** (`e8fee0d`), **not deployed** — the GCS workflow is manual `workflow_dispatch`. 1002/1002 tests, `CI=true bun run build` clean, manual browser pass done against the local backend. One check never ran: it needs an account without `cluster.read` (both available logins are full admins).

**Leftover test data:** cluster `ZZ-TEST-PR64` ("ZZ Test Cluster - PR64 verify - safe to delete") still exists in the local dev DB — its two test BUs were deleted, but the cluster delete is blocked by bug 1 below.

**Three non-obvious facts this work uncovered**

**1. `AuthContext` gates every non-public path.** `src/context/AuthContext.tsx` hard-redirects to `/login` on mount for any path outside `publicPaths = ['/', '/login', '/changelog']`, *before* routing renders. An anonymous visitor can never see any other page. A whole logged-out branch of `NotFound.tsx` was built, reviewed and tested green before running the app showed it was unreachable — mocking `useAuth` made it look live to every test and every reviewer.
…

## Watch out
before designing anonymous-visitor UI here, read `publicPaths` first. When a mocked hook makes a branch reachable in tests, ask whether it is reachable in the running app. Related: project-ux-unification, feedback-branch-sync.

_From Claude Code's memory of this repo, last updated Jul 29._
