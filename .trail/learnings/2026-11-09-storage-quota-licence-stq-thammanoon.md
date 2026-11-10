---
title: Storage quota licence (STQ)
author: Thammanoon
date: 2026-11-09
id: l-ff0c4725
scope: repo
status: active
touches:
  - docs/superpowers/specs/2026-11-03-storage-quota-license-design.md
  - docs/superpowers/plans/2026-11-03-storage-quota-license.md
---

## Decided
The storage quota licence (`STQ-YYMM-####`) has no dates. It carries an optional DB figure and an optional file figure in bytes. An empty figure means the live `storage_quota` default, which is now 5 GB / 5 GB.
- Spec: `docs/superpowers/specs/2026-11-03-storage-quota-license-design.md`
- Plan: `docs/superpowers/plans/2026-11-03-storage-quota-license.md`. Its Deploy notes section is the runbook.

State on 2026-11-03: merged to main.
- BE #991 (8598ca19b).
- FE #436 (64f4b0fb). It was merged while CI was still pending; the local typecheck, lint and 1394 tests were green.
- FE auto-deploys to DEV. Whether the BE migration has been applied on DEV still needs checking (reference-migration-applied-without-merge).
- Not on vercel/prod yet.

**Why:** the owner wanted storage sold like the other licences. The decisions are in the trail learning `2026-11-03-storage-quota-licence-has-no-dates`.

## Watch out
- The gateway keeps the deprecated `db_quota_bytes` and `file_quota_bytes` in the quota view for one release, as a shim for the old FE card. Remove them once the FE is on prod.
- Seed all 6 `businessUnitStorageLicense.*` keys into the app allow-list on every environment. Without them the calls return 401 and log users out.
- Run the reconciliation SQL after the migration.
- A saved `storage_quota` config row overrides the code default. Set the file figure to 5 GB on each environment.
- Licence writes need backstage-wide `subscription.manage`.
- A storage-only intake is a valid sale.
…

_From Claude Code's memory of this repo, last updated Nov 3._
