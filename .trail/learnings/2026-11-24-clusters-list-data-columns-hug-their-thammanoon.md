---
title: "Clusters list: data columns hug their content, and the table becomes cards below 1340px"
author: Thammanoon
date: 2026-11-24
branch: fix/clusters-table-width
cost: { minutes: 13, tokens: 111579 }
id: l-09706a53
scope: repo
status: active
src: agent
touches:
  - src/pages/ClusterManagement.tsx
---

## Decided
On the Clusters list the data columns hug their content and the last column (Updated) takes the spare width. Under `table-auto` every column without a width shares the spare room, so on a 3840 screen the name and the numbers drifted ~1000px apart. The page switches to one card per row below a 1340px viewport, because the table needs ~1005px, and with the sidebar open the card only gets that wide from 1340.

## Tried and ruled out
Adding right padding to the hugging columns as a visual gap: it raises the table's minimum width (4 columns × 20px), and 1366 with the sidebar open started scrolling sideways. The cells' own px-3 is gap enough.

## Watch out
The breakpoint is a viewport query, so a collapsed sidebar at 1180–1339 also gets cards, even though the table would fit. Turning on "show deleted" adds a column and raises the minimum, so re-measure the breakpoint if you add a column.

In the code: src/pages/ClusterManagement.tsx `hug` = `w-px whitespace-nowrap` (Name, bu_count, bu_cap_end_date, user_count); last audit column `min-w-28`; `mobileBreakpoint="(min-width: 1340px)"`. Measured: 1340 → 1005/1005, 1366 → 1031/1031, Thai is the same width.
