# AI Credit License — Design

**Date:** 2026-11-19
**Repos:** `carmen-turborepo-backend` (schema `prisma-shared-schema-backstage`, `micro-cluster`, `backend-gateway`) · `carmen-backstage` (FE)
**Builds on:** Storage quota licence (spec `2026-11-03-storage-quota-license-design.md`) · License intake Parts 1–4 (spec `2026-10-29-license-intake-customer-design.md`)
**Out of scope here, separate specs later:** (B) the server-side OCR/AI gateway and provider choice · (C) the three OCR features in `carmen-frontend` + `micro-business`

## 1. Intent

The company is adding three AI OCR features to the inventory app:

1. scan a goods-received document and match it to its PO,
2. scan a supplier invoice to create an AP invoice,
3. scan payment documents to reconcile payments.

OCR costs money per call. The owner wants to sell it as **AI credits, licensed per BU**. Each scanned page uses one credit, so a customer can predict
what they get: "500 credits a month, which is 500 pages, plus whatever top-up we bought".

The unit is named **AI credit**, not "OCR credit", so that later AI features can draw from the same balance.
Every feature in this spec costs **1 credit per page**. The OCR caller converts pages to credits before it calls `reserve`.

Today there is **no server-side AI call anywhere**. Ask AI on the PR page only hands the browser a `url_template` link to an external chat site.
So this spec builds the credit system only: licences, the balance, the ledger, the backstage UI, and intake. It also builds a **reserve → commit / release**
contract that the future OCR gateway (B) will call before and after each job. Nothing burns credits until B exists.

## 2. Decisions made by the owner (2026-11-19)

| # | Decision |
|---|---|
| O1 | Unit = **AI credit**. Every OCR feature costs **1 credit per page** of a document. Customers must be able to predict usage. Token-based metering was rejected. The term was renamed from "OCR credit" to "AI credit" on 2026-11-19. |
| O2 | Two sources of credit: a **monthly quota that comes with the subscription**, and **top-up credits that never expire**. This was option 3 of three. Option 1 (top-ups only, no expiry) was chosen first and then replaced by this. Option 2 (dated lots, FIFO) was rejected. |
| O3 | The quota is **per BU**. "License on each BU" means each BU has its own balance, not one balance shared across a subscription or a cluster. |
| O4 | When a BU has several active subscriptions that overlap, its monthly quota is the **maximum** of their per-BU figures, never their sum. Overlap usually means a renewal. Buying more is what top-ups are for. |
| O5 | Approach 1 (§4): the ledger lives in `micro-cluster` beside the other licences, in the backstage DB. |
| O6 | Scope of this spec = the credit system plus the reserve/commit/release contract. OCR provider and the features come in later specs. |

## 3. Goals / non-goals / anti-goals

**Goals**
- A BU's usable credits = remaining monthly quota + remaining top-up balance. This number is correct under concurrent scans.
- Every change to a balance is a ledger row that says who, what, which feature, which document, and how many credits.
- Staff can issue top-ups, set monthly quota, adjust balances and see usage from backstage. Intake can sell both.
- A job that fails on our side costs the customer nothing.

**Non-goals**
- OCR provider, API keys, page counting of uploaded files (B).
- The GRN↔PO, AP invoice and reconcile features and their UI in `carmen-frontend` (C).
- Billing or invoicing the customer for credits. The intake / license master owns the sale.
- Per-feature pricing. Every feature costs 1 page = 1 credit.

**Anti-goals** (failure even if it technically works)
- Two concurrent scans each pass the check and drive the balance below zero. The only way a balance may go negative is voiding a top-up (§5.6).
- A credit is used but no ledger row explains it, or the backstage figure and the inventory figure disagree.
- A crashed OCR job leaves credits reserved forever.
- Monthly quota rolls over, or overlapping subscriptions double it.

## 4. Approaches considered

