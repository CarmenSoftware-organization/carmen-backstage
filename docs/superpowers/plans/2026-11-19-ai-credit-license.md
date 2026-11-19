# AI Credit License Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Owner preference:** do not write automated tests and do not create `*.spec.ts` / `*.test.ts` files. Each task is: implement → type-check + lint → manual check (curl or browser) → commit. Existing suites must still pass before merge.

**Goal:** a per-BU AI credit balance (monthly quota from the subscription plus top-up licences that never expire), an append-only ledger, a reserve/commit/release RPC for the future OCR gateway, and the backstage UI to issue credits, adjust them and watch them.

**Architecture:** tables live in the backstage DB (`prisma-shared-schema-backstage`). The shared helpers in that package hold the pure balance and split rules and the issue function, so `micro-cluster`'s new `ai-credit` module and the license-intake confirm use the same code. The gateway exposes `/api-system` routes. An internal route is hit by `micro-cronjobs` to expire stale reservations. The FE follows the storage licence (STQ) pattern: its own service, form, table and BU card. It is not part of `licenseKindConfig`.

**Tech Stack:** NestJS microservices + Prisma/Postgres (Bun, turbo) · Go (`micro-cronjobs`) · React + TS + shadcn (`carmen-backstage`)

**Spec:** `docs/superpowers/specs/2026-11-19-ai-credit-license-design.md` (this repo). Read it first. Rule numbers (§5.x) below refer to it.

## Global Constraints

- **Branches:** `feature/ai-credit-license` in **each** repo. Create the branch before the first commit. Never commit on `main`, and never touch `prod`.
  - `carmen-turborepo-backend` (`R/` below)
  - `micro-cronjobs`
  - `carmen-backstage` (`FE/` below)
- Unit = **AI credit**. Every OCR feature costs 1 credit per page. The caller converts pages to credits, and this plan never sees pages.
- Licence number `AIC-YYMM-####` via `nextLicenseNumber('AIC', …)`. Numbers count soft-deleted and retired rows (`readRetiredLicenseNumbers`).
- Month key = `YYYY-MM` in **Asia/Bangkok**, computed in SQL (`AT TIME ZONE 'Asia/Bangkok'`) or by the shared helper. Never compute it on the client.
- Effective monthly quota = `MAX(tb_subscription.ai_credits_per_month)` over the BU's non-deleted subscriptions where `status='active' AND start_date <= now() AND now() < end_date`. If there are none, it is 0.
- `available = max(0, quota − monthly_used) + max(0, topup_remaining)`. Debit takes from monthly first.
- Error code `AI_CREDIT_INSUFFICIENT` (HTTP 402). The name is a stable contract.
- Licence and adjustment writes need `@RequireBackstagePermission('subscription.manage')`.
- Raw SQL must use `Prisma.raw(systemTableRef('<table>'))`, or it fails with 42P01 (`audit:raw-sql`).
- FE rules from `FE/CLAUDE.md`:
  - `ConfirmDialog`, never `window.confirm`; `toast.*`; `parseApiError` in catch blocks
  - i18n TH + EN for every string (`FE/src/i18n/en.ts`, `th.ts`)
  - mobile cards under `lg`
  - `doc_version` on licence void

## Review Focus

These cases have no automated test. Each one has a manual check in the owning task.

1. **Two concurrent reserves on one BU with exactly enough for one.** Expected: one gets 201, the other gets 402, and `available` is never negative. Check in Task 3, step 4.
2. **A subscription with `status='active'` whose `end_date` has passed.** Expected: it gives 0 quota. Check in Task 2, step 4.
3. **A retry of `reserve` with the same `idempotency_key`.** Expected: the same reservation id, with no second hold. Check in Task 3, step 4.
4. **An old intake re-pushed after deploy, without the AI fields.** Expected: an identical `payload_hash`, so it is treated as idempotent. Check in Task 6, step 3.
5. **Voiding a used top-up drives the top-up pool negative.** Expected: monthly quota is still usable, `available` excludes the negative top-up, and the UI shows the negative top-up figure. Check in Task 2, step 4, and Task 10, step 3.

---

## Part A — Backend (`carmen-turborepo-backend`)

### Task 1: Schema, migration, shared helpers

