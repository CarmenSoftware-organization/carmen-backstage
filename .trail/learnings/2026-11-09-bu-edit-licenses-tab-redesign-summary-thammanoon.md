---
title: BU Edit Licenses tab redesign (summary strip + uniform card headers) merged 2026-11-03…
author: Thammanoon
date: 2026-11-09
id: l-220ef4d2
scope: repo
status: active
touches:
  - "scripts/fill-vendor-address.mjs#main"
  - "scripts/generate-preconfig-mock.mjs#main"
  - "scripts/release.mjs#main"
---

## Decided
BU Edit `?tab=licenses` redesign merged into `main` on 2026-11-03: #439 (LicenseSectionHeader, storage settings in `<details>`) and #440 (LicenseSummaryStrip, 3 cells), merge commit `0fda32e2`. Deploy Dev ran on push.

Pending: production (`git push origin main:vercel`, human-run); Thai browser check; BU with multiple / near-expiry licences or storage ≥80% never seen live; strip has no own test. Cluster-admin BU form cards still use their own headers (see trail learning).

**Why:** pending items will look "done" from git history alone.

## Watch out
before claiming this is in production, check `git log origin/vercel` for `0fda32e2`. Related: project-pending-work, reference-vercel-production-tracks-missing-dev-branch.

_From Claude Code's memory of this repo, last updated Nov 3._
