# Subscription `scheduled` State (start_date fix) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A subscription whose `start_date` is in the future stops granting features and is shown as "Scheduled", not "Active".

**Architecture:** Add a fourth derived state `scheduled` to the single shared rule `deriveSubscriptionState` (it gains a `startDate` parameter). Every consumer is reached through the TypeScript union, so `tsc` lists the sites that must handle it. The gateway licence resolver drops scheduled contracts entirely (they grant nothing and are not "expired"); the FE gets a label and badge.

**Tech Stack:** NestJS + Prisma (turborepo, bun), React + TS (Vite, bun).

**Spec:** `docs/superpowers/specs/2026-10-29-license-intake-customer-design.md` — Part 1. This is plan 1 of 4 (Part 2 Customer, Part 3 intake API, Part 4 pending queue get their own plans).

## Global Constraints

- **No new test files** (user preference): implement → type-check → lint → commit; verify manually. Existing suites must still pass before merge — run the suites named below.
- `deriveSubscriptionState` stays the only implementation of the rule (`packages/prisma-shared-schema-backstage/src/index.ts`); never re-implement in an app.
- Derived state precedence (exact): stored `inactive` → `inactive`; stored `expired` → `expired`; stored `active` and `end_date < now` → `expired`; stored `active` and `start_date > now` → `scheduled`; else `active`.
- Branching: backend on `fix/subscription-scheduled-state` in `carmen-turborepo-backend` (integration branch is `main`, never touch `prod`); FE on the same branch name in `carmen-backstage`.
- Backend lint: `bun run lint` rewrites the whole repo (`--fix`) — run `bunx eslint <changed files>` instead.
- FE: TH and EN i18n both required; status badges use `<Badge variant=…>`, never raw colour classes.
- Deploy order: backend first. The FE must tolerate `scheduled` arriving before it ships (unknown state renders as a neutral badge, not a crash).

## Review Focus

1. A BU whose **only** contract is scheduled: resolver must report `none` (no licence yet), not `expired` and not `active`. Verify manually with a BU on DEV.
2. A BU with an active contract **and** a scheduled renewal carrying extra modules: the extra modules must NOT appear in `features` or in `expired_features`.
3. Summary counters (`buildSummary`, micro-business ~:1611): a scheduled row must not be counted as active or expiring-soon.
4. Interface-licence main-contract check (micro-cluster `contractStates` ~:185): a scheduled contract must not satisfy "active main contract".
5. FE receiving `scheduled` from a backend that ships first: every `Record<SubscriptionState, …>` map has an entry; nothing falls through to `undefined` label.

---

### Task 1: Shared rule + backend consumers

**Files:**
- Modify: `packages/prisma-shared-schema-backstage/src/index.ts:128` (type) and `:157` (function), plus its README line 47
- Modify: `apps/backend-gateway/src/license/license.service.ts` (~:150–240 query + loop, `deriveState` ~:501)
- Modify: `apps/micro-business/src/subscription/subscription.service.ts` (`STATE_SORT_RANK` :294; calls at :427, :890, :1258, :1446, :1611 and the selects feeding them)
- Modify: `apps/micro-cluster/src/cluster/business-unit-interface-license/business-unit-interface-license.service.ts` (~:180–195)
- Modify: swagger/response docs that enumerate `active | expired | inactive` for `state` (grep `'active', 'expired', 'inactive'` / `enum: [` under `apps/backend-gateway/src/backstage/backstage_subscriptions/swagger/`)

**Interfaces:**
- Produces: `export type SubscriptionState = 'active' | 'scheduled' | 'expired' | 'inactive';`
- Produces: `deriveSubscriptionState(status: enum_subscription_status, startDate: Date, endDate: Date, now: Date): SubscriptionState`
- `LicenseState` (gateway `license.types.ts`) inherits `scheduled` through the union — no edit there beyond its doc comment.

