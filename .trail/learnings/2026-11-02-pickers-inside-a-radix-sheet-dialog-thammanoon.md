---
title: Pickers inside a Radix Sheet/Dialog need a useRef Escape guard and a page-level name hook; the picker is unmounted while the Sheet is closed
author: Thammanoon
date: 2026-11-02
branch: feature/lazy-pickers-round-2
cost: { minutes: 44, tokens: 194214 }
id: l-f39d7230
scope: repo
status: active
src: agent
touches:
  - src/pages/ActivityEventManagement.tsx
  - src/pages/BusinessUnitEdit.tsx
  - src/pages/UserBackstageManagement.tsx
  - src/pages/businessUnitEdit/BusinessUnitDocument.tsx
  - src/pages/cronjobs/jobConfig/UserIdsField.tsx
  - src/pages/licenses/SubscriptionTable.tsx
  - src/pages/licenses/subscriptionCreate/SubscriptionCreateForm.tsx
  - src/pages/userBackstageEdit/AddRoleSheet.tsx
  - src/components/BusinessUnitCodePicker.tsx
  - src/components/BusinessUnitMultiSelect.tsx
---

## Decided
- Lazy pickers (BusinessUnitPicker, BusinessUnitMultiSelect, BusinessUnitCodePicker, UserMultiSelect, ClusterPicker) render an absolute dropdown and close on a document-level Escape. Inside a Radix Sheet/Dialog the host must guard `onEscapeKeyDown` with a **useRef** set from the picker's `onOpenChange` (useState goes stale under React 19). Radix's capture-phase document listener runs first, so stopPropagation never works. The picker's own Escape also calls `preventDefault()`, so `useGlobalShortcuts` (window listener, skips defaultPrevented) doesn't fire the page's onCancel. Without that, CronJobEdit navigates away and loses edits.
- A chip or label that names the selected value while the Sheet is closed must hydrate at page level: `useClusterById`, `useBusinessUnitByCode`. Radix unmounts closed SheetContent, so the picker inside can't report the name, and a persisted filter shows a UUID after reload.
- `useHydratedOptions(keys, keyOf, fetchByKeys, { known })`: pass rows the caller already holds (search results, the option from onChange, the page's hydrated row) so picks don't flash a skeleton or refetch.

## Watch out
- Pickers call `onChange(value, option)` once after hydration resolves, with the same value. Every caller must ignore it with `id === current`, or it dirties forms or resets pagination.
- BU Edit's seat pool needs the full `Cluster` (users_count, total_max_license_users). Don't feed it a ClusterOption from `known`.
- Hydration failure still renders "Not found" (`missing` includes `failed`). The value is kept and retries on remount (parked minor, round 2).
