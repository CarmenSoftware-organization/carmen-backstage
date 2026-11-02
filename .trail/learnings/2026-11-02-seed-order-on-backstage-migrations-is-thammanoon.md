---
title: Seed order on /backstage/migrations is the backend catalog order; seed-system-user must precede seed-application-api
author: Thammanoon
date: 2026-11-02
branch: fix/seed-system-user-op
cost: { minutes: 5, tokens: 125035 }
id: l-fff6fd9e
scope: repo
status: active
src: agent
touches:
  - src/i18n/en.ts
  - src/i18n/th.ts
---

## Decided
The page (BackstageMigrationManagement.tsx) never sorts ops: it renders BACKSTAGE_SEED_CATALOG (carmen-turborepo-backend apps/micro-business/src/authen/backstage_seed/backstage_seed.catalog.ts) top to bottom. To change the order, edit the backend array, not the FE. The order now follows script dependencies: permission before role-permission, backstage-permission before backstage-role-permission, system-user before application-api. The per-BU seed-role-permission goes last, which was our choice, not a dependency.

## Tried and ruled out
The old order had no dependency violation. Reordering alone would not have fixed anything. The real gap was db:seed.system-user, which was missing from the catalog. Without it, seed-application-api only warns and creates the license-master app with no system_user_id, so AppIdGuard returns 401 (the 2026-10-30 symptom).

## Watch out
Each new op needs an i18n key pages.backstageMigration.ops.<camelCase id> in en.ts and th.ts, and the FE must merge/deploy BEFORE the backend. Otherwise users see the raw key. Do not add seed-backstage-super-admin to the catalog: it is env-driven and leaves no audit trail.
