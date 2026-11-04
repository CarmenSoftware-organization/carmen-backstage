---
title: "BU alias min length lives in the backend gateway DTO; BU alias is optional, 1-10 when set"
author: Thammanoon
date: 2026-11-04
branch: fix/bu-alias-optional
cost: { minutes: 10, tokens: 27526 }
id: l-cc8eacaf
scope: repo
status: active
replaces: l-f2ac2cbc
src: agent
touches:
  - src/i18n/en.ts
  - src/i18n/th.ts
  - src/pages/BusinessUnitEdit.test.tsx
  - src/pages/BusinessUnitEdit.tsx
  - src/pages/businessUnitEdit/types.ts
  - src/utils/validation.ts
---

## Decided
User choice (2026-11-04): a business unit's alias is OPTIONAL; when set it must be 1-10 alphanumerics (`tb_business_unit.alias_name` is VarChar(10)). Cluster alias stays optional, max 3. "alias min = 1" meant the backend's min, not "make it required".

## Tried and ruled out
Making BU alias required in the FE (PR #447) — not what was asked; it blocked saving any field on a BU with a blank alias. Reverted in the follow-up PR.

## Watch out
- The "min 3" 400 (`alias_name must be at least 3 characters`) came from carmen-turborepo-backend `apps/backend-gateway/src/common/dto/business-unit/business-unit.dto.ts` (Create + Update schemas), not from this repo — the FE already allowed 1 char. Fixed to `.min(1).max(10)` in BE PR #997. A BE error message is the first place to look before touching FE validation.
- `validateRequired()` in `BusinessUnitEdit.tsx` re-checks a non-empty alias because InlineField only renders its error on commit and never blocks Save.
- The FE payload drops empty strings, so a blank alias is never sent as "" (which `.min(1)` would reject).