**Files:**
- Modify: `R/packages/prisma-shared-schema-backstage/prisma/schema.prisma`
  - new models and enums
  - `tb_subscription` (~660): add `ai_credits_per_month Int @default(0)`
  - `tb_license_intake` (~469): add `ai_credits_per_month Int?` and `ai_credit_topup Int?`
  - back-relations on `tb_business_unit` (~298) and `tb_license_intake` (~501)
- Create: `R/packages/prisma-shared-schema-backstage/prisma/migrations/20261119090000_add_ai_credit/migration.sql`
- Modify: `R/packages/prisma-shared-schema-backstage/src/license-number.ts:14` (add `'AIC'` to `LicensePrefix`)
- Create: `R/packages/prisma-shared-schema-backstage/src/ai-credit.ts`
- Modify: `R/packages/prisma-shared-schema-backstage/src/index.ts` (export it)

**Interfaces:**
- Produces, as Prisma models:
  - `tb_bu_ai_credit_license`: copy of `tb_business_unit_storage_license` minus `db_quota_bytes`, `file_quota_bytes` and `superseded_*`, plus `credits Int`
  - `tb_bu_ai_credit_balance`: `business_unit_id @unique`, `created_at`
  - `tb_bu_ai_credit_reservation`:
    - `id, business_unit_id, idempotency_key VarChar, feature, ref_type VarChar?, ref_id VarChar?`
    - `credits Int, from_monthly Int, from_topup Int, month Char(7), status, expires_at, release_reason VarChar?`
    - `credits_actual Int?, created_by_id, created_at, updated_at`
    - `@@unique([business_unit_id, idempotency_key])`, `@@index([status, expires_at])`
  - `tb_bu_ai_credit_ledger`:
    - `id, business_unit_id, entry_type, pool, credits Int (signed), month Char(7)?`
    - `feature?, ref_type?, ref_id?, reservation_id Uuid?, license_id Uuid?, reason?, created_by_id Uuid?, created_at`
    - `@@index([business_unit_id, pool, month])`, `@@index([business_unit_id, created_at])`
- Produces, as enums:
  - `enum_ai_credit_feature { ocr_grn_po_match ocr_ap_invoice ocr_payment_reconcile }`
  - `enum_ai_credit_entry_type { debit topup topup_void adjust }`
  - `enum_ai_credit_pool { monthly topup }`
  - `enum_ai_credit_reservation_status { pending committed released }`
- Produces, from `ai-credit.ts`:
  - `bangkokMonth(now?: Date): string`, returns `'YYYY-MM'`
  - `splitDebit(credits: number, monthlyRemaining: number): { from_monthly: number; from_topup: number }`
  - `splitRefund(refund: number, r: { from_monthly: number; from_topup: number }): { monthly: number; topup: number }`. Top-up first, capped at `from_topup` (§5.4).
  - `lockBuCredit(tx, businessUnitId): Promise<void>`. Upserts the balance row, then runs `SELECT 1 FROM ${systemTableRef('tb_bu_ai_credit_balance')} WHERE business_unit_id = $1 FOR UPDATE`.
  - `readAiCreditBalance(tx, businessUnitId, now?): Promise<AiCreditBalance>`, where:
    - `AiCreditBalance = { month, monthly_quota, monthly_used, monthly_remaining, topup_remaining, available, pending, low?: never }`
    - `low` is added by the caller, because it needs the config.
    - used and pending include `pending` reservations, per §5.5.
  - `issueAiCreditLicense(tx, { businessUnitId, credits, referenceNo?, note?, userId, licenseIntakeId? }): Promise<{ id: string; license_number: string }>`. Inserts the licence plus a `topup +credits` ledger row in the same tx. It mirrors the number retry of `issueStorageLicense` (`src/storage-license.ts:56`).

- [ ] **Step 1:** Edit the schema, then write `migration.sql`.
  - Use `CREATE ... IF NOT EXISTS`, following `20261105090000_add_bu_storage_license`.
  - Add the partial unique `bu_ai_credit_license_number_u` on `(license_number) WHERE deleted_at IS NULL`.
  - Add `CHECK (credits >= 1)` on the licence.
- [ ] **Step 2:** Write `ai-credit.ts` and export it. Add the `'AIC'` prefix.
- [ ] **Step 3:** Run `cd R && bun run db:generate && cd packages/prisma-shared-schema-backstage && bun run check-types`. Expected: no errors.
- [ ] **Step 4:** Apply the migration to a **local** DB only (`bun run db:migrate`), never DEV. Then:
  - check that `\d tb_bu_ai_credit_reservation` shows the unique index;
  - check that `tb_subscription.ai_credits_per_month` defaults to 0.
