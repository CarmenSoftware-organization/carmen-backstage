---
title: "Converting a BU Edit control to InlineField makes 'no combobox without permission' tests pass vacuously; assert the read-mode button is disabled"
author: Thammanoon
date: 2026-11-03
branch: feature/bu-general-spec-sheet
cost: { minutes: 18, tokens: 309499 }
id: l-b45644c7
scope: repo
status: active
src: agent
touches:
  - src/components/AuditMeta.tsx
  - src/components/notes/NoteComposer.tsx
  - src/components/notes/NoteFilesPanel.tsx
  - src/components/notes/NoteItem.tsx
  - src/components/notes/NotesSection.tsx
  - src/pages/businessUnitEdit/sections/CalculationSettingsSection.tsx
  - src/pages/BusinessUnitEdit.test.tsx
---

## Decided
BU Edit General tab (2026-11-03, option A): Calculation method / Default currency in `src/pages/businessUnitEdit/sections/CalculationSettingsSection.tsx` are now `InlineField` rows (same grammar as the Details card); the section takes a required `onCommit`. Read-only Code / Max users render as plain text (`StaticValue` in `BusinessUnitDocument.tsx`), not `ReadOnlyText` — the bordered box looked like an input while the editable InlineField rows looked like plain text (inverted affordance). Hero initials use `brandInitials(name, code)` from `components/BrandMark.tsx`, same as the Branding card.

## Watch out
- An InlineField only mounts its `<select>`/`<input>` after the read button is clicked. A permission test asserting `queryByRole('combobox') === null` therefore passes for every user. `src/pages/BusinessUnitEdit.test.tsx` now asserts the read button (`/set calculation method/i` — fixture has no method) is disabled without cluster.update, and enabled + opens a combobox with it. Do the same for any other field converted to InlineField.
- InlineField's empty select option is `disabled`, so a select-type InlineField cannot be cleared back to "". The old currency `<select>` allowed clearing; that ability is gone.
- After changing a component's required props the Vite checker overlay can keep showing the old error at a stale line number; trust `bun run typecheck`.