- [ ] **Step 1:** Create branch `fix/subscription-scheduled-state` from fresh `main` in `carmen-turborepo-backend`.
- [ ] **Step 2:** Change the type and `deriveSubscriptionState` per the precedence in Global Constraints; update the JSDoc (`@param startDate`) and README line.
- [ ] **Step 3:** Run `bun run check-types` at repo root. Expected: errors at every caller (missing argument) and at `STATE_SORT_RANK`. This list is the work list for steps 4–6.
- [ ] **Step 4:** micro-business: pass `start_date` at every call (add `start_date: true` to the selects that lack it). `STATE_SORT_RANK = { active: 0, scheduled: 1, inactive: 2, expired: 3 }`. In `buildSummary` treat `scheduled` like `inactive` (`continue`).
- [ ] **Step 5:** gateway `license.service.ts`: select `start_date` on `tb_subscription`; pass it through `deriveState(status, startDate, endDate, now)`; in the loop, `if (state === 'scheduled') continue;` before bucketing — scheduled rows contribute neither features nor expired features. A BU left with no rows in either bucket must therefore resolve to `none` exactly as a never-sold BU does (confirm by reading the code after the loop).
- [ ] **Step 6:** micro-cluster interface service: pass `start_date`; `scheduled` must not win over or count as `active` in the farthest-wins map.
- [ ] **Step 7:** Update swagger enums/descriptions for `state` to include `scheduled` with one line: "start_date is in the future; grants nothing yet".
- [ ] **Step 8:** Verify: `bun run check-types` → 0 errors; `bunx eslint <every changed .ts file>` → clean; run existing suites `cd apps/micro-business && bunx jest src/subscription --runInBand --forceExit`, `cd apps/backend-gateway && bunx jest src/license --runInBand --forceExit`, `cd apps/micro-cluster && bunx jest src/cluster/business-unit-interface-license --runInBand --forceExit` → all pass (fix call sites in existing specs that now miss the `startDate` argument; do not add new test cases).
- [ ] **Step 9:** Commit `fix(license): subscriptions with a future start_date derive 'scheduled' and grant nothing`.

### Task 2: FE — `scheduled` label and badge

**Files:**
- Modify: `src/types/index.ts:1578` (`SubscriptionState`) and `:1894` (`contract_state` union)
- Modify: every site `tsc` reports after the type change — expected among `src/utils/buLicense.ts`, `src/utils/clusterLicense.ts`, `src/pages/licenses/SubscriptionTable.tsx`, `src/pages/licenses/sections/SubscriptionSection.tsx`, `src/pages/licenses/sections/BuQuotaSection.tsx`, `src/pages/licenses/ClusterLicenseDetail.tsx`, `src/pages/licenses/subscriptionEdit/IssuedSubscriptionPlate.tsx`, `src/pages/clusterAdmin/businessUnitForm/BuSubscriptionsCard.tsx`, `src/pages/licenses/subscriptionManagement/buildAdvance.ts`
- Modify: `src/i18n/en.ts`, `src/i18n/th.ts` — state label keys next to the existing active/expired/inactive ones

**Interfaces:**
- Consumes: Task 1's `state` / `contract_state` value `'scheduled'`.
- Produces: `SubscriptionState = 'active' | 'scheduled' | 'expired' | 'inactive'`.

- [ ] **Step 1:** Create branch `fix/subscription-scheduled-state` from fresh `main` in `carmen-backstage`.
- [ ] **Step 2:** Add `'scheduled'` to both unions; run `bun run typecheck`; fix every reported site. Copy: EN "Scheduled", TH "รอเริ่ม". Badge: `variant="info"` if the Badge component has it, else `"secondary"`. `isExpiringSoon` already returns false for non-active — leave it. Where a label/variant map is keyed by string from the API, add a fallback so an unknown value renders the raw value with `secondary`.
- [ ] **Step 3:** If `buildAdvance.ts` offers a state filter list, add `scheduled` only if the backend list endpoint can filter by derived state; otherwise leave the filter unchanged (stored status filter is not derived state).
- [ ] **Step 4:** Verify: `bun run typecheck` and `bun run lint` → clean; `bun run test` → existing suites pass (update existing assertions only where a map's exhaustive shape changed).
- [ ] **Step 5:** Commit `feat(licenses): show 'Scheduled' for subscriptions that have not started`.

### Task 3: Manual verification (DEV)

- [ ] **Step 1:** After backend deploys to DEV: on a test BU, create a subscription with `start_date` = tomorrow, status active, one module group. `GET` that BU's licence (`/api/license` via carmen-frontend or the gateway) → the group's features absent, not in `expired_features`; if it is the BU's only contract → `state: "none"`.
- [ ] **Step 2:** Same BU with an existing active contract: features unchanged from before the scheduled contract was added.
- [ ] **Step 3:** `/licenses` subscriptions tab and cluster-admin Subscriptions card show "Scheduled"/"รอเริ่ม" badge for that row, in TH and EN, desktop and 390px.
- [ ] **Step 4:** Subscriptions summary band: active count did not increase when the scheduled row was added.
- [ ] **Step 5:** On a BU whose only contract is the scheduled one, create an interface licence → it is created (create has no main-contract check) and the response shows `in_force: false` and `contract_state: "scheduled"`.
- [ ] **Step 6:** Clean up the test subscription.
