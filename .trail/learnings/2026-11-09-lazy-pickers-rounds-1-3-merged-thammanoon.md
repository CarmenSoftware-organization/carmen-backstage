---
title: "Lazy pickers rounds 1–3 merged (#427 #428 #429 #430, 2026-11-02)"
author: Thammanoon
date: 2026-11-09
id: l-430ad21a
scope: repo
status: active
touches:
  - docs/superpowers/plans/2026-11-02-lazy-pickers-round-3.md
  - src/components/typeahead/useTypeahead.ts
  - "scripts/fill-vendor-address.mjs#main"
  - "scripts/generate-preconfig-mock.mjs#main"
  - "scripts/release.mjs#main"
  - "src/components/BuSwitcher.tsx#BuSwitcher"
  - "src/components/ClusterPicker.tsx#ClusterPicker"
  - "src/components/ReportTemplatePicker.tsx#ReportTemplatePicker"
  - "src/components/typeahead/TypeaheadStatus.tsx#TypeaheadAnnouncer"
  - "src/components/typeahead/useTypeahead.ts#useTypeahead"
---

## Decided
All three rounds of server-searched, infinite-scroll pickers are merged into `main`.
- **Round 1, #427:** the Customer Edit BU picker.
- **Round 2, #428 / #429:** BU multi-select, cron recipients, the analytics BU filter, and `ClusterPicker`. #429 added "Couldn't load" + retry.
- **Round 3, #430 (merge `2a8ca6c5`, 2026-11-02).** Plan: `docs/superpowers/plans/2026-11-02-lazy-pickers-round-3.md`.
  - `BuSwitcher` searches the server itself (via `usePagedSearch().resultsQuery`), and Enter is gated while results are stale. Recents use the key `sqlwb_recent_bus_v2`, and grouping by cluster was dropped.
  - Every picker runs on `src/components/typeahead/useTypeahead.ts`. `UserPicker.onDropdownOpenChange` was renamed to `onOpenChange`.
  - `ReportTemplatePicker` is in cron `ReportConfigFields`.

**None of it is on production (Vercel) yet.** That needs `git push origin main:vercel`, which the owner runs. When #430 merged, the DEV deploy run 41408131494 was in progress.

**Why:** the BU and template lists were too long to scroll through, the pickers each had their own Escape/open-state code, and that code caused bugs.

## Watch out
- Build a new typeahead on `useTypeahead`, using `ClusterPicker` as the reference. The rules are in the trail learning "Typeahead pickers must report open state from the real dropdown".
- Checked in a browser (Chrome, localhost, 2026-11-02): Enter in a form doesn't submit, scrollbar drag works, the activity-events Sheet Escape is fixed, the cron template and BU multi-select work, and the SQL Workbench stale Enter guard plus Recents work.
…

_From Claude Code's memory of this repo, last updated Nov 2._
