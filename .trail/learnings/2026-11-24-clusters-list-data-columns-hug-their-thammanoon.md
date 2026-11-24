---
title: "Clusters list: data columns hug their content, and the table becomes cards below 1340px"
author: Thammanoon
date: 2026-11-24
branch: fix/clusters-table-width
cost: { minutes: 14, tokens: 112859 }
id: l-09706a53
scope: repo
status: active
src: agent
touches:
  - src/pages/ClusterManagement.tsx
  - src/pages/clusterManagement/FleetCapacity.tsx
  - src/utils/capacity.ts
---

## Decided
On the Clusters list the data columns hug their content and the last column (Updated) takes the spare width. Under `table-auto` every column without a width shares the spare room, so on a 3840 screen the name and the numbers drifted ~1000px apart. The page switches to one card per row below a 1340px viewport, because the table needs ~1005px, and with the sidebar open the card only gets that wide from 1340.
A cluster row showing "0 / 0" users is correct: seat enforcement blocks every add when the pool is 0, and the backend licence design doc says null = 0 and that "unlimited" does not exist. The Fleet capacity band on the same page says "+ 1 cluster with no cap" for that cluster. **The band is the wrong one**: the backend fleet summary treats a 0 cap as uncapped. Fixing it is a cross-repo change (backend summary + spec + swagger, frontend capacity utils).
The same commit hides a cluster's code line when it repeats the name, and mutes alert counters at zero so only a non-zero one stands out.

## Tried and ruled out
Adding right padding to the hugging columns as a visual gap: it raises the table's minimum width (4 columns × 20px), and 1366 with the sidebar open started scrolling sideways. The cells' own px-3 is gap enough.

## Watch out
The breakpoint is a viewport query, so a collapsed sidebar at 1180–1339 also gets cards, even though the table would fit. Turning on "show deleted" adds a column and raises the minimum, so re-measure the breakpoint if you add a column.

In the code: src/pages/ClusterManagement.tsx `hug` = `w-px whitespace-nowrap` (Name, bu_count, bu_cap_end_date, user_count); last audit column `min-w-28`; `mobileBreakpoint="(min-width: 1340px)"`. Measured: 1340 → 1005/1005, 1366 → 1031/1031, Thai is the same width.
Do not "fix" the row to show ∞ to match the band. The row follows enforcement; the band follows a leftover helper the backend doc lists as phase-B debt, to be flipped together with the frontend capacity utils.

In the code: backend `apps/micro-cluster/src/common/helpers/summary.helper.ts:95` `finiteCap()` = `cap && cap > 0 ? cap : null`. It is used by the fleet summary in `cluster/cluster/cluster.service.ts` (~1962–1965, `users.uncapped_count`). Enforcement is in `cluster/common/seat.helper.ts:219`. The doc is `docs/design-license-logic.md:131-133` (also ~426, the phase-B table). Still saying 0 = uncapped: swagger `backend-gateway/.../backstage_clusters/swagger/response.ts:134` and `summary.helper.spec.ts:8`. Frontend: `src/pages/clusterManagement/FleetCapacity.tsx` `uncappedNote`, `src/utils/capacity.ts`.
