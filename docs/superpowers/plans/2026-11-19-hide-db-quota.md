# Hide DB Quota Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** While feature flag `license_storage_quota` is not `active`, the database quota is invisible in backstage and has no effect in the gateway; DB **used size** stays visible; attachment quota is untouched.

**Architecture:** Gateway derives `db_quota_enabled` from the `feature_flags` backstage config row inside `loadConfig` and zeroes the DB quota (quota 0 = never full) on every path that computes or reads DB quota/blocking. FE adds the flag (default `hide`) and, per component, drops the DB limit/%/meter/source/inputs while keeping `used_bytes`.

**Tech Stack:** NestJS + Prisma (`carmen-turborepo-backend/apps/backend-gateway`), React + TS + Vitest (`carmen-backstage`).

**Spec:** `docs/superpowers/specs/2026-11-19-hide-db-quota-design.md`

## Global Constraints

- Flag key `license_storage_quota`; DB quota is on **only** when stored state === `'active'`. Missing key / missing row / unreadable row / `inactive` / `hide` → off.
- FE catalog entry: group `navGroup.licenseManagement`, right after `license_ai_credit`, `defaultState: 'hide'`; label key `nav.licenseStorageQuota` (EN "License DB Quota", TH "โควตาฐานข้อมูล (License)").
- Attachment quota UI and behaviour unchanged in every task.
- FE never sends a DB field the user cannot see; `StorageQuotaConfigCard` echoes the loaded `default_db_bytes` unchanged.
- STQ **create** with DB hidden: file figure required (field error, not toast). STQ **edit**: file not required.
- **Per user's global CLAUDE.md: skip writing new tests.** Run type-check + lint; existing suites must stay green — where an existing test breaks only because the flag now defaults to `hide`, add `vi.mock('<rel>/hooks/useFeature', () => ({ useFeature: () => 'active' }))` (precedent: `src/pages/BusinessUnitEdit.test.tsx`).
- Branch `feature/hide-db-quota` in **both** repos (FE branch exists). Never commit to `main`. Do not push; the controller pushes after the final review.
- i18n: every new string in both `src/i18n/en.ts` and `src/i18n/th.ts`.

## Review Focus

1. A BU whose DB row already has `exceeded_at` set (blocked/grace) before deploy — must stop blocking immediately when the flag is off, not only after the next measurement. (Task 1: gate on the read paths, not just on measure.)
2. `feature_flags` row has an unrelated key only, or the row is malformed JSON — DB must be off, attachment unaffected. (Task 1.)
3. Saving `StorageQuotaConfigCard` (file size changed) with DB hidden must PATCH the same `default_db_bytes` it loaded — never `NaN`/0/undefined. (Task 5.)
4. Editing a DB-only STQ licence with DB hidden: save notes only → request body contains neither `db_quota_bytes` nor a both-null pair. (Task 4.)
5. `/storage-usage` sorted by the DB column with flag off sorts by `used_bytes`, and the "fullest" ordering / summary-strip tone ignore DB. (Tasks 3, 2.)

---

### Task 1: Gateway — gate DB quota on the flag

**Repo:** `carmen-turborepo-backend` — first `git switch -c feature/hide-db-quota` from up-to-date `main`.

**Files:**
- Modify: `apps/backend-gateway/src/storage-quota/storage-quota.service.ts` (`StorageQuotaPolicy` ~L99, `DEFAULT_CONFIG` ~L86, `loadConfig` ~L1078, `effectiveByKind` ~L1044, `getUsage` ~L402, `resolveBlockingCached` ~L453, `listAllUsage` ~L778)

**Interfaces:**
- Produces: `StorageQuotaPolicy.db_quota_enabled: boolean`; `private gateRows(rows: UsageRow[], config: StorageQuotaPolicy): UsageRow[]`; constant `DB_QUOTA_FLAG_KEY = 'license_storage_quota'`.

