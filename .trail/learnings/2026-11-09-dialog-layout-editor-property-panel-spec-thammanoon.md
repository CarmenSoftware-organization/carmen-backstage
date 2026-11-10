---
title: Dialog layout editor property panel (spec A)
author: Thammanoon
date: 2026-11-09
id: l-be93966c
scope: repo
status: active
touches:
  - src/utils/dialogDataSources.ts
---

## Decided
Property panel for the Dialog layout editor: platform PR #341 (branch `feature/dialog-property-panel`), merged 2026-10-09 as 23b40984; pushing main deploys DEV, production still needs `git push origin main:vercel`.

- Unverified: editing the group heading in a browser, and Safari/Firefox.
- Trap: RowsEditor writes its draft on unmount (`onLeave`). That write is gated by `aliveRef` (a layout-effect cleanup in PropertyPanel). Without the gate, Cmd/Ctrl+S or Esc-cancel brings an unsaved draft back into formData.
- `src/utils/dialogDataSources.ts` must stay in sync with inventory `dataSourceMap`.
- Spec C (add/remove fields): PR #342, branch `feature/dialog-add-remove-fields`, merged 2026-10-09 as 6235edf8; pushing main deploys DEV, production still needs `git push origin main:vercel`. Undo is gated by mountedRef, the post-delete XML, and blockedSwitch. Builds on project_dialog_label_attr and project_dialog_layout_editor.

_From Claude Code's memory of this repo, last updated Oct 8._
