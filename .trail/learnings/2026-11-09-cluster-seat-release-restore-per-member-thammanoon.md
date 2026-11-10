---
title: Cluster seat release/restore + per-member seat status
author: Thammanoon
date: 2026-11-09
id: l-3f8b2cb7
scope: repo
status: active
touches:
  - "src/pages/reportTemplates/ReportTemplateVersionsSheet.tsx#ReportTemplateVersionsSheet.restore"
---

## Decided
Cluster seat management merged 2026-10-26: backend #939 (merge 5b2a4aab6), backstage #392 (merge 44b4155e). Spec/plan in carmen-backstage `docs/superpowers/{specs,plans}/2026-10-26-cluster-seat-management*`.

State at merge: FE auto-deploys DEV; backend Deploy Dev/Checks/Publish **failed — billing, job never started**, so migration `20261027090000_add_user_bu_seat_released_at` and the release/restore endpoints are NOT on DEV. FE hides seat UI when `seat` is absent, but the "0/null seat cap = 0 seats" rule ships with FE immediately (clusters with members and no seat licence now show over quota — intended by the user).

Pending:
- Deploy backend to DEV once Actions billing works (or manually).
- Add `clusterSeat.release` / `clusterSeat.restore` to the backstage app's allow-list on DEV + prod (missing key → 401 → logout).
- Manual checks (Task 9): release/restore on full cluster; restore when full → toast with used/cap; cross-cluster admin → 403; self-release warning confirms `useAuth().user.id` == tb_user.id; 390px TH/EN.
- `verify.yml` likely red: `CapacityMeter.test.tsx`, `ClusterEdit.test.tsx` still assert old "null cap = uncapped" (user forbade running/updating tests during this work).
- Seat holders with inactive cluster membership are invisible in the member list; banner only counts them (no release from this page).

**Why:** user wanted admins (backstage + cluster admin) to manage over-quota clusters themselves.

## Watch out
before claiming this works on DEV, check the backend actually deployed. Related: project-cluster-bu-license, reference-backend-auto-deploys-dev-on-main-push.

_From Claude Code's memory of this repo, last updated Oct 26._