- [ ] **Step 5:** Commit: `feat(ai-credit): schema, migration and shared balance helpers`.

> Do **not** push this branch before Part A is complete. A pushed branch with a migration has been applied to DEV within about 2 minutes, twice before (memory `reference-migration-applied-without-merge`).

### Task 2: micro-cluster `ai-credit` module: licences, adjust, balance, ledger

**Files:**
- Create: `R/apps/micro-cluster/src/cluster/ai-credit/{ai-credit.controller.ts, ai-credit.service.ts, ai-credit.module.ts, interface/ai-credit.interface.ts}`
- Create: `R/packages/rpc-contract/src/contracts/ai-credits.ts`. Generate it with `bun run gen:rpc-contract`; it is not written by hand. Export it from `contracts/index.ts`.
- Modify: `R/apps/micro-cluster/src/app.module.ts:124` (register the module)
- Modify: `R/apps/micro-cluster/src/common/activity/backstage-activity-registry.ts:82-102` (audit entries for the create, void and adjust cmds)

**Interfaces:**
- Consumes: Task 1 helpers.
- Produces: `AiCredits` RPC contract, service `'ai-credits'` on `'micro-cluster'`. Each key and its payload:
  - `balance { business_unit_id, user_id }` → `AiCreditBalance & { low: boolean }`
  - `ledger { business_unit_id, paginate, user_id }` → paginated ledger rows. Filters: `entry_type`, `feature`, `month`.
  - `licenses { business_unit_id, user_id }` → `tb_bu_ai_credit_license[]`, newest first, including deleted rows with `deleted_at`.
  - `createLicense { business_unit_id, credits, reference_no?, note?, user_id }` → `{ id, license_number }`
  - `voidLicense { business_unit_id, id, doc_version, user_id }`
    - soft delete + ledger `topup_void −credits`
    - 409 on a `doc_version` mismatch, 400 if already deleted
  - `adjust { business_unit_id, credits (non-zero int), reason (1..500 chars), user_id }` → ledger `adjust` on the top-up pool
  - `summary { paginate, user_id }`
    - per-BU rows `{ business_unit_id, bu_code, bu_name, cluster_name, monthly_quota, monthly_used, topup_remaining, available, low }`
    - only BUs with entitlement (§5.7)
    - use `readableClusterScope()` like STQ `listBackstage`

- [ ] **Step 1:** Implement the service by following `business-unit-storage-license.service.ts`:
  - `@Inject('PRISMA_SYSTEM')`, `@TryCatch`, `Result.*`
  - read scope through `ClusterAdminAuthzService`
  - every write calls `lockBuCredit` first, inside `$transaction`
  - `low` = `available < config.ai_credit.low_threshold` and the BU has entitlement. The config key arrives in Task 7. Until then, read it with a fallback of 100.
- [ ] **Step 2:** Add the controller patterns, generate the contract, and add the audit registry entries.
- [ ] **Step 3:** Run `cd R/apps/micro-cluster && bun run check-types && bunx eslint src/cluster/ai-credit`. Expected: clean. Do **not** run `bun run lint`, because it rewrites the whole repo.
- [ ] **Step 4:** Manual check. Run micro-cluster and the gateway locally after Task 4, or call the RPC through a scratch script. Check four things:
  1. Issue `AIC` 50 to a test BU. `balance.topup_remaining` should be 50.
  2. Void it. `topup_remaining` should be −50, and `available` should equal `monthly_remaining` (Review Focus 5).
  3. Set a test subscription to `status='active'` with an `end_date` in the past. `monthly_quota` should be 0 (Review Focus 2).
  4. Adjust +60. `topup_remaining` should be 10.
- [ ] **Step 5:** Commit: `feat(ai-credit): micro-cluster licences, adjust, balance and ledger`.

### Task 3: reserve / commit / release / expireReservations

**Files:**
- Modify: the Task 2 service, controller and contract (re-run `gen:rpc-contract`)

