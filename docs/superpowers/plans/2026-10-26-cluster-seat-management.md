# Cluster Seat Management Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backstage admins and cluster admins see the backend's real seat count, see who holds a seat, and can release/restore one person's seat inside one cluster.

**Architecture:** Backend adds a nullable `seat_released_at` marker on `tb_user_tb_business_unit`, a micro-cluster `cluster-seat` module (release/restore in one transaction each, restore under `assertSeatAvailable`), per-member seat data on the existing cluster-members response, and a gateway controller. Backstage switches every seat-pool display to "0/null cap = 0 seats", and adds a seat column, filter, over-quota banner and release/restore actions to both Users pages via shared components.

**Tech Stack:** NestJS + Prisma (turborepo, micro-cluster + backend-gateway, RPC contracts), React 19 + TS + shadcn/ui + Vite (Bun).

**Spec:** `docs/superpowers/specs/2026-10-26-cluster-seat-management-design.md` (carmen-backstage). Read it before any task.

## Global Constraints

- **No new automated tests** (user preference). Each task: implement → type-check/lint → commit. Existing suites must still pass; when an existing test asserts the old "null cap = uncapped" seat behaviour, update its expectation — do not add new test files.
- **Branches:** backend work on `feature/cluster-seat-management` in `../carmen-turborepo-backend` (create it from `main`; never commit to `main`). FE work on the existing `feature/cluster-seat-management` in carmen-backstage. Subagents must be told the repo path **and** branch name.
- **Do not push the backend branch** until the user says so: a pushed branch carrying a migration is applied to DEV within ~2 minutes, before merge.
- Seat holder rule has one SQL source — `seat.helper.ts`. Never re-derive it in TypeScript.
- Cap semantics everywhere in the FE: `total_max_license_users` 0 / null / absent ⇒ **0 seats**, never "unlimited".
- Authz for release/restore: `ClusterAdminAuthzService.isClusterAdmin(actorId, clusterId)` → else `ERROR_CATALOG.CLUSTER_USER_NOT_CLUSTER_ADMIN`. Never `readableClusterScope()`.
- FE rules from `CLAUDE.md`: `toast.*`, `<ConfirmDialog>`, `<Badge>` variants (no raw green), `parseApiError`/`getErrorDetail` in catches, every string in both `src/i18n/en.ts` and `src/i18n/th.ts`, mobile cards under `lg`, don't touch `src/components/ui/`.
- Backend checks before each backend commit: `bun run check-types` in the touched app(s); before the final backend commit `bun run gates`. Do **not** run `bun run lint` at the root (it rewrites the repo); use `bunx eslint <files>`.
- FE checks before each FE commit: `bun run typecheck && bun run lint`; before the last FE commit also `bun run test`.

## Review Focus

1. A member linked only to an **inactive BU** of the cluster: shows "no seat", release turns nothing into a seat change, restore skips that link with `bu_inactive` (Task 2, Task 3).
2. **Restore when the pool is full**: must return `SEAT_LIMIT_REACHED` with `used`/`cap`, leave every link inactive, and the FE must show `used/cap` from the error, not a generic failure (Task 2, Task 7).
3. A user who still holds a seat via a link **not** released (e.g. one link re-enabled by PATCH): restore costs 0 seats and must pass on a full cluster — `assertSeatAvailable` de-dupes via `already_in` (Task 2).
4. The generic `PATCH api-system/user/business-units/:id` re-activating a released link must clear `seat_released_at`, otherwise a later restore would act on it twice (Task 1).
5. Cluster with **no seat licence and members** (cap 0): both pages show `n / 0` and the over-quota banner, ClusterManagement/Licenses tables colour it as over (Task 5).

---

### Task 1: Release marker column + PATCH clears it (backend)

**Files:**
- Modify: `packages/prisma-shared-schema-backstage/prisma/schema.prisma` (model `tb_user_tb_business_unit`, ~line 826)
- Create: `packages/prisma-shared-schema-backstage/prisma/migrations/20261027090000_add_user_bu_seat_released_at/migration.sql`
- Modify: `apps/micro-cluster/src/cluster/business-unit/business-unit.service.ts` (`userBusinessUnitUpdate`, the `tx.tb_user_tb_business_unit.update` inside the transaction ~line 1815)