- [ ] **Step 1: Add `db_quota_enabled: boolean` to `StorageQuotaPolicy`; `DEFAULT_CONFIG.db_quota_enabled = false`.** `parseConfig` stays as is (it parses the `storage_quota` row only) and must not read or require this field.
- [ ] **Step 2: In `loadConfig`, read the `feature_flags` row** from `tb_backstage_config` (`where: { key: 'feature_flags', deleted_at: null }`, `orderBy: { updated_at: 'desc' }`, `select: { value: true }`) — in the same `try` as the `storage_quota` read or its own `try`, so a failure on it logs a warning and yields `db_quota_enabled: false` without discarding a valid `storage_quota` config. Value: `value?.[DB_QUOTA_FLAG_KEY] === 'active'` where `value` is checked to be a plain object. Cached with the rest (same 60 s TTL). Comment (TH + EN) cites the spec and that missing = off on purpose (FE catalog default is `hide`).
- [ ] **Step 3: `effectiveByKind`** returns `database: 0` when `!config.db_quota_enabled`. This covers measurement (`measureBu` ~L286), `writeDerivedQuota`/`refreshAllQuotas` (~L657).
- [ ] **Step 4: `gateRows(rows, config)`** — when DB off, map each `kind === 'database'` row to `{ ...r, quota_bytes: 0, exceeded_at: null }`; otherwise return rows unchanged. Apply it to the rows in `getUsage`, `resolveBlockingCached` (per-BU `rows` before `flagged`/`effectiveBlocking`), and `listAllUsage` (before `toApi` and `maxPct`). Leave `flagged` computed from the ungated rows (schema flags are not quota).
- [ ] **Step 5: Grep the gateway for other readers** of `tb_business_unit_storage_usage` / `quota_bytes` / `exceeded_at` that decide blocking, warnings or "fullest" (`rg -n "storage_usage|exceeded_at" apps/backend-gateway/src`). Each one must go through `gateRows` or `effectiveByKind`; list what you checked in the commit body.
- [ ] **Step 6: Verify**
  Run: `cd apps/backend-gateway && bun run check-types` → exit 0.
  Run: `bunx prettier --check apps/backend-gateway/src/storage-quota/storage-quota.service.ts` (from repo root) → clean. Do **not** run `bun run lint` (it rewrites the repo); use `bunx eslint apps/backend-gateway/src/storage-quota/storage-quota.service.ts`.
  Run existing gateway jest for the folder if any spec exists: `bunx jest apps/backend-gateway/src/storage-quota --runInBand --forceExit` → no new failures.
- [ ] **Step 7: Commit** `feat(storage-quota): treat DB quota as unlimited until license_storage_quota is active`

---

### Task 2: FE — flag, hook, meter variant, BU Edit card + summary strip

**Files:**
- Modify: `src/constants/featureFlags.ts` (catalog entry + header comment exception list)
- Modify: `src/i18n/en.ts`, `src/i18n/th.ts` (`nav.licenseStorageQuota`)
- Create: `src/hooks/useDbQuotaOn.ts`
- Modify: `src/pages/clusterAdmin/businessUnitForm/StorageMeter.tsx`
- Modify: `src/pages/clusterAdmin/businessUnitForm/BuStorageQuotaCard.tsx` (~L220–300)
- Modify: `src/pages/businessUnitEdit/LicenseSummaryStrip.tsx` (~L140–155)

**Interfaces:**
- Produces: `export const DB_QUOTA_FLAG = 'license_storage_quota'` (in `featureFlags.ts`); `export function useDbQuotaOn(): boolean` → `useFeature(DB_QUOTA_FLAG) === 'active'`; `StorageMeter` new optional prop `usedOnly?: boolean`.

- [ ] **Step 1: Catalog + i18n.** Add the entry per Global Constraints; extend the header comment: `license_storage_quota` hidden by the owner 2026-11-19 — DB quota not ready to sell, no DB size committed; while not active the gateway also treats the DB quota as unlimited.
- [ ] **Step 2: `useDbQuotaOn`** in `src/hooks/useDbQuotaOn.ts` with a JSDoc (TH + EN).
- [ ] **Step 3: `StorageMeter usedOnly`** — when true render label + flag badge + `formatBytes(used_bytes)` + measured-at; no `/ quota`, no %, no bar, no blocking badge, no exceeded/grace lines.
- [ ] **Step 4: `BuStorageQuotaCard`** — when `!useDbQuotaOn()`: DB meter gets `usedOnly`; DB source line and any DB edit/override input are not rendered; `buildPatch` never includes DB fields.
- [ ] **Step 5: `LicenseSummaryStrip`** — when off, compute `kinds` for %, `fullestPct`, `blocked` and `storageTone` from `attachment` only (big number and meter must measure the same quantity). DB used size as plain secondary text is optional.
- [ ] **Step 6: Verify** `bun run typecheck && bun run lint` → 0 errors; `bunx vitest run src/pages/BusinessUnitEdit src/pages/businessUnitEdit src/pages/clusterAdmin` → green (apply the `useFeature` mock where a test fails only from the new default).
- [ ] **Step 7: Commit** `feat(storage-quota): hide DB quota on BU Edit behind license_storage_quota`

