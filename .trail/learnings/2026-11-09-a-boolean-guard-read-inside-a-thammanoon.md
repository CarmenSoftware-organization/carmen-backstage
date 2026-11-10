---
title: A boolean guard read inside a Radix dismiss-layer callback (onEscapeKeyDown etc.) must…
author: Thammanoon
date: 2026-11-09
id: l-f0fa55cd
scope: repo
status: active
touches:
  - src/components/UserPicker.tsx
  - src/pages/SuperAdminManagement.tsx
  - "src/components/AvatarCropDialog.tsx#AvatarCropDialog.onKeyDown"
  - "src/components/typeahead/useTypeahead.ts#useTypeahead.onKeyDown"
  - "src/pages/businessUnitEdit/InlineField.tsx#InlineField.onKeyDown"
---

## Decided
Guarding a Radix Dialog's Escape (`<DialogContent onEscapeKeyDown={e => { if (flag) e.preventDefault(); }}>`)
works **only if `flag` is a `useRef().current`**. With `useState` the guard silently never fires.

**Why:** Radix invokes `onEscapeKeyDown` through a callback that does not stay fresh across renders
under React 19.2.7's native `useEffectEvent`, so the state value captured in that closure stays at its
initial `false` while app state is truly `true`. Nothing warns; the code reads correctly and two
reviewers approved it before a browser test caught it.

**How it was proven** (repeat this if it recurs): replace the guard body with an unconditional
`e.preventDefault()`. If the dialog then stays open, the Radix mechanism works and the bug is the value
being read, not the wiring.

**Related mechanics, verified in `node_modules`:**
- `react-dismissable-layer/dist/index.mjs:85-99` — dismisses only `if (!event.defaultPrevented)`, on a
  **capture-phase** `document` keydown listener, so a bubble-phase `stopPropagation()` inside the dialog
  can never beat it.
- `react-dialog/dist/index.mjs:227` — `DialogContentImpl` spreads `...contentProps` onto
  `DismissableLayer`, which is why `onEscapeKeyDown` reaches it even though react-dialog never names it.

Because Radix's capture handler runs first, a dropdown inside the dialog needs its own **document-level**
Escape listener (bubble phase is fine) — an `onKeyDown` on the input only fires when the input itself has
…

_From Claude Code's memory of this repo, last updated Aug 6._
