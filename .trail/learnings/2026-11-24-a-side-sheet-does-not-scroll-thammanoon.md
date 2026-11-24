---
title: "A side Sheet does not scroll on its own, so long content in it needs its own scrolling area"
author: Thammanoon
date: 2026-11-24
branch: main
cost: { minutes: 23, tokens: 358442 }
id: l-658595d6
scope: repo
status: active
src: agent
touches:
  - src/components/BuSwitcher.tsx
  - src/components/Sidebar.tsx
  - DESIGN.md
  - src/components/ui/sheet.tsx
  - design-plans/capacity-meter-tags.md
  - src/pages/clusterManagement/CapacityMeter.tsx
  - src/i18n/en.ts
---

## Decided
The mobile nav drawer was cut off at 390px: the menu is ~1950px tall, Radix locks body scroll while a Sheet is open, and the Sheet primitive has no overflow rule, so everything below the fold could not be reached. Fixed by making the Sheet content a flex column with the list as the scrolling child, without touching the ui primitive.
2026-11-24, user decision: the table capacity meter gets a word for its most severe level too. At or over 100% of cap it shows "full" / "เต็ม" in destructive ink on a 15% destructive tint, matching the existing "near" tag (≥90%). Both tags use the Label size (12px, weight 500) instead of 9px bold. One word covers both 10/10 and 12/10; the used/cap figures beside it say whether the cap is exceeded. Below 90% there is still no tag.

## Watch out
- Any Sheet whose content can exceed the viewport (long forms, nav, lists) needs the same treatment. It looks fine on desktop and in tests; it only fails on a short screen.
- Reproduce it with a same-origin iframe 390x844, open the drawer, compare the last link's bottom with the iframe height. `resize_window` does not narrow the viewport.
- The design detector flags the sidebar's 10px counters, the 4px active bar and 10px mono Kbd as off-ramp. DESIGN.md documents all three, so leave them.

In the code: src/components/Sidebar.tsx mobile `<SheetContent className="flex w-72 flex-col p-0">`, header/headerSlot `shrink-0`, `<nav className="flex-1 overflow-y-auto overscroll-contain …">`. src/components/ui/sheet.tsx left variant has `h-full` and no overflow. PR #491.
The original test asserts that no tag appears at the cap. That came from the first version and has no recorded reason; change the assertion to expect "full" rather than treating the test as a design contract. On the licences page the BU-quota column catches cap 0 before the meter ("No licence"), but on /clusters a cluster with cap 0 that is using units will show "full". That is intended.

In the code: src/pages/clusterManagement/CapacityMeter.tsx `TAG` map (+ `over` entry), tag span `text-xs font-medium`; i18n `components.fleetCapacity.fullTag` in src/i18n/en.ts / th.ts; plan design-plans/capacity-meter-tags.md (written against bf6273d6, not yet implemented).

## Tried and ruled out
- "limit" / "ถึงเพดาน": dropped in favour of the shorter word that pairs with near/ใกล้เต็ม.
- Splitting "full" (=cap) from "over" (>cap): needs a new capacity level shared with the fleet gauge and allocation ticks. That is too wide for a label.
- A solid Badge: undoes the low-ink tinted look chosen for the clusters page.
