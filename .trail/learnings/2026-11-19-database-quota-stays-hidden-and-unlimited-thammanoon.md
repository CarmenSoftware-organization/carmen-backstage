---
title: Database quota stays hidden and unlimited until one feature flag is switched on
author: Thammanoon
date: 2026-11-19
branch: feature/hide-db-quota
cost: { minutes: 12, tokens: 139553 }
id: l-e2f6017e
scope: repo
status: active
src: agent
touches:
  - docs/superpowers/specs/2026-11-19-hide-db-quota-design.md
  - src/constants/featureFlags.ts
---

## Decided
Owner (2026-11-19): DB part of the storage quota licence is not ready to sell and no DB size is committed. While flag `license_storage_quota` is not exactly `active` (default `hide`, missing key = off), the DB quota is hidden in the UI AND treated as 0 (never full) by the gateway: measured, but no warning email, no block. Attachment quota untouched. One switch on purpose so UI and enforcement can't disagree.

## Tried and ruled out
- Hide UI only: DB still counts against hidden 5 GB; the global `enforce` switch covers both kinds, so turning it on for files would block BUs on an invisible DB figure.
- Separate `db_quota_enabled` config switch: two switches that must flip together.
- Set `default_db_bytes = 0`: rejected by micro-cluster zod `positive()`, and gateway `parseConfig` treats any invalid field as a bad config and falls back to ALL defaults silently.

## Watch out
- Gateway deploy lifts DB warnings/blocks on every env at once (no env has the flag active). Intended.
- FE must never send a hidden DB field back; config card echoes stored `default_db_bytes`.

In the code:
- Spec: docs/superpowers/specs/2026-11-19-hide-db-quota-design.md
- Gate point: carmen-turborepo-backend apps/backend-gateway/src/storage-quota/storage-quota.service.ts `effectiveByKind`, `loadConfig`, `parseConfig`
- Flag catalog: src/constants/featureFlags.ts
