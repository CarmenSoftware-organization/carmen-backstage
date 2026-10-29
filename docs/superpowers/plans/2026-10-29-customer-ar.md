# Customer (AR) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A backstage-wide Customer (AR number = payer) entity, linked from BUs (one AR per BU, many BUs per AR), with a Customers list/edit screen and a customer picker on BU Edit.

**Architecture:** New `tb_customer` in the backstage schema plus `tb_business_unit.customer_id`. micro-cluster owns CRUD and link/unlink. The gateway exposes it under `api-system/backstage/customers`. The FE gets Management + Edit pages copied from Database Pools, and BU Edit gets a typeahead picker that calls the link endpoints directly (not the BU form's Save).

**Tech Stack:** NestJS + Prisma (PrismaClient_SYSTEM), zod DTOs, `@repo/rpc-contract` (generated), React + TS + shadcn.

**Spec:** `docs/superpowers/specs/2026-10-29-license-intake-customer-design.md` — Part 2. Plan 2 of 4 (plan 1 `2026-10-29-subscription-scheduled-state.md` is merged).

## Global Constraints

- **No new test files** (user preference): implement → type-check → lint → commit; verify manually. Existing suites must pass. Fix existing specs only where a shape changed.
- **Names (collision):** the tenant schema already has `tb_customer`, rpc contract `Customers` (`customers.*`), and api_names `customer.*`. In the backstage side use:
  - contract `BackstageCustomers`
  - cmd prefix `backstage-customers.*`
  - service `micro-cluster`
  - AppIdGuard names `backstage-customer.list|get|create|update|delete|link|unlink`
  - gateway path `api-system/backstage/customers`
  - permission keys `customer.read` / `customer.manage` (backstage RBAC catalog, no collision)
- AR number is normalized `trim().toUpperCase()` in micro-cluster before the duplicate check and the write. It is unique among live rows via a SQL partial index. Never use `@@unique([ar_number, deleted_at])`, because NULL<>NULL makes it useless (see the comment on tb_business_unit, schema.prisma ~:296).
- `doc_version` on update. A stale version gives 409. Follow `ai-provider.service.ts`: `updateMany` with doc_version in WHERE, count 0 → 409.
- Customer data is a reference copy of accounting's AR profile. No balances, no posting.
- `tb_business_unit.company_name` / `tax_no` stay untouched.
- Customer link is backstage-only. The cluster-admin BU form (`src/pages/clusterAdmin/BusinessUnitForm.tsx`) never sends or shows it.
- Backend: run `bun run gates` before push. `bun run lint` rewrites the repo, so use `bunx eslint <files>`. Migrations apply to DEV within ~2 min of pushing any branch, so push only when the plan's Task 1–3 are committed together.
- FE: TH + EN i18n for every string. `<Badge variant>` for status. `PageHeader` for titles. CSV export on the list page. `useUnsavedChanges`, Ctrl/⌘+S, Escape on Edit. Debug sheet dev-only.
- Deploy order: backend before FE.

## Review Focus

1. Creating `" ar-001 "` when `AR-001` exists (live) → 409 `CUSTOMER_AR_NUMBER_EXISTS`. Creating it when the existing one is soft-deleted → succeeds.
2. Deleting a customer with any live BU linked → 409 `CUSTOMER_IN_USE`. A linked BU that is soft-deleted does not block.
3. Linking a BU that is already linked to a *different* customer → 409 `CUSTOMER_BU_LINKED_ELSEWHERE`, not a silent move. Unlinking a BU that is not linked to this customer → 404.
4. A cluster-admin (membership) user calling the BU update with `customer_id` in the body: the field is ignored. It is not in the DTO, so zod strips it.
5. BU Edit picker for a user without `customer.read`: no fetch fires and no picker renders. The linked customer name still shows read-only from the BU detail.

---

### Task 1: Schema, migration, permissions, error catalog (BE)

**Files:**
- Modify: `packages/prisma-shared-schema-backstage/prisma/schema.prisma`. Add model `tb_customer` after `tb_cluster_note` (~:403); add the `customer_id` FK on `tb_business_unit` (~:213-309)
- Create: `packages/prisma-shared-schema-backstage/prisma/migrations/20261029120000_add_customer/migration.sql`
- Modify: `packages/prisma-shared-schema-backstage/prisma/seed.backstage-permission.data.ts` (+ fix the stale "23 active resources" comment at :15)
- Modify: `packages/prisma-shared-schema-backstage/src/backstage-permission-resource.ts`
- Modify: `packages/prisma-shared-schema-backstage/prisma/seed.backstage-role-permission.data.ts`
- Modify: `packages/error-catalog/src/module.ts` (new `CUSTOMER` id after `RUNNING_CODE: 813`), `packages/error-catalog/src/catalog.ts` (next to the `DATABASE_POOL_*` entries ~:3562)

**Interfaces:**
- Produces model `tb_customer`, with fields in this order: `id` Uuid default; `ar_number` VarChar(30); `company_name` VarChar(255)?; `tax_no` VarChar(30)?; `billing_address` Json?; `status` enum `enum_customer_status` (`active`|`inactive`) default active; `note` Text?; the standard audit block from `tb_cluster_note` (doc_version, created/updated at/by, deleted_at/by); back-relation `tb_business_unit tb_business_unit[]`.
- Produces `tb_business_unit.customer_id String? @db.Uuid` + relation `tb_customer tb_customer?` + `@@index([customer_id], map: "business_unit_customer_idx")`.
- Produces error entries: `CUSTOMER_NOT_FOUND` (404), `CUSTOMER_AR_NUMBER_EXISTS` (409), `CUSTOMER_IN_USE` (409), `CUSTOMER_BU_LINKED_ELSEWHERE` (409). Each has message_en + message_th.
- Produces permissions:
  - `customer.read`: "View customers (AR numbers) and the business units they pay for"
  - `customer.manage`: "Create, edit and delete customers and link business units to them"
- Produces role grants:
  - Backstage Admin: `customer.*`
  - Support Manager: `customer.read`, `customer.manage`
  - Support Staff: `customer.read`

- [ ] **Step 1:** Branch `feature/customer-ar` from fresh `main` in `carmen-turborepo-backend`.
- [ ] **Step 2:** Prisma model + BU FK as above. Add a comment on the model: "ar_number unique among live rows via customer_ar_number_live_u (SQL only)".
- [ ] **Step 3:** Migration, idempotent like `20261026150000_add_cluster_note`: `CREATE TYPE` for the enum (guarded), `CREATE TABLE IF NOT EXISTS`, `CREATE UNIQUE INDEX IF NOT EXISTS "customer_ar_number_live_u" ON "tb_customer" ("ar_number") WHERE "deleted_at" IS NULL`, `ALTER TABLE tb_business_unit ADD COLUMN IF NOT EXISTS customer_id UUID`, FK DO-block (`ON DELETE SET NULL`), BU index.
- [ ] **Step 4:** Permission seed + resource seed (`description`/`description_th`) + role grants + error catalog.
- [ ] **Step 5:** `bun run db:generate`; `bun run check-types` → 0; run `bun run audit:backstage-permission-resource` and `bun run audit:api-system-permission` → pass; `cd packages/prisma-shared-schema-backstage && bun run test` and the role-permission data test → pass.
- [ ] **Step 6:** Commit `feat(customer): tb_customer + BU customer_id, permissions and error catalog`.

### Task 2: micro-cluster customer module

**Files:**
- Create: `apps/micro-cluster/src/cluster/customer/{customer.module.ts,customer.controller.ts,customer.service.ts,interface/customer.interface.ts}`. Copy `database-pool/` structure; copy the `ai-provider.service.ts` write pattern.
- Modify: `apps/micro-cluster/src/app.module.ts` (register `CustomerModule` next to `AiProviderModule`)
- Generated: `packages/rpc-contract/src/contracts/backstage-customers.ts` + `index.ts` via `bun run gen:rpc-contract`

**Interfaces (RPC, all on `BackstageCustomers`, with REST descriptors):**
- `findAll` (`GET /backstage/customers`): `QueryParams` paginate. `defaultSearchFields = ['ar_number','company_name','tax_no']`. Always `deleted_at: null`. Each row has `bu_count` (live linked BUs). Response is `{ paginate, data, summary: { all, active, inactive } }`; the summary is built in try/catch so a failure does not break the list (pattern: business-unit.service.ts ~:940).
- `findOne` (`GET /backstage/customers/:id`): customer + `business_units: { id, code, name, cluster_id, cluster_name, is_active }[]` (live BUs only).
- `create` (`POST`): `{ ar_number, company_name?, tax_no?, billing_address?, status?, note? }`. Normalize AR, check live duplicate → `CUSTOMER_AR_NUMBER_EXISTS`. P2002 also maps to 409 via TryCatch.
- `update` (`PATCH /:id`): same fields + required `doc_version`. AR change re-runs the duplicate check excluding self.
- `delete` (`DELETE /:id`): refuse `CUSTOMER_IN_USE` if any live BU has this `customer_id`, else soft delete.
- `linkBusinessUnit` (`PUT /:id/business-units/:buId`): BU must be live. If BU `customer_id` is another live customer → `CUSTOMER_BU_LINKED_ELSEWHERE`; if it is already this one → no-op 200. Otherwise set `customer_id` and bump BU `doc_version`.
- `unlinkBusinessUnit` (`DELETE /:id/business-units/:buId`): 404 `CUSTOMER_NOT_FOUND` if the BU is not linked to this customer; else set null and bump BU `doc_version`.
- Ruling carried from design: link/unlink are their own endpoints. BU update does not take `customer_id`. This gives one write path, gated by `customer.manage`, and the cluster-admin BU form cannot touch it.

- [ ] **Step 1:** Write the handlers with temporary `@MessagePattern({ cmd: 'backstage-customers.<op>', service: 'micro-cluster' })` literals; run `bun run gen:rpc-contract`; replace the literals with `BackstageCustomers.<op>.pattern`.
- [ ] **Step 2:** Implement the service per Interfaces. Wrap writes in `runWithAuditContext`. Set `created_by_id`/`updated_by_id`/`deleted_by_id` from the payload user. The two link ops update `tb_business_unit` through Prisma (check `bun run audit:bu-scope-guard` accepts the access; follow its message if not).
- [ ] **Step 3:** `cd apps/micro-cluster && bun run check-types` → 0; `bunx eslint src/cluster/customer src/app.module.ts` → clean; `bunx jest --runInBand --forceExit` → only the known pre-existing `setDefaultTenant` failure.
- [ ] **Step 4:** Commit `feat(customer): micro-cluster customer CRUD and BU link/unlink`.

### Task 3: Gateway controller + BU read model

**Files:**
- Create: `apps/backend-gateway/src/backstage/backstage_customers/{backstage_customers.controller.ts,backstage_customers.module.ts,backstage_customers.service.ts,swagger/response.ts}`. Copy `backstage_ai-providers/`.
- Create: `apps/backend-gateway/src/common/dto/customer/customer.dto.ts` (zod v4 `createZodDto`) + export from `common/dto/index.ts`
- Modify: `apps/backend-gateway/src/app.module.ts` (register module)
- Modify: micro-cluster `business-unit.service.ts` list include (~:937) and `loadBusinessUnitDetail` (~:1030) to add `tb_customer: { select: { id, ar_number, company_name, status } }`; `business-unit/dto/business-unit.serializer.ts` renames it to `customer`. Update the gateway BU swagger response accordingly.
- Regenerate: `bun run scripts/generate-app-api-catalog/run.ts`

**Interfaces:**
- Routes `@Controller('api-system/backstage/customers')`. Class level: `KeycloakGuard`, `ApiBearerAuth`, `ApiHeaderRequiredXAppId`. Per route: `AppIdGuard('backstage-customer.<op>')` + `BackstagePermissionGuard` + `@RequireBackstagePermission('customer.read'|'customer.manage')` + `@EnrichAuditUsers()`. Declare `GET summary` (if added) before `GET :id`.
- BU read model gains `customer: { id, ar_number, company_name, status } | null`.

- [ ] **Step 1:** Controller, service (`RpcClient.send(BackstageCustomers.x, payload)` → `Result.fromMicroserviceError` on non-2xx), DTOs (AR `z.string().trim().min(1).max(30)`, status enum, billing_address `z.record(z.unknown()).nullable().optional()`), swagger.
- [ ] **Step 2:** BU read model include + serializer + swagger.
- [ ] **Step 3:** Regenerate the app api catalog. Then run `bun run gates`. Expected: only the pre-existing red gates (`audit:raw-sql` document-number.helper.ts:219, `audit:dependencies` systeminformation, `setDefaultTenant` test, prettier on untracked/pre-existing files). Every new file must pass `bunx prettier --check`.
- [ ] **Step 4:** Commit `feat(customer): api-system customer endpoints; BU detail returns its customer`. Push, open PR (body: migration name, deploy order, permissions to seed on DEV).

### Task 4: FE — service, types, Customers list + edit

**Files:**
- Modify: `src/types/index.ts`. Add a `// ==== Customer (tb_customer) ====` section near `DatabasePool` (~:1271) with `Customer`, `CustomerStatus`, `CustomerWriteInput`, `CustomerBusinessUnit`, `CustomerSummary`; add `customer?: { id: string; ar_number: string; company_name?: string | null; status: CustomerStatus } | null` to `BusinessUnit` (~:168).
- Create: `src/services/customerService.ts`. Copy `databasePoolService.ts`; BASE `/api-system/backstage/customers`; `defaultSearchFields` = `ar_number,company_name,tax_no`; add `linkBusinessUnit(id, buId)` / `unlinkBusinessUnit(id, buId)`.
- Create: `src/pages/CustomerManagement.tsx`. Copy `DatabasePoolManagement.tsx`:
  - columns: AR number, company, tax no, status badge, BU count, audit columns
  - summary band from `summary` (All / Active / Inactive, clickable filters)
  - status filter
  - CSV
  - perpage key `perpage_customer`
- Create: `src/pages/CustomerEdit.tsx` (+ `src/pages/customerEdit/` sections if it grows). Toggle mode like `DatabasePoolEdit.tsx`:
  - fields: AR, company, tax no, status, billing address, note
  - "Business units" card: linked BUs with unlink (`ConfirmDialog`), plus a link control using `BusinessUnitMultiSelect`/a single BU picker
  - read-only "Licenses" card that reuses existing per-BU licence fetches for each linked BU: seats, subscriptions with module chips, interface
- Modify: `src/App.tsx` (3 routes, `requiredPermission="customer.read"`), `src/components/nav/backstageNav.ts` (item `nav.customers` under the licences/business group, icon `Building2` or `Receipt`, `permission: 'customer.read'`), `src/i18n/en.ts` + `th.ts` (`nav.customers`, `pages.customers.*`), `src/constants/featureFlags.ts` only if nav items in that group carry `feature`.

- [ ] **Step 1:** Branch `feature/customer-ar` from fresh `main` in `carmen-backstage`. Add types and the service.
- [ ] **Step 2:** Management page, Edit page, routes, nav, i18n (copy: EN "Customers"/"Customer", TH "ลูกค้า (AR)"; AR label EN "AR number", TH "เลข AR").
- [ ] **Step 3:** 409 handling. Check `isVersionConflict` first (`notifyVersionConflict` + refetch). Then map `CUSTOMER_AR_NUMBER_EXISTS` to the AR field error. `CUSTOMER_IN_USE` → toast.error with the BU count. `CUSTOMER_BU_LINKED_ELSEWHERE` → toast.error naming the other customer when the error details carry it, else generic.
- [ ] **Step 4:** `bun run typecheck` → 0, `bun run lint` → clean, `bun run test` → all pass.
- [ ] **Step 5:** Commit `feat(customers): Customers list and edit pages`.

### Task 5: FE — customer on BU Edit

**Files:**
- Create: `src/components/CustomerPicker.tsx` + `src/hooks/useCustomerSearch.ts`. Clone `UserPicker.tsx` / `useUserSearch.ts`: 400 ms debounce, generation guard, error in dropdown.
- Create: `src/pages/businessUnitEdit/BusinessUnitCustomerCard.tsx`
- Modify: `src/pages/businessUnitEdit/BusinessUnitDocument.tsx` (render the card in the `general` tab)

**Interfaces:**
- Consumes `BusinessUnit.customer` (Task 4 type), `customerService.linkBusinessUnit/unlinkBusinessUnit`.
- The card applies immediately with its own button (like the Live controls cards). It is not part of the BU form's Save, so it does not touch the BU's `formData`/`doc_version`. After success it refetches the BU without a skeleton. Link/unlink bump the BU's `doc_version`. If the BU form has unsaved edits, keep them and advance the form's `doc_version` only when the server's form fields still equal `savedFormData`. This is the same rule as ApplicationEdit's `fetchApplication({ keepForm: true })` (see `src/pages/CLAUDE.md` → Application Management). Otherwise the next BU Save hits a 409.

- [ ] **Step 1:** Card shows the linked customer (AR + company, link to `/customers/:id/edit`) or "No customer". With `customer.manage`: Change (picker → link; if the BU already has another customer, unlink first, then link, inside one handler, with a `ConfirmDialog` explaining the move) and Remove (`ConfirmDialog` → unlink). Without `customer.read`: read-only text only, no picker mounted.
- [ ] **Step 2:** Confirm the cluster-admin BU form never renders the card or sends `customer_id`.
- [ ] **Step 3:** `bun run typecheck`, `bun run lint`, `bun run test` → pass.
- [ ] **Step 4:** Commit `feat(customers): link a BU to its customer from BU Edit`. Push, open PR (merge after backend is on DEV).

### Task 6: Manual verification (DEV, after BE deploy + permission seed)

- [ ] **Step 1:** Seed permissions/roles on DEV (`seed.backstage-permission.ts`, role-permission seed). Confirm `customer.read`/`customer.manage` appear on the roles page.
- [ ] **Step 2:** Create `AR-TEST-01`, then try `" ar-test-01 "` → AR field error. Edit with a stale tab → version-conflict toast + refetch.
- [ ] **Step 3:** Link two BUs from the Customer page. Link one of them from another customer → "linked elsewhere" error. Delete the customer → in-use error. Unlink both → delete succeeds.
- [ ] **Step 4:** BU Edit: change and remove the customer. The BU form's own Save still works afterwards (no 409 from the doc_version bump — the silent refetch must have updated it).
- [ ] **Step 5:** Repeat Step 4 logged in as a cluster-admin user via `/cluster-admin/...`: no customer card. Check TH/EN and 390 px on both new pages.
- [ ] **Step 6:** Clean up test data.
