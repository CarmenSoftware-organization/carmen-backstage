# Lazy Pickers Round 3 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Remove the last "load every row up front" pickers (`BuSwitcher`'s parents and the cron report-template `<Select>`), and collapse the duplicated open/close/keyboard code of the typeahead pickers into one shared shell. The shell fixes the parked minors from round 2.

**Owner decision (2026-11-02):** the owner skipped the brainstorming questions ("เริ่มเลย"). Every **Decided** item below is the builder's call, recorded so the owner can review it in the PR.

**Prior art:** round 2 spec + plan (`docs/superpowers/specs/2026-11-02-lazy-pickers-round-2-design.md`, `docs/superpowers/plans/2026-11-02-lazy-pickers-round-2.md`). `usePagedSearch`, `useHydratedOptions`, `hydrateByKeys`, `useBusinessUnitSearch`, `LoadMoreErrorRow` already exist. Reuse them; don't fork them.

## Global Constraints

- **No new test files** (owner preference). Every task ends with `bun run typecheck`, `bunx eslint <changed files>`, `bun run test`. Existing tests that break because of an intended behavior change get **updated**, not deleted.
- Page size 20, debounce 400 ms, scroll trigger `isNearBottom` (48 px), as in round 2.
- Never call an endpoint a page did not call before. `BuSwitcher`'s parents already call `businessUnitService.getAll`; `ReportConfigFields` already calls `reportTemplateService.getAll`.
- Never drop a saved value that hydration couldn't find. Show it as a muted not-found / "Couldn't load" + retry, as `ClusterPicker` does now.
- Saved payloads stay byte-identical when the user doesn't touch the picker.
- No changes to `src/components/ui/*`. A `Card` that hosts a dropdown gets `className="overflow-visible"`.
- i18n: every new key goes in both `src/i18n/en.ts` and `src/i18n/th.ts`.
- One branch, `feature/lazy-pickers-round-3`, one PR. Commit per task.

---

## Task 1: `BuSwitcher` searches the server itself

**Problem:** `SqlWorkbench`, `BackstageMigrationManagement` and `TenantImportWizard` each `fetchAllBusinessUnits` (up to 1,000 rows, 10 requests) just to feed `BuSwitcher`, which then filters in memory.

**Decided:**
1. `BuSwitcher` drops the `businessUnits` prop. It calls `useBusinessUnitSearch(search, open)` (server search, code-sorted, 20 per page). The list `onScroll` → `loadMore` via `isNearBottom`, with a "loading more" row and `LoadMoreErrorRow`. Show loading / error / empty states inside the list.
2. The callbacks return objects, not codes: `onSelect(bu: BusinessUnitOption)` and `onSelectMany(bus: BusinessUnitOption[])`. Parents store the object. `BusinessUnitOption` already has `id`, `code`, `name` and `cluster_name`, which are every field the three parents read (`ConnectionBar` reads code/name/cluster_name; TenantImportWizard reads id/code; migrations reads code and passes rows to `runOpBatch`). Widen those local types to `BusinessUnitOption` (or a `Pick<BusinessUnit, …>`) instead of casting.
3. All three parents delete their `businessUnits` state and their `fetchAllBusinessUnits` call. Also delete `buLoadedRef` in migrations and the `byCode` maps. If `fetchAllBusinessUnits` ends up with no callers, leave it alone; another round can remove it.
4. **Recents:** store the objects `{id, code, name, cluster_name}`, most recent first, max 5, under a new key `sqlwb_recent_bus_v2`. Legacy `sqlwb_recent_bus` (bare codes) is ignored, which loses at most 5 recents once. That is an accepted cost. The recents section shows only when the query is empty, and it is de-duplicated against the server list (a recent BU is not repeated below).
5. **Grouping by cluster is dropped.** It can't be right with paged results. With no query, the list is: Recent, then all BUs flat, sorted by code. The cluster tag already on each row (`sm:` and up) carries the cluster.
6. **Counts:** add `total: number | null` to `PagedSearchResult` (from `paginate.total` of the latest page 1; `null` when unknown) in `usePagedSearch`. The header count shows `total` when known and hides when unknown. The placeholder `switcher.searchBuPlaceholder` must stop needing `{count}`: add a count-free key and keep the old one only if something else uses it.
7. **Multi mode:** `checked` holds objects keyed by code, so a pick survives a query change. `onSelectMany` receives them **sorted by code**, because "display order" no longer exists across queries. Update the JSDoc that says "display order".
8. Keyboard (ArrowUp/Down/Enter, ⌘/Ctrl+Enter in multi), `aria-activedescendant`, the `Kbd` footer and the `⌘B` toggle all stay. Reset the active index when results change.
9. Permission: the parents already called the BU list unconditionally on mount. Searching only while `open` is stricter, so no gate changes.

