---
title: Dialog XML Cols/ColSpan/Group
author: Thammanoon
date: 2026-11-09
id: l-aa0f6b10
scope: repo
status: active
touches:
  - docs/superpowers/specs/2026-10-08-dialog-xml-columns-design.md
  - docs/dialog-xml/README.md
  - src/components/DialogPreview.tsx
  - src/utils/dialogXml.ts
---

## Decided
Report-template dialog XML gained `<Dialog Cols>`, `ColSpan`, `<Group>` (spec `docs/superpowers/specs/2026-10-08-dialog-xml-columns-design.md`, format doc `docs/dialog-xml/README.md`). Merged 2026-10-08 (merge commits): platform #337 `dca322b2`, inventory #262 `ed046b32`, micro-report #28 `d1650f6` (test only). Platform + inventory auto-deploy to DEV on main push; not on any production (platform needs `git push origin main:vercel`).

**Why:** the dialog XML is read in 4 places (platform preview, inventory run dialog, inventory schedule form, micro-report `parseDialogDefs`); old inventory parsers read only direct `<Dialog>` children, so `<Group>` content vanishes silently on old builds.

## Watch out
- No live template may use `<Group>` until inventory #262 is on inventory production; then delete the `groupNeedsInventory` notice line in `src/components/DialogPreview.tsx`.
- Preview parser `src/utils/dialogXml.ts` is a port of inventory `parse-report-dialog.ts` groupFields — change both together; shared fixtures in `docs/dialog-xml/fixtures/` are copied by hand into inventory `routes/report/list/__fixtures__/dialog-xml/`.
- micro-report `TestBuildFilterSubtitle` already fails on main (expects `Status: ALL`, gets `-`) — not from this work.
…

_From Claude Code's memory of this repo, last updated Oct 8._
