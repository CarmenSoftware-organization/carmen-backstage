# Lazy pickers, round 2: design

**Date:** 2026-11-02
**Status:** Waiting for owner approval
**Follows:** PR #427 (round 1: `BusinessUnitPicker` + `useBusinessUnitSearch` gained server search and infinite scroll; used on Customer Edit and License Intake)

## Why

Several dropdowns load an entire unbounded list when the page opens, then filter it in the browser or not at all. When that list is long, the user scrolls and still can't find the entry (the original complaint was Customer Edit's BU select, fixed in round 1). Some of these lists are also silently truncated. The analytics filters load only the first 100 BUs and applications, so BU #101 can never be picked, and nothing says so.

Round 2 applies round 1's pattern (type to search on the server, 20 rows at a time, load more on scroll) to the remaining pickers over unbounded lists.

## Goals

1. Every in-scope picker sends a server search request as the user types, and loads more rows on scroll. None of them loads the whole list up front.
2. Values the caller already holds (selected ids or codes) still show readable names, even when they aren't in the first page of results.
3. Callers keep their current value shape (`string[]` of ids or codes, `string` code). Saved data, API payloads, and job configs don't change.
4. Remove the analytics 100-row cap.

## Non-goals

- Bounded lists: roles, license feature groups, DB pools, currencies, enum selects, and the user's own clusters on User Edit. These stay as they are.
- Places where a `fetchAll*` result feeds a table, a lookup map, or a per-row checklist rather than a picker: TenantMigration, TenantSeed, ClusterEdit BU table, DeployPanel, InviteUserDialog, ClusterAdminLicenses, ClusterLicenseDetail, the cluster-admin BU list, and the subscription hooks.
- `BuSwitcher` (SqlWorkbench, BackstageMigrationManagement, TenantImportWizard). It is a command palette with a "recent" list and a multi mode, and it takes `businessUnits` from its parent. Converting it is its own piece of work. **Deferred.**
- The report-template select in cron `ReportConfigFields`. **Deferred:** templates are a curated set and are not known to be large.
- Backend changes. Every endpoint used here already supports `search`, `page`/`perpage`, and `advance` with `where … in`.

## Anti-goals (would count as failure even if it "works")

- A saved selection that renders as a bare UUID or code, or disappears from the chip list because it wasn't on page 1.
- A change to what gets written. For example, cron `recipients` must stay user **ids**, because `report.go` resolves `audience.user_ids` and an email address would never resolve to anyone.
- A request fired when the user lacks the permission. Some endpoints answer 401 and that logs the user out; `BusinessUnitPicker`'s `canSearch` exists for this reason.
- Any change to `src/components/ui/` primitives (repo rule 2).

## In scope, in build order

| # | Where | Today | After |
|---|---|---|---|
| A | `components/BusinessUnitMultiSelect.tsx`, used by `NewsEdit.tsx:473`, cron `ReportConfigFields.tsx:156`, `DashboardRefreshConfigFields.tsx:22`, `dashboardTemplates/TemplateEditDialog.tsx:205,209` (`keyBy="code"`) | `fetchAllBusinessUnits` on mount (≤1,000), client filter | Server search + lazy load; selected chips hydrated by `id` or `code` |
| B | Cron recipients: `ReportConfigFields.tsx` (`recipients`) and `NotificationConfigFields.tsx` (`user_ids`) | `fetchAllPages<User>`, hand-rolled client-filtered checklist (two copies) | Existing `UserMultiSelect` plus an id adapter; lazy load added to `useUserSearch` |
| C | Analytics filters: `UsageAnalytics.tsx` and `ActivityEventManagement.tsx` via `hooks/useAnalyticsFilterOptions.ts` | `perpage: 100`, no paging; BU value = `code` | BU filter becomes a single-select lazy picker keyed by `code`, cleared = "All"; Applications keep the `<Select>` (see C) |
| D | Cluster selects: `licenses/SubscriptionCreateForm` (via `SubscriptionForm.tsx:119`), `licenses/SubscriptionTable.tsx` filter, `UserBackstageManagement.tsx` scope filter, `userBackstageManagement/GrantAccessDialog.tsx`, `UserBackstageEdit.tsx`, `BusinessUnitEdit` cluster field (`BusinessUnitDocument.tsx`) | `useAllClusters` (all pages) + native `<select>` | New `ClusterPicker` (single, lazy). **In scope** (owner, 2026-11-02) |

