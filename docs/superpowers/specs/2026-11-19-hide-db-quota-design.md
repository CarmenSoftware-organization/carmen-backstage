# Hide the database quota behind a feature flag — design

Date: 2026-11-19 · Repos: `carmen-backstage` (FE), `carmen-turborepo-backend` (gateway)

## Intent

The storage quota licence (STQ, spec `2026-11-03-storage-quota-license-design.md`) carries a
**database** figure and an **attachment (file)** figure. The owner is not ready to sell the
database quota and does not want to commit to a database size yet. Until then:

- nobody sees a database **quota** figure anywhere in backstage — but the database **size used**
  stays visible (owner, 2026-11-19: "ยังต้องการให้โชว์ database size ว่าใช้ไปแล้วเท่าไร"), and
- the database quota has **no effect**: no ceiling, no warning email, no growth block.

The attachment quota is untouched and keeps working exactly as today.

## Goals

- One switch, the feature flag `license_storage_quota`, default `hide`. While it is not `active`,
  the database quota is invisible in the UI **and** unlimited in the backend.
- Flipping it to `active` at `/backstage/features` turns both on together — no second switch.
- Database usage keeps being **measured** while hidden, and its used size stays on screen.

## Non-goals

- No change to the attachment quota, its UI, its emails or its blocking.
- No change to the `storage_quota` config schema or to the meaning of `0`.
- No data migration; existing STQ rows keep their `db_quota_bytes` as stored.
- No change to `enforce`, `grace_days`, `exempt`.

## Anti-goals (failure even if it "works")

- A BU blocked or warned because of a database quota nobody can see.
- Hiding the UI while the backend still enforces 5 GB (that is the option the owner rejected).
- Saving an STQ licence/config from the UI silently wiping a stored database figure.

## Approaches considered

1. **Feature flag drives UI and enforcement** — *chosen.* Gateway reads `license_storage_quota`
   from the `feature_flags` backstage config row; when not `active` it treats the database quota
   as `0` (never full). One switch; UI and behaviour cannot disagree. Trade-off: a UI flag now
   affects backend behaviour for the first time, and the backend must hard-code its own "off"
   default to match the FE catalog.
2. A `db_quota_enabled` boolean in the `storage_quota` config. Clean separation, but two switches
   that must be flipped together; forgetting one shows a quota that does not apply.
3. Make `0` mean "unlimited" system-wide and set `default_db_bytes = 0`. Today `0` is rejected by
   the micro-cluster zod schema (`positive()`) and by gateway `parseConfig` (which falls back to
   **all** defaults on any invalid field). Needs semantics changes everywhere, and STQ licences
   with an explicit DB figure would still enforce.

## Design

### Flag semantics (shared contract)

- Key `license_storage_quota`, states `active | inactive | hide`.
- Database quota is **on** only when the stored state is exactly `active`.
  Missing key, missing `feature_flags` row, unreadable row, `inactive`, `hide` → **off**.
- FE: add the entry to `FEATURE_CATALOG` in `src/constants/featureFlags.ts`, group
  `navGroup.licenseManagement`, next to `license_ai_credit`, `defaultState: 'hide'`. Extend the
  header comment's exception list: owner hid it on 2026-11-19, not ready to sell, no DB size yet.
  New i18n label key (e.g. `nav.licenseStorageQuota` — "License DB Quota" / TH equivalent).
- `inactive` behaves like `hide` everywhere here: none of the touched spots are menu entries.

### Backend (gateway, `apps/backend-gateway/src/storage-quota/storage-quota.service.ts`)

- When loading the policy (`loadConfig`, same 60 s cache), also read the `feature_flags` row from
  `tb_backstage_config` and derive `dbQuotaEnabled: boolean` with the rule above. A read failure
  means **off** (fail toward "no DB enforcement"), logged.
- In `effectiveByKind` (the single place the measurement, reconcile and summary paths get their
  per-kind quota): when `dbQuotaEnabled` is false, return `database: 0`. The existing rule
  "quota ≤ 0 is never full" (`full`, `computeStep`, `isBlocking`) then yields no exceeded_at,
  no warning step, no block. `attachment` is unchanged.