**Interfaces:**
- Produces RPC keys on `AiCredits`:
  - `reserve { business_unit_id, credits (int ≥1), feature, ref_type?, ref_id?, user_id, idempotency_key (1..200 chars) }`
    - returns `{ reservation_id, from_monthly, from_topup, expires_at, available_after }`
    - or `402 AI_CREDIT_INSUFFICIENT { available, requested }`
  - `commit { reservation_id, credits_actual? }` → `{ reservation_id, status: 'committed', credits_charged }`
  - `release { reservation_id, reason }` → `{ reservation_id, status: 'released' }`
  - `expireReservations {}` → `{ released: number }`
- Behaviour (§5.4):
  - `reserve` order: `lockBuCredit`, then look up an existing reservation by `(business_unit_id, idempotency_key)` and return it unchanged if found, then `readAiCreditBalance`, then `splitDebit`, then insert `pending` with `expires_at = now() + interval '15 minutes'` and `month = bangkokMonth()`.
  - `commit` writes one ledger `debit` row per pool that has credits greater than 0. It uses the reservation's `month` for the monthly row.
    - `credits_actual < credits`: subtract `splitRefund` before writing.
    - `credits_actual > credits`: 400.
    - Already committed: return the same result.
    - Released: 409.
  - `release` on a released reservation returns the same result. On a committed one, it returns 409.
  - `expireReservations` selects `pending AND expires_at < now()` in batches of 200. Each row goes through the `release` path with reason `expired`.

- [ ] **Step 1:** Implement the four methods and the controller patterns, then regenerate the contract.
- [ ] **Step 2:** Add `ERROR_CATALOG.AI_CREDIT_INSUFFICIENT` with HTTP 402, next to `STORAGE_LICENSE_CONFLICT`.
- [ ] **Step 3:** Run type-check and eslint as in Task 2, step 3.
- [ ] **Step 4:** Manual check with a scratch script in `R/apps/micro-cluster/scripts/` that calls the service. Delete the script afterwards and do not commit it.
  1. Set the BU to `available = 5`. Fire two `reserve(5)` calls with `Promise.all` and different keys. Expect one success and one 402 (Review Focus 1).
  2. Call `reserve` again with the first key. Expect the same id (Review Focus 3).
  3. `commit(credits_actual: 3)`. Expect a ledger total of −3.
  4. Reserve, then set `expires_at` into the past, then call `expireReservations`. Expect `released: 1`.
- [ ] **Step 5:** Commit: `feat(ai-credit): reserve, commit, release and expiry`.

### Task 4: Gateway routes, internal expiry endpoint, catalogs

**Files:**
- Create: `R/apps/backend-gateway/src/backstage/backstage_ai-credits/{backstage_ai-credits.controller.ts, .service.ts, .module.ts, swagger/request.ts, swagger/response.ts}`
- Create: `R/apps/backend-gateway/src/ai-credit/ai-credit-internal.controller.ts` and its module. Copy `storage-quota/storage-quota-internal.controller.ts:20-35`.
- Modify: `R/apps/backend-gateway/src/app.module.ts` (register both modules)
- Regenerate: `R/apps/backend-gateway/src/backstage/applications/app-api-catalog.generated.ts`, with `bun run scripts/generate-app-api-catalog/run.ts`
- Modify: `R/packages/prisma-shared-schema-backstage/prisma/check.api-system-permission-coverage.ts:400-418`. Add allowlist entries for the read routes, with the same reason text as the STQ reads.

**Interfaces:**
- `@Controller('api-system/business-units/:buId/ai-credit')`, guarded by `KeycloakGuard`:

  | Method | Path | AppIdGuard key | Permission |
  |---|---|---|---|
  | GET | `''` | `aiCredit.balance` | none |
  | GET | `ledger` | `aiCredit.ledger` | none |
  | GET | `licenses` | `aiCredit.licenses` | none |
  | POST | `licenses` | `aiCredit.createLicense` | `subscription.manage` |
  | DELETE | `licenses/:id?doc_version=` | `aiCredit.voidLicense` | `subscription.manage` |
  | POST | `adjustments` | `aiCredit.adjust` | `subscription.manage` |

- `@Controller('api-system/backstage/ai-credit')`: GET `summary`, key `aiCredit.summary`.
- `@Controller('api/internal/ai-credit')` with `@UseGuards(InternalJobGuard)`: `POST expire-reservations` → RPC `expireReservations`.
- reserve, commit and release have **no** HTTP route. They are RPC only (spec §7).
- Writes use `@EnrichAuditUsers()`. Use the `toResult(response, HttpStatus.CREATED)` helper on POST, the same as the STQ gateway service.