A, B, C and D each ship as their own PR, in that order. *(My call on the order: A builds `usePagedSearch` and the hydration helper that B, C and D reuse, so it goes first even though C is the only one broken today. The owner didn't pick an order.)*

## Decided

### Shared machinery
- **One generic hook, `usePagedSearch<T>`** in `src/hooks/`. Round 1 put the paging logic inside `useBusinessUnitSearch`: debounce 400 ms, generation guard, `loadMore` / `hasMore` / `loadingMore`, `refresh`. Move that logic into the generic hook, and turn `useBusinessUnitSearch`, `useUserSearch` (and later a cluster hook) into thin wrappers that only supply `fetchPage(search, page, perpage)` and a row mapper. The public return shape of `useBusinessUnitSearch` stays the same, so round 1 callers don't change. *(My call: four copies of the same race-guarded paging code is what `agent-os/standards/hooks/` warns against.)*
- **`hasMore`** = `page * perpage < paginate.total` when `total` is a number, otherwise "the last page came back full". This is the same rule as round 1.
- **Infinite scroll trigger:** an `onScroll` threshold of 48 px from the bottom of the dropdown list, the same as round 1. Don't use `IntersectionObserver`, since jsdom has no implementation and the existing tests would need stubs.
- **Card clipping:** any `Card` that hosts one of these dropdowns gets `className="overflow-visible"`, because `Card` hard-codes `overflow-hidden` (learning `2026-11-02-card-s-overflow-hidden-clips-absolutely`). Dialogs (`TemplateEditDialog`, `GrantAccessDialog`) also need checking: their content may scroll and clip too.

### Permissions: no new endpoint, no new gate
- A, B and C call **the same list endpoints the pages already call today**: `GET /api-system/business-units` (BU multi-select, analytics), `GET /api-system/users` (cron recipients) and `GET /api-system/applications` (analytics). Paging, `search` and `advance` on an endpoint the caller already hits don't change who is allowed, so these pickers keep today's gating exactly: none inside the component, and whatever page or route guard exists already. Props on the multi-selects therefore stay as they are.
- The rule a builder must not break: **don't make any picker call an endpoint its page did not call before.** If a change needs a new endpoint, gate it with `canSearch` the way `BusinessUnitPicker` does (`hasPermission('cluster.read')`). D is the only part that adds a new call site to `GET /clusters`, which is why D keeps each caller's `canReadClusters`-style gate.

### Hydrating already-selected values (goal 2)
- Each multi or single picker that receives ids or codes it hasn't loaded fetches them once with `advance = JSON.stringify({ where: { id: { in: [...] } } })` (or `code: { in: [...] }` for `keyBy="code"` and the analytics BU filter), with `perpage` = number of missing values. This is the same `where … in` shape `UserBackstageManagement.tsx:99` and `ReportTemplateManagement.tsx:138` already send.
- **Chunk at 100 values per request.** The gateway rejects large `perpage` values (`perpage: -1` and `200` are already known to return 400, which is why `fetchAllBusinessUnits` pages at 100), so send `perpage: 100` and run chunks with `Promise.allSettled`.
- Hydrated rows are kept in a small `Map` inside the component, so chips survive changes to the search query.
- While hydration is pending, a chip shows the raw value (a code), or a skeleton chip for ids, and swaps to the name once it arrives.
- If hydration fails, or a value doesn't come back (deleted BU or user, or a stale code in a job config), the chip still renders in a muted "not found" style with a remove button. It is never silently dropped from `value`. *(My call: dropping it would change the saved config behind the user's back.)* The label is the code for BUs, and for users "Unknown user" followed by the first 8 characters of the id, never a full bare UUID.
- `UserMultiSelect` gets this not-found chip as a rendering fallback for any `UserOption` with no `name`. Its existing callers (`BroadcastCompose`, `ApplicationBypassUsersCard`) always pass named options, so nothing changes for them.

### A: `BusinessUnitMultiSelect`
- Keep the same props (`value`, `onChange`, `disabled`, `keyBy`). None of the five callers change.
- Results are sorted `code:asc` on the server (it was client-side by name). *(My call, final: this matches round 1 and `fetchAllBusinessUnits`. Every BU picker in the app then lists in the same order.)*
- The selected chips row stays above the search box, as today.

