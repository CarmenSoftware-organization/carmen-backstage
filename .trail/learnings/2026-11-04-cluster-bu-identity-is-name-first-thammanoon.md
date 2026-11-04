---
title: "Cluster/BU identity is name-first: code is muted secondary text, schema name hidden unless the screen needs it"
author: Thammanoon
date: 2026-11-04
branch: feature/name-first-identity
cost: { minutes: 17, tokens: 151955 }
id: l-e6186ed4
scope: repo
status: active
src: agent
---

## Decided
User choice (2026-11-04): cluster name and BU name are the primary identity everywhere; `code` is secondary; database schema name is not shown unless the screen genuinely needs it.
- Render: name is the linked/foreground text; code follows or sits under it as `font-mono text-xs text-muted-foreground` — no Badge, no bold, no leading Code column.
- Text labels (options, chips, plates, toasts): `Name (CODE)` or name only. Never `CODE · Name` / `CODE - Name` / `CODE — Name`.
- Lists (BusinessUnitManagement, ClusterManagement, TenantMigration/TenantSeed, ClusterLicenseTable): the Code column was folded into the Name cell; stickyLeftColumns 3 → 2; CSV still exports code; client-filtered tables keep code searchable via the Name accessorFn.
- Schema stays visible only in BU Edit's Database connection section, the repoint ConfirmDialog, and SQL Workbench. TenantMigrationManagement's column shows the pool name only (schema still in CSV).
- Avatar initials/hue (BrandMark, buInitials, buHueColor) still derive from code — stable colour key, not displayed identity.

## Watch out
- SubscriptionTable still sorts the BU column by `bu_code`: the backend has no BU-name sort key.
- ActivityEventManagement rows carry only `bu_code`, so that column still shows code.
- Tenant import's CompanyProfilePanel keeps showing code in its mismatch warning — that screen compares sheet code vs BU code.
