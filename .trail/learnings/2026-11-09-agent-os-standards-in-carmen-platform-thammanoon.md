---
title: Agent-os/standards/ in carmen-platform holds 30 discovered standards across…
author: Thammanoon
date: 2026-11-09
id: l-a8925834
scope: repo
status: active
touches:
  - CLAUDE.md
  - agent-os/standards/index.yml
  - src/utils/buildQuery.ts
  - "src/hooks/useDebouncedValue.ts#useDebouncedValue"
  - "src/pages/userBackstageManagement/BackstageAccessSummary.test.tsx#summary"
  - "src/utils/errorParser.ts#getErrorDetail"
  - "src/utils/errorParser.ts#parseApiError"
  - "src/utils/validation.ts#validateField"
---

## Decided
`agent-os/standards/` was created 2026-08-07 via `/agent-os:discover-standards`: 19 files
under `api/` (7), `errors/` (4), `pages/` (4), `testing/` (4), indexed in
`agent-os/standards/index.yml`.

**Round 2, 2026-08-10 — PR #92 MERGED to main** (merge commit `b13fb80`, branch deleted
local + remote, all CI green): +11 files → **30 standards in 7 folders**. New: `styling/` (tokens,
dark-mode, table-sticky-columns), `permissions/` (route-guards, permission-checks,
gating-a-page, unresolved-vs-denied), `hooks/` (fetch-race-guards, parallel-loads,
debounced-value, hook-placement). Docs only — no code changed, so no test run.
Still undiscovered: DataTable/list-view state, UI primitives, build/env/release.

**MERGED to main 2026-08-07** — PRs #82, #83, #84, #85 (head `58a0e4e`). Not deployed;
`deploy-gcs.yml` is manual `workflow_dispatch`. `.claude/settings.local.json` is gitignored
— per-machine, and its permission grants embed `.env` values.

**Two of the three "debts" the standards named turned out not to exist**, and both errors
were mine, from auditing with grep instead of reading code:

- `perpage: -1` (#84): three pages *cannot* be rewritten client-side at all — `businessUnits`
  and `clusters` are DISTINCT counts, FleetCapacity is a SUM, and a count query answers
  neither. The other three (Role, News, Application) would trade one request for four-to-six
  over tables holding tens of rows. Fix is a backend `summary` block; each page now names its
…

## Watch out
read `agent-os/standards/index.yml` before adding a service, page, error
path, or test — CLAUDE.md now points at these files rather than restating them, so the
detail only lives there. When CLAUDE.md and code disagree in this repo, verify against
code; the drift is systematic, not incidental. See project-two-backends.

Real code changed alongside the docs: `src/utils/buildQuery.ts` (new, collapses the
QueryParams boilerplate); best-effort `refreshAccessToken().catch(() => {})` before both
NDJSON streams in `preconfigImportService` / `tenantMigrationService` (raw `fetch` skips
…

_From Claude Code's memory of this repo, last updated Aug 9._