### B: cron recipients
- Replace both hand-rolled checklists with `UserMultiSelect`. It holds `UserOption[]`, while the job config holds `string[]` of ids. A small adapter in `src/pages/cronjobs/jobConfig/` maps between the two: config → hydrate ids → `UserOption[]`, and back to ids on change.
- Add lazy load to `useUserSearch` through `usePagedSearch`. `UserMultiSelect` gets the same scroll handler. Its other callers (`BroadcastCompose`, `ApplicationBypassUsersCard`) get lazy load with no prop changes.
- The `recipientsHint` copy and the C2/I2 code comments explaining why ids (not emails) are required stay.

### C: analytics filters
- **BU:** a thin wrapper, `BusinessUnitCodePicker`, around `BusinessUnitPicker`. Round 1's props are not changed. *(My call: a `valueKey` prop would widen the round-1 contract for one caller.)* The wrapper takes `value: string` (the BU **code**, as today's filter state and `ActivityEventManagement`'s `bu_code` URL param hold it), hydrates it to a `BusinessUnitOption` internally by `code in [...]`, and calls `onChange(code, option | null)`. Clearing the picker means "All" (`''`).
- The page keeps the `option` it gets back in a `useState` next to `buCode`, and the active-filter chip label (`optionLabel(buOptions, buCode)` at `ActivityEventManagement.tsx:252`) reads `option?.name ?? buCode`. On a cold load from the URL, the chip shows the code until the wrapper's first hydration reports the option back. The wrapper also calls `onChange` once after hydration, with the same code, for this reason. `UsageAnalytics` has no chip, so it ignores the option.
- **Applications:** keep the `<Select>`, but load all pages with `fetchAllPages` instead of `perpage: 100`. The application registry is a curated list of client apps (single digits to tens), so a picker would be overkill, but the silent cap is still a bug. *(My call.)*
- `useAnalyticsFilterOptions` keeps returning `appOptions`. `buOptions` is removed once both pages stop reading it.
- Width: the picker keeps the current `w-[200px]` trigger footprint on desktop. On mobile it goes full width, matching the filter row's breakpoints.

### D: `ClusterPicker`
In scope: the owner asked for it on 2026-11-02.
- Single select, `clusterService.getAll({ search, sort: 'name:asc' })`; it searches `name` and `code`. Rows show name + code.
- Callers with extra leading options ("All clusters" in `SubscriptionTable`; "Any scope" / "Backstage" in `UserBackstageManagement`) keep those as separate controls or as a pinned group above the results. The builder picks one and states which.
- `SubscriptionForm.tsx:116`'s synthetic "missing current cluster" option becomes the not-found chip from **Hydrating**.
- `UserBackstageEdit.tsx:187` also uses the full cluster list to resolve names. That lookup switches to hydration by id and stops using the full list.
- Each caller keeps its current permission gate (`canReadClusters` etc.) as the picker's `canSearch`.

## Constraints

- Per the repo `CLAUDE.md`: no new libraries; `toast` not `alert`; `parseApiError` / `devLog` in catch blocks; i18n keys in both `en.ts` and `th.ts`; mobile-first (check at 390 px with the iframe probe, see memory `reference_iframe_viewport_probe`).
- Only the `searchfields` keys each service already sends (lowercase on the wire). Don't filter or sort on `customer_id` / `customer` (gateway 400 for non-backstage-wide callers; learning 2026-10-29).
- Team preference: no new test files unless asked. `bun run typecheck`, `bun run lint` and the existing `bun run test` must pass. Existing tests that assert on the old checklists (e.g. cron config field tests) are updated to the new component, not deleted.

## Left to the builder

- File layout of `usePagedSearch`, and whether `UserMultiSelect` / `BusinessUnitMultiSelect` share a chip-list subcomponent.
- Exact empty / loading / error copy (reuse `components.businessUnitPicker.*` / `components.userPicker.*` keys where they fit).
- Whether hydration lives in the hook (`useHydratedOptions(ids, fetchByIds)`) or in each component.

## Verification per PR

- Lower `PAGE_SIZE` to 5 temporarily against the local backend (only ~12 BUs locally) and confirm pages 1 → 2 → 3 load, then stop with no duplicates. Revert before committing.
- Open an existing record whose saved selection is **not** on page 1 (e.g. a cron job with recipients whose names sort late, or a template allow-list) and confirm the chips show names.
- Save without touching the picker and confirm the payload is byte-identical to before (Network tab).
- 390 px viewport: the dropdown is not clipped and is reachable.


## Owner decisions

- 2026-11-02: cluster picker (D) is in scope.