- [ ] **Step 1:** Implement the routes, swagger request/response DTOs (zod `createZodDto`), and the internal controller.
- [ ] **Step 2:** Regenerate the app-api catalog, then add the permission allowlist entries.
- [ ] **Step 3:** Run `cd R && bun run check-types && bun run audit:api-system-permission && bun run audit:app-api-catalog-drift && bun run audit:raw-sql`. Expected: all pass.
- [ ] **Step 4:** Manual check against a local gateway (`:4000`). Confirm the routes in Scalar at `/swagger`.
  - Exercise each row of the table above with curl, using a backstage token and `x-app-id`.
  - Confirm that POST without `subscription.manage` gives 403.
  - Confirm that the internal route without `x-internal-token` gives 403.
- [ ] **Step 5:** Commit: `feat(ai-credit): gateway routes and internal expiry endpoint`.

### Task 5: Subscription field `ai_credits_per_month`

**Files:**
- Modify: `R/apps/micro-business/src/subscription/subscription.service.ts`
  - `CreateSubscriptionDto` (172), `UpdateSubscriptionDto` (187): add `ai_credits_per_month?: number`
  - `SubscriptionRow` (46), `SubscriptionDetail` (123): add `ai_credits_per_month: number`
  - add validation
- Modify: `R/apps/backend-gateway/src/backstage/backstage_subscriptions/swagger/request.ts` (`@ApiProperty` on both DTOs) and `swagger/response.ts`

**Interfaces:**
- Produces: `ai_credits_per_month` on subscription create, PATCH and GET payloads.
- Validation: an integer from 0 to 1,000,000; otherwise 400. If it is omitted on create, it is 0. If it is omitted on PATCH, the value is unchanged.

- [ ] **Step 1:** Implement the change. PATCH already requires `doc_version` and is audited, so quota edits are audited with no extra work (spec §5.1).
- [ ] **Step 2:** Run type-check for `micro-business` and the gateway.
- [ ] **Step 3:** Manual check. PATCH a test subscription to 500, then GET the AI credit balance of its BU (Task 4). Expect `monthly_quota: 500`.
- [ ] **Step 4:** Commit: `feat(subscription): ai_credits_per_month`.

### Task 6: License intake fields

**Files:**
- Modify: `R/apps/backend-gateway/src/common/dto/license-intake/license-intake.dto.ts:76`. Add:
  - `ai_credits_per_month: z.number().int().min(0).max(1000000).optional()`
  - `ai_credit_topup: z.number().int().min(1).max(1000000).optional()`
- Modify: `R/apps/micro-cluster/src/cluster/license-intake/interface/license-intake.interface.ts:22`
- Modify: `R/apps/micro-cluster/src/cluster/license-intake/license-intake.normalize.ts`:
  - add both fields to `NormalizedIntake`, `null` when absent
  - add them to `payloadHash` with the **conditional spread** used for `storage_db_gb` (lines 105-120)
- Modify: `R/apps/micro-cluster/src/cluster/license-intake/license-intake.service.ts`. Persist the new columns.
- Modify: `R/apps/micro-cluster/src/cluster/license-intake/license-intake-decision.service.ts`:
  - `IProduced` (~59) gains `ai_credit: { id: string; license_number: string }[]`, initialised at line 258
  - after the storage block (322-333), write `ai_credits_per_month` onto the subscription that this confirm created
  - if `ai_credit_topup !== null`, call `issueAiCreditLicense(tx, { …, referenceNo: intake.source_sale_id, licenseIntakeId: intake.id })`
- Update the partner-API swagger text for both fields.

- [ ] **Step 1:** Implement the change. An intake that carries only `ai_credit_topup` is a valid sale (spec §6). Check that the validator accepting a storage-only intake also accepts this case.
- [ ] **Step 2:** Run type-check for micro-cluster and the gateway.
- [ ] **Step 3:** Manual check (Review Focus 4):
  - Before your change, on `main`, take one stored intake's `raw_payload` and record `payloadHash(normalizeIntake(raw))`. Record it again on the branch. The two must be identical. Use a scratch script and delete it afterwards.
  - Then push a test intake with `ai_credit_topup: 100` and confirm it. `produced.ai_credit` should hold one `AIC-` number, and the BU balance should show `topup_remaining` of 100.