---

### Task 3: FE — `/storage-usage`

**Files:** Modify `src/pages/licenses/StorageUsageList.tsx` (totals card ~L128, column ~L366, CSV ~L420–445, plus any "fullest" sort/filter on DB %).

**Interfaces:** Consumes `useDbQuotaOn` (Task 2).

- [ ] **Step 1:** When off — `StorageTotalsCard` DB tile shows total used only (no quota, no %, no bar); DB column `accessorFn` → `kindOf(row,'database')?.used_bytes ?? -1` and the cell shows used size only; CSV drops `db_quota` (keep DB used column); `columns` `useMemo` deps include the flag. Any status/fullest filter considers attachment only.
- [ ] **Step 2: Verify** typecheck + lint; `bunx vitest run src/pages/licenses/StorageUsageList` → green.
- [ ] **Step 3: Commit** `feat(storage-quota): show DB used size only on storage usage list`

---

### Task 4: FE — STQ licence form + table

**Files:** Modify `src/pages/licenses/StorageLicenseForm.tsx` (validation ~L237–262, DB input ~L480–496, summary ~L437), `src/pages/licenses/StorageLicenseTable.tsx` (column ~L259, CSV ~L201/213).

- [ ] **Step 1: Form** — when off: DB input/read-only row not rendered; summary passes no DB line; on **create** `form.file.trim() === ''` sets `fieldErrors.file` (new i18n key `pages.storageLicense.form.fileRequired`, EN "Enter the attachment quota", TH "กรอกโควตาไฟล์แนบ") instead of the both-empty `figures` error; on **edit** no extra rule; the dirty-diff PATCH (L262) remains the only way `db_quota_bytes` is sent, and `buildPayload` for **create** sends `db_quota_bytes: null`.
- [ ] **Step 2: Table** — when off: no `db_quota_bytes` column, no `db_quota` CSV column (memo deps include the flag).
- [ ] **Step 3: Verify** typecheck + lint; `bunx vitest run src/pages/licenses` → green.
- [ ] **Step 4: Commit** `feat(storage-quota): hide DB quota on storage licence form and table`

---

### Task 5: FE — config card + intake cards

**Files:** Modify `src/pages/backstageConfig/StorageQuotaConfigCard.tsx` (~L95, ~L115, ~L161–171), `src/pages/licenseIntakes/IntakeSoldCard.tsx` (~L56–70), `src/pages/licenseIntakes/IntakeOverlapPanel.tsx` (~L115).

- [ ] **Step 1: Config card** — when off: DB field/value not rendered, `validateGb` not run for DB, save sends `default_db_bytes: saved.default_db_bytes` (the loaded value) instead of reading `formData.default_db_gb`.
- [ ] **Step 2: Intake cards** — when off: storage line uses the file figure only; an intake with only a DB figure reads `pages.licenseIntakes.storageNotIncluded`; overlap panel omits the DB part.
- [ ] **Step 3: Verify** typecheck + lint; `bunx vitest run src/pages/backstageConfig src/pages/licenseIntakes src/pages/LicenseIntakeDetail` → green; then full `bun run test` → green.
- [ ] **Step 4: Commit** `feat(storage-quota): hide DB quota on config and intake cards`

---

### Task 6: Final checks (controller)

- [ ] FE: `bun run typecheck && bun run lint && bun run test` green; `trail check` clean.
- [ ] BE: Task 1 checks re-run on the branch tip; `bun run gates` if the local gate runner works (pre-existing red gates from `main` are noted, not fixed).
- [ ] Manual (user): with `bun run dev:localhost`, flag `hide` → BU Edit shows DB used size only, `/storage-usage` DB column used-only, STQ form has no DB input; flip to `active` at `/backstage/features` → everything as before.
- [ ] Ask the user before pushing either branch / opening PRs. Deploy note for the PR: gateway deploy stops DB warnings/blocks on every env (intended); BE DEV deploy is blocked by Actions billing.