1. **Ledger in `micro-cluster` beside the licences (chosen).** It is the same source of truth as subscriptions, so the quota is the maximum (O4) in one query.
   Backstage reads it directly, and the STQ / intake pattern already exists here. Cost: `micro-business` OCR jobs make an RPC to `micro-cluster` for every scan,
   and OCR stops if `micro-cluster` is down. That is acceptable: we will not let scans run free.
2. **Ledger in each tenant DB (`micro-business`).** It sits next to the documents and can debit in the same transaction that creates the GRN or AP.
   Rejected for three reasons. Subscriptions and top-ups would live in another DB, so the copies would drift. Backstage would need to fan out across every tenant.
   And a tenant admin with DB access could edit the balance.
3. **External metering (Lago, Stripe meters).** Rejected. It adds a dependency and cost, has to be synced with our licences and intake, and is not built for
   per-page real-time reserve/release.

## 5. Rules

### 5.1 Monthly quota
- New column `ai_credits_per_month Int @default(0)` on **`tb_subscription`**. 0 = this subscription includes no AI credit.
  - A subscription is created for exactly one BU. `subscriptionService.create` requires `business_unit_id`, and the BU cannot change after create. So a field on the subscription is per BU (O3).
  - *(My call, after the builder check: an earlier draft put it on `tb_subscription_bu`, which has no per-BU editor.)*
  - Being on the subscription means quota edits ride the existing subscription PATCH (`doc_version`) and its record audit trail. Quota changes are audited there, not in the credit ledger.
- **Month** = calendar month in **Asia/Bangkok** (key `YYYY-MM`). It resets at 00:00 on the 1st, Bangkok time.
- **Effective monthly quota** for a BU in month M = `MAX(ai_credits_per_month)` over the BU's non-deleted subscriptions where, **at the moment of the check**, `status = 'active'` **and** `start_date ≤ now < end_date`. If there are none, it is 0.
  - *(My call: the quota is evaluated live, not snapshotted at month start, so a renewal or upgrade mid-month takes effect right away. The date test matters because an `active` row past its `end_date` must not grant quota.)*
  - The MAX rule (O4) means a renewal with a lower figure takes effect only once the old subscription ends.
- Unused quota is **lost** at month end. It never rolls over.
- An expired or inactive subscription gives 0 monthly quota. Top-up credit is still counted.
- **`reserve` does not call the licence-enforcement gate.** The OCR feature routes in spec C are HTTP routes, so `license.interceptor.ts` gates them like any other write route. A BU whose subscription has lapsed is therefore blocked from scanning by enforcement, even with top-up left. *(My call: it keeps one place that decides "can this BU write".)*

### 5.2 Top-up credit
- New licence kind, number `AIC-YYMM-####` via the existing `nextLicenseNumber('AIC', …)`. Numbers count soft-deleted rows, so a number is never reused.
- It carries `credits Int (≥1)` and **no dates**. It never expires. Licences **sum** into the BU's top-up pool. This is unlike STQ, where a new licence replaces the old one.
- Writes need backstage-wide `subscription.manage`, the same permission as the other licences.

### 5.3 Balance and order of use
For BU b in month M:
- `monthly_remaining = max(0, effective_quota(b) − monthly_used(b, M))`
- `topup_remaining = Σ credits of non-deleted AIC licences + Σ adjustments − topup_used(b, all time)`
- `available = monthly_remaining + max(0, topup_remaining)`

`topup_remaining` can be negative after a void (§5.6). The UI shows it raw, so staff can see the debt, but `available` never counts a negative pool against monthly quota.

A debit takes from **monthly first, then top-up**, because monthly quota is lost anyway. The split is decided at **reserve** time and stored on the reservation.

