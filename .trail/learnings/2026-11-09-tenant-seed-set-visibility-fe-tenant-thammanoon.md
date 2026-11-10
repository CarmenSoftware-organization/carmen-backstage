---
title: Tenant seed-set visibility (FE) + tenant URL encoding across 4 backend builders
author: Thammanoon
date: 2026-11-09
id: l-dcceeaf2
scope: repo
status: active
touches:
  - package.json
  - "scripts/fill-vendor-address.mjs#main"
  - "scripts/generate-preconfig-mock.mjs#main"
  - "scripts/release.mjs#main"
  - "src/components/TenantSeedCard.tsx#TenantSeedCard"
  - "src/utils/dialogXmlEdit.ts#save"
---

## Decided
Two coordinated PRs, **both MERGED to main 2026-07-27** (not deployed — deploys are manual here). Branches deleted local + remote.

- **FE** `carmen-platform` **PR #62** → merge commit `808478b`. `TenantSeedCard` renders every seed set (complete ones visible but checkbox-disabled, `Seeded` badge, collapsible missing-row list, button reads `Nothing to seed`). 926/926 tests, green again on merged main.
- **BE** `carmen-turborepo-backend-v2` **PR #257** → merge commit `21e6dcf6f`. All four tenant connection-string builders now percent-encode `database`/`schema`; new leaf package `@repo/db-connection-utils` holds `isSafeHost`/`isSafePort`/`quoteIdent` exactly once; SQL identifier injection via `SET search_path TO "${schema}"` closed with `quoteIdent`. 357/357 suites, 4683/4683 tests at merge; CodeQL passed before merging.
…

_From Claude Code's memory of this repo, last updated Jul 27._
