---
title: "BU alias is the avatar token: optional, 1-3 chars, unique per cluster (case-insensitive); legacy longer values are fixed by admins, not blocked"
author: Thammanoon
date: 2026-11-04
branch: feature/bu-alias-max-3
cost: { minutes: 60, tokens: 353542 }
id: l-f2c021dc
scope: repo
status: active
replaces: l-cc8eacaf
src: agent
touches:
  - docs/superpowers/plans/2026-11-04-bu-alias-max-3.md
  - docs/superpowers/specs/2026-11-04-bu-alias-avatar-design.md
  - src/i18n/en.ts
  - src/i18n/th.ts
  - src/pages/businessUnitManagement/AliasConflictBanner.tsx
  - src/pages/businessUnitManagement/aliasConflictColumns.tsx
  - src/pages/clusterAdmin/BusinessUnitForm.tsx
  - src/utils/validation.test.ts
  - src/pages/clusterAdmin/BusinessUnitList.tsx
  - src/pages/BusinessUnitManagement.test.tsx
---

## Decided
User choice (2026-11-04, supersedes the 1-10 rule from earlier the same day): a business unit's `alias_name` is what the BU avatar shows. It may be empty, or 1-3 characters after trim. It must not repeat within one cluster; the comparison is case-insensitive and soft-deleted BUs don't count. Avatar order: uploaded image → alias (uppercased, `slice(0,3)`) → the old code/name initials (`brandInitials` in src/components/BrandMark.tsx).
Legacy aliases longer than 3: the BE migration `20261106090000_bu_alias_trim_to_3` trims them to 3 unless the trimmed key would collide. A collision is left as-is and listed by `GET /api-system/business-units/alias-conflicts`. Admins fix those from the warning banner on /business-units (super admin, sees all) or /cluster-admin/:clusterId/business-units (option A, chosen from a mockup).
Phase 2 (not built yet): after the list is empty on every env, change the column to VarChar(3) and add a unique index on (cluster_id, lower(alias_name)). That ships on a separate branch.

## Watch out
- Unchanged alias is never re-validated or re-sent. BusinessUnitEdit and clusterAdmin/BusinessUnitForm both drop an unchanged alias from the payload. The BE update DTO still allows 10, and the 3-char limit applies only when the alias changes. Otherwise a legacy 10-char alias would block saving every other field.
- Clearing sends `''`, which the BE stores as NULL. The old `aliasCannotBeCleared` guard is gone.
- Duplicate key = upper(rtrim(left(btrim(alias),3))). The JS side is `buAliasKey` in micro-cluster business-unit-alias.helper.ts and must match the migration SQL. Without the rtrim, "BK 01" truncates to "BK " and hides a clash with "BK" (found in the final review).
- A 409 `BUSINESS_UNIT_ALIAS_TAKEN` is read from `response.data.error.code`. Keep it out of `isVersionConflict`.
- i18n placeholders are `{{x}}`, never `{x}`.