**Interfaces:**
- Produces: column `seat_released_at DateTime? @db.Timestamptz(6)` — "set by seat release; restore acts only on rows where it is set".

- [ ] **Step 1:** Add the field after `is_active` with a `///` doc comment; write the migration as one `ALTER TABLE ... ADD COLUMN "seat_released_at" TIMESTAMPTZ(6);` (schema-qualified the same way as `20261026160000_add_business_unit_note/migration.sql`). Regenerate the client (`bun run db:generate` or the package's generate script).
- [ ] **Step 2:** In `userBusinessUnitUpdate`, when `willBeActive` is true, write `seat_released_at: null` alongside `...data`; also make sure a client-supplied `seat_released_at` in `data` can never reach Prisma (strip it before the spread).
- [ ] **Step 3:** `cd apps/micro-cluster && bun run check-types` → no errors. Run the existing business-unit jest suite: `bunx jest src/cluster/business-unit --runInBand --forceExit` → passes.
- [ ] **Step 4:** Commit `feat(seat): add seat_released_at marker on user-business-unit links`.

### Task 2: micro-cluster `cluster-seat` module — release / restore

**Files:**
- Create: `apps/micro-cluster/src/cluster/cluster-seat/cluster-seat.service.ts`, `cluster-seat.controller.ts`, `cluster-seat.module.ts`, `interface/cluster-seat.interface.ts`
- Modify: `apps/micro-cluster/src/app.module.ts` (register module)
- Generated: `packages/rpc-contract/src/contracts/cluster-seats.ts` + `contracts/index.ts` via `bun run gen:rpc-contract`

**Interfaces:**
- Consumes: Task 1 column; `assertSeatAvailable(tx, { clusterId }, [userId], enforcementEnabled)` and `SeatLimitError` from `../common/seat.helper`; `SeatEnforcementFlagService.isEnabled()`; `ClusterAdminAuthzService.isClusterAdmin()`.
- Produces (RPC, payload `{ cluster_id, target_user_id, user_id /* actor */ }` plus the audit-context fields every handler gets):
  - `ClusterSeats.release` → `Result<ISeatReleaseResult>`; `interface ISeatReleaseResult { released: string[] }` (link ids)
  - `ClusterSeats.restore` → `Result<ISeatRestoreResult>`; `interface ISeatRestoreResult { restored: string[]; skipped: { id: string; reason: 'bu_inactive' | 'user_inactive' }[] }`
  - `ClusterSeatService.release(clusterId: string, targetUserId: string, actorId: string): Promise<Result<ISeatReleaseResult>>`
  - `ClusterSeatService.restore(clusterId: string, targetUserId: string, actorId: string): Promise<Result<ISeatRestoreResult>>`

- [ ] **Step 1: release.** Authz first. In one `$transaction`: select the target's links with `deleted_at: null`, `is_active: true`, BU `cluster_id = clusterId` (any BU state); `updateMany` them to `is_active: false, seat_released_at: now, updated_by_id: actorId, updated_at: now`. Zero links → `Result.ok({ released: [] })`. Decorate with `@TryCatch`.
- [ ] **Step 2: restore.** Authz first. Load links with `seat_released_at` not null, `deleted_at: null`, BU in the cluster, plus BU `is_active/deleted_at` and the target user's `is_active/deleted_at`. Skip (and keep the marker on) links whose BU is inactive/deleted → `bu_inactive`; if the user is inactive/deleted skip all → `user_inactive`. If anything remains: read `enforcementEnabled = await seatEnforcementFlag.isEnabled()` **outside** the transaction, then in one `$transaction` call `assertSeatAvailable(tx, { clusterId }, [targetUserId], enforcementEnabled)` and `updateMany` the restorable ids to `is_active: true, seat_released_at: null, updated_by_id, updated_at`. A thrown `SeatLimitError` must propagate (TryCatch maps it — confirm the gateway receives `code`, `used`, `cap`).
- [ ] **Step 3: controller.** Two handlers following `ClusterController.getUserClusterById` (temporary `@MessagePattern({ cmd: 'cluster-seats.release', service: 'micro-cluster' })` / `'cluster-seats.restore'`, `createAuditContext` + `runWithAuditContext`, `handleResult`). Run `bun run gen:rpc-contract`, then replace the literals with `ClusterSeats.release.pattern` / `.restore.pattern`. Module providers mirror `business-unit.module.ts` (`ClusterAdminAuthzService`, `SeatEnforcementFlagService`, `BackendLogger`, `PRISMA_SYSTEM`).
- [ ] **Step 4:** `bun run check-types` (micro-cluster + rpc-contract) clean; `bun run audit:message-pattern-literal` and `bun run audit:tcp-drift` pass.
- [ ] **Step 5:** Commit `feat(micro-cluster): cluster seat release/restore`.

### Task 3: Per-member seat data on the cluster-members response

**Files:**
- Modify: `apps/micro-cluster/src/cluster/common/seat.helper.ts` (add `clusterSeatHoldersSubquery`, rebuild `clusterHeadsSubquery` on it)
- Modify: `apps/micro-cluster/src/cluster/cluster/cluster.service.ts` (`getUserClusterById`, ~line 1205)
- Modify: `apps/micro-cluster/src/cluster/cluster/dto/cluster.serializer.ts` (`UserClusterByClusterIdSchema`, ~line 143)
- Modify: gateway swagger for `GET api-system/user/clusters/:cluster_id` in `apps/backend-gateway/src/backstage/backstage_user-clusters/swagger/`

**Interfaces:**
- Produces: `clusterSeatHoldersSubquery(): Prisma.Sql` → rows `(cluster_id uuid, user_id uuid)`, distinct, same WHERE as today's `clusterHeadsSubquery`; `clusterHeadsSubquery()` becomes `SELECT cluster_id, count(*)::int AS used FROM (holders) GROUP BY cluster_id` — identical output.
- Produces on each member item:
  ```ts
  seat: {
    holds: boolean;
    links: { id: string; business_unit_id: string; bu_code: string; bu_name: string;
             is_active: boolean; bu_is_active: boolean; released: boolean }[];
  }
  ```

- [ ] **Step 1:** Add `clusterSeatHoldersSubquery` and re-express `clusterHeadsSubquery` on it (update the doc comments that list the rule's copies).
- [ ] **Step 2:** In `getUserClusterById`, after the members load: one raw query of holders `WHERE cluster_id = $clusterId` → `Set<user_id>`; one Prisma query of links for all member `user_id`s with `deleted_at: null` and BU `cluster_id = clusterId, deleted_at: null` (select id, is_active, seat_released_at, BU id/code/name/is_active). Attach `seat` per item (`released = seat_released_at != null`). Extend the zod schema accordingly.
- [ ] **Step 3:** Update the gateway swagger example/schema for the new `seat` field.
- [ ] **Step 4:** `bun run check-types` in micro-cluster and backend-gateway; `bunx jest src/cluster/cluster src/cluster/common --runInBand --forceExit` in micro-cluster passes (fix expectations only where the response shape is asserted); `bun run audit:raw-sql` passes.
- [ ] **Step 5:** Commit `feat(micro-cluster): expose per-member seat status on cluster members`.

### Task 4: Gateway endpoints

**Files:**
- Create: `apps/backend-gateway/src/backstage/backstage_cluster-seats/` — `backstage_cluster-seats.controller.ts`, `.service.ts`, `.module.ts`, `swagger/response.ts`
- Modify: `apps/backend-gateway/src/app.module.ts`
- Modify: `packages/prisma-shared-schema-backstage/prisma/check.api-system-permission-coverage.ts` (allowlist, next to the `api-system/user/business-units` entries)
- Regenerate: `apps/backend-gateway/src/backstage/applications/app-api-catalog.generated.ts` (use the generator named by `bun run audit:app-api-catalog-drift`)

**Interfaces:**
- Consumes: Task 2 RPCs.
- Produces (HTTP, both 200 with the Task 2 result as `data`):
  - `POST /api-system/clusters/:cluster_id/users/:user_id/seat/release` — `AppIdGuard('clusterSeat.release')`
  - `POST /api-system/clusters/:cluster_id/users/:user_id/seat/restore` — `AppIdGuard('clusterSeat.restore')`; seat-full → the same error envelope invitations return for `SEAT_LIMIT_REACHED` (body carries `code`, `used`, `cap`)

- [ ] **Step 1:** Controller/service modelled on `backstage_cluster-notes` (KeycloakGuard, `ApiHeaderRequiredXAppId`, `ParseUUIDPipe` on both params, `BaseHttpController.respond`). No `@RequireBackstagePermission` — authz is membership-based in micro-cluster; add allowlist entries with a `reason` naming `ClusterSeatService.release/restore → clusterAdminAuthz.isClusterAdmin()`.
- [ ] **Step 2:** Regenerate the app-api catalog; `bun run check-types` (gateway).
- [ ] **Step 3:** `bun run gates` → all green (`app-api-catalog`, `api-system-permission`, `guard-providers`, `rest-contract`, `bu-scope-guard`…).
- [ ] **Step 4:** Commit `feat(gateway): cluster seat release/restore endpoints`. **Do not push** (Global Constraints).

### Task 5: FE seat pool = backend count, 0 cap = 0 seats

**Files:**
- Create: `src/utils/seatPool.ts`
- Modify: `src/pages/ClusterEdit.tsx` (~524–532 `userUsed`/`userCap`, Add-user dialog ~836–851), `src/pages/BusinessUnitEdit.tsx` (~133), `src/pages/ClusterManagement.tsx` (~460), `src/pages/licenses/ClusterLicenseTable.tsx` (~294), `src/pages/clusterAdmin/CapacityStrip.tsx` (`seats.cap` type), `src/pages/clusterAdmin/AllocationTicks.tsx`, `src/pages/clusterAdmin/ClusterProfile.tsx` (~132), `src/pages/clusterAdmin/ClusterAdminLicenses.tsx` (~141)

**Interfaces:**
- Produces: `export function toSeatPool(used: number | null | undefined, cap: number | null | undefined): { used: number; cap: number }` — both default to 0.

- [ ] **Step 1:** Add `toSeatPool`. ClusterEdit: `userUsed`/`userCap` come from `toSeatPool(clusterMeta.users_count, clusterMeta.total_max_license_users)`; the Users tab badge count stays membership count; the seat line and `clusterAtLimit` use the pool (`used >= cap`, so cap 0 disables Add). Expose a `refreshClusterMeta()` (or reuse the existing cluster fetch) for Task 7.
- [ ] **Step 2:** Pass `finite` to every seat `<CapacityMeter>`; change `CapacityStrip` `seats.cap` to `number` and drop its uncapped branch; same for `AllocationTicks`; feed `toSeatPool(...)` at each call site listed above; fix comments that still say "null = uncapped" for seats.
- [ ] **Step 3:** `bun run typecheck && bun run lint && bun run test` — update only expectations that encoded "null seat cap = uncapped" (e.g. `CapacityMeter.test.tsx`, `ClusterEdit.test.tsx`).
- [ ] **Step 4:** Commit `fix(seats): show the backend seat count and treat a 0/null cap as 0 seats`.

### Task 6: Types, service and shared seat components (FE)

**Files:**
- Modify: `src/types/index.ts` (`ClusterUser`), `src/services/clusterService.ts`
- Create: `src/components/clusterSeat/SeatCell.tsx`, `SeatActions.tsx`, `SeatOverQuotaBanner.tsx`, `useSeatActions.ts`
- Modify: `src/i18n/en.ts`, `src/i18n/th.ts` (new `components.clusterSeat.*` block)

**Interfaces:**
- Consumes: Task 3/4 shapes.
- Produces:
  - `interface ClusterSeatLink { id: string; business_unit_id: string; bu_code: string; bu_name: string; is_active: boolean; bu_is_active: boolean; released: boolean }`; `interface ClusterUserSeat { holds: boolean; links: ClusterSeatLink[] }`; `ClusterUser.seat?: ClusterUserSeat`
  - `clusterService.releaseSeat(clusterId: string, userId: string): Promise<{ released: string[] }>` and `restoreSeat(clusterId, userId): Promise<{ restored: string[]; skipped: { id: string; reason: 'bu_inactive' | 'user_inactive' }[] }>` (unwrap per `src/services/CLAUDE.md`)
  - `<SeatCell seat={ClusterUserSeat | undefined} />` — `<Badge variant="success">` "Holds seat" / `secondary` "No seat", plus the cluster's BU codes (inactive/released ones muted); renders nothing when `seat` is undefined (backend not deployed yet).
  - `<SeatActions user={ClusterUser} clusterId currentUserId onDone={() => void} />` — "Release seat" when `seat.holds`; "Restore seat" when any link `released`; each behind `<ConfirmDialog>`; release copy adds a self-warning when `user.user_id === currentUserId`.
  - `useSeatActions(clusterId, onDone)` → `{ release(user), restore(user), pendingId }`; toasts: release `success`; restore all → `success`, partial → `warning` naming skipped BU codes, none → `info`; `SEAT_LIMIT_REACHED` → `toast.error` with `used/cap` from the error body.
  - `<SeatOverQuotaBanner used cap />` — renders only when `used > cap`; copy: "{used}/{cap} seats in use — release {used-cap} seat(s). While licence enforcement is on, carmen-frontend cannot save anything in this cluster's business units." (TH equivalent).
- [ ] **Step 1:** Implement the above; Thai copy drafted by the implementer (user reviews in PR).
- [ ] **Step 2:** `bun run typecheck && bun run lint`.
- [ ] **Step 3:** Commit `feat(seats): shared seat status, actions and over-quota banner`.

### Task 7: Wire into backstage Cluster Edit → Users

**Files:**
- Modify: `src/pages/clusterEdit/sections/UsersSection.tsx`, `src/pages/ClusterEdit.tsx` (~681 props)

**Interfaces:**
- Consumes: Task 5 pool + refresh, Task 6 components.
- Produces: new `UsersSectionProps` fields `clusterId: string; currentUserId?: string; seatPool: { used: number; cap: number }; onSeatChanged: () => void`.

- [ ] **Step 1:** Add a Seat column (`<SeatCell>`, also a `meta.card` hint for mobile), `<SeatActions>` in the row actions (only when `canEdit`), a "Seat holders only" toggle beside the existing active/inactive filters (client-side), and `<SeatOverQuotaBanner>` above the table. `onSeatChanged` refetches members **and** cluster meta.
- [ ] **Step 2:** `bun run typecheck && bun run lint && bun run test` (update `UsersSection.test.tsx` only where props changed).
- [ ] **Step 3:** Commit `feat(cluster-edit): manage seats from the Users tab`.

### Task 8: Wire into cluster-admin Users page

**Files:**
- Modify: `src/pages/clusterAdmin/MembersTable.tsx`, `src/pages/clusterAdmin/ClusterUsers.tsx`

**Interfaces:**
- Consumes: Task 6 components; `clusterService.getById(clusterId)` for `users_count`/`total_max_license_users` → `toSeatPool`.
- Produces: `MembersTableProps` gains `clusterId: string; currentUserId?: string`.

- [ ] **Step 1:** `ClusterUsers` fetches the cluster detail alongside members, renders `<SeatOverQuotaBanner>`, refetches both after a seat action. `MembersTable` gets the Seat column, actions and the seat-holder filter. Update the header comment in `MembersTable.tsx`: seat release acts on BU links, so rows never disappear (the reason Status/Deactivate stay absent is unchanged).
- [ ] **Step 2:** `bun run typecheck && bun run lint && bun run test`.
- [ ] **Step 3:** Commit `feat(cluster-admin): manage seats from the Users page`.

### Task 9: Manual verification + deploy order (no code)

- [ ] Local backend (`:4000`) with branch built; FE `bun run dev:localhost`. On a cluster at `used == cap`: release one member → both pages and `GET /api-system/clusters/:id` `users_count` drop by 1; restore → back.
- [ ] Fill the freed seat with another user, then restore → error toast shows `used/cap`; DB links still inactive.
- [ ] Member linked only to an inactive BU → "No seat"; restore reports `bu_inactive`.
- [ ] As a cluster admin of cluster A, `curl -X POST .../clusters/<B>/users/<u>/seat/release` → 403/`CLUSTER_USER_NOT_CLUSTER_ADMIN`.
- [ ] Cluster with members but no seat licence → `n / 0` + banner on both pages; ClusterManagement meter red.
- [ ] 390px check of both Users pages (iframe probe per `reference_iframe_viewport_probe`), TH + EN.
- [ ] Deploy order to report to the user: backend PR merged and deployed to DEV (migration applies) → seed app-id allow-list entries `clusterSeat.release` / `clusterSeat.restore` for the backstage app on DEV → FE PR merged (auto-deploys DEV) → browser check → production per the deploying skill.
