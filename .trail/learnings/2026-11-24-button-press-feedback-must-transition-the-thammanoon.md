---
title: "Button press feedback must transition the scale property, and tooltips share one app-wide provider"
author: Thammanoon
date: 2026-11-24
branch: fix/motion-ui-primitives
cost: { minutes: 6, tokens: 182092 }
id: l-da96cbc3
scope: repo
status: active
src: agent
touches:
  - src/App.tsx
  - src/components/ui/button.tsx
  - src/components/ui/data-table.tsx
  - src/components/ui/dropdown-menu.tsx
  - src/components/ui/sheet.tsx
  - src/components/ui/tabs.tsx
  - src/components/ui/tooltip.tsx
---

## Decided
2026-11-24 motion pass (user approved editing components/ui): buttons shrink to 0.97 while pressed (150ms, strong ease-out, off under reduced motion). Tooltips sit under one provider at the app root so moving from one tooltip to the next opens instantly with no animation; a tooltip rendered outside that provider wraps its own, so tests and isolated trees keep working.

## Tried and ruled out
Listing `transform` in the button's transition: Tailwind v4 writes `active:scale-*` as the CSS `scale` property, not `transform`, so the press snapped with no transition. The list must name `scale`.
Moving the provider to the root and dropping the per-tooltip one outright: every tooltip rendered without the root provider (unit tests) would throw.

## Watch out
Any new hover/press scale, rotate or translate in Tailwind v4 animates `scale` / `rotate` / `translate` properties — `transition-transform` alone does not cover them; check computed `transition-property` in the browser.
Popovers that zoom in need the Radix transform-origin variable, or they grow from their centre.

In the code:
- src/components/ui/button.tsx: `transition-[color,background-color,border-color,scale] duration-150 ease-[cubic-bezier(0.23,1,0.32,1)] active:scale-[0.97] motion-reduce:active:scale-100`
- src/components/ui/tooltip.tsx: `TooltipProvider` (skipDelayDuration 300) + `SharedProvider` context fallback; `data-[state=instant-open]:animate-none`
- src/App.tsx: `<TooltipProvider>` wraps `<Router>`
- origin classes: `origin-(--radix-dropdown-menu-content-transform-origin)`, `origin-(--radix-tooltip-content-transform-origin)`