**Files:** `src/components/BuSwitcher.tsx`, `src/components/BuSwitcher.test.tsx` (update it to mock the service/hook instead of passing `businessUnits`), `src/hooks/usePagedSearch.ts`, `src/pages/sqlWorkbench/SqlWorkbench.tsx` (and `ConnectionBar.tsx` prop type if needed), `src/pages/BackstageMigrationManagement.tsx`, `src/pages/TenantImportWizard.tsx`, `src/i18n/en.ts`, `src/i18n/th.ts`, `src/pages/CLAUDE.md` (it mentions BuSwitcher; fix the description if it says "pass the BU list").

**Watch out:** SqlWorkbench's `selectedBu` was derived from `businessUnits.find`. It becomes state set by `onSelect`. Check every place that read `selectedBu`, and the effect keyed on `buCode`. Keep `buCode` as the source of truth that the effects depend on: set both from the picked object.

---

## Task 2: Shared typeahead shell, piloted on `ClusterPicker`

**Problem:** `ClusterPicker`, `BusinessUnitPicker`, `BusinessUnitMultiSelect`, `BusinessUnitCodePicker`, `UserMultiSelect`, `UserPicker` and `CustomerPicker` each hand-roll the same open state, outside click, Escape, open-state reporting and dropdown body. The parked minors:
- (a) focus fires late after a rejected clear or while disabled (`focusPending` never cleared)
- (b) Tab-out doesn't close the dropdown
- (c) the activity-events filter Sheet needs one extra Escape after a non-typing key
- (d) `aria-invalid` sits on the chip `div`
- (e) no `listbox`/`option` roles
- (f) open-state reporting is inconsistent (`UserPicker.onDropdownOpenChange`)

**Decided:** a **hook plus small presentational pieces**, not one mega-component. The chip/multi-chip rendering differs too much between pickers.

