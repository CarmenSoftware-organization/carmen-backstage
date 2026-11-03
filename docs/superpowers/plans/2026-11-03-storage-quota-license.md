# Storage Quota License Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give each BU a dateless storage licence (`STQ-YYMM-####`) that carries its DB and file quota. It is issued from a license intake or by staff on `/licenses`. Whenever a BU has no licence, or a licence leaves a figure empty, the `storage_quota` config default applies (now 5 GB / 5 GB).

**Architecture:** The table and two pure helpers live in `prisma-shared-schema-backstage`: `issueStorageLicense` (supersede, then insert) and `effectiveStorageQuota`. That way intake confirm (micro-cluster) and manual CRUD (micro-cluster) issue licences the same way. CRUD follows the existing interface-licence path: micro-cluster module → rpc-contract → gateway controller. Only the gateway reads the `storage_quota` config, so after any licence write the gateway calls `StorageQuotaService.refreshQuota(buId)` to re-derive `quota_bytes` on the usage rows. The FE adds a Storage tab with its own table and form; it does not extend the date-centred `LicensePurchaseForm` / `PurchaseLicenseTable`.

**Tech Stack:** NestJS + Prisma 7 (backend monorepo, Bun), React 18 + TS + Vite + shadcn/ui + i18next (FE).

**Spec:** `docs/superpowers/specs/2026-11-03-storage-quota-license-design.md`. Read it before any task; the O-numbers below refer to its §2.

## Global Constraints

