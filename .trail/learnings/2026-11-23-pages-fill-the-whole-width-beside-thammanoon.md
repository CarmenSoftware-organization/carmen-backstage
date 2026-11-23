---
title: Pages fill the whole width beside the sidebar; read-only values are unboxed; ClusterEdit keeps its section nav
author: Thammanoon
date: 2026-11-23
branch: fix/full-width-shell
cost: { minutes: 18, tokens: 147628 }
id: l-f9647b86
scope: repo
status: active
src: agent
touches:
  - src/components/Layout.tsx
  - src/pages/AGENTS.md
  - src/pages/CLAUDE.md
  - src/components/ReadOnlyField.tsx
  - src/pages/clusterEdit/useScrollSpy.ts
  - src/pages/BackstageMigrationManagement.tsx
  - src/pages/FeatureFlagManagement.tsx
  - src/pages/backstageMigration/OpRow.tsx
  - src/pages/licenseCatalog/FeatureCatalogPanel.tsx
  - src/pages/licenseFeatures/ModuleShelf.tsx
---

## Decided
User decisions 2026-11-23 on layout conflicts:
- The shell no longer caps page width at 1400px. A page that looks stretched fixes its rows (more columns, a capped name column), never a page-level max-w.
- View mode shows a muted label + strong value with no border; the old bordered read-only box is replaced on a page only when that page is changed anyway.
- Viewport breakpoints move to container queries only when touched and found broken.
- ClusterEdit's scrollspy section nav stays as the one exception to "no cross-section nav".
Edit page files by hand and commit only the lines the change needs. Lint (eslint) is the gate here; prettier is not enforced on src/pages.

## Tried and ruled out
Keeping the 1400px cap as a documented exception (rejected by the user). Raising the cap to 1920px (rejected). Converting every read-only field or every breakpoint in one sweep (rejected: too wide a blast radius).
Running `prettier --write` on the touched files after a layout change: it rewrote 727 lines across five files (613 in one) for a 54-line change, burying the real diff. The files were restored from HEAD and the edits reapplied without formatting.

## Watch out
Removing the cap is not shippable alone: at 1920 five pages put a value ~1300px from its label — /backstage/features, /backstage/migrations, /license-features, /backstage/email-settings, /dashboard-templates. Fix them before merging. A push to main auto-deploys DEV.

In the code: src/components/Layout.tsx (<main> and footer `w-full`, was `container mx-auto`); src/pages/CLAUDE.md + src/pages/AGENTS.md §Form Field Pattern; src/components/ReadOnlyField.tsx; src/pages/clusterEdit/useScrollSpy.ts.
Check a file's baseline before formatting it: `git show HEAD:<file> | bunx prettier --stdin-filepath <file> --check` — if HEAD already fails, formatting will reformat the whole file. Nesting JSX one level deeper without re-indenting the inner block is fine for tsc and eslint.

In the code: src/pages/BackstageMigrationManagement.tsx, src/pages/FeatureFlagManagement.tsx, src/pages/licenseCatalog/FeatureCatalogPanel.tsx (the files it happened on).
