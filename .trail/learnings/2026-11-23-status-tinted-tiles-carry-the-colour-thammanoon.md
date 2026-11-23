---
title: Status-tinted tiles carry the colour on the box; the number and label stay in ink
author: Thammanoon
date: 2026-11-23
branch: main
cost: { minutes: 9, tokens: 263400 }
id: l-2f0ec082
scope: repo
status: active
src: agent
touches:
  - src/pages/Dashboard.tsx
  - src/pages/dashboard/ActivityStream.tsx
  - src/pages/dashboard/AttentionBand.tsx
  - src/pages/dashboard/CountsRail.tsx
  - DESIGN.md
---

## Decided
On a tile tinted with its own status colour (5-10% fill + border), the status hue goes on the box only. The figure, label and icons inside use Ink (`text-foreground` / `text-muted-foreground`). The tint plus the text label carries the state, so colour is never the only signal.

## Tried and ruled out
- Status colour as the figure's text colour. Measured on its own tint: red 4.22:1 light / 2.88:1 dark, amber ~3:1, info 4.5-5.2:1. An 18px semibold figure is not "large text", so the bar is 4.5:1. Red and amber fail in both themes.
- Amber icon on an amber-tinted box: 2.77:1 in light, under the 3:1 non-text bar. Amber icons are fine on plain card (3.08:1).
- Amber icon inside a selected Signal Blue chip: no contrast. The icon follows the chip's ink when the chip is on.

## Watch out
- On `main` there are no required checks, so `gh pr merge --auto` merges immediately, before CI runs. CI still runs on the PR afterwards; read its result after the merge.
- Run the contrast check against the tinted fill (fg mixed over the ground at the tint alpha), not against the plain ground.

In the code: src/pages/dashboard/AttentionBand.tsx (TONE map = box classes only), src/pages/dashboard/CountsRail.tsx, src/pages/dashboard/ActivityStream.tsx; DESIGN.md "Don't use --warning or --success as text colours"; PR #485.