- [ ] **Step 4:** Commit: `feat(license-intake): ai credit quota and top-up`.

### Task 7: Config key `ai_credit`

**Files:**
- Modify: `R/apps/micro-cluster/src/cluster/backstage-config/backstage-config.schema.ts`:
  - add `AiCreditConfigSchema = z.object({ low_threshold: z.number().int().min(0).max(1000000) })`
  - add the registry entry `ai_credit: { schema: AiCreditConfigSchema, default: { low_threshold: 100 } }` near line 434
- Modify: the Task 2 service. Replace the fallback with a registry read.

- [ ] **Step 1:** Implement the change. Run type-check.
- [ ] **Step 2:** Manual check. Run `GET /api-system/backstage/configs/ai_credit` (use the same path pattern as `storage_quota`). Expect the default of 100. Save 10, and the `balance.low` flag should flip for a BU whose `available` is 50.
- [ ] **Step 3:** Commit: `feat(config): ai_credit low threshold`.

### Task 8: `micro-cronjobs` expiry job (repo `micro-cronjobs`, Go)

**Files:**
- Create: `micro-cronjobs/internal/executor/ai_credit_expire.go`. Copy `internal/executor/storage_measure.go`, change the target to `POST /api/internal/ai-credit/expire-reservations`, and send the same `x-internal-token` header.
- Register the job the way `storage_measure` is registered (its migration, seed or config row), with the cron `*/5 * * * *`.

- [ ] **Step 1:** Implement the job. Run `go build ./... && go vet ./...`. Expected: clean.
- [ ] **Step 2:** Manual check. Run it once locally against the local gateway, with an expired pending reservation present. The response should be `released: 1`.
- [ ] **Step 3:** Commit on `feature/ai-credit-license`: `feat(ai-credit): expire stale reservations every 5 minutes`.

### Task 9: Backend gate run

- [ ] **Step 1:** Run `cd R && SKIP_TESTS=0 bun run gates`. Expected: every gate passes, including `test`, because existing suites must stay green. If `audit:env-drift` was already red on `main`, record it as pre-existing; do not treat it as caused by this branch (memory `reference-backend-env-drift-audit-red-on-main`).
- [ ] **Step 2:** Fix only what this branch broke, then commit: `chore(ai-credit): gate fixes`.

---

## Part B — Frontend (`carmen-backstage`)

### Task 10: Types, service, BU Edit "AI credit" card

**Files:**
- Modify: `FE/src/types/index.ts`. Add these next to `BuStorageLicense` (~2462), with optional fields per Rule 11:
  - `AiCreditBalance`
  - `AiCreditLicense`
  - `AiCreditLedgerEntry`
  - `AiCreditSummaryRow`
  - `AiCreditEntryType`
  - `AiCreditFeature`
- Create: `FE/src/services/aiCreditService.ts`, shaped like `businessUnitStorageLicenseService.ts`:
  - `balance(buId)`
  - `ledger(buId, paginate)`, which returns the envelope
  - `licenses(buId)`
  - `createLicense(buId, { credits, reference_no?, note? })`
  - `voidLicense(buId, id, docVersion)`
  - `adjust(buId, { credits, reason })`
  - `summary(paginate)`
- Create: `FE/src/pages/businessUnitEdit/BusinessUnitAiCreditCard.tsx`
  - header via `LicenseSectionHeader`
  - balance strip: a monthly used/quota meter whose big number and meter measure the same quantity; top-up remaining, shown in `text-destructive` when negative; available; a `Badge variant="warning"` when `low`
  - an actions row gated by `<Can permission="subscription.manage">`:
    - Issue top-up (Dialog: credits ≥1, reference no, note)
    - Adjust (Dialog: ± credits, non-zero; reason, required)
  - licences list, with Void through `ConfirmDialog` that sends `doc_version`
  - ledger `DataTable serverSide`, filters type, feature and month, CSV via `generateCSV`/`downloadCSV`
- Modify: `FE/src/pages/businessUnitEdit/BusinessUnitDocument.tsx`. Add an `aiCreditSlot` prop and render it under the storage slot with an id in `LICENSE_SECTION_IDS`.
- Modify: `FE/src/pages/BusinessUnitEdit.tsx:970`. Pass the card when `!isNew`.
- Modify: `FE/src/i18n/en.ts`, `th.ts`. Add keys under `pages.businessUnit.aiCredit.*`.

