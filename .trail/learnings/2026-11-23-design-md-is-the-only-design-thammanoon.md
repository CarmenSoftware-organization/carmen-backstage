---
title: DESIGN.md is the only design document; the old design folder under .planning was deleted
author: Thammanoon
date: 2026-11-23
branch: chore/design-md-only
cost: { minutes: 1, tokens: 3030 }
id: l-7f8b3385
scope: repo
status: active
replaces: l-9418ce88
src: agent
touches:
  - DESIGN.md
  - ".impeccable/design.json"
  - src/index.css
  - tailwind.config.js
  - CLAUDE.md
  - AGENTS.md
---

## Decided
2026-11-23, user decision: DESIGN.md at the repo root, with its sidecar .impeccable/design.json, is the single design reference. The .planning/design/ folder is deleted: the tokens, components, page-patterns and component-checklist docs, plus the 2026-07-17 UX audit scorecard. Token values still come from src/index.css and tailwind.config.js.

## Tried and ruled out
Keeping page-patterns.md and the component checklist next to DESIGN.md as UX contracts. The user wanted one design doc. Page-archetype rules are already in agent-os/standards/pages/.

## Watch out
Older plans and specs under docs/superpowers/ still link to .planning/design/system/*. Those links are historical and now dead; read the files from git history (e.g. `git show ba733684:.planning/design/system/page-patterns.md`) if you need them.

In the code: DESIGN.md; .impeccable/design.json; CLAUDE.md + AGENTS.md Styling Reference.
