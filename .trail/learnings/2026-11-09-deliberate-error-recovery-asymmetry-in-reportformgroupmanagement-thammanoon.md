---
title: Deliberate error-recovery asymmetry in ReportFormGroupManagement
author: Thammanoon
date: 2026-11-09
id: l-7fac889e
scope: repo
status: active
touches:
  - src/pages/ReportFormGroupManagement.tsx
  - "src/pages/ReportFormGroupManagement.tsx#ReportFormGroupManagement.confirmDefault"
  - "src/pages/ReportFormGroupManagement.tsx#ReportFormGroupManagement.toggleActive"
---

## Decided
In `src/pages/ReportFormGroupManagement.tsx` two write paths handle failure **differently on purpose**:

- `confirmDefault` → `fetchAll()` on **every** error (both 409 and ordinary).
- `toggleActive` → `fetchAll()` **only** on a 409 version conflict; an ordinary error fires `toast.error` and leaves the list untouched.

Surfaced during the 2026-07-29 test-coverage pass and **ruled intentional by the user** — keep the current behaviour, don't "fix" the inconsistency. `ReportFormGroupManagement.test.tsx` now pins it with two paired tests ("does NOT reload after an ordinary failure" / "DOES reload after a version conflict"), so changing the code requires changing those tests deliberately.

**Known coverage gap (deliberate):** the `MAX_PAGES = 50` runaway guard in `fetchAll` is **not** tested — exercising it needs 50 full 500-row pages, and the page renders every row, so jsdom would choke. The other three loop-exit conditions (empty page, total reached, short page with no total) are covered.

See project-report-form-groups.

_From Claude Code's memory of this repo, last updated Jul 29._
