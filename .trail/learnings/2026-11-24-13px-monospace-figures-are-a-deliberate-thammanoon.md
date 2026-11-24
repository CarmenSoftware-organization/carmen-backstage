---
title: "13px monospace figures are a deliberate type role, not drift; badges are never shrunk below 12px"
author: Thammanoon
date: 2026-11-24
branch: fix/typeset-off-ramp-sizes
cost: { minutes: 5, tokens: 268154 }
id: l-1728da8b
scope: repo
status: active
src: agent
touches:
  - ".impeccable/design.json"
  - DESIGN.md
  - src/components/BroadcastPreview.tsx
  - src/components/Sidebar.tsx
  - src/pages/SuperAdminManagement.tsx
  - src/pages/applicationEdit/ApplicationStatusCard.tsx
  - src/pages/applicationManagement/ApplicationRegistrySummary.tsx
  - src/pages/broadcastManagement/broadcastColumns.tsx
  - src/pages/clusterAdmin/licenses/BuRankingCard.tsx
  - src/pages/clusterAdmin/licenses/QuotaLedgerCard.tsx
---

## Decided
- 2026-11-24 typeset pass: 13px mono figures (summary bands, reach cells, linked codes; 16 sites) stay as they are. Monospace draws larger than Inter at the same px, so 13px mono sits level with 14px body text. It is now a documented role, **Figure**. **Figure Emphasis** (15px) lifts the single exception in a row of figures. **Mono Dense** (10px) covers codes and kbd hints in tight rows.
- Inter text never goes below 11px. Badges keep the `Badge` default of 12px (Label). Counters and tags in dense chrome (sidebar counts, tree-row counts, the label under a stat) use 11px (Meta).
- Monogram initials inside a fixed avatar box (BrandMark, the BU swatch in BuSwitcher) are sized to the box and are exempt from the ramp.

## Tried and ruled out
- Snapping the 13px figures to 12px or 14px to make the detector go quiet. 12px reads smaller than the text beside it and 14px reads louder. The fix was to add the role to DESIGN.md, not to change the code.

## Watch out
- The impeccable detector only accepts sizes listed in the DESIGN.md frontmatter `typography:` block. A size that the prose allows but the frontmatter does not list still gets flagged, so add new roles in both places and in the `.impeccable/design.json` typographyMeta.
- `trail check` flags "Figure Emphasis … status ink" against the status-tinted-tile learning. That is a word match, not a real conflict: the emphasis figure sits on a plain card and uses the `-ink` token, not a status-tinted tile.

In the code: DESIGN.md frontmatter `typography.figure` / `figure-emphasis` / `mono-dense` plus the Hierarchy prose; FleetSync.tsx and SeedFleetSummary.tsx Legend; detector command `impeccable detect --json --scope type src` (5 explained findings remain: BrandMark 8px, Login/Landing, CapacityMeter 9px pending plan #493).
