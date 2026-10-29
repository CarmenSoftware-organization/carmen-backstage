# License Intake Queue (Part 4) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Backstage staff holding `subscription.approve` review each pending intake that the license master pushed, pick its BU and confirm it (one transaction issues the subscription, seat and interface licences) or reject it with a reason. The page warns when the new licences overlap licences the BU already has.

**Architecture:**
- micro-cluster already owns `tb_license_intake`. It gains list, summary, detail, BU-licence overview, confirm and reject.
- Confirm runs one Prisma transaction on the backstage schema. It calls row writers extracted into `@repo/prisma-shared-schema-backstage`, so there is no RPC hop to micro-business.
- The gateway gets a second, staff-only controller under `api-system/backstage/license-intakes`.
- The FE adds a list page, a detail/decision page, a single-select BU picker and a pending-count badge on the nav.

**Tech Stack:** NestJS + Prisma (backstage schema), zod v4 DTOs, rpc-contract generator; React + TS + shadcn/ui, Vite, Bun.

**Spec:** `docs/superpowers/specs/2026-10-29-license-intake-customer-design.md` § "Part 4 — Pending queue". Recon with file:line references (gitignored): `.superpowers/sdd/part4-recon.md`. Executors should read both.

## Global Constraints

### Repos and branches
- BE: `carmen-turborepo-backend`, branch `feature/license-intake-queue`, cut from `main`.
- FE: `carmen-backstage`, branch `feature/license-intake-queue`, cut from `main`.
- **Name the branch in every subagent dispatch.** Without it, a subagent working in a sibling repo commits to `main`.
- Pushing the BE branch applies its migration to DEV within about 2 minutes. Push only when the PR is about to open.
- Merge order:
  - BE merges before FE, because the FE calls new routes.
  - Part 4 changes no licence-feature catalog keys, so `audit:fe-license-fixture` does not force any order.

### Working rules
- **No new test files** (user preference). The loop is: implement → type-check → lint → commit. Existing suites must still pass. `Sidebar.test.tsx` is likely to need updating; that is allowed.
- BE:
  - Lint with `bunx eslint <files>`. Never run `bun run lint`.
  - Before any push, run `bun run gates` in the background (it takes more than 10 minutes). Known pre-existing reds:
    - audit:raw-sql (document-number.helper.ts:219)
    - audit:dependencies (systeminformation)
    - micro-cluster `BusinessUnitService › setDefaultTenant`
    - prettier, on pre-existing files only
  - Add no env vars. Add no `$queryRaw`. DTOs import from `'zod/v4'`.
  - Rebuild `packages/prisma-shared-schema-backstage` (prisma generate + build) before check-types. A stale `dist` produces fake type errors.
- rpc-contract has 3 steps:
  1. Write a temporary literal `@MessagePattern`.
  2. Run `bun run gen:rpc-contract`.
  3. **Revert every unrelated contract file the generator rewrites** (about 8 files). Keep only `license-intakes.ts` and the barrel if it changed. Then swap in `LicenseIntakes.<op>.pattern`.
- App-api catalog: regenerate with `bun run scripts/generate-app-api-catalog/run.ts` and commit only the expected lines. Use the one-string form for every guard: `new AppIdGuard('x')`.
- FE:
  - Run `bun run typecheck`, then `bun run lint`, then `bun run test` (existing suites only), then `bun run build`.
  - Follow CLAUDE.md rules 1–18. Never modify `src/components/ui/`.
  - Add i18n keys to both TH and EN.

### Names
| Thing | Value |
|---|---|
| permission | `subscription.approve`, description `Confirm or reject pending license intakes (bind a pushed sale to a BU and issue its licences)` |
| staff route base | `api-system/backstage/license-intakes` |
| rpc service / served by | `license-intakes` / `micro-cluster` (extend the existing `LicenseIntakes` contract) |
| carrier column | `license_intake_id uuid NULL` FK → `tb_license_intake(id)` ON DELETE NO ACTION, on `tb_subscription`, `tb_business_unit_license`, `tb_business_unit_interface_license` |
| migration | `20261030090000_license_intake_carrier` |
| FE route / nav | `/license-intakes`, `/license-intakes/:id`; `nav.licenseIntakes`; feature key `license_intakes` |
| FE perpage / status keys | `perpage_license_intakes`, `status_license_intakes` |

