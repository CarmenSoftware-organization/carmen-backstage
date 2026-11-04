---
title: "Cluster/BU identity is name-first: code is muted secondary text, schema name only on DB screens"
author: Thammanoon
date: 2026-11-04
branch: feature/name-first-identity
cost: { minutes: 1, tokens: 7051 }
id: l-233ca18b
scope: repo
status: active
replaces: l-e6186ed4
src: agent
touches:
  - src/components/BuSwitcher.tsx
  - src/components/BusinessUnitMultiSelect.tsx
  - src/components/BusinessUnitPicker.tsx
  - src/components/TenantMigrationResolveDialog.tsx
  - src/components/clusterSeat/SeatCell.tsx
  - src/i18n/en.ts
  - src/i18n/th.ts
  - src/pages/BackstageMigrationManagement.tsx
  - src/pages/BusinessUnitEdit.tsx
  - src/pages/BusinessUnitManagement.test.tsx
---

## Decided
User choice (2026-11-04): cluster name and BU name are the primary identity everywhere; `code` is secondary; database schema name is shown only where the screen genuinely needs it.
- Render: name is the linked/foreground text; code follows or sits under it as `font-mono text-xs text-muted-foreground` — no Badge, no bold, no leading Code column.
- Text labels (options, chips, plates, toasts): `Name (CODE)` or name only. Never `CODE · Name` / `CODE - Name` / `CODE — Name`.
- Lists (BusinessUnitManagement, ClusterManagement, TenantMigration/TenantSeed, ClusterLicenseTable): Code column folded into the Name cell; stickyLeftColumns 3 → 2; CSV still exports code; client-filtered tables keep code searchable via the Name accessorFn.
- Schema IS shown on: /tenant-migrations (Schema column with pool name under it — the user explicitly asked to keep it, 2026-11-04), BU Edit's Database connection section, the repoint ConfirmDialog, SQL Workbench. Everywhere else, don't render db_schema.
- Avatar initials/hue (BrandMark, buInitials, buHueColor) still derive from code — stable colour key, not displayed identity.

## Tried and ruled out
- Hiding the schema on /tenant-migrations (showing pool only): the user reverted it — migrations operate per schema, so the operator needs to see it.

## Watch out
- SubscriptionTable still sorts the BU column by `bu_code`: the backend has no BU-name sort key.
- ActivityEventManagement rows carry only `bu_code`, so that column still shows code.
- Tenant import's CompanyProfilePanel keeps showing code in its mismatch warning — that screen compares sheet code vs BU code.