`src/components/typeahead/useTypeahead.ts`:
```ts
useTypeahead<T>({
  items: T[];                 // currently selectable rows, in display order (pinned rows included by caller)
  getKey: (item: T) => string;
  isDisabled?: (item: T) => boolean;
  onPick: (item: T) => void;
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
  hasMore?: boolean; loadingMore?: boolean; loadMoreError?: string; loadMore?: () => void;
}) => {
  open: boolean; setOpen: (next: boolean) => void;  // single choke point; reports to onOpenChange only on real change; releases on unmount
  activeIndex: number;
  wrapperRef; inputRef; listId: string;
  inputProps: {...};     // role=combobox, aria-expanded, aria-controls, aria-activedescendant, aria-autocomplete=list, onFocus→open, onKeyDown
  listProps: {...};      // id, role=listbox, onScroll→loadMore (isNearBottom, skipped while loadMoreError)
  getOptionProps: (item, index) => {...};  // id, role=option, aria-selected, aria-disabled, onClick, onMouseMove→active
  requestFocus: () => void;  // focus-after-mount; dropped if disabled or the input doesn't mount within the same commit cycle (fixes a)
}
```
Behavior:
- **ArrowDown/ArrowUp** move the active index, wrapping and skipping disabled items. ArrowDown opens when closed. **Enter** picks the active item (preventDefault so forms don't submit). **Escape** closes with `preventDefault` + `stopPropagation`, **only when open**. When closed, Escape passes through so the surrounding Sheet/Dialog closes on the first press (fixes c). Find c's actual cause in `ActivityEventManagement`'s filter Sheet first, and make sure the fix covers it.
- **Tab / focus leaving the wrapper** closes the dropdown (`focusout` with `relatedTarget` outside `wrapperRef`) (fixes b). Outside `mousedown` closes it, as today.
- Every state where the dropdown can't be seen (disabled, chip shown) reports closed, as `ClusterPicker` does today.

`src/components/typeahead/TypeaheadStatus.tsx`: the shared dropdown status rows (searching…, error, empty / type-to-search, loading more, `LoadMoreErrorRow`), parameterised by message strings so each picker keeps its own i18n keys.

(d): `aria-invalid` goes on the focusable control (the input, or the chip's clear button group's container gets nothing). The chip `div` loses it.

**Pilot:** migrate `ClusterPicker` onto the shell in this task. Its visible behavior stays identical, except for the fixes and the new keyboard navigation.

**Files:** create `src/components/typeahead/useTypeahead.ts`, `src/components/typeahead/TypeaheadStatus.tsx`; modify `src/components/ClusterPicker.tsx`; update existing ClusterPicker tests if they break.

---

## Task 3: Migrate the remaining pickers onto the shell

Migrate `BusinessUnitPicker`, `BusinessUnitMultiSelect`, `BusinessUnitCodePicker`, `UserMultiSelect`, `UserPicker` and `CustomerPicker`. For each, keep the public props and value shape **except**:
- `UserPicker.onDropdownOpenChange` is renamed `onOpenChange` (fixes f). Update its 2 callers: `SuperAdminManagement.tsx:335` and `userBackstageManagement/GrantAccessDialog.tsx:123`.
- Any picker that lacks `onOpenChange` gets one.

Multi-selects: picking toggles/adds and keeps the dropdown open with focus in the input, as today. Backspace in an empty input removing the last chip stays where it exists. Don't add it where it doesn't.

If one picker's shape genuinely doesn't fit the hook (say so in the report, with the reason), leave it unmigrated rather than bending the hook.

**Files:** the 6 components, their 2 callers above, their existing tests.

---

## Task 4: `ReportTemplatePicker` for cron report jobs

**Problem:** `ReportConfigFields` loads every report template (`fetchAllPages`) into a Radix `<Select>`.

**Decided:**
- New `src/components/ReportTemplatePicker.tsx`, single-select, value = template **id** (`template_id` stays an id). It is built on the Task 2 shell, modelled on `ClusterPicker` (chip shows `name`, sub-line `report_group`).
- `src/hooks/useReportTemplateSearch.ts` = `usePagedSearch` over `reportTemplateService.getAll({ page, perpage, search, sort: 'name:asc' })`. The service already sends `searchfields` name/description/report_group. Check the sort key against swagger (`/api-system/report-templates`). If `name:asc` is rejected, use what the list page sends.
- Hydrate a saved `template_id` with `hydrateByKeys(ids, 'id', …)` + `useHydratedOptions`. Not found keeps the id and shows "Not found · <8 chars>"; a failed load shows "Couldn't load" + retry, the same as ClusterPicker.
- `readOnly` → `disabled` (chip only, no clear).
- `ReportConfigFields` drops `templates`/`loadingTemplates`/`templatesError` state and the `fetchAllPages` effect. Check whether `cronjob.config.templateIdLoadFailed` becomes unused; remove the key from en/th only if nothing else uses it.
- This picker sits in the cron job config form (inside a dialog/sheet?). Check for clipping and Escape layering, and pass `onOpenChange` to whatever guard the container uses (as the BU multi-select beside it does).

**Files:** create the component and hook; modify `src/pages/cronjobs/jobConfig/ReportConfigFields.tsx`, `src/i18n/en.ts`, `src/i18n/th.ts`.

---

## Review Focus

1. **SqlWorkbench BU switch mid-query:** the `buCodeRef` stale-response guard must still work now that `selectedBu` is state (Task 1).
2. **Migrations multi-pick across two searches:** pick A under query "a", then B under query "b"; confirm → both, sorted by code (Task 1).
3. **Escape layering:** the first Escape closes an open dropdown only; the second closes the Sheet/Dialog. A closed picker passes Escape straight through: GrantAccessDialog, AddRoleSheet, activity-events filter Sheet, cron job dialog (Tasks 2–4).
4. **Enter inside a form** never submits the form while the dropdown is open (Tasks 2–3).
5. **Saved `template_id` off page 1 / deleted** shows a name, or not-found, and is never cleared (Task 4).
