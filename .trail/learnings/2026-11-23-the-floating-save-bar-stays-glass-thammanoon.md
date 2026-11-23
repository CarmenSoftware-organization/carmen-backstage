---
title: "The floating save bar stays glass on purpose, and DESIGN.md replaces the old token and component docs"
author: Thammanoon
date: 2026-11-23
branch: main
cost: { minutes: 8, tokens: 192339 }
id: l-e7bc5748
scope: repo
status: active
src: agent
touches:
  - DESIGN.md
  - src/index.css
  - CLAUDE.md
  - AGENTS.md
---

## Decided
- 2026-11-23, user decision: the floating unsaved-changes bar keeps its frosted-glass look as the one deliberate exception to "every sticky bar is opaque". Every other bar, header and card stays opaque and flat.
- The design system's north star is "The Control Room Ledger": a warm paper ground, one blue accent, and status colours only when they report real state.
- DESIGN.md at the repo root is now the visual reference. The old token and component inventory docs are stubs that point to it.
- The page-archetype UX contract and the component checklist were kept. They describe states, flows and a11y rather than visuals, so they don't belong in DESIGN.md.

## Tried and ruled out
- Treating the glass save bar as drift to make opaque: rejected by the user, who wants it kept as the signature element.
- Merging the page-pattern contract into DESIGN.md: DESIGN.md is visual-only by format, so it would end up holding UX rules it can't express.
- Other north-star names offered: "The Quiet Instrument Panel" and "The Back Office Desk".

## Watch out
- The older learning "no backdrop-blur outside components/ui" still holds for new sticky bars. It does not mean the save bar should be flattened.
- DESIGN.md is about 18KB. `impeccable doctor` flags it as sprawl and suggests `impeccable design-compact`, which still needs the user's agreement.

In the code: DESIGN.md (The One Glass Pane Rule, The Flat-Ledger Rule); .impeccable/design.json; src/index.css `.unsaved-bar`; .planning/design/system/{tokens,components}.md are stubs; CLAUDE.md + AGENTS.md Styling Reference point to DESIGN.md.
