---
title: "Hug-content columns in a plain table only switch on when the table's box is wide enough"
author: Thammanoon
date: 2026-11-24
branch: main
cost: { minutes: 19, tokens: 139459 }
id: l-f2928c31
scope: repo
status: active
src: agent
touches:
  - src/pages/TenantSeedManagement.tsx
  - src/pages/tenantSeed/SeedFleetSummary.tsx
  - src/pages/tenantImport/FileCheckPanel.tsx
  - src/pages/tenantImport/StepPanel.tsx
  - src/pages/tenantImport/CompanyProfilePanel.tsx
  - src/pages/TenantImportWizard.tsx
---

## Decided
The three plain `<table>`s in the tenant import wizard (file check, Company Profile diff, step preview) size their data columns to content and let the last column take the rest, but only from a container width: `@3xl` (768) for file check and preview, `@6xl` (1152) for Company Profile. Below that they keep the old equal-share layout.

## Tried and ruled out
- Unconditional `w-px` + `whitespace-nowrap` + `pr-10`: at 390 the file-check table grew from 433 to 545px and Company Profile from 501 to 585px (they already scrolled; this made it worse). The padding alone accounts for most of it, so the padding must be gated too, not just the width.
- `w-px` with a `min-w-48` span on Company Profile values: the column collapses to 192px, so the company name wrapped to 3 lines while 1031px sat empty in the Status column. `w-max max-w-xs` on the span (max-content, capped at 320px) is what works.
- Gating Company Profile at `@3xl`: at 1366 the box is ~777px, and the longest Current + Workbook values need ~1140px, so it scrolled.

## Watch out
- To compare against the old layout at narrow widths, stash the files and rerun the same probe. The narrow numbers must come out identical.
- The wizard keeps no state in the URL or localStorage, so an iframe probe has to pick the BU and set the file itself. The dev server serves the committed mock workbook at `/@fs/<abs path>/sample_data/Preconfig-mock.xlsx`. Feed it to the iframe's file input with a DataTransfer. Only Check and Preview are read-only; never press Import or Apply to BU on DEV.

In the code: src/pages/tenantImport/FileCheckPanel.tsx, StepPanel.tsx, CompanyProfilePanel.tsx — `@container` on the overflow wrapper; `@3xl:` / `@6xl:` prefixes on w-px, whitespace-nowrap, pr-10/pl-10.
