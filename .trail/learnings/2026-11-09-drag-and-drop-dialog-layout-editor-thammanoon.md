---
title: Drag-and-drop Dialog layout editor on the Report Template Preview tab
author: Thammanoon
date: 2026-11-09
id: l-aced05e7
scope: repo
status: active
touches:
  - docs/superpowers/specs/2026-10-08-dialog-layout-editor-design.md
  - docs/superpowers/plans/2026-10-08-dialog-layout-editor.md
  - src/utils/dialogXmlEdit.ts
  - "src/components/dialogPreview/DialogLayoutEditor.tsx#DialogLayoutEditor"
  - "src/components/KeyboardShortcuts.tsx#useGlobalShortcuts"
---

## Decided
Spec `docs/superpowers/specs/2026-10-08-dialog-layout-editor-design.md`, plan `docs/superpowers/plans/2026-10-08-dialog-layout-editor.md`. Builds on project-dialog-xml-columns.

**Why:** authors arrange `Cols`/`ColSpan`/`<Group>` without typing XML. All edits are pure `xml → xml` ops in `src/utils/dialogXmlEdit.ts` (DOM mutate + XMLSerializer); the editor holds no XML and calls the page's `handleXmlChange('dialog')`.

## Watch out
- dnd-kit 6.3.1 does NOT tear down an active KeyboardSensor when DndContext unmounts — the next Space/Enter/Tab runs the stale onDragEnd and writes old XML into the form. `DialogLayoutEditor` guards with a mounted ref; keep it.
- Esc is shared by dnd-kit and `useGlobalShortcuts` on window: the page keeps a drag-active ref cleared via setTimeout(0).
- Browser-testing keyboard drags: the stale Vite checker overlay (see reference-stale-vite-checker-overlay) swallows keys after reload — close it first or the drag silently never starts.
…

_From Claude Code's memory of this repo, last updated Oct 8._