- **No automated tests** (user's standing instruction): skip "write failing test / run test" steps and create no `*.spec.ts` / `*.test.ts`. Still run typecheck + lint, and existing suites must stay green.
- Backend repo `../carmen-turborepo-backend`, branch **`feature/storage-quota-license`** (create from `main`). FE repo: this repo, the same branch name, already created. Subagents must be told the branch name, or they commit onto `main`.
- **Don't push the backend branch before review:** pushing a branch that contains a migration has applied it to DEV within about 2 minutes, twice before.
- Licence number prefix `STQ`. Format `STQ-YYMM-####`, issued by `nextLicenseNumber('STQ', …)`.
- Defaults: `default_db_bytes = 5368709120` (5 GB), `default_file_bytes = 5368709120` (5 GB).
- Intake push fields: `storage_db_gb`, `storage_file_gb`. Both optional, integer ≥ 1, GB. Stored as bytes (`× 1073741824`).
- A licence with both figures NULL is invalid → 400.
- Write permission: `subscription.manage`, same as interface licences. AppIdGuard keys `businessUnitStorageLicense.create|update|delete`. Read routes carry no `@RequireBackstagePermission`; they are authorized in micro-cluster, like interface licences.
- FE: `/api-system` base, `parseApiError` / `getErrorDetail` in catch blocks, `doc_version` via `src/utils/docVersion.ts`, `<Badge>` variants for status, i18n TH + EN for every new string, `<ConfirmDialog>` for delete.

## Review Focus

1. **An intake without storage figures must leave the BU's current licence in force** (O5). Manual check: confirm one on DEV and see the old STQ still in force.
2. **An intake with only `storage_file_gb`** → the licence has DB NULL, and the BU card shows DB = "Default". Check that a bare `0` or a string is rejected at push (400), not stored.
3. **Two concurrent issues for one BU** must not leave two licences in force. The partial unique index has to make the second transaction fail, and it must surface as 409, not 500.
4. **The migration is idempotent and leaves every manual quota unchanged.** Run it twice on a DB copy and check the licence count; compare `quota_bytes` before and after for every BU that had an override.
5. **The BU card when the FE ships before the BE** (new fields absent) must render usage without crashing.

---

## Backend (`../carmen-turborepo-backend`, branch `feature/storage-quota-license`)

### Task 1: Schema, migration, shared helpers

**Files:**
- Modify: `packages/prisma-shared-schema-backstage/prisma/schema.prisma`: add model `tb_business_unit_storage_license` next to `tb_business_unit_storage_quota` (~L1551), add relations on `tb_business_unit` (~L297) and `tb_license_intake` (~L456), add `storage_db_bytes BigInt?` / `storage_file_bytes BigInt?` to `tb_license_intake`, and update the `kind` doc comment on `tb_license_number_retired` to include `'STQ'`.
- Create: `packages/prisma-shared-schema-backstage/prisma/migrations/20261105090000_add_bu_storage_license/migration.sql`
- Modify: `packages/prisma-shared-schema-backstage/src/license-number.ts` (`LicensePrefix` adds `'STQ'`; update the doc comment)
- Create: `packages/prisma-shared-schema-backstage/src/storage-license.ts`
- Modify: `packages/prisma-shared-schema-backstage/src/index.ts` (export the new module)

**Interfaces — Produces:**
```ts
// storage-license.ts
export interface StorageQuotaDefaults { default_db_bytes: number; default_file_bytes: number }
export interface StorageLicenseFigures { db_quota_bytes: bigint | null; file_quota_bytes: bigint | null }
export function effectiveStorageQuota(
  license: StorageLicenseFigures | null, defaults: StorageQuotaDefaults,
): { database: number; attachment: number; source: { database: 'license' | 'default'; attachment: 'license' | 'default' } };
export const STORAGE_LICENSE_IN_FORCE = { deleted_at: null, superseded_at: null } as const; // Prisma where fragment
export async function issueStorageLicense(tx: Prisma.TransactionClient, input: {
  businessUnitId: string; dbQuotaBytes: bigint | null; fileQuotaBytes: bigint | null;
  referenceNo?: string | null; note?: string | null; userId: string | null; licenseIntakeId?: string | null;
}): Promise<{ id: string; license_number: string; superseded_id: string | null }>;
```

- [ ] **Step 1: Add the model.** Columns are exactly those in spec §4. Index map names: `bu_storage_license_bu_deleted_at_idx` (business_unit_id, deleted_at) and `bu_storage_license_license_intake_idx`. The FK to `tb_license_intake` must be named `license_intake_id` (same as the other licence tables).
- [ ] **Step 2: Write `migration.sql`.**
  - The Prisma-generated DDL (`bunx prisma migrate diff` from the previous schema).
  - Two partial unique indexes added by hand:
    - `bu_storage_license_number_u ON (license_number) WHERE deleted_at IS NULL`
    - `bu_storage_license_in_force_u ON (business_unit_id) WHERE deleted_at IS NULL AND superseded_at IS NULL`
  - The O11 data migration:
    ```sql
    INSERT INTO tb_business_unit_storage_license (business_unit_id, license_number, db_quota_bytes, file_quota_bytes, note)
    SELECT q.bu_id,
           'STQ-' || to_char(now() AT TIME ZONE 'Asia/Bangkok', 'YYMM') || '-' || lpad(row_number() OVER (ORDER BY q.bu_id)::text, 4, '0'),
           q.db_quota_bytes, q.file_quota_bytes, 'Migrated from manual quota'
    FROM tb_business_unit_storage_quota q
    WHERE (q.db_quota_bytes IS NOT NULL OR q.file_quota_bytes IS NOT NULL)
      AND NOT EXISTS (SELECT 1 FROM tb_business_unit_storage_license l WHERE l.business_unit_id = q.bu_id AND l.deleted_at IS NULL);
    ```
  - Schema-qualify the tables the same way `20261104090000_add_bu_storage_quota/migration.sql` does.
  - **Do not** drop the old columns here (spec §4).
- [ ] **Step 3: Implement `storage-license.ts`.** `issueStorageLicense` runs inside the caller's tx:
  - Find the BU's in-force row.
  - Number the new licence with `nextLicenseNumber('STQ', withMonth => tx.tb_business_unit_storage_license.findMany({ where: { license_number: { startsWith: withMonth } } })…)`, plus `readRetiredLicenseNumbers` (copy the read pattern of `issueInterfaceLicense` in `license-issue.ts`).
  - Set `superseded_at` on the old row first, then insert the new row, then set the old row's `superseded_by_id` to the new id.
  - Throw if both figures are null.
  - `effectiveStorageQuota` is pure: `Number(fig)` when non-null, otherwise the default.
- [ ] **Step 4: Verify.** Run `bun run --cwd packages/prisma-shared-schema-backstage build` (regenerates the client and `dist`) and `bun run check-types --filter=@carmen/prisma-shared-schema-backstage` (or the package's typecheck script). Expected: no errors. Remember that a stale `dist` makes the apps report false type errors.
- [ ] **Step 5: Commit** `feat(storage-license): ตาราง tb_business_unit_storage_license + migration ย้าย quota มือ + helper ออกใบ`

### Task 2: micro-cluster storage-licence module + rpc contract

**Files:**
- Create: `apps/micro-cluster/src/cluster/business-unit-storage-license/{business-unit-storage-license.controller.ts,business-unit-storage-license.service.ts,business-unit-storage-license.module.ts,interface/business-unit-storage-license.interface.ts}`. Model these on `business-unit-interface-license/`, but trim them to the handlers below.
- Modify: `apps/micro-cluster/src/app.module.ts`, `apps/micro-cluster/src/common/activity/backstage-activity-registry.ts` (entries for create / update / delete, plus `supersede` recorded on the old row).
- Generated: `packages/rpc-contract/src/contracts/business-unit-storage-licenses.ts` + `index.ts` via `bun run gen:rpc-contract` (follow the 3-step process in the file header; `service` value `'micro-cluster'`, contract group name `business-unit-storage-licenses`).

**Interfaces — Produces** (rpc `BusinessUnitStorageLicenses.*`):
- `findAll({ buId, user })` → the BU's licences, newest first, including replaced ones.
- `listBackstage({ query: QueryParams, user })` → paginated across all BUs, with `tb_business_unit { id, code, name, cluster { id, name } }`. Default sort `created_at desc`. Search fields: `license_number`, `reference_no`, and the BU code/name (lowercase `searchfields` on the wire).
- `findOneBackstage({ id, user })`
- `summaryBackstage({ user })` → `{ in_force: number; replaced: number; bus_without_license: number }`
- `create({ buId, db_quota_bytes, file_quota_bytes, reference_no?, note?, user })` → `{ id, license_number, superseded_id }`
- `update({ id, doc_version, db_quota_bytes?, file_quota_bytes?, reference_no?, note?, user })`. Only the in-force row can be updated; otherwise throw a new error-catalog entry `STORAGE_LICENSE_NOT_IN_FORCE` (409). Both figures ending up null → 400. Stale `doc_version` → the existing optimistic-lock 409.
- `delete({ id, doc_version, user })`: soft delete. Do **not** un-supersede the previous licence (O10).
- Row shape returned everywhere: `{ id, license_number, business_unit_id, db_quota_bytes: number|null, file_quota_bytes: number|null, reference_no, note, license_intake_id, superseded_at, superseded_by: { id, license_number } | null, doc_version, created_at, audit }`. BigInt is converted to number at the service boundary.

- [ ] **Step 1: Implement the service.** `create` calls `issueStorageLicense` inside `$transaction`. A P2002 on `bu_storage_license_in_force_u` (concurrent issue) maps to 409 `STORAGE_LICENSE_CONFLICT` (Review Focus 3). Read authorization copies the interface-licence service: check the backstage-wide / cluster scope the same way.
- [ ] **Step 2: Controller with temporary pattern literals → `bun run gen:rpc-contract` → swap in the contract references.**
- [ ] **Step 3: Verify.** `bun run check-types --filter=micro-cluster`, then `bunx eslint apps/micro-cluster/src/cluster/business-unit-storage-license` (**not** `bun run lint`, which rewrites the whole repo). Run the audits `bun run audit:tcp-drift`, `audit:message-pattern-literal` and `audit:rest-contract`; all must PASS.
- [ ] **Step 4: Commit** `feat(storage-license): micro-cluster CRUD ใบ storage + rpc contract`

### Task 3: Gateway: licence routes, effective quota, defaults

**Files:**
- Create: `apps/backend-gateway/src/backstage/backstage_business-unit-storage-licenses/{controller,service,module}.ts` + `swagger/`, modelled on `backstage_business-unit-interface-licenses/`.
- Modify: `apps/backend-gateway/src/app.module.ts`
- Modify: `apps/backend-gateway/src/storage-quota/storage-quota.service.ts`
- Modify: `apps/backend-gateway/src/common/dto/storage-quota/storage-quota-update.dto.ts` (remove `db_quota_bytes` / `file_quota_bytes`; keep `exempt`, `note`)
- Modify: `apps/micro-cluster/src/cluster/backstage-config/backstage-config.schema.ts:438` → `default_file_bytes: 5368709120`
- Generated: `apps/backend-gateway/src/backstage/applications/app-api-catalog.generated.ts` via `bun run scripts/generate-app-api-catalog/run.ts`

**Routes** (two controllers in one file, as with interface licences):
- `GET|POST /api-system/business-units/:buId/storage-licenses`
- `PATCH|DELETE /api-system/business-units/:buId/storage-licenses/:id`
- `GET /api-system/backstage/storage-licenses` (list), `GET …/summary` (**declared above `:id`**), `GET …/:id`

**Interfaces — Produces:**
- `StorageQuotaService.refreshQuota(buId: string): Promise<void>` re-derives `quota_bytes` on the BU's existing usage rows from `effectiveStorageQuota(inForce, config)`. It reuses the loop now in `updateQuota` (~L556) and swallows + logs errors, because the next measurement repairs any miss.
- `StorageQuotaView.quota` gains `license: { id, license_number } | null` and `source: { database: 'license'|'default'; attachment: 'license'|'default' }`.
- `StorageUsageListItem` gains `license_number: string | null`.

- [ ] **Step 1: Route every quota read through `effectiveStorageQuota`.** Add a private `loadLicenseInForce(buId)` (and a batched version for `listAllUsage`, ~L590). Replace the fallbacks at ~L245 (`measure`), ~L495 (`getQuotaView`), ~L550 (`updateQuota`) and in `listAllUsage`. Afterwards, `grep -n "quotaRow?.db_quota_bytes\|row.db_quota_bytes" storage-quota.service.ts` must return nothing.
- [ ] **Step 2: Change `updateQuota`** to write only `exempt` / `note`, and drop `quota` from the DTO and the swagger.
- [ ] **Step 3: Set the gateway `DEFAULT_CONFIG.default_file_bytes` to 5368709120** in `storage-quota.service.ts`, together with the registry default in micro-cluster (three copies exist, FE is in Task 6). Update the comments that say "15 GB".
- [ ] **Step 4: Licence controller.** POST / PATCH / DELETE call the rpc, then `await storageQuotaService.refreshQuota(buId)`. Guards: `new AppIdGuard('businessUnitStorageLicense.<op>')` + `BackstagePermissionGuard` + `@RequireBackstagePermission('subscription.manage')`. DTOs are zod with `db_quota_bytes` / `file_quota_bytes`: positive integer or null, refined so that not both are null. Bytes go on the wire (the FE converts from GB).
- [ ] **Step 5: Regenerate the app-api-catalog.** Add the three keys to the backstage app allow-list seed, wherever `businessUnitInterfaceLicense.create` is seeded (`grep -rn "businessUnitInterfaceLicense.create" packages apps --include='*.ts'`).
- [ ] **Step 6: Verify.** `bun run check-types --filter=backend-gateway` and `bunx eslint` on the touched dirs, then run all 9 audits (loop in `reference_backend_v2_audit_gates`) or `bun run gates`. All must PASS.
- [ ] **Step 7: Commit** `feat(storage-license): gateway routes + quota ที่มีผลมาจากใบ + default ไฟล์ 5 GB`

### Task 4: Intake carries storage

**Files:**
- Modify: the push DTO for the license-intake partner API (`apps/backend-gateway/src/common/dto/license-intake/*`) and its swagger example
- Modify: `apps/micro-cluster/src/cluster/license-intake/license-intake.normalize.ts`. Add `storage_db_gb` / `storage_file_gb` to the normalised shape **and** to the hashed object (~L97); `payload_hash` is computed in `license-intake.service.ts:137`.
- Modify: `license-intake.service.ts` (persist `storage_db_bytes` / `storage_file_bytes`)
- Modify: `license-intake-decision.service.ts:256` (`IProduced` + confirm)
- Modify: `license-intake-overlap.ts` (`computeBuLicenseOverview`), `license-intake-queue.service.ts` (detail `produced` + list fields)
- Modify: `apps/backend-gateway/src/license-intakes/license-intakes-staff.controller.ts:190` (`confirm`)

**Interfaces — Produces:**
- The intake row/detail exposes `storage_db_bytes: number|null` and `storage_file_bytes: number|null`.
- `produced.storage: { id: string; license_number: string }[]`
- The overlap response gains `storage: { id, number, db_quota_bytes, file_quota_bytes } | null`, which is the BU's in-force licence.

- [ ] **Step 1: Push validation.** Integer ≥ 1 or absent. `0`, negatives, floats and strings → 400 (Review Focus 2).
- [ ] **Step 2: Confirm.** After the interface block and before the guarded flip: if either byte field is non-null, call `issueStorageLicense(tx, { businessUnitId: bu.id, dbQuotaBytes, fileQuotaBytes, referenceNo: intake.source_sale_id, userId, licenseIntakeId: intake.id })` and push the result to `produced.storage`. Otherwise do nothing (O5).
- [ ] **Step 3: Gateway confirm.** After the rpc succeeds, if `produced.storage.length > 0`, call `storageQuotaService.refreshQuota(buId)`. Import `StorageQuotaModule` into `LicenseIntakesModule`.
- [ ] **Step 4: Verify.** check-types for micro-cluster and backend-gateway, eslint on touched dirs, all 9 audits. Then manual curl against a local stack:
  - push one intake with `storage_file_gb: 20` only and one without storage;
  - confirm both onto the same BU;
  - `GET /api-system/business-units/:buId/storage-licenses` must show the first one in force and nothing new from the second (Review Focus 1).
- [ ] **Step 5: Commit** `feat(license-intake): ใบขายระบุ storage_db_gb/storage_file_gb แล้วออกใบ STQ ตอนยืนยัน`

## Frontend (this repo, branch `feature/storage-quota-license`)

### Task 5: Types, service, default

**Files:**
- Modify: `src/types/index.ts`: add `BuStorageLicense` (row shape from Task 2), `BuStorageLicenseSummary`, `BuStorageLicenseInput`. Extend `BuStorageQuotaView.quota` (all new fields optional: `license?`, `source?`), `StorageUsageListItem.license_number?`, `LicenseIntake.storage_db_bytes?` / `storage_file_bytes?`, `LicenseIntakeProduced.storage?`, and `LicenseIntakeBuLicenses.storage?`. Remove the quota fields from `StorageQuotaPatch`.
- Create: `src/services/businessUnitStorageLicenseService.ts`: `listByBu(buId)`, `listBackstage(params)`, `summary()`, `get(id)`, `create(buId, input)`, `update(buId, id, input & { doc_version? })`, `remove(buId, id, docVersion)`. Shape copied from `businessUnitInterfaceLicenseService.ts`.
- Modify: `src/pages/backstageConfig/StorageQuotaConfigCard.tsx:33` `DEFAULTS.default_file_bytes` → 5 GB, plus the comment on L32.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Verify.** `bun run typecheck && bun run lint`. Expected: clean, except for errors in files that Tasks 6–9 will fix (the `StorageQuotaPatch` change breaks `BuStorageQuotaCard`). If so, do Task 8 Step 1 in the same commit.
- [ ] **Step 3: Commit** `feat(storage-license): types + service ใบ storage และ default ไฟล์ 5 GB`

### Task 6: `/licenses` Storage tab

**Files:**
- Create: `src/pages/licenses/StorageLicenseTable.tsx`
- Modify: `src/pages/licenses/LicenseCenter.tsx:118` (add `{ id: 'storage', … }` after `interface`, render `<StorageLicenseTable deletedView={deletedView} />`, and extend the `LicenseView` union and its membership check)
- Modify: `src/i18n` locale files (TH + EN): `pages.licenses.viewByStorage` and `pages.storageLicense.*`

- Server-side list (Rule 13): `DataTable serverSide`, debounced search, `perpage_storage_license` in localStorage, CSV export via `generateCSV` + `downloadCSV`.
- Summary band from `summary()`: in force / replaced / BUs without a licence.
- Columns: number (link to edit), BU (name + code), cluster, DB quota, file quota (null → `t('pages.storageLicense.default', { size })` using the live default from `backstageConfigService`), status `<Badge>` (in force = `success`, replaced = `secondary`, with "→ STQ-…" from `superseded_by`), source (intake link / manual / migrated, derived from `license_intake_id` and the note), created (`AuditMeta`).
- **No** Days Left, expiry filter or date columns. Wrap column defs in `useMemo`. Mobile card hints via `meta.card`.
- "Issue storage licence" button → `/licenses/storage/new`.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Verify.** `bun run typecheck && bun run lint`. Manual: `/licenses?tab=storage` at desktop and 390px (iframe probe, see `reference_iframe_viewport_probe`), TH + EN.
- [ ] **Step 3: Commit** `feat(licenses): แท็บ Storage แสดงใบ storage quota`

### Task 7: Storage licence create / edit page

**Files:**
- Create: `src/pages/licenses/StorageLicenseForm.tsx` (one component with `mode: 'create' | 'edit'`)
- Modify: `src/App.tsx` (routes `/licenses/storage/new` and `/licenses/storage/:id/edit`, beside the interface routes ~L257; lazy import)
- Modify: `src/components/Breadcrumbs.tsx` (`storage` segment), i18n TH + EN

- Fields:
  - BU picker (`BusinessUnitPicker`, prefilled from `?bu=`, read-only in edit)
  - DB quota GB and file quota GB: optional; empty = default, with a hint showing the live default. Validate with `isValidQuotaInput` and require at least one. Convert with `BYTES_PER_GB` / `bytesToGbInput` from `src/utils/storageQuota.ts`.
  - `reference_no`, `note`
- Create mode: when the BU has an in-force licence (`listByBu`), show an inline notice "Replaces STQ-…" above the unsaved bar.
- Edit mode: an issued plate (number, BU, source, status). A replaced licence opens read-only with a link to its successor.
- Delete via `<ConfirmDialog>`. For the in-force licence, the copy says the BU falls back to the default.
- Edit-page furniture (Rule 14): `PageHeader backTo="/licenses?tab=storage"`, `.unsaved-bar` with Save/Cancel, `useUnsavedChanges`, `useGlobalShortcuts`, `validateField` on blur, dev debug Sheet, and `doc_version` via `src/utils/docVersion.ts` (409 → `notifyVersionConflict()` + refetch). Catch with `parseApiError` and check `isVersionConflict` first.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Verify.** `bun run typecheck && bun run lint`. Manual: create for a BU with no licence, create again (old one shows replaced), edit figures, delete the in-force one (the BU card shows Default).
- [ ] **Step 3: Commit** `feat(licenses): หน้าออก/แก้ใบ storage quota`

### Task 8: `BuStorageQuotaCard` reads the licence

**Files:**
- Modify: `src/pages/clusterAdmin/businessUnitForm/BuStorageQuotaCard.tsx`, i18n

- [ ] **Step 1: Change the card.** Remove the DB/file quota inputs and their save path; keep the `exempt` + note save. Under each quota show its source: when `quota.license` is present, a link `STQ-…` → `/licenses/storage/:id/edit`; when `source[kind] === 'default'`, "Default". Add a button "Issue storage licence" / "Replace" → `/licenses/storage/new?bu=<id>`, shown only with `subscription.manage` (`<Can>`). When `quota.license` / `source` are absent (BE not yet deployed), render the quota with no source line (Review Focus 5).
- [ ] **Step 2: Verify.** `bun run typecheck && bun run lint`. Manual on a BU edit page: a BU with a licence, a BU without one, and exempt toggle still saves.
- [ ] **Step 3: Commit** `feat(storage-quota): การ์ด Storage แสดง quota จากใบ license แทนช่องแก้มือ`

### Task 9: Intake UI shows storage

**Files:**
- Modify: `src/pages/licenseIntakes/IntakeSoldCard.tsx`, `src/pages/licenseIntakes/IntakeOverlapPanel.tsx`, `src/pages/LicenseIntakeDetail.tsx`, and `src/pages/licenseIntakes/format.ts` if a bytes formatter belongs there (reuse `formatBytes` from `utils/storageQuota.ts`), plus i18n.

- [ ] **Step 1: Implement.**
  - Sold card: a "Storage" row. Neither figure → "Not included". Otherwise show the DB and file values, with an empty one reading "Default".
  - Overlap panel: when the intake carries storage and `storage` (the BU's in-force licence) is non-null, show "Will replace STQ-… (DB x / File y)" as info, not as an overlap warning.
  - Detail: list `produced.storage` with links to the edit page.
- [ ] **Step 2: Verify.** `bun run typecheck && bun run lint && bun run test` (the existing suites must stay green). Manual: open an intake with and without storage.
- [ ] **Step 3: Commit** `feat(license-intakes): แสดง storage ในใบขายและใบ STQ ที่ออกให้`

## Deploy notes (not tasks; for the PR descriptions)

1. BE PR first, merge-commit. Deploy to DEV applies the migration. Check that the licence count equals the number of rows with a manual quota, and that `quota_bytes` is unchanged for those BUs (Review Focus 4).
2. Seed the app allow-list on **every** environment (DEV, production, and any other app id such as inventory/UAT) with all six keys `businessUnitStorageLicense.create`, `.update`, `.delete`, `.findAll`, `.listPlatform`, `.findOnePlatform` **before the FE goes live** (Task 3 Step 5). Without them the Storage tab, the edit page and the create form return 401, which logs the user out. Writes also require backstage-wide `subscription.manage` (`BackstageWidePermissionGuard`); a cluster-scoped grant is not enough.
3. FE PR merged to `main` (auto-deploys to DEV).
   - **Old-FE window:** until the new FE is deployed, the old quota card keeps working (the gateway still returns deprecated `db_quota_bytes` / `file_quota_bytes` in the quota view, mirroring the in-force licence, for one release), but quota edits made from it are no-ops: PUT no longer accepts those fields, only `exempt` / `note` save.
   - **Post-deploy reconciliation** (run on each environment once the new gateway is up). It catches manual quotas edited between the migration applying and the new gateway starting; expect zero rows:
     ```sql
     SELECT q.bu_id, q.db_quota_bytes AS q_db, q.file_quota_bytes AS q_file,
            l.license_number, l.db_quota_bytes AS l_db, l.file_quota_bytes AS l_file
     FROM tb_business_unit_storage_quota q
     LEFT JOIN tb_business_unit_storage_license l
       ON l.business_unit_id = q.bu_id AND l.deleted_at IS NULL AND l.superseded_at IS NULL
     WHERE (q.db_quota_bytes IS NOT NULL OR q.file_quota_bytes IS NOT NULL)
       AND (l.id IS NULL
            OR q.db_quota_bytes   IS DISTINCT FROM l.db_quota_bytes
            OR q.file_quota_bytes IS DISTINCT FROM l.file_quota_bytes);
     ```
     Any row: issue (or correct) an STQ licence for that BU from the Licenses > Storage tab.
4. On each environment, if a `storage_quota` config row exists, set the file default to 5 GB in Backstage Config.
5. Later, a separate branch: drop `tb_business_unit_storage_quota.db_quota_bytes` / `file_quota_bytes`.
6. Production: `git push origin main:vercel` after the BE is on production.
