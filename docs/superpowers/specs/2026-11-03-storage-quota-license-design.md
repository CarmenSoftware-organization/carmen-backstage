# Storage Quota License — Design

**Date:** 2026-11-03
**Repos:** `carmen-turborepo-backend` (schema, micro-cluster, gateway) · `carmen-backstage` (FE)
**Builds on:** BU storage quota (FE #434, BE #990) · License intake Parts 1–4 (spec `2026-10-29-license-intake-customer-design.md`)

## 1. Intent

Today a BU's storage quota (database + attachments) comes from the global default in the
`storage_quota` config, or from a number someone typed into `BuStorageQuotaCard`. Storage is
something the company sells, so the owner wants it handled like every other thing they sell:
as a **licence**. It is issued from a sale (license intake) or by staff on `/licenses`, and
it has a number and an audit trail.

After this change **a BU's quota comes from its storage licence, or else from the config
default. There is no third source.** A storage licence has **no dates**. How long a BU can
be used is already governed by its subscription, and the storage licence does not repeat that.

## 2. Decisions made by the owner (2026-11-03)

| # | Decision |
|---|---|
| O1 | Effective quota = the figures on the BU's storage licence. If there is no licence, or the licence leaves a figure empty, that figure uses the **config default**. |
| O2 | Default becomes **database 5 GB / files 5 GB** (today 5 / 15). It stays editable in Backstage Config (`storage_quota` card). |
| O3 | A storage licence has **no start or end date and never expires**. The subscription decides how long the BU is accessible. |
| O4 | A new storage licence **replaces** the BU's previous one immediately: one licence in force per BU, never summed. The old one is kept as history with status "replaced". |
| O5 | An intake **without** storage figures issues **no** storage licence. The BU keeps its current one. An intake with figures issues one, which replaces the current one (O4). |
| O6 | Intake push API gains two optional fields, `storage_db_gb` / `storage_file_gb` (integer GB). If only one is sent, the licence carries only that one and the other stays empty, so it uses the default. |
| O7 | Quota comes **only** from licences or the default. The manual quota inputs on `BuStorageQuotaCard` are removed. |
| O8 | The `exempt` switch ("don't enforce") stays a manual switch on `BuStorageQuotaCard`. It is not part of the licence. |
| O9 | `/licenses` gets a Storage tab: staff can issue, edit and delete storage licences by hand, like the other licence types. |
| O10 | Deleting the licence in force sends the BU back to the **default**. It does **not** revive the previous licence. |
| O11 | BUs with a manually set quota today get a storage licence issued automatically with those values, so their quota doesn't change on deploy. |
| O12 | Lowering the file default 15 → 5 GB is accepted as is. BUs on the default that already hold more than 5 GB of files go over quota and start the normal grace period. No licences are issued to shield them. |

## 3. Goals / non-goals / anti-goals

**Goals**
- A new BU-owned licence kind, "Storage", carrying an optional DB quota and an optional file quota.
- Intake confirm issues one when the sale carries storage figures (O5, O6).
- `/licenses` Storage tab with list / create / edit / delete (O9).
- Every reader of the effective quota (measurement, quota views, usage list) goes through one rule (O1).
- Manual quotas are carried over as licences (O11).

**Non-goals (this round)**
- A Storage sub-tab on the cluster-admin BU Licenses tab (Seats | Features | Interface). *(My call: can follow later.)*
- Changing measurement, grace period, warning emails or blocking.
- Storage sold at cluster level.
- Dates, expiry or renewal on storage licences (O3).

**Anti-goals: a failure even if it "works"**
- A BU with a manual quota today seeing its quota change at deploy (O11). The only intended change at deploy is O12.
- Two storage licences in force for one BU, or quotas summed.
- A second place computing the effective quota. The rule has one owner. Today the fallback
  `row?.db_quota_bytes ?? config.default_db_bytes` is written out at least twice in
  `apps/backend-gateway/src/storage-quota/storage-quota.service.ts` (~L245, ~L550), and both
  must route through the new rule.
- An intake without storage wiping a BU's purchased storage (O5).

## 4. Data model (backend, `prisma-shared-schema-backstage`)

New table `tb_business_unit_storage_license`, modelled on `tb_business_unit_license` minus the dates:

| Column | Notes |
|---|---|
| `id` | uuid |
| `license_number` | `STQ-YYMM-####` via `nextLicenseNumber('STQ')`. Uniqueness is a partial unique index `WHERE deleted_at IS NULL` in SQL (same trap as the other licence tables). Add `'STQ'` to the `tb_license_number_retired.kind` set. |
| `business_unit_id` | FK |
| `db_quota_bytes` | `BigInt NULL`. NULL = use the config default for this kind |
| `file_quota_bytes` | `BigInt NULL`. NULL = use the config default for this kind |
| `reference_no`, `note` | optional |
| `license_intake_id` | FK to `tb_license_intake`; NULL = issued by hand or by migration |
| `superseded_at`, `superseded_by_id` | set when a newer licence replaces this one (O4) |
| `doc_version`, audit columns, `deleted_at/by` | as the other licence tables |

A licence with **both** figures NULL is not allowed: it would mean nothing. Reject it at the DTO (400).

**Licence in force for a BU** = the row with `deleted_at IS NULL AND superseded_at IS NULL`.
There is at most one, enforced by a partial unique index on `(business_unit_id) WHERE deleted_at IS NULL AND superseded_at IS NULL`.

**Effective quota per kind** = licence figure if non-NULL, else the live `storage_quota`
config default. Empty figures on a licence **follow** later changes to the default.

`tb_business_unit_storage_quota` keeps `exempt` (O8) and `note`. Its `db_quota_bytes` /
`file_quota_bytes` stop being read once the migration has run. They are dropped in a
**separate, later** migration on its own branch, because `migrate deploy` applies every pending
migration at once and CREATE and DROP must not ship together.

`tb_license_intake` gains nullable `storage_db_bytes` / `storage_file_bytes` (stored as bytes,
received as GB), and a relation to the new table.

## 5. Rules

**Issue** (intake, hand, migration), in one transaction:
1. Mark the BU's current licence (if any) `superseded_at = now()`, `superseded_by_id = N.id`.
2. Insert N.
3. Re-derive `quota_bytes` on the BU's existing `tb_business_unit_storage_usage` rows,
   the same way `update()` does today, so the card and enforcement state don't wait for the next measurement run.

**Edit** figures of the licence in force: update it, then step 3. Editing a replaced or deleted licence: 409/400. *(My call.)*

**Delete** the licence in force: soft delete, then step 3. The BU falls back to the default (O10).
Deleting a replaced licence only removes history and changes no quota.

**Default changed in Backstage Config:** BUs with no licence or with empty figures pick it
up at the next measurement run, as today. *(My call: no immediate re-derive across every BU.)*

**Enforcement path is untouched.** `license.interceptor.ts` → `assertStorageNotBlocked` reads
the growth-block flag on the usage rows, not the quota, so the licence lookup runs only at
measurement, at licence writes and on views. *(Checked in code 2026-11-03.)*

## 6. License intake

- Push DTO + `license-intake.normalize.ts`: accept optional integer `storage_db_gb` /
  `storage_file_gb` (≥ 1). Convert to bytes and store them. Include them in `payload_hash` like the other fields.
- `license-intake-decision.service.ts` confirm: after subscription / seats / interfaces,
  **if either figure is present**, issue one storage licence for the confirmed BU (§5 Issue).
  Otherwise issue none (O5). `produced` gains `storage: { id, number }[]`.
- An intake is confirmed against exactly one BU (`business_unit_id`), so it produces at most one storage licence.
- Overlap preview (`GET /license-intakes/:id/business-units/:buId/licenses`) returns the BU's
  storage licence in force. When the intake carries storage, the FE shows "will replace STQ-…".
- FE: `IntakeSoldCard` shows the figures (an empty one reads "Default"), or "Not included"
  when neither was sent. `IntakeOverlapPanel` gets a Storage line. `LicenseIntakeDetail` links the produced STQ licence.
- Update the partner-API documentation / swagger for the two fields.

## 7. `/licenses` (FE)

- New tab **Storage** in `LicenseCenter` (`?tab=storage`), after Interface.
- New kind `'storage'` in `licenseKindConfig.ts`. Owner = BU, `showCluster: true`,
  `showNoExpiry: false`. The two quotas fit neither the `amount` nor the `feature-group`
  selector, so add a third one (e.g. `'storage-quota'`) rendering two optional GB inputs
  (DB, File), sent as bytes. Reuse `utils/storageQuota.ts` (`BYTES_PER_GB`, `bytesToGbInput`,
  `isValidQuotaInput`). The form and table switch on `selector`, never on `kind === 'storage'`.
  That file states this rule.
- The **dates** that the other kinds always show (start/end inputs, Days Left, expiring-soon
  filter, expiry thresholds) do not apply. The kind config needs a flag for "has dates", or
  the equivalent. The builder decides the shape, but date UI must not appear for Storage.
- `PurchaseLicenseTable` columns for Storage: number, BU, cluster, DB quota, file quota
  (empty → "Default (5 GB)" with the live value), status (in force / replaced), source (intake / manual / migrated), created.
- Routes `/licenses/storage/new` and `/licenses/storage/:id/edit`, following the existing
  purchase-licence pages (doc_version, unsaved guard, shortcuts, debug sheet). Prefill with `?bu=`.
  The create form warns when the BU already has a licence in force: "replaces STQ-…".
- New `businessUnitStorageLicenseService.ts`, endpoints under `/api-system`. Confirm paths against swagger once the backend exists.
- i18n TH + EN.

## 8. `BuStorageQuotaCard`, config default, migration

**Card (O7, O8):** remove the DB / file quota inputs. Show each effective quota with its source:
"STQ-2611-0003" (linked), or "Default". Add an **Issue storage licence** link to
`/licenses/storage/new?bu=<id>`, or "Replace" when one exists. `exempt`, usage, Measure and Reclaim stay.
If the backend has not shipped yet and the new source fields are absent, the card renders as today minus the inputs.

**Default (O2):** change the `storage_quota` registry default in
`apps/micro-cluster/src/cluster/backstage-config/backstage-config.schema.ts` and the FE
mirror `DEFAULTS` in `StorageQuotaConfigCard.tsx` to 5 GB / 5 GB. **Watch out:** if an
environment already has a saved `storage_quota` config row, the registry default is not
used there. That row's `default_file_bytes` must be set to 5 GB through Backstage Config on
each environment (DEV, then production). Put this in the deploy steps.

**Data migration (O11):** one-off and idempotent. For each `tb_business_unit_storage_quota` row
with a non-NULL `db_quota_bytes` or `file_quota_bytes`, issue an STQ licence with **those same
columns** (NULL stays NULL → default), `note` = "Migrated from manual quota",
`license_intake_id` = NULL. The builder chooses SQL migration or seed-console op, whichever fits the deploy order.

**Deploy order:** BE (schema + migration + readers) first, then FE. Then set the config row
on each environment (above). The DROP of the old columns comes last, on its own branch.

## 9. Left to the builder

- Permission keys for the new kind (follow the seat-licence keys; add to the backstage
  permission seed and the `app-api-catalog` / api-system-permission audit gates).
- Whether the effective-quota rule is a SQL view (like `v_cluster_bu_quota`) or a TS helper. It has one owner either way.
- Status badge variants (`<Badge>`, no raw colours).
- Activity-registry entries for issue / replace / edit / delete.
- The exact shape of the "has dates" switch in `licenseKindConfig.ts`.