### 5.4 Reserve → commit / release (the contract for B)
- `reserve({ bu_id, credits, feature, ref_type, ref_id, user_id, idempotency_key })`: one transaction. `user_id` and `idempotency_key` are required.
  - `idempotency_key` is unique per BU. A repeat call with the same key returns the existing reservation instead of creating a new one, so B can retry after a timeout without double-reserving.
  1. Lock BU b's balance row (`SELECT … FOR UPDATE`).
  2. Compute `available`. Pending reservations count as used.
  3. If `credits > available`, return **`402`-style `AI_CREDIT_INSUFFICIENT`** with `{ available, requested }`. Nothing is written, and no job starts with a partial file.
  4. Otherwise insert a reservation (`pending`, `from_monthly`, `from_topup`, `month`, `expires_at = now + 15 min`) and return its id.
- `commit({ reservation_id, credits_actual? })`: marks the reservation committed and writes ledger debit row(s). `credits_actual` may be **lower** than reserved,
  for example when the provider counted fewer pages, so fewer credits are owed. The difference is refunded to top-up first, up to the reservation's `from_topup`, and the rest goes back to monthly.
  *(My call: top-up is the scarcer pool. If the reservation's month has already closed, the monthly part of the refund changes only that month's history.)*
  `credits_actual` may never be higher than reserved. The caller must reserve again.
- `release({ reservation_id, reason })`: marks the reservation released. No ledger debit is written, and the credits become available again.
- Both commit and release are **idempotent**. Calling commit again on a committed reservation returns the same result. Commit on a released or expired reservation returns 409.
- **Expiry:** a scheduled task **in `micro-cluster`** (NestJS scheduler) runs every 5 minutes. It calls the same `release` code path for `pending` reservations past `expires_at`, with reason `expired` and `created_by_id = null`.
  - *(My call: `micro-cronjobs` is a Go service, so putting the job there would mean a second implementation of the lock and release logic, in another language.)*
- `feature` enum: `ocr_grn_po_match`, `ocr_ap_invoice`, `ocr_payment_reconcile`. New features add enum values.
- A reservation made in month M and committed in M+1 still counts against M's monthly usage, the month stored on the reservation. *(My call.)*

### 5.5 Ledger
Table `tb_bu_ai_credit_ledger`. It is **append-only** and never updated.
Columns: `business_unit_id`, `entry_type` (`debit` | `topup` | `topup_void` | `adjust`), `pool` (`monthly` | `topup`), `credits` (signed), `month` (for monthly),
`feature?`, `ref_type?`, `ref_id?`, `reservation_id?`, `license_id?`, `reason?`, `created_by_id`, `created_at`.
- `monthly_used(b, M)` = Σ debit credits, pool monthly, month M, plus pending reservations.
- `topup_used` = Σ debit credits, pool topup, plus pending.

The balance row (`tb_bu_ai_credit_balance`, one per BU) is a **lock target and cache**. The ledger is the truth. A `db:check.*` script recomputes the cache from the ledger and reports drift.

### 5.6 Voiding and adjusting
- **Void a top-up licence** (soft delete). This writes `topup_void −credits`, and the top-up pool **may go negative**. A negative pool does not reduce monthly quota,
  but nothing is taken from top-up until it is positive again. *(This is why voiding a licence that has already been used stays possible: it reverses a sale that was wrong.)*
- **Manual adjust** (for example a free gift, or a refund for a bad OCR read): `adjust ±credits` on the **top-up pool** only, with a required reason. Needs `subscription.manage`.
  An adjust can never touch monthly quota.
- Editing a licence's `credits` is not allowed. Void it and issue a new one. *(My call: it keeps the ledger honest.)*

### 5.7 Low-balance warning
- Config key, for example `ai_credit_low_threshold`, default **100 credits**, editable in Backstage Config. It sits next to the expiry thresholds (`project-expiry-thresholds-config`).
- A BU is "low" when `available < threshold` **and** it has any AI credit entitlement (quota > 0 or ever had a top-up). BUs with no AI credit at all are not flagged.

## 6. License intake
- The push DTO gains optional `ai_credits_per_month` (int ≥ 0) and `ai_credit_topup` (int ≥ 1). Both go into `payload_hash`.
  - **When the fields are absent, the hash must be identical to today's hash**, so existing intakes keep their idempotency. The builder must verify this in `license-intake.normalize.ts`.