| Endpoint | Perm | AppIdGuard api_name | rpc op (cmd) |
|---|---|---|---|
| `GET /` (paginate) | `subscription.read` | `license-intake.list` | `findAll` (`license-intakes.find-all`) |
| `GET /summary` | `subscription.read` | `license-intake.summary` | `summary` (`license-intakes.summary`) |
| `GET /:id` | `subscription.read` | `license-intake.findOne` | `findOne` (`license-intakes.find-one`) |
| `GET /:id/business-units/:buId/licenses` | `subscription.read` | `license-intake.buLicenses` | `buLicenses` (`license-intakes.bu-licenses`) |
| `POST /:id/confirm` | `subscription.approve` | `license-intake.confirm` | `confirm` (`license-intakes.confirm`) |
| `POST /:id/reject` | `subscription.approve` | `license-intake.reject` | `reject` (`license-intakes.reject`) |

- Declare `/summary` before `/:id`.
- Add `.rest(...)` mappings in the same style as `backstage-customers.ts`.

### Error catalog (module `LICENSE_INTAKE` 815; take the next free ids after the existing five, in this order)
| code | http | when |
|---|---|---|
| `LICENSE_INTAKE_NOT_FOUND` | 404 | no intake with that id |
| `LICENSE_INTAKE_NOT_PENDING` | 409 | status ≠ pending, or the guarded transition updated 0 rows (concurrent confirm/reject, stale doc_version) |
| `LICENSE_INTAKE_BU_NOT_FOUND` | 404 | target BU missing or soft-deleted |
| `LICENSE_INTAKE_CUSTOMER_MISSING` | 400 | no live customer with the intake's AR (create it on the Customers screen first) |
| `LICENSE_INTAKE_BU_CUSTOMER_MISMATCH` | 409 | BU linked to a different **live** customer |
| `LICENSE_INTAKE_GROUP_UNAVAILABLE` | 400 | a pushed group code is now deleted, missing, or has the wrong kind; message lists the codes |
| `LICENSE_INTAKE_NO_MAIN_CONTRACT` | 400 | an interface's `start_date` is not covered by any live active subscription of the BU or by the one this confirm creates |
| `LICENSE_INTAKE_SCOPE_DENIED` | 403 | caller's grant is cluster-scoped, not backstage-wide |

### Date semantics
- `end_date` is an inclusive calendar day.
- Two periods `[s1,e1]` and `[s2,e2]` overlap iff `s1 < e2 + 1d && s2 < e1 + 1d`. Use `SUBSCRIPTION_END_DAY_MS`.
- "Covers a date d" means `start ≤ d && d < end + 1d`.
- Licence rows take the intake's `start_date` / `end_date` unchanged.

## Rulings (planner's calls; the owner can overturn any of them in review)

- **R1 — Carrier: an FK on the produced rows.** The produced rows carry `license_intake_id`; there is no join table.
  - An intake yields 1:N rows, and `tb_subscription` has no `reference_no`.
  - Seat and interface rows also get `reference_no = source_sale_id`, per the spec.
- **R2 — No seat-pool or BU-quota check at confirm.**
  - The spec assumed these checks exist on the create paths. Recon shows they don't: quota is enforced only when a BU is created, and the seat pool is display-only.
  - The seat model is a non-goal, so confirm adds no check either.
