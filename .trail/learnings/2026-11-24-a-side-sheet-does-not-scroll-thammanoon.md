---
title: "A side Sheet does not scroll on its own, so long content in it needs its own scrolling area"
author: Thammanoon
date: 2026-11-24
branch: main
cost: { minutes: 18, tokens: 283199 }
id: l-658595d6
scope: repo
status: active
src: agent
touches:
  - src/components/BuSwitcher.tsx
  - src/components/Sidebar.tsx
  - DESIGN.md
  - src/components/ui/sheet.tsx
---

## Decided
The mobile nav drawer was cut off at 390px: the menu is ~1950px tall, Radix locks body scroll while a Sheet is open, and the Sheet primitive has no overflow rule, so everything below the fold could not be reached. Fixed by making the Sheet content a flex column with the list as the scrolling child, without touching the ui primitive.

## Watch out
- Any Sheet whose content can exceed the viewport (long forms, nav, lists) needs the same treatment. It looks fine on desktop and in tests; it only fails on a short screen.
- Reproduce it with a same-origin iframe 390x844, open the drawer, compare the last link's bottom with the iframe height. `resize_window` does not narrow the viewport.
- The design detector flags the sidebar's 10px counters, the 4px active bar and 10px mono Kbd as off-ramp. DESIGN.md documents all three, so leave them.

In the code: src/components/Sidebar.tsx mobile `<SheetContent className="flex w-72 flex-col p-0">`, header/headerSlot `shrink-0`, `<nav className="flex-1 overflow-y-auto overscroll-contain …">`. src/components/ui/sheet.tsx left variant has `h-full` and no overflow. PR #491.