- Existing usage rows with a DB `exceeded_at` / `warned_step` clear on the next measurement,
  because both are recomputed from `full`. The reconcile path writes `quota_bytes = 0` to DB rows.
- Every other place that computes an effective DB quota (e.g. the quota view returned to the FE
  BU card, the summary's max-percent, `storage-quota-system.controller.ts`) must go through the
  same gate. The builder must grep for `effectiveStorageQuota` / `default_db_bytes` /
  `db_quota_bytes` consumers in the gateway and micro-cluster and confirm none enforce or warn
  on the DB figure outside the gated path.
- Flipping the flag takes effect within the config cache TTL and at the next measurement; quota
  values on existing rows refresh on the next measure/reconcile. No forced re-measure.
- Writes are unchanged: STQ licences and the `storage_quota` config still accept and store
  DB figures (the API is not hidden).

### Frontend (`carmen-backstage`)

Read the flag with the same hook the AI-credit gate uses. When off, remove the database
**quota** only — the limit, the percentage, the meter fill, the source ("licence"/"default") and
any warning/blocked tone. The database **used size** (`used_bytes`, plus "measured at" where shown
today) stays visible as a plain figure. The attachment part renders as today:

| Spot | When off |
|---|---|
| `StorageLicenseForm` | no DB input; summary shows no DB line |
| `StorageLicenseTable` | no DB column, no DB CSV column (a licence row has no usage to show) |
| `StorageUsageList` (`/storage-usage`) | DB column shows used size only (sort by used bytes, not %); DB CSV keeps used bytes, drops DB quota; DB total tile shows total used only |
| `BuStorageQuotaCard` (BU Edit) | DB row shows used size only: no meter bar/limit/%, no source, no DB edit field |
| `LicenseSummaryStrip` storage cell | %, tone and "fullest" consider attachment only; DB used size may appear as plain text (builder's call) |
| `StorageQuotaConfigCard` (Backstage Config) | no default-DB field/value |
| `IntakeSoldCard`, `IntakeOverlapPanel` | storage line shows the file figure only |

Rules:
- **Never send a DB field the user cannot see.** `StorageLicenseForm` already PATCHes only
  dirty fields — keep it so. `StorageQuotaConfigCard` saves the whole value: it must send back
  the **stored** `default_db_bytes` unchanged (it is required and must stay positive).
- STQ create with the DB input hidden: the file figure becomes required in the form, because the
  backend rejects a licence with both figures null (400). Show a field error, not a toast.
  *(Designer's call.)* On **edit** the file figure is **not** required: the stored DB figure is
  never sent and stays, so a DB-only licence can be saved without inventing a file quota.
- `StorageQuotaConfigCard` with no stored `storage_quota` row: send back the `default_db_bytes`
  the GET returned (the registry default) — the card always has a value to echo. *(Designer's call.)*
- Scope is backstage only. The inventory app (`carmen-frontend`) does not show storage quota
  (checked 2026-11-19), and quota warning emails go to the Carmen team list, not to BUs.
- An intake that sold only a DB figure: the storage line reads as "not included" when off
  (builder's call on wording; TH + EN).
- CSV export follows the visible columns.

### Deploy order

- FE and BE are independent: FE alone hides the UI; BE alone stops enforcement. Ship both.
- BE deploy to DEV is currently blocked by Actions billing; until the gateway is deployed the DB
  quota still counts against 5 GB (team warning emails always; blocking only where
  `storage_quota.enforce` is true). Before relying on "no effect" in an environment, confirm the
  gateway build there contains this change.
- **Expected on deploy, not a risk** *(follows from the owner's choice)*: the gateway deploy
  immediately stops DB warnings and clears any DB `exceeded_at` / block on the next measurement,
  on every environment, because no environment has the flag set to `active`. No sequencing or
  announcement is needed; the plan records this as intended behaviour.

## Left to the builder

- Exact i18n wording (TH/EN) and the flag label.
- Whether to put the gate in `effectiveByKind` or one level up, as long as every DB-quota consumer
  in the gateway is covered.
- Test shape (FE: flag on/off for each spot above; BE: flag off ⇒ DB never full, attachment
  unaffected; missing/invalid flags row ⇒ off).