- On confirm (one BU per intake):
  - `ai_credits_per_month` is written to the subscription that the intake creates. If it is omitted, the value is 0.
  - `ai_credit_topup` issues one `AIC-` licence, plus a `topup` ledger row.
  - `produced` gains `ai_credit: { id, number }[]`.
- An intake with **only** AI credit top-up and nothing else is a valid sale, the same as storage-only.
- FE: `IntakeSoldCard` shows both values, or "Not included". `LicenseIntakeDetail` links the produced AIC licence.

## 7. Backend surface (gateway, `/api-system`)
All of these use the BU licence permission conventions of STQ. Every new route key must be added to the app allow-list on every environment that is not `allow_all`.
Otherwise the call returns 401 and the user is logged out.
- `GET  /business-units/:id/ai-credit`: `{ month, monthly_quota, monthly_used, monthly_remaining, topup_remaining, available, pending, low }`
- `GET  /business-units/:id/ai-credit/ledger`: paginated, filterable by `entry_type`, `feature`, `month`
- `POST /business-units/:id/ai-credit/licenses`, `DELETE …/licenses/:licenseId` (void), `POST …/adjustments`
- `ai_credits_per_month` is added to the existing subscription create, PATCH and GET payloads. There is no new endpoint for it.
- `GET  /ai-credit/summary`: per-BU list for `/licenses` (balance, low flag)
- RPC only, not HTTP-public: `AiCredit.reserve | commit | release`. B will call these from `micro-business`, or from wherever the OCR gateway lands.

`carmen-frontend` read endpoints (balance next to the scan button, BU admin usage page) belong to spec C. The data shape above is what they will read.

## 8. Backstage FE (`carmen-backstage`)
- **BU Licenses tab** (`BusinessUnitLicensesCard` area): new **AI credit** section.
  - Balance card: monthly used/quota bar, top-up remaining, available, low badge.
  - Actions: Issue top-up (`AIC-` form: credits), Adjust (± credits, required reason), Void (ConfirmDialog).
  - Ledger table: server-side, filters by type, feature and month, CSV export.
- **Subscription form:** add an `AI credits / month` input (int ≥ 0, default 0) to the subscription create and edit form in `/licenses`, and show the value in the subscription table and detail. `subscriptionService.create`/`update` gain the field.
- **`/licenses` (`LicenseCenter`):** new tab **AI credit** (`?tab=ai-credit`). New kind in `licenseKindConfig.ts`, owner = BU, no dates, amount selector = credits. Low badge in the table and the health strip.
- **Backstage Config:** low-threshold input.
- i18n TH/EN for all of the above. Mobile cards under `lg` like the other licence tables.

## 9. Concurrency, failure and data integrity
- All three RPCs lock the BU balance row first, so two scans on the same BU serialise.
  Scans on different BUs do not contend.
- `reserve` returning an error never leaves a row. `commit` / `release` are idempotent by `reservation_id`.
- If `micro-cluster` is unreachable, `reserve` fails, and B must fail closed (no scan).
- Month key is computed in the DB with `AT TIME ZONE 'Asia/Bangkok'`, never on the client.

## 10. Rollout order
1. BE schema + migration (new tables, `tb_subscription.ai_credits_per_month` default 0). This is additive and safe to apply before the code that uses it.
2. `micro-cluster` services + RPC + gateway routes + cron job. Seed the allow-list keys where needed.
3. FE backstage. It needs step 2 deployed first, or the new card hides or errors.
4. Intake fields. This needs the license master side to send them, so coordinate with whoever owns that system.

## 11. Left to the builder
- Exact table and column names, Prisma relations, indexes. A likely index is `(business_unit_id, month)` on the ledger and `(status, expires_at)` on reservations.
- Exact HTTP status and error code mapping for "insufficient". The code name `AI_CREDIT_INSUFFICIENT` must stay stable for B and C.
- Component layout within the AI credit section, following the existing licence cards.
- The `db:check` drift script shape.