- [ ] **Step 1:** Implement the change. Every fetch hook needs the race guard (`agent-os/standards/hooks/`).
- [ ] **Step 2:** Run `bun run typecheck && bun run lint`. Expected: clean.
- [ ] **Step 3:** Browser check with `bun run dev:localhost` against the local backend:
  - issue 50, adjust −10 (enter a reason), void the licence; the top-up figure should go negative and show red (Review Focus 5)
  - export CSV
  - check 390px with the iframe probe (memory `reference-iframe-viewport-probe`)
  - switch TH/EN
- [ ] **Step 4:** Commit: `feat(ai-credit): BU Edit AI credit card`.

### Task 11: `/licenses` AI credit tab

**Files:**
- Create: `FE/src/pages/licenses/AiCreditSummaryTable.tsx`
  - server-side `DataTable` over `aiCreditService.summary`
  - columns BU (name-first, code muted), cluster, monthly used/quota, top-up remaining, available, low badge
  - row → `/business-units/:id?tab=licenses#<aiCredit section id>`
  - CSV; mobile cards via `meta.card`
- Modify: `FE/src/pages/licenses/LicenseCenter.tsx:125`
  - add `{ id: 'ai-credit', label: t('pages.licenses.viewByAiCredit') }` after storage
  - add it to the `?tab=` membership check
- Modify: i18n both files.

- [ ] **Step 1:** Implement the change. Run typecheck and lint.
- [ ] **Step 2:** Browser check:
  - `/licenses?tab=ai-credit` loads
  - a BU with no entitlement is absent
  - the low badge shows after setting the threshold above `available`
- [ ] **Step 3:** Commit: `feat(ai-credit): licences AI credit tab`.

### Task 12: Subscription form field, intake display, config card

**Files:**
- Modify: `FE/src/services/subscriptionService.ts:65-90`. Add `ai_credits_per_month?: number` to the `create` and `update` input types and to `Subscription` in `types/index.ts`.
- Modify: `FE/src/pages/licenses/SubscriptionForm.tsx`
  - add an "AI credits / month" number input (int ≥ 0, default 0)
  - validate on blur through `validateField`
  - include it in `hasChanges`
- Modify: `FE/src/pages/licenses/SubscriptionTable.tsx`. Add the column. It shows `—` when the value is 0.
- Modify: the intake views:
  - `IntakeSoldCard`: show both values, or "Not included"
  - `FE/src/pages/LicenseIntakeDetail.tsx`: link each `produced.ai_credit` number to the BU card
- Create: `FE/src/pages/backstageConfig/AiCreditConfigCard.tsx`, a copy of the `ExpiryThresholdsCard` pattern with one field, `low_threshold`. Register it in `BackstageConfigManagement.tsx` (the key union at line ~43 and the cards list).
- Modify: i18n both files.

- [ ] **Step 1:** Implement the change. Run typecheck and lint, and run `bun run test`. The existing suites must still pass, especially `SubscriptionForm.test.tsx`.
- [ ] **Step 2:** Browser check:
  - edit a subscription to 500; the BU card should show a quota of 500
  - save the config threshold
  - open an intake detail that has no AI fields; it should show "Not included"
- [ ] **Step 3:** Commit: `feat(ai-credit): subscription quota, intake display, config card`.

---

## Deploy notes (order matters, spec §10)

1. Merge the BE PR. `build.yml` auto-deploys DEV on push to `main` and does **not** migrate. Apply the migration on DEV by hand, and confirm it with a query, because a 403 is not proof that it was applied.
2. On every environment that is not `allow_all`, seed the AppIdGuard keys `aiCredit.balance`, `.ledger`, `.licenses`, `.createLicense`, `.voidLicense`, `.adjust` and `.summary`. A missing key returns 401 and logs the user out.
3. Merge the `micro-cronjobs` PR and register the job.
4. Merge the FE PR, which auto-deploys DEV. Production stays a separate `git push origin main:vercel`, and only when the owner asks.
5. Ask the owner of the license master system to send `ai_credits_per_month` / `ai_credit_topup` when they are ready. Older pushes keep working unchanged.
