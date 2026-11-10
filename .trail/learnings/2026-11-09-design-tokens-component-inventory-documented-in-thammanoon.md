---
title: "Design tokens & component inventory documented in .planning/design/system/"
author: Thammanoon
date: 2026-11-09
id: l-9418ce88
scope: repo
status: active
touches:
  - src/index.css
  - tailwind.config.js
  - CLAUDE.md
---

## Decided
Design system is documented (2026-07-17) in `.planning/design/system/`:
- `tokens.md` — full token reference: light + dark theme, all semantic roles, HSL (canonical) + hex, status accents, special tokens (zebra, per-BU chip), typography, spacing, radius, shadows, breakpoints, motion, WCAG contrast notes.
- `components.md` — inventory of 45 live components (21 shadcn primitives in `src/components/ui/` + 24 app-level), grouped, with component→page-pattern map.
- `component-checklist.md` — coverage checklist: all 45 built components (checked) + verified gaps not yet in the system (no Checkbox/Switch/Accordion/RadioGroup/Popover/Alert primitives; checkbox is raw HTML in 16 files).

**Source of truth is code, not the docs:** `src/index.css` (CSS custom properties) + `tailwind.config.js`. Docs mirror those — keep in sync when they change.

Fixed at the same time: CLAUDE.md's "Styling Reference" section (line ~311) was **stale after the calm-corporate reskin** — corrected `--radius` (0.375→0.5rem), `--accent`/`--destructive`/`--muted-foreground`/`--border`/`--input` from cool hue 220 → warm hue 30-40. Now points to tokens.md. Related: project-calm-corporate-reskin.

_From Claude Code's memory of this repo, last updated Aug 30._