- **R3 — Main-contract rule is enforced at confirm only (spec designer's call).**
  - This is a *new* rule. The manual interface create path has no such gate today and stays as is.
  - Order inside confirm: subscription → seat → interfaces.
- **R4 — Customer is required to confirm.**
  - At confirm, re-resolve the live customer by `ar_number`, because the customer may have been created after the push. If none exists → `CUSTOMER_MISSING`.
  - Write the resolved id back to `intake.customer_id`.
  - Why: every intake must say who pays. The FE offers a "create customer" shortcut.
- **R5 — Backstage-wide grants only.**
  - The gateway `BackstagePermissionGuard` checks only the key, so a cluster-scoped grant would get through.
  - micro-cluster therefore re-checks that the caller's grant is backstage-wide on every queue op, reads included. Otherwise it returns `SCOPE_DENIED`.
  - Use the same "backstage-wide" check that Part 2's customer query-key denial uses.
- **R6 — Role seed.**
  - `subscription.approve` goes into the permission catalog only.
  - Backstage Admin gets it through its existing `subscription.*` wildcard.
  - Support Manager and Support Staff do **not** get it, because neither holds `subscription.manage` today. **Owner to confirm.**
- **R7 — Overlap flag.**
  - `overlap_warning_shown` stores what the client says it displayed, as the spec wants.
  - The server also computes `overlap_detected` and puts it in the activity metadata, so a mismatch is visible in the audit trail.
- **R8 — Group re-validation.**
  - Codes are resolved to live groups inside the confirm tx.
  - Module codes need kind ≠ `interface`; interface codes need kind = `interface`.
  - Any miss → `GROUP_UNAVAILABLE`, and nothing is written.
- **R9 — Seats.** A seat row is created only when `seats ≥ 1`. `seats` null or 0 → no seat row.
- **R10 — Retry.** On P2002 (licence-number race), re-run the **whole** confirm transaction, up to 5 attempts.
- **R11 — Badge.**
  - The pending count is fetched on mount and on a `license-intakes:changed` window event that the detail page fires after confirm or reject. There is no polling.
  - The fetch is gated on `subscription.read`. A permission 401 logs the user out, so the gate matters.
- **R12 — Reject dialog.** `ConfirmDialog` has no body slot and `ui/` is off-limits, so the reason goes in a new `RejectIntakeDialog` built on the `ui/dialog` primitives. The reason is trimmed, 1–500 chars.

## Review Focus

1. **Two people confirm the same intake at once.**
   - Expected: one succeeds and the other gets `409 NOT_PENDING`, with no second subscription, seat or interface row.
   - How it is enforced: the guarded `updateMany({ where: { id, status: 'pending', doc_version } })` runs inside the same tx as the inserts, and a count of 0 throws, which rolls the tx back.
2. **A group is deleted, or its kind changes, between push and confirm.**
   - Expected: a readable 400 that names the codes, with no partial rows left behind (e.g. the subscription committed but the interface missing).
3. **An interface starts before any subscription covers it.**
   - Expected: `NO_MAIN_CONTRACT`, and the subscription created earlier in the same tx is rolled back.
4. **The BU's customer link edge cases.**
   - Linked to another live customer → 409.
   - Linked to a soft-deleted customer → treated as unlinked, and the link moves.
   - Unlinked → linked in the same tx, with `doc_version` incremented.
5. **The overlap boundary.**
   - An existing row ending the day before the intake starts → no warning.
   - Ending on the intake's start day → warning.
   - A cluster-admin or cluster-scoped caller → 403 (never 401) from every endpoint.

---

## Backend (carmen-turborepo-backend, branch `feature/license-intake-queue`)

### Task 1: Schema carrier, permission, error codes

**Files:**
- Modify: `packages/prisma-shared-schema-backstage/prisma/schema.prisma`. Add `license_intake_id` + relation + `@@index([license_intake_id])` on the 3 targets, and back-relations on `tb_license_intake`.
- Create: `packages/prisma-shared-schema-backstage/prisma/migrations/20261030090000_license_intake_carrier/migration.sql`. Hand-written and idempotent: `ADD COLUMN IF NOT EXISTS`, FK in a `DO $$ … IF NOT EXISTS` block, `CREATE INDEX IF NOT EXISTS`.
- Modify: `packages/prisma-shared-schema-backstage/prisma/seed.backstage-permission.data.ts`. Add the `subscription.approve` entry after `subscription.manage`.
- Modify: `packages/prisma-shared-schema-backstage/prisma/seed.backstage-role-permission.data.ts`. Add only a comment beside `'subscription.*'` noting that it includes approve (R6).
- Modify: `packages/error-catalog/src/catalog.ts`. Add the 8 codes from Global Constraints.

- [ ] Write the schema + migration; run prisma generate + build the package.
- [ ] Run `bun run check-types` for the package plus `audit:backstage-permission-resource` and the permission drift checks. Expected: green.
- [ ] Commit `feat(license-intake): carrier column, subscription.approve, queue error codes`.

### Task 2: Shared licence row writers

**Files:**
- Create: `packages/prisma-shared-schema-backstage/src/license-issue.ts`. Export it from `src/index.ts`.
- Modify: `apps/micro-cluster/src/cluster/business-unit-license/business-unit-license.service.ts:186` (create).
- Modify: `apps/micro-cluster/src/cluster/business-unit-license/business-unit-interface-license.service.ts:418` (create). Use the real path of that file.
- Modify: `apps/micro-business/src/subscription/subscription.service.ts:524-596` (create).

**Interfaces (Produces):**
```ts
type Tx = Prisma.TransactionClient;
issueSubscription(tx: Tx, a: { clusterId: string; businessUnitId: string; startDate: Date; endDate: Date;
  status?: 'active' | 'inactive'; groupIds?: string[]; userId: string; licenseIntakeId?: string }): Promise<{ id: string; subscription_number: string }>;
issueSeatLicense(tx: Tx, a: { businessUnitId: string; licensedUsers: number; startDate: Date; endDate: Date;
  referenceNo?: string | null; note?: string | null; userId: string; licenseIntakeId?: string }): Promise<{ id: string; license_number: string }>;
issueInterfaceLicense(tx: Tx, a: { businessUnitId: string; groupId: string; startDate: Date; endDate: Date;
  referenceNo?: string | null; note?: string | null; userId: string; licenseIntakeId?: string }): Promise<{ id: string; license_number: string }>;
periodsOverlap(s1: Date, e1: Date, s2: Date, e2: Date): boolean;   // inclusive-end rule
periodCovers(start: Date, end: Date, d: Date): boolean;
```

- Each writer allocates its number through `nextLicenseNumber` (`SUB` / `SEAT` / `INF`) + `readRetiredLicenseNumbers`, using **`tx`** for every read.
- `issueSubscription` writes `tb_subscription`, then `tb_subscription_bu`, then `tb_subscription_bu_group.createMany`, the last only when `groupIds` is non-empty.

- [ ] Write the helpers. Do not move any validation into them; callers keep validating.
- [ ] Switch the three existing `create()` paths to call the writer inside their existing `$transaction` and retry wrapper.
  - Behaviour and responses must stay byte-identical: same `select`, same status default, same retry counts.
  - `setGroups` stays untouched.
- [ ] Run check-types for micro-cluster and micro-business, plus `bunx eslint` on the changed files. Run the existing micro-cluster and micro-business licence/subscription jest suites with `--runInBand --forceExit`. Expected: pass.
- [ ] Commit `refactor(license): shared tx-aware licence row writers`.

### Task 3: micro-cluster queue reads

**Files:** `apps/micro-cluster/src/cluster/license-intake/` (service, controller, plus a new `license-intake-queue.service.ts` if the existing service would pass ~400 lines).

**Interfaces (Produces, rpc response `data`):**
- `findAll(paginate)`
  - Paginates `tb_license_intake`. Default sort is `created_at desc`. The `status` filter comes through `advance.where`.
  - Search fields: `source_sale_id`, `ar_number`.
  - Rows are the intake columns minus `raw_payload`, plus:
    - `customer: {id, ar_number, name} | null`
    - `business_unit: {id, code, name} | null`
    - `module_groups` / `interface_groups: {code, name, kind, missing: boolean}[]`, resolved by code
  - Reject `customer`, `tb_customer` and `customer_id` keys in sort, filter or search the same way Part 2 does (`referencesDeniedKey`).
- `summary()` returns `{ pending, confirmed, rejected }`.
- `findOne(id)` returns the row shape above, plus:
  - `raw_payload`
  - `suggested_business_units: {id, code, name, cluster_id, cluster_name}[]`: live BUs whose `customer_id` = the live customer resolved by `ar_number`
  - `produced: { subscriptions: {id, subscription_number}[], seats: {id, license_number}[], interfaces: {id, license_number, group_code}[] }`, read through the carrier FK
  - `confirmed_by` / `rejected_by` `{id, name}`
- `buLicenses(id, buId)` returns `{ business_unit: {id, code, name, customer_id}, seats[], subscriptions[], interfaces[], any_overlap }`.
  - It covers the BU's live, not-yet-expired rows only.
  - Each row carries `{id, number, start_date, end_date, state, overlaps: boolean}`, plus `licensed_users` for seats, `groups[] {code, name}` for subscriptions, and `group {code, name}` for interfaces.
  - `overlaps` is set only against intake parts of the same kind: subscription vs `module_group_codes` non-empty, seats vs `seats ≥ 1`, interface vs the same group code.
- Every op starts with the R5 backstage-wide check. A missing intake → `NOT_FOUND`.

- [ ] Implement, using the generator workflow for the four new patterns.
- [ ] Run check-types + eslint, then commit `feat(license-intake): queue list, summary, detail, BU licence overview`.

### Task 4: micro-cluster confirm + reject

**Interfaces:**
- `confirm({ id, business_unit_id, doc_version, overlap_warning_shown: boolean }, userId)` returns `findOne(id)`.
- `reject({ id, reason, doc_version }, userId)` returns `findOne(id)`.

**Confirm algorithm** (one `prismaSystem.$transaction`; the whole tx is retried per R10):
1. Do the R5 check. Load the intake. Missing → `NOT_FOUND`. `status ≠ pending` → `NOT_PENDING`.
2. Load the BU, live, with `cluster_id`, `customer_id` and `doc_version`. Missing → `BU_NOT_FOUND`.
3. Resolve the live customer by `ar_number` (R4), then handle the BU link:
   - BU linked to another live customer → `BU_CUSTOMER_MISMATCH`.
   - BU unlinked, or its holder is soft-deleted → `updateMany({ where: { id, customer_id: <current value> }, data: { customer_id, doc_version: { increment: 1 } } })`. A count of 0 → `NOT_PENDING`.
   - Copy this rule from `customer.service.ts:385-436`, but run it through `tx`.
4. Resolve the groups (R8).
5. Issue the rows:
   - If there are module groups → `issueSubscription`, status `active`.
   - If `seats ≥ 1` → `issueSeatLicense` with `referenceNo = source_sale_id`.
   - For each interface group: check the main contract first. The start must be covered by a live `active` subscription of the BU (through `tb_subscription_bu`, both not deleted) or by the one just created. If not → `NO_MAIN_CONTRACT`. Otherwise `issueInterfaceLicense`.
   - Pass `licenseIntakeId` to every writer.
6. `updateMany({ where: { id, status: 'pending', doc_version }, data: { status: 'confirmed', business_unit_id, customer_id, confirmed_by_id, confirmed_at: now, overlap_warning_shown, updated_by_id } })`. A count of 0 → `NOT_PENDING`.
7. After commit, call `logBackstageEvent` fire-and-forget (precedent `business-unit.service.ts:1331`). Metadata: `{ event_type: 'license_intake.confirm', license_intake_id, business_unit_id, overlap_warning_shown, overlap_detected, produced }`. `overlap_detected` reuses the `buLicenses` logic.

**Reject:**
- Do the R5 check.
- Trim the reason and require 1–500 chars.
- Run the guarded `updateMany` to `rejected`, setting `rejected_by_id`, `rejected_at` and `reject_reason`. A count of 0 → `NOT_PENDING`.

**Audit registry:** register `license-intakes.confirm` and `license-intakes.reject` in `BACKSTAGE_ACTIVITIES`, with entity `tb_license_intake`, action `update` and id from `payload.id`. Add `tb_license_intake: {}` to `BACKSTAGE_SNAPSHOT_INCLUDES`.

- [ ] Implement (generator workflow for 2 patterns), check-types, eslint, commit `feat(license-intake): confirm and reject in one transaction`.

### Task 5: Gateway staff controller + gates

**Files:**
- Create: `apps/backend-gateway/src/license-intakes/license-intakes-staff.controller.ts`, at `@Controller('api-system/backstage/license-intakes')`.
  - Class-level `KeycloakGuard` + `BackstagePermissionGuard`, matching the `backstage_customers.controller.ts` guard setup.
  - Each handler gets `new AppIdGuard('<api_name>')` + `@RequireBackstagePermission(...)` from the table.
  - Add swagger decorators.
- Create: DTOs in the same folder.
  - Confirm: `{ business_unit_id: uuid, doc_version: int ≥ 0, overlap_warning_shown: boolean }`, strict.
  - Reject: `{ reason: string trim 1..500, doc_version }`, strict.
- Modify: the module (register the controller), `app-api-catalog.generated.ts` (regenerate), and `seed.application-api.data.ts`.
  - Add the 6 api_names to the backstage FE application's list. Do **not** add them to `license-master`.
- Modify: `docs/external-api/license-intake.md`. Add one paragraph saying a pushed sale stays `pending` until a staff member confirms it.

- [ ] Implement. Then run `bun run gates` in the background. Expected: only the known reds.
  - Pay particular attention to: audit:api-system-permission, app-api-catalog-drift, rest-contract, message-pattern-literal and guard-providers.
- [ ] Commit `feat(license-intake): staff queue routes`. Commit the regenerated catalog in the same commit.

## Frontend (carmen-backstage, branch `feature/license-intake-queue`)

### Task 6: Types, service, routing, nav badge

**Files:**
- `src/types/index.ts`: add `LicenseIntake`, `LicenseIntakeStatus`, `LicenseIntakeGroup`, `LicenseIntakeDetail`, `LicenseIntakeBuLicenses` and `LicenseIntakeSummary`, mirroring Task 3. All fields optional except `id` and `status`.
- `src/services/licenseIntakeService.ts`:
  - Methods: `getAll(params)`, `getSummary()`, `getById(id)`, `getBuLicenses(id, buId)`, `confirm(id, body)`, `reject(id, body)`.
  - Base path `/api-system/backstage/license-intakes`.
  - Wrap every path segment with `encodeURIComponent`, as `customerService` does.
- `src/components/nav/backstageNav.ts`: add the item inside the license run, with `permission: 'subscription.read'`, `feature: 'license_intakes'` and `countKey: 'licenseIntakesPending'`.
- `src/constants/featureFlags.ts`: register the feature.
- `src/App.tsx`: add the two lazy `PrivateRoute`s, gated on `subscription.read` + the feature.
- `src/components/Sidebar.tsx`:
  - New optional `NavItem.countKey`.
  - Render a small count `Badge` in both the expanded and collapsed branches, only when the count is > 0.
- New hook `src/hooks/useLicenseIntakePendingCount.ts`. It follows R11 and needs a race guard.
- `src/i18n/en.ts` and `th.ts`.

- [ ] Implement. Update `Sidebar.test.tsx` only if it breaks. Run typecheck + lint + test. Commit `feat(license-intakes): service, routes, nav badge`.

### Task 7: List page

**Files:** `src/pages/LicenseIntakeManagement.tsx` (+ `src/pages/licenseIntakes/*` helpers). Copy the shape of `CustomerManagement.tsx`.

- It is a server-side list:
  - Status filter `pending | confirmed | rejected | all`, default `pending`, persisted in `status_license_intakes` with an `isStatusFilter` guard.
  - Debounced search.
  - CSV export.
  - Summary band from `getSummary()`.
  - Debug Sheet, `Ctrl/⌘+K`, and perpage persisted.
- Columns, in `useMemo`:
  - status `Badge`: pending=`warning`, confirmed=`success`, rejected=`secondary`
  - sale id
  - AR
  - customer name, or an "AR not found" `outline` badge
  - seats
  - module chips and interface chips (`<Badge variant="outline" className="font-normal" title={code}>`, with missing groups marked)
  - period
  - received (`created_at`)
- A row click navigates to `/license-intakes/:id`.

- [ ] Implement, run typecheck + lint, commit `feat(license-intakes): queue list page`.

### Task 8: Detail / decision page

**Files:**
- `src/pages/LicenseIntakeDetail.tsx`
- `src/pages/licenseIntakes/{IntakeSoldCard,IntakeOverlapPanel,RejectIntakeDialog}.tsx`
- `src/components/BusinessUnitPicker.tsx`, a single-select typeahead cloned from `CustomerPicker`. It takes a `suggested` prop rendered as the first group.
- `src/pages/CustomerEdit.tsx`: in new mode, prefill `ar_number` from `?ar_number=`.

**Behaviour:**
- `PageHeader` with `backTo="/license-intakes"` and the status badge in `afterTitle`.
- Hold `doc_version` in its own state.
- On 409, check `isVersionConflict` before `notifyVersionConflict()` + refetch. A `NOT_PENDING` error → toast + refetch.
- Sold card:
  - Shows seats, chips, period, note, customer and the received time.
  - "AR not found" shows a "Create customer" link to `/customers/new?ar_number=…`, gated on `customer.manage`.
- Pending + `<Can permission="subscription.approve">`:
  - The BU picker shows the suggested BUs first.
  - Picking a BU loads `getBuLicenses`.
  - `IntakeOverlapPanel` lists seats, subscriptions (with chips) and interfaces with their dates. Rows with `overlaps` are flagged.
  - If `any_overlap` is true, a warning callout says the licences will stack during the overlap.
- Confirm button → `<ConfirmDialog>`:
  - The description names the BU and adds the stacking sentence when there is an overlap.
  - It sends `overlap_warning_shown = any_overlap`.
- Reject button → `RejectIntakeDialog` (R12).
- After either action: toast, dispatch `license-intakes:changed`, refetch.
- Confirmed or rejected intakes are read-only.
  - Confirmed shows the BU, who confirmed and when, and links to the produced rows: the subscription via `/licenses/subscriptions/:id`, or whatever route exists.
  - Rejected shows the reason, who rejected and when.
- Every catch block uses `parseApiError` / `getErrorDetail`.
- Keep the dev debug Sheet. Skip `useUnsavedChanges`: this is a decision page, not a form.

- [ ] Implement. Run typecheck + lint + test + build. Commit `feat(license-intakes): review page with BU picker, overlap warning, confirm/reject`.

### Task 9: Manual verification (for the user, after BE is on DEV; not dispatched)

1. Seed on DEV, in this order: `subscription.approve` (permission seed, then role seed), then `db:seed.application-api`.
2. Push 3 intakes with curl:
   - modules + seats + interface
   - interface only, for a BU with no subscription
   - one whose AR has no customer
3. Confirm the first one.
   - Check that the rows carry `license_intake_id` and seat/interface `reference_no = sale id`.
   - Check that the BU is linked to the customer.
   - Check the tb_activity rows.
4. The second intake → expect `NO_MAIN_CONTRACT`, with nothing written.
5. The third → `CUSTOMER_MISSING`. Create the customer through the shortcut, then confirm.
6. Open the same pending intake in two tabs and confirm it in both → the second gets a 409.
7. As a Support Staff user, check the list is visible but there is no Confirm or Reject. As a cluster admin, check there is no nav item and a direct call returns 403.
8. Check at 390px and in TH/EN.
