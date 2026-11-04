---
title: "BU alias_name is mandatory (min 1, max 10); cluster alias stays optional (max 3)"
author: Thammanoon
date: 2026-11-04
branch: fix/bu-alias-min-length
cost: { minutes: 4, tokens: 112218 }
id: l-f2ac2cbc
scope: repo
status: active
src: agent
touches:
  - src/pages/businessUnitEdit/types.ts
  - src/utils/validation.ts
---

## Decided
User choice (2026-11-04): a business unit's alias must be 1-10 alphanumerics. `BU_ALIAS_MIN = 1` in `src/pages/businessUnitEdit/types.ts`; `aliasBound()` passes `{ minLength, maxLength }` to `validateField`. `validateField` (`src/utils/validation.ts`) treats `minLength > 0` on `alias_name` as "blank fails" — it is checked *before* the historical "falsy value passes" guard. Clusters pass no minLength and still accept a blank alias.

## Watch out
- The inline field only shows the error on commit; `validateRequired()` in `BusinessUnitEdit.tsx` re-checks alias so Save/Create is actually blocked. Remove that line and a blank alias reaches the backend again.
- An existing BU with an empty alias cannot save ANY field until an alias is filled in.
- Test fixtures for BU Edit need `alias_name`, otherwise every save/create test silently stops at validation (`update`/`create` called 0 times).
