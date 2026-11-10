---
title: "Build:bump rebuilt as scripts/release.mjs (guards + prompt + gates + annotated tag)"
author: Thammanoon
date: 2026-11-09
id: l-4042ce2a
scope: repo
status: active
touches:
  - scripts/release.mjs
  - package.json
  - src/data/changelog.json
  - CHANGELOG.md
  - README.md
  - docs/DEVELOPMENT.md
  - scripts/deploy-gcs.sh
  - "scripts/fill-vendor-address.mjs#main"
  - "scripts/generate-preconfig-mock.mjs#main"
  - "scripts/release.mjs#main"
---

## Decided
`bun run build:bump` is now `scripts/release.mjs`: pre-flight guards (version drift, branch
`main`/`chore/release-*`, clean tree, not behind upstream, non-empty `unreleased`) → level
prompt or argv → `typecheck`/`lint`/`test` gates → writes `package.json` +
`src/data/changelog.json` + `CHANGELOG.md`, commits as `chore(release): vX.Y.Z`, creates the
annotated tag. It never pushes and never fetches. **Merged to `main` 2026-08-05** via PR
**#72** (merge commit `59d06d5`, branch deleted both ends). **No release has ever been cut**
— the repo still has zero git tags, and nothing is deployed (`deploy-gcs.yml` is manual).

**Why:** the old `build:bump` was a shell chain with no guards and no git involvement; the
`0.2.0` release commit was hand-staged and untagged. The shape was ported from
`../carmen-inventory-god-mode/scripts/bump.ts`, but `bun pm version` could not be reused
because this repo's version of record is `src/data/changelog.json` → `versions[0].version`
(the app displays it), so a release touches three files rather than one.

## Watch out
- Cut a release on a `chore/release-*` branch, and **merge that PR with a merge commit, not a
  squash** — a squash rewrites the release commit and strands the tag outside `main`'s
  history. The repo has `allow_squash_merge: true`, so nothing enforces this.
- Push the branch and merge **before** pushing the tag; the script prints this order itself
  when the branch is `chore/release-*`.
- Three facts confirmed the hard way during this work, all previously mis-stated in docs:
  `.github/workflows/deploy-gcp.yml` **does not exist** (it is `deploy-gcs.yml`,
…

_From Claude Code's memory of this repo, last updated Aug 5._
