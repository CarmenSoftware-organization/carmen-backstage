---
title: "Storage quota licence has no dates; an intake without storage figures issues nothing and keeps the BU's current licence"
author: Thammanoon
date: 2026-11-03
branch: feature/storage-quota-license
cost: { minutes: 16, tokens: 119639 }
id: l-e47d5c69
scope: repo
status: active
src: agent
touches:
  - docs/superpowers/plans/2026-11-03-storage-quota-license.md
  - docs/superpowers/specs/2026-11-03-storage-quota-license-design.md
---

## Decided
Owner choice (2026-11-03), spec docs/superpowers/specs/2026-11-03-storage-quota-license-design.md:
- Storage licence (STQ-YYMM-####) carries only db/file quota bytes. It has no start/end date and never expires; the subscription decides how long the BU can be accessed.
- Effective quota = licence figure, or the live `storage_quota` config default when there is no licence or the figure is NULL. Default becomes 5 GB / 5 GB.
- One licence in force per BU. A new one supersedes the old one; deleting the in-force licence falls back to the default and does NOT revive the previous one.
- An intake without storage_db_gb/storage_file_gb issues NO storage licence, so the BU keeps its current one.
- The `exempt` switch stays manual on BuStorageQuotaCard; the quota inputs there are removed.
- BUs on the default that hold more than 5 GB of files are allowed to start the normal grace period, with no shielding licences issued.

## Tried and ruled out
- A dated model: storage licence with intake dates, trim-on-replace, original_end_date undo, expiry → default. The owner rejected it as duplicating the subscription.
- Reusing LicensePurchaseForm / PurchaseLicenseTable through licenseKindConfig: both are built around dates throughout (the form is about 1,200 lines). The plan uses a dedicated StorageLicenseTable/Form instead.

## Watch out
- The storage_quota default exists in THREE places: the micro-cluster registry (backstage-config.schema.ts), the gateway DEFAULT_CONFIG (storage-quota.service.ts) and the FE DEFAULTS (StorageQuotaConfigCard.tsx). A saved config row on an environment overrides all of them, so it must be edited by hand in Backstage Config.
- Only the gateway reads the storage_quota config, so after any licence write (including intake confirm) the gateway must call refreshQuota(buId) to re-derive usage.quota_bytes.
