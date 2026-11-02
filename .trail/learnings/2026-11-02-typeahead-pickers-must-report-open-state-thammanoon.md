---
title: "Typeahead pickers must report open state from the real dropdown, never guess it from key events"
author: Thammanoon
date: 2026-11-02
branch: feature/lazy-pickers-round-3
cost: { minutes: 48, tokens: 200563 }
id: l-c9bb4f59
scope: repo
status: active
src: agent
touches:
  - src/pages/TenantImportWizard.tsx
  - src/pages/cronjobs/jobConfig/ReportConfigFields.tsx
  - src/pages/userBackstageManagement/GrantAccessDialog.test.tsx
  - src/components/BuSwitcher.tsx
  - src/components/BusinessUnitMultiSelect.tsx
  - src/components/BusinessUnitPicker.tsx
  - src/components/ClusterPicker.tsx
  - src/components/CustomerPicker.tsx
  - src/components/LoadMoreErrorRow.tsx
  - src/components/ReportTemplatePicker.tsx
---

## Decided
- All typeahead pickers (ClusterPicker, BusinessUnitPicker, BusinessUnitMultiSelect, BusinessUnitCodePicker, UserMultiSelect, UserPicker, CustomerPicker, ReportTemplatePicker) run on `src/components/typeahead/useTypeahead.ts`. Its `setOpen` is the one place open state changes; `onOpenChange` fires synchronously and only on real changes, and `open` is false whenever the dropdown can't be seen (disabled / chip shown).
- While the dropdown is visibly open, Enter always preventDefaults (picks only an enabled active row) so a host `<form>` (e.g. SubscriptionCreateForm) never submits mid-search. Closed → Enter passes through.
- The active row is marked with `data-active`; `aria-selected` means "checked" in multi-selects. Style highlight with `data-[active]:`, never `aria-selected:`.
- Handlers go through `getInputProps(user)` / `getWrapperProps(user)`, which chain the caller first; a caller that preventDefaults Tab/Escape/Arrow/Enter disables the hook's handling.

## Tried and ruled out
- Round 2's "activity-events Sheet needs an extra Escape" was first blamed on Tab leaving the dropdown open. Real cause: BusinessUnitCodePicker's `onKeyDownCapture` called `setOpen(true)` on every non-Escape key (Shift, arrows), so the Sheet's `buPickerOpenRef` guard went true while the dropdown was invisible and swallowed the next Escape. Fix was deleting the guessed state and forwarding the inner picker's real `onOpenChange`.
- `stopPropagation` in the picker can't stop a Radix Dialog/Sheet closing: DismissableLayer listens on document in the capture phase. The container `onOpenChange` → ref → `onEscapeKeyDown` preventDefault guard is the only mechanism.

## Watch out
- `listProps` preventDefaults mousedown so clicks on status text keep focus in the input (otherwise focus moves to Radix content tabIndex=-1 and focusout closes the dropdown). Scrollbar dragging under that was not browser-verified as of 2026-11-02.
- BuSwitcher results belong to the debounced query (`usePagedSearch().resultsQuery`); Enter on a stale list would connect SQL Workbench to the wrong tenant, so it's gated on `pending`.
