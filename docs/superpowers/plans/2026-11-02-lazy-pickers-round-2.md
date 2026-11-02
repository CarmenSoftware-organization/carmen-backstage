# Lazy Pickers Round 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace every remaining picker that loads an unbounded list up front (BU multi-select, cron recipients, the analytics BU filter, and the cluster selects) with server search plus infinite scroll. Values that are already selected must keep showing readable names.

**Architecture:** One generic hook, `usePagedSearch<T>`, owns the debounce, generation guard and paging logic. A second hook, `useHydratedOptions<T>`, resolves ids or codes that are already selected, using `advance where … in` in chunks of 100. Entity hooks (`useBusinessUnitSearch`, `useUserSearch`, `useClusterSearch`) become thin wrappers over them. Each picker keeps its caller-facing value shape, so saved data does not change.

**Tech Stack:** React 19 + TypeScript, Vite, Tailwind, existing services (`businessUnitService`, `userService`, `clusterService`, `applicationService`). No new libraries.

**Spec:** `docs/superpowers/specs/2026-11-02-lazy-pickers-round-2-design.md`. Read it first. Its **Decided** section is binding.

## Global Constraints

- **No new test files** (owner preference). Skip TDD steps. Every task ends with `bun run typecheck`, `bunx eslint <changed files>`, and `bun run test` (the existing suite must stay green; update existing tests that break, don't delete them unless the module they test is deleted).
- Page size **20**, debounce **400 ms**, scroll trigger **48 px** from the bottom of the dropdown list, hydration chunk **100** values per request, run with `Promise.allSettled`.
- `hasMore` = `page * perpage < paginate.total` when `total` is a number, otherwise `lastPage.length === perpage`.
- **Never** make a picker call an endpoint its page did not call before. A, B and C add no gates. D keeps each caller's existing `cluster.read`-style gate as `canSearch`.
- **Never** drop a selected value that hydration couldn't find. Render it as a muted not-found chip with a remove button. A user shows as `Unknown user · <first 8 chars of id>`, and a BU shows as its code.
- Saved payloads are byte-identical when the user doesn't touch the picker. Cron `recipients` / `user_ids` stay user **ids**.
- No changes to `src/components/ui/*`. Any `Card` hosting one of these dropdowns gets `className="overflow-visible"`. Check dialogs (`TemplateEditDialog`, `GrantAccessDialog`, `AddRoleSheet`) for clipping too.
- Don't filter or sort on `customer_id` / `customer`. Use `searchfields` only as each service already sends them.
- i18n: every new key goes in both `src/i18n/en.ts` and `src/i18n/th.ts`.
- Branches: one per PR, cut from fresh `main`: `feature/lazy-pickers-a-bu-multi`, `feature/lazy-pickers-b-cron-recipients`, `feature/lazy-pickers-c-analytics`, `feature/lazy-pickers-d-cluster`. When this plan ships, `docs/superpowers/plans/` and the spec go in PR A.

## Review Focus

1. **Saved selection off page 1.** Example: a template allow-list with a code that sorts late. Expect chips with names after hydration, never an empty chip row. Owner: Task 2. Verify by opening such a record.
2. **Stale or deleted value in a saved config.** Expect a muted not-found chip that can be removed. Saving untouched keeps the value. Owner: Tasks 1 and 3. Verify by editing a value to a fake id in DevTools or the debug sheet.
3. **Fast typing then scrolling.** A late page-2 response from the previous query must not append to the new query's results. This is the generation guard in `usePagedSearch`, Task 1. Verify with throttled network.
4. **Dropdown clipped by its container** (Card `overflow-hidden`, dialog scroll area), on desktop and at 390 px. Owners: Tasks 2, 3, 4, 6, 7, 8.
5. **Cold load from URL** (`ActivityEventManagement?bu_code=X`): the filter chip shows the code, then the name. The filter value is never reset to "All". Owner: Task 4.

---

## PR A: `feature/lazy-pickers-a-bu-multi`

### Task 1: Generic paged search and hydration hooks, ported onto the BU and user search hooks

**Files:**
- Create: `src/hooks/usePagedSearch.ts`
- Create: `src/hooks/useHydratedOptions.ts`
- Modify: `src/hooks/useBusinessUnitSearch.ts`. Keep the exported `BusinessUnitOption`, `BusinessUnitSearchResult`, `useBusinessUnitSearch(query, enabled)` signature and return shape. The body becomes a wrapper.
- Modify: `src/hooks/useUserSearch.ts`. Same signature; the return gains the paging fields.
- Modify: `src/components/BusinessUnitPicker.tsx`. Replace its local threshold logic with `isNearBottom`.
- Modify: `src/components/UserMultiSelect.tsx:118` (dropdown div). Add `onScroll` → `loadMore`, a "loading more" footer, and the not-found chip for options with no `name`.
- Modify: `src/i18n/en.ts`, `src/i18n/th.ts`. Add `components.userPicker.loadingMore` and `components.userPicker.unknownUser` ('Unknown user' / 'ไม่ทราบผู้ใช้'), and `components.businessUnitPicker.notFound` ('Not found' / 'ไม่พบ').

**Interfaces:**
- Produces, in `usePagedSearch.ts`:
  ```ts
  export interface PagedPage<T> { data?: T[]; paginate?: { total?: number } }
  export interface PagedSearchResult<T> {
    results: T[]; loading: boolean; loadingMore: boolean; error: string;
    hasMore: boolean; loadMore: () => void; refresh: () => void;
  }
  export function usePagedSearch<T extends { id: string }>(
    query: string,
    enabled: boolean,
    fetchPage: (args: { search: string; page: number; perpage: number }) => Promise<PagedPage<T>>,
    opts?: { pageSize?: number; debounceMs?: number },
  ): PagedSearchResult<T>;
  export const LOAD_MORE_THRESHOLD_PX = 48;
  export function isNearBottom(el: HTMLElement, thresholdPx?: number): boolean;
  ```
  `fetchPage` must be referentially stable. Callers define it at module level or wrap it in `useCallback`. Dedupe appended rows by `id`. Error text via `parseApiError(err).message`. A failed page 1 clears results; a failed `loadMore` keeps them and sets `hasMore=false`.
- Produces, in `useHydratedOptions.ts`:
  ```ts
  export const HYDRATE_CHUNK = 100;
  export function hydrateByKeys<T>(
    keys: string[], field: 'id' | 'code',
    fetchPage: (args: { advance: string; perpage: number }) => Promise<PagedPage<T>>,
  ): Promise<{ rows: T[]; failed: boolean }>;
  export function useHydratedOptions<T>(
    keys: string[], keyOf: (row: T) => string,
    fetchByKeys: (keys: string[]) => Promise<{ rows: T[]; failed: boolean }>,
  ): { byKey: Map<string, T>; pending: Set<string>; missing: Set<string> };
  ```
  `advance` = `JSON.stringify({ where: { [field]: { in: chunk } } })`. The hook fetches only keys not already in `byKey`, merges results into its map, uses a generation guard, and puts keys that weren't returned (or whose chunk failed) into `missing`.
- `useBusinessUnitSearch`: `fetchPage` = `businessUnitService.getAll({ page, perpage, search, sort: 'code:asc' })` mapped with the existing `toOption`. Return shape unchanged.
- `useUserSearch(query, enabled)` → `PagedSearchResult<UserOption>`. `fetchPage` = `userService.getAll({ page, perpage, search })` mapped `{ id, name: displayName(u), email }`.

- [ ] **Step 1:** Implement `usePagedSearch.ts` by moving the body of the current `useBusinessUnitSearch` into it, generalised over `fetchPage`.
- [ ] **Step 2:** Implement `useHydratedOptions.ts` as specified above.
- [ ] **Step 3:** Rewrite `useBusinessUnitSearch` and `useUserSearch` as wrappers over `usePagedSearch`. Switch `BusinessUnitPicker`'s scroll handler to `isNearBottom`.
- [ ] **Step 4:** Make `UserMultiSelect` changes: `onScroll` with `isNearBottom` and `loadMore`, a footer showing `components.userPicker.loadingMore`, and a chip for a `UserOption` with an empty `name` that renders `` `${t('components.userPicker.unknownUser')} · ${u.id.slice(0, 8)}` `` with muted styling.
- [ ] **Step 5:** Run `bun run typecheck && bunx eslint src/hooks src/components/BusinessUnitPicker.tsx src/components/UserMultiSelect.tsx && bun run test`. Expect a clean typecheck, no lint errors, and every test passing.
- [ ] **Step 6:** Browser check on `localhost:3304`. With `pageSize` temporarily set to 5 in the wrapper, Customer Edit's BU picker loads pages 1 → 2 → 3 and stops, with no duplicates. On BroadcastCompose, the user multi-select scrolls and loads more. Revert the page size.
- [ ] **Step 7:** Commit with `refactor(pickers): extract usePagedSearch + useHydratedOptions; lazy-load user search`.

### Task 2: `BusinessUnitMultiSelect` on server search

**Files:**
- Modify: `src/components/BusinessUnitMultiSelect.tsx`. Rewrite internals. Props are unchanged: `value: string[]`, `onChange(ids: string[])`, `disabled?`, `keyBy?: 'id' | 'code'`.
- Check: `src/pages/NewsEdit.tsx:473`, `src/pages/cronjobs/jobConfig/ReportConfigFields.tsx:156`, `src/pages/cronjobs/jobConfig/DashboardRefreshConfigFields.tsx:22`, `src/pages/dashboardTemplates/TemplateEditDialog.tsx:205,209`. No prop changes, but check each host container for clipping.
- Modify if it breaks: `src/pages/NewsEdit.test.tsx`.

**Interfaces:**
- Consumes: `useBusinessUnitSearch`, `isNearBottom` and `useHydratedOptions` / `hydrateByKeys` (Task 1).
- Search runs only while the dropdown is open. Hydration fetchPage = `businessUnitService.getAll({ page: 1, perpage, advance })`, with `field` = `keyBy`.

- [ ] **Step 1:** Replace the `fetchAllBusinessUnits` load and the client filter with `useBusinessUnitSearch(search, open && !disabled)`. Remove the `eslint-disable` it carried.
- [ ] **Step 2:** Render selected chips from `useHydratedOptions(value, b => keyBy === 'code' ? b.code : b.id, …)`. A pending key shows its raw value (code) or a skeleton chip (id). A missing key shows a muted chip with its raw value and `components.businessUnitPicker.notFound` as its title. Remove still works for every chip.
- [ ] **Step 3:** In the result list, rows already in `value` are shown as checked. Toggling adds or removes `keyBy` values. The list has infinite scroll and the "loading more" footer.
- [ ] **Step 4:** Add `className="overflow-visible"` to every `Card` that hosts the component and clips it. Check both `TemplateEditDialog` usages inside the dialog.
- [ ] **Step 5:** Run `bun run typecheck && bunx eslint src/components/BusinessUnitMultiSelect.tsx src/pages/NewsEdit.tsx src/pages/dashboardTemplates/TemplateEditDialog.tsx && bun run test`. Expect it to be clean and green.
- [ ] **Step 6:** Browser check:
  - Open a News item with linked BUs, and a dashboard template with an allow-list (`keyBy="code"`). Chips show names.
  - Save without changes. The Network tab payload equals the pre-change payload.
  - Check at 390 px.
- [ ] **Step 7:** Commit with `feat(pickers): BusinessUnitMultiSelect searches server-side with lazy load`, then open PR A. Include the spec, the plan and the Task 1 commit.

## PR B: `feature/lazy-pickers-b-cron-recipients`

### Task 3: Cron recipients on `UserMultiSelect`

**Files:**
- Create: `src/pages/cronjobs/jobConfig/UserIdsField.tsx`
- Modify: `src/pages/cronjobs/jobConfig/ReportConfigFields.tsx`. Remove the `fetchAllPages<User>` load (around line 70), `recipientUsers`/`recipientSearch` state and the checklist UI (around lines 224–281), and render `<UserIdsField value={value.recipients ?? []} onChange={(ids) => onChange({ ...value, recipients: ids })} … />`. Keep the label, `recipientsHint` and the C2 comment.
- Modify: `src/pages/cronjobs/jobConfig/NotificationConfigFields.tsx`. Make the same swap for `user_ids` (load around line 32, UI around lines 124–153). Keep the I2 comment.

**Interfaces:**
- Consumes: `UserMultiSelect` (with Task 1 changes), and `useHydratedOptions` / `hydrateByKeys` with `field: 'id'` over `userService.getAll({ page: 1, perpage, advance })`.
- Produces: `UserIdsField(props: { value: string[]; onChange: (ids: string[]) => void; disabled?: boolean; id?: string; error?: boolean })`. It hydrates `value` to `UserOption[]`: pending and missing ids become `{ id, name: '' }`, which renders as the unknown-user chip. `UserMultiSelect` reports a new `UserOption[]`, and the field emits `next.map(u => u.id)`.

- [ ] **Step 1:** Implement `UserIdsField`.
- [ ] **Step 2:** Swap it into both config field components and delete the now-unused state, effects and imports.
- [ ] **Step 3:** Run `bun run typecheck && bunx eslint src/pages/cronjobs && bun run test`. Expect it to be clean and green.
- [ ] **Step 4:** Browser check:
  - Open an existing report job and a notification job that have recipients. Names appear.
  - Add and remove a user, then save. The payload holds an ids array.
  - Save untouched. The payload is unchanged.
- [ ] **Step 5:** Commit with `feat(cronjobs): recipient pickers search users server-side`, then open PR B.

## PR C: `feature/lazy-pickers-c-analytics`

### Task 4: Analytics BU filter on a code-keyed picker, and application options with no cap

**Files:**
- Create: `src/components/BusinessUnitCodePicker.tsx`
- Modify: `src/pages/UsageAnalytics.tsx:142-148`. Replace the BU `<Select>` with the picker.
- Modify: `src/pages/ActivityEventManagement.tsx`. Replace the BU `<Select>`. Hold `buOption` state next to `buCode`. The chip at line 252 uses `buOption?.name ?? buCode`.
- Modify: `src/hooks/useAnalyticsFilterOptions.ts`. Delete `buOptions` and its request. Load applications with `fetchAllPages` (pageSize 100, maxPages 10, label `'analyticsAppOptions'`) instead of `perpage: 100`. Return `{ appOptions }`.

**Interfaces:**
- Consumes: `BusinessUnitPicker`, and `useHydratedOptions` / `hydrateByKeys` with `field: 'code'`.
- Produces: `BusinessUnitCodePicker(props: { value: string; onChange: (code: string, option: BusinessUnitOption | null) => void; canSearch: boolean; id?: string; placeholder?: string; disabled?: boolean; className?: string })`. `value` `''` means All. The component hydrates `value` once. When hydration resolves, it calls `onChange(value, option)` once with the same code. When the user clears the picker, it calls `onChange('', null)`.
- Both pages pass `canSearch={true}`, since they already call `GET /business-units` today.

- [ ] **Step 1:** Implement `BusinessUnitCodePicker`. A missing code shows as the not-found state, and the value is kept.
- [ ] **Step 2:** Wire both pages. The desktop width keeps the `w-[200px]` footprint, and the picker is full width below `sm`.
- [ ] **Step 3:** Update `useAnalyticsFilterOptions`, and remove `buOptions` readers.
- [ ] **Step 4:** Run `bun run typecheck && bunx eslint src/components/BusinessUnitCodePicker.tsx src/pages/UsageAnalytics.tsx src/pages/ActivityEventManagement.tsx src/hooks/useAnalyticsFilterOptions.ts && bun run test`. Expect it to be clean and green.
- [ ] **Step 5:** Browser check:
  - Open `/activity-events?bu_code=<real code>` cold. The chip shows the code, then the name, and the filter stays applied.
  - Pick and clear a BU on both pages.
  - Check at 390 px.
- [ ] **Step 6:** Commit with `fix(analytics): BU filter searches all BUs; app options no longer capped at 100`, then open PR C.

## PR D: `feature/lazy-pickers-d-cluster`

### Task 5: `useClusterSearch` + `ClusterPicker`

**Files:**
- Create: `src/hooks/useClusterSearch.ts`
- Create: `src/components/ClusterPicker.tsx`
- Modify: `src/i18n/en.ts`, `src/i18n/th.ts`. Add a `components.clusterPicker` block with `defaultPlaceholder`, `clearSelectedAria`, `searchingEllipsis`, `noMatch`, `typeToSearch`, `loadingMore`, `notFound`, mirroring `businessUnitPicker`'s copy for clusters.

**Interfaces:**
- Produces:
  ```ts
  export interface ClusterOption { id: string; code: string; name: string }
  export function useClusterSearch(query: string, enabled: boolean): PagedSearchResult<ClusterOption>;
  // fetchPage = clusterService.getAll({ page, perpage, search, sort: 'name:asc' })
  export const ClusterPicker: React.FC<{
    value: string;                                   // cluster id, '' = none
    onChange: (id: string, option: ClusterOption | null) => void;
    canSearch: boolean;
    pinned?: { value: string; label: string }[];     // fixed rows above results, e.g. "All clusters"
    id?: string; placeholder?: string; disabled?: boolean; ariaLabel?: string; className?: string;
  }>;
  ```
  `value` is hydrated by `id`, and calls back once on resolve, like `BusinessUnitCodePicker`. A `pinned` row's `value` is reported as `onChange(pinnedValue, null)` and displayed as its `label` when selected. Rows show name and code. Layout and behaviour copy `BusinessUnitPicker`.

- [ ] **Step 1:** Implement the hook and the component.
- [ ] **Step 2:** Run `bun run typecheck && bunx eslint src/hooks/useClusterSearch.ts src/components/ClusterPicker.tsx`. Expect it to be clean.
- [ ] **Step 3:** Commit with `feat(pickers): ClusterPicker with server search + lazy load`.

### Task 6: Licensing cluster selects

**Files:**
- Modify: `src/pages/licenses/subscriptionCreate/SubscriptionCreateForm.tsx:88-121`. Replace the cluster `<select>` and the synthetic missing-cluster option with `<ClusterPicker canSearch={…}>`. The BU `<select>` at line 134 stays as it is; it is scoped per cluster.
- Modify: `src/pages/licenses/SubscriptionForm.tsx:119,134,488`. Drop `useAllClusters(isNew)`. `draftCluster` comes from the picker's `option` (held in state) instead of `clusters.find`. Stop passing a `clusters` prop.
- Modify: `src/pages/licenses/SubscriptionTable.tsx:136-137,643-654,709`. The filter becomes `<ClusterPicker canSearch={canReadClusters} pinned={[{ value: '', label: t('…allClusters') }]}>`, reusing the existing "all" label key. The active chip at line 709 reads the held option's name, falling back to the id.

**Interfaces:**
- Consumes: `ClusterPicker`, `ClusterOption` (Task 5).
- The gate in SubscriptionForm is whatever permission currently guards `useAllClusters(isNew)`. Keep it: pass `canSearch={isNew && hasPermission('cluster.read')}` only if that matches today's condition. Otherwise mirror exactly what today's code does.

- [ ] **Step 1:** Make the SubscriptionCreateForm and SubscriptionForm changes.
- [ ] **Step 2:** Make the SubscriptionTable filter change.
- [ ] **Step 3:** Run `bun run typecheck && bunx eslint src/pages/licenses && bun run test`. Expect it to be clean and green.
- [ ] **Step 4:** Browser check:
  - Create a subscription. Pick a cluster; its BU select then lists that cluster's BUs.
  - Edit an existing subscription. Its cluster shows by name.
  - Use the Subscriptions filter, pick and clear, and check the chip.
- [ ] **Step 5:** Commit with `feat(licenses): cluster selects use ClusterPicker`.

### Task 7: Backstage-user cluster selects

**Files:**
- Modify: `src/pages/UserBackstageManagement.tsx:86,159-160,518-527,556`. The scope filter's "Any scope" / "Backstage" options become `pinned` rows. The chip label reads the held option, falling back to the id. Remove the `fetchAllClusters` effect.
- Modify: `src/pages/userBackstageManagement/GrantAccessDialog.tsx:34,67-68,182-191`. Replace the cluster `<select>` with `ClusterPicker`, and remove the `fetchAllClusters` effect. Check that the dialog doesn't clip the dropdown.
- Modify: `src/pages/userBackstageEdit/AddRoleSheet.tsx:22,33,153`. Replace the `<select>` with `ClusterPicker` and drop the `clusterOptions` prop.
- Modify: `src/pages/UserBackstageEdit.tsx:88,98-99,155-156,306`. Remove `clusterOptions` and the `fetchAllClusters` effect. The name lookup at lines 98–99 uses `useHydratedOptions` over the cluster ids that appear in the user's assignments, with fallback to the id.

**Interfaces:**
- Consumes: `ClusterPicker`, `useHydratedOptions` and `hydrateByKeys` (`field: 'id'` over `clusterService.getAll`).
- `canSearch` for each = the permission that today guards the page or dialog's cluster fetch. These pages call `fetchAllClusters` unconditionally inside guarded routes, so pass `true` there, but only after confirming the route guard in `App.tsx` (`user_backstage.*`) is what protected the old call.

- [ ] **Step 1:** Make the UserBackstageManagement filter change.
- [ ] **Step 2:** Make the GrantAccessDialog and AddRoleSheet changes.
- [ ] **Step 3:** Make the UserBackstageEdit name hydration change.
- [ ] **Step 4:** Run `bun run typecheck && bunx eslint src/pages/UserBackstageManagement.tsx src/pages/userBackstageManagement src/pages/userBackstageEdit src/pages/UserBackstageEdit.tsx && bun run test`. Expect it to be clean and green.
- [ ] **Step 5:** Browser check:
  - Filter by a cluster scope, then by Backstage.
  - Grant access with a cluster scope.
  - Add a role with a cluster on a user's edit page.
  - Existing assignments show cluster names.
- [ ] **Step 6:** Commit with `feat(user-backstage): cluster selects use ClusterPicker`.

### Task 8: BU Edit cluster field, then remove the cluster list loaders

**Files:**
- Modify: `src/pages/businessUnitEdit/InlineField.tsx`. Add an optional prop, `renderEditor?: (ctx: { value: string; setValue: (v: string) => void; commit: () => void; cancel: () => void }) => React.ReactNode`. When it is set, edit mode renders it in place of the built-in control, and read mode uses `readLabel?: string` (new optional prop) in place of the `options` lookup.
- Modify: `src/pages/businessUnitEdit/BusinessUnitDocument.tsx:124,131,253`. The `cluster_id` inline field passes `renderEditor` → `<ClusterPicker value={ctx.value} onChange={(id, opt) => { ctx.setValue(id); setClusterOption(opt); }} canSearch={…}>` and `readLabel` from the held option or the hydrated name. The `clusterOptions` array is removed.
- Modify: `src/pages/BusinessUnitEdit.tsx:11,67,143,688-692,814`. Remove `fetchAllClusters` and `clusters` state. `currentCluster` / `getClusterName` use `useHydratedOptions([formData.cluster_id])`. Stop passing the `clusters` prop.
- Delete, only if `grep -rn "useAllClusters\|fetchAllClusters" src` returns nothing outside the hook: `src/hooks/useAllClusters.ts` and `src/hooks/useAllClusters.test.ts`.

**Interfaces:**
- Consumes: `ClusterPicker`, `useHydratedOptions`.
- `canSearch` = `hasPermission('cluster.read')`. BU Edit is reachable with cluster-scoped permissions, so check the route guard and use the narrower permission if it already guards today's `fetchAllClusters` call.

- [ ] **Step 1:** Add the `InlineField` props.
- [ ] **Step 2:** Make the BusinessUnitDocument and BusinessUnitEdit changes.
- [ ] **Step 3:** Run the grep; delete the hook and its test only if it is unused.
- [ ] **Step 4:** Run `bun run typecheck && bun run lint && bun run test`. Expect it to be clean and green. This is the full lint, because hook removal touches imports.
- [ ] **Step 5:** Browser check:
  - Open an existing BU. The cluster field reads the cluster name.
  - Edit it, pick another cluster, save; the payload has the new `cluster_id`. Cancel restores the old value.
  - Create a new BU with a cluster.
  - Check at 390 px.
- [ ] **Step 6:** Commit with `feat(business-units): cluster field uses ClusterPicker; drop full cluster list loads`, then open PR D.
