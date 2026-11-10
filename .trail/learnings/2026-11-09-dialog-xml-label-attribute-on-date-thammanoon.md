---
title: "Dialog XML Label attribute on <Date>/<Lookup> and <Group>"
author: Thammanoon
date: 2026-11-09
id: l-dccd93f4
scope: repo
status: active
touches:
  - docs/superpowers/specs/2026-10-08-dialog-control-label-attr-design.md
  - src/components/DialogPreview.tsx
---

## Decided
`Label="…"` on `<Date>`/`<Lookup>` = standalone field (never takes preceding `<Label>`, never a From/To range — use `<Group>`); trimmed, empty → Name. `<Group Label>` = heading. Spec `docs/superpowers/specs/2026-10-08-dialog-control-label-attr-design.md`. Merged 2026-10-09: platform #340 56a973ff, inventory #264 07fa7c3b, micro-report #29 3c67dd65 (main push → DEV for platform+inventory; not on production).

**Why:** old inventory drops controls with no preceding `<Label>`, so `Label=` fields vanish silently on old builds.

## Watch out
- No live template may use `Label=` on a control until inventory #264 is on inventory production; then delete the `labelAttrNeedsInventory` notice line in `src/components/DialogPreview.tsx`. `<Group Label>` itself is safe (still subject to project-dialog-xml-columns Group rule).
- Next specs the user asked for: A = property panel in layout editor, C = add/remove fields (project-dialog-layout-editor).
- Deferred minors: labelWithoutControl wording when a self-labelled control follows; same-Label groups announced identically; inventory heading id from first field Name.
…

_From Claude Code's memory of this repo, last updated Oct 8._
