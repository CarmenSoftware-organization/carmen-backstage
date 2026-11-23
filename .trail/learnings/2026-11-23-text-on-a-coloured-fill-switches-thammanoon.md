---
title: "Text on a coloured fill switches to dark ink wherever white misses 4.5:1, instead of darkening the fill"
author: Thammanoon
date: 2026-11-23
branch: fix/status-fill-contrast
cost: { minutes: 18, tokens: 617616 }
id: l-85f89493
scope: repo
status: active
src: agent
touches:
  - ".impeccable/design.json"
  - DESIGN.md
  - src/index.css
  - ".impeccable/config.json"
  - ".planning/design/system/component-checklist.md"
  - ".planning/design/system/components.md"
  - ".planning/design/system/page-patterns.md"
  - ".planning/design/system/tokens.md"
  - AGENTS.md
  - CLAUDE.md
---

## Decided
2026-11-23: after the /dashboard critique the user chose to fix contrast app-wide first. White text missed AA on dark primary/info (3.51:1), dark success (3.02:1) and light warning (3.24:1). Those foregrounds are now dark ink 20 14% 8% (5.24 / 6.09 / 5.67:1). Light primary, success and destructive and dark destructive keep white, because they pass.

## Tried and ruled out
Darkening dark --primary until white passes. The same token is also link, nav and ring colour on the dark ground (5.09:1 now). White on it needs luminance ≤ 0.183, while text on the ground needs ≥ 0.214, so no lightness satisfies both.

## Watch out
Before changing any fill's lightness, re-measure both pairs: fill vs its -foreground, and the fill as text on --background. The Login brand panel uses text-primary-foreground at alpha, so in dark theme it now shows dark ink. Its look hasn't been checked in the browser yet.

In the code: src/index.css (:root --warning-foreground; .dark --primary/--info/--success-foreground); DESIGN.md "Fill Ink"; src/pages/Login.tsx brand panel.
