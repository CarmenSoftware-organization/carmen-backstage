---
title: License intake from the license master + Customer (AR)
author: Thammanoon
date: 2026-11-09
id: l-5d98c034
scope: repo
status: active
touches:
  - docs/superpowers/specs/2026-10-29-license-intake-customer-design.md
  - ".superpowers/sdd/2026-10-29-customer-ar/progress.md"
  - ".superpowers/sdd/2026-10-29-license-intake-api/progress.md"
  - "src/utils/dialogXmlEdit.test.ts#read"
---

## Decided
Spec: carmen-backstage `docs/superpowers/specs/2026-10-29-license-intake-customer-design.md` (merged via PR #423). The owner's decisions are in the spec.

**Part 1 (subscription scheduled state + every licence end_date inclusive)**
- Merged: BE #967, FE #421.
- Still to do: the manual DEV checks, and `git push origin main:vercel`.

**Part 2 (Customer AR)**: merged on 2026-10-29. BE #968 merge commit fae9eb0cc; FE #422 merge commit f06fd73f. The FE auto-deploys to DEV.
- Still to do:
  - deploy BE to DEV by hand (Actions are blocked by billing); until then the Customers page on DEV is broken
  - seed `customer.*` on DEV
  - add the 7 `backstage-customer.*` api_names to every app that is not `allow_all`
  - manual check: a cluster admin calling `sort=tb_customer.ar_number` must get 400
  - production: `git push origin main:vercel`, only after the BE is on prod
- Ledger: `.superpowers/sdd/2026-10-29-customer-ar/progress.md`

**Part 3 (intake API)**: merged on 2026-10-29. BE #972 merge commit c15043002. Migration `20261029140000_add_license_intake`.
- DEV rollout, still to do:
  1. deploy BE by hand
  2. `db:seed.system-user` then `db:seed.application-api` (order matters)
  3. rotate the `license-master` secret and enable enforcement
  4. wait 60 s
  5. run the curl checks in the PR test plan
- Share `docs/external-api/license-intake.md` (BE repo) with พี's team.
- Ledger: `.superpowers/sdd/2026-10-29-license-intake-api/progress.md`
…

## Watch out
next is manual BE deploy to DEV + seeds (permission then role-permission) + allow-list check, then manual DEV check T9. Check live state before trusting this note.

_From Claude Code's memory of this repo, last updated Oct 29._
