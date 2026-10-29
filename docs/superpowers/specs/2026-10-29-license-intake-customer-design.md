# License Intake from the License Master + Customer (AR) — Design

Date: 2026-10-29 · Repos: `carmen-turborepo-backend` (prisma schema, gateway, micro-cluster / micro-business), `carmen-backstage` (FE)

## Intent

The company is moving license and invoice handling out of Zoho CRM. A separate team ("พี") is
building a **license master** system: Sales' closed-won deals in Zoho flow into it, accounting
(พี่แบงค์) requests reductions/terminations there, and it will eventually generate invoices.
Backstage is the **enforcement end**: it must receive what was sold and turn it into the seat,
module-group and interface licenses it already enforces.

Today nothing can push into backstage — every license write needs a human Keycloak JWT, BUs have
no field that matches anything in the sales or accounting world, and a duplicated push would
silently double a seat pool. This design adds:

1. a **Customer (AR)** entity so a BU knows who pays for it,
2. an **inbound intake API** the license master calls with app-id + secret,
3. a **pending queue** in backstage where a human with a new `subscription.approve` permission
   confirms which BU each sale belongs to before anything takes effect,
4. a prerequisite **bug fix**: subscriptions ignore `start_date`.

Source: meeting 2026-10-29 (Sales / Accounting / license-master / backstage). Decisions marked
**(owner)** were made by the backstage owner in the design conversation; **(designer's call)**
marks defaults set while writing — change them freely.

## Goals

1. The license master can push one sale ("deal") per call, identified by a stable sale id, and a
   repeated push of the same id never creates a second set of licenses.
2. Nothing a push contains takes effect until a person confirms the target BU. **Every** intake
   goes through the queue, including an AR with exactly one BU **(owner)**.
3. Confirming an intake creates the seat / subscription + groups / interface licenses in **one
   transaction**, using the existing tables and enforcement unchanged.
4. Each BU is linked to at most one Customer (AR number); one Customer may be linked to many BUs
   (e.g. KC Koh Chang: one AR, owner DB + transaction DB) **(owner)**.
5. A Customers screen in backstage to list customers, link/unlink BUs, and see every license
   under a customer.
6. Future-dated subscriptions stop granting features before their `start_date`.

## Non-goals

- **Seat model unchanged.** Seats stay a cluster-wide pool (sum of BU `licensed_users`, distinct
  active users) **(owner)**. The meeting floated a per-BU cap ("a BU must not exceed its own
  seats"); that is explicitly **not** done — tell the license-master team and Sales.
- No prices, invoices, billing periods, proration — the license master owns them.
- No reduce/terminate/cancel flow from accounting — that lives in the license master; it will
  later reach backstage as its own design.
- No storage licensing, no direct Zoho sync/webhook, no account-name sync.
- Backstage is **not** an AR ledger. Customer rows are a reference copy of the accounting
  system's AR profile (Carmen accounting stays source of truth). Editing them in backstage is
  allowed for now, but nothing here computes balances or posts to accounting.

## Anti-goals (would make this a failure even if it "works")

- A sale landing on the wrong BU without a human seeing it (this is why there is no auto-bind).
- A retried or duplicated push doubling seats (seat licenses stack by design —
  `business-unit-license.service.ts:170-176` says "Never add an overlap check").
- The intake endpoint becoming a second, unaudited way to grant licenses: every license it
  creates must be traceable to the intake row and the person who confirmed it.

## Constraints found in the backend (verified or reported, with locations)

- All license write routes sit behind class-level `KeycloakGuard` + `AppIdGuard('<api>')` +
  `BackstagePermissionGuard` (`subscription.manage`). App-id + secret alone cannot call them.
  Controllers: `apps/backend-gateway/src/backstage/backstage_business-unit-licenses/…`,
  `…/backstage_business-unit-interface-licenses/…`, `…/backstage_subscriptions/…`.
- `AppIdGuard` (`apps/backend-gateway/src/common/guard/app-id.guard.ts:62`) verifies `x-app-id`
  and, when `require_secret`, `x-app-secret` (SHA-256 digest, timing-safe, rotation grace).
  App scope is an allow-list of `tb_application_api.api_name`.
- `BuApiKeyGuard` (`apps/backend-gateway/src/external-api/bu-api-key.guard.ts`) is the existing
  non-Keycloak precedent, but it is pinned to one BU; not reusable as is.
- `created_by_id` / `updated_by_id` are FKs to `tb_user`, so the license master needs a user row.
- License tables have `reference_no` (free text, not unique) and no price columns.
- `tb_business_unit` already has `company_name`, `tax_no`, `hotel_name`; no AR / external id.
- **Bug (verified in code):** `deriveSubscriptionState`
  (`packages/prisma-shared-schema-backstage/src/index.ts`) only looks at `status` and `end_date`;
  `apps/backend-gateway/src/license/license.service.ts` reads every non-deleted subscription
  without a `start_date` filter. A future-dated `active` subscription grants its features today.
  Interface licenses already check `start_date` (`license.service.ts` ~:253).
- Permissions are catalogued in
  `packages/prisma-shared-schema-backstage/prisma/seed.backstage-permission.data.ts`
  (single source for the seeder and the drift checker), and the gateway's api-system permission
  coverage is checked by `prisma/check.api-system-permission-coverage.ts`.

## Design

### Part 1 — Subscription `start_date` fix (ship first, independent)

A subscription whose `start_date` is in the future derives a state that grants nothing and does
not count as expired (mirror the interface-license rule). The shared rule stays in
`deriveSubscriptionState` — both gateway and micro-business must keep importing it; do not
re-implement. Whether "not started yet" becomes a new state value (e.g. `scheduled`) visible in
the UI or maps to existing `inactive` for display is the builder's call, but the FE must not show
a future subscription as "Active". Required before Part 3, because intake sales are often renewals
that start later.

### Part 2 — Customer (AR)

**Data**

- New table `tb_customer`: `id`, `ar_number` (unique among live rows), `company_name`, `tax_no`,
  `billing_address` (structure: builder's call; reuse the BU address shape if convenient),
  `status` (`active` | `inactive` — inactive means the customer cancelled, per accounting),
  `note`, `doc_version`, standard audit + soft-delete columns.
- `tb_business_unit.customer_id` nullable FK → `tb_customer`. Many BUs per customer, one customer
  per BU **(owner)**.
- Existing `tb_business_unit.company_name` / `tax_no` stay as they are in this phase
  **(designer's call)**: they are tenant-side company data used by the inventory app; the customer
  is the payer. Do not migrate or drop them here.

**API** (api-system, normal Keycloak + RBAC):
list/search (by AR number, company name), detail (with linked BUs and their licenses), create,
update (with `doc_version` → 409 on stale), soft delete (refuse while BUs are linked),
link/unlink a BU. Link/unlink is allowed only for BUs whose cluster the caller can manage.

**Permissions (designer's call):** new resource `customer` with `customer.read` and
`customer.manage`, added to the permission seed catalog.

**FE:** new Management page "Customers" (server-side list shape — the set is unbounded; see
`agent-os/standards/pages/management-page.md`): AR number, company, status, BU count, CSV export,
summary band. Customer Edit page following the Edit-page rules (doc_version, unsaved guard,
`Ctrl/⌘+S`), with a "Business units" section to link/unlink and a read-only "Licenses" section
listing seats / subscriptions (with module chips) / interface licenses across its BUs.
BU Edit shows the linked customer (link to it) and lets an authorized user pick one.

### Part 3 — Inbound intake API (for the license master)

**Auth.** A new machine-only guard (not a `KeycloakGuard` subclass): requires `x-app-id` +
`x-app-secret`, the application must have `require_secret = true` and the intake `api_name` on its
allow-list. The guard sets a request identity bound to one **system user** row created for the
license master (seeded; flagged as a system account so it cannot log in interactively). That user
is what `created_by_id` points to on intake rows. The guard does not grant any other backstage
permission.

**Endpoint.** `POST /api-system/license-intakes` (path: builder's call). One call = one sale:

- `source_sale_id` (string, required) — the license master's stable id for this sale line.
- `ar_number` (required).
- `customer_hint` (optional: company name, hotel name, Zoho account name) — display only, helps the
  person matching it.
- `seats` (optional int ≥ 0), `module_group_codes` (optional string[] — `tb_license_feature_group.code`
  with kind `standard`), `interface_group_codes` (optional string[] — kind `interface`).
- `start_date`, `end_date` (required), `note` (optional).
- At least one of seats / module groups / interface groups must be present.

**AR matching (designer's call).** `ar_number` is normalized (trim, uppercase) on the way in and
stored normalized on both `tb_customer` and the intake; uniqueness and lookup use the normalized
value.

**Idempotency.** `source_sale_id` is unique on the intake table. Same id + identical payload →
`200` returning the existing intake (and its status); "identical" compares the normalized payload
(group-code arrays sorted, AR normalized). Same id + different payload → `409`
(the license master must not mutate a sale by re-pushing; corrections are a later design).

**Validation at push time.** Unknown group codes, wrong group kind, `end_date < start_date` →
`400` with field details; nothing stored. An unknown AR number is **not** an error — the intake
is stored and the queue shows "AR not found" so staff can create the customer.

**Response.** `201` with intake id and `status: pending`. No license exists yet.

### Part 4 — Pending queue (backstage)

**Data.** New table `tb_license_intake`: `id`, `source_sale_id` (unique), `ar_number`,
`customer_id` (nullable, resolved at push if the AR exists), raw payload (Json, as received),
normalized fields, `status` (`pending` | `confirmed` | `rejected`), `business_unit_id` (set on
confirm), `confirmed_by_id` / `confirmed_at`, `rejected_by_id` / `rejected_at` / `reject_reason`,
audit columns, and links to the license rows it produced (or the produced rows carry the intake id
— builder's call; either way it must be queryable both ways).

**Permission.** New `subscription.approve` **(owner)** — required to view the queue's actions and
to confirm or reject. Note: the seed's wildcard `subscription.*` would include it; decide at seed
time which roles get it explicitly rather than relying on the wildcard. Viewing the queue needs
`subscription.read`.

**Confirm.** The person picks the target BU. Suggested BUs = live BUs linked to the intake's
customer (if any); they may pick any BU they are allowed to manage. If the chosen BU has no
customer, confirming links it to the intake's customer; if it is linked to a **different**
customer, confirm is refused (fix the link on the Customers screen first). In one transaction:

- `seats` → one `tb_business_unit_license` (`licensed_users`, dates, `reference_no = source_sale_id`).
- `module_group_codes` → one `tb_subscription` for the BU's cluster + BU with those groups
  (`status: active`; Part 1 makes a future start safe).
- each interface group → one `tb_business_unit_interface_license`.
- existing creation rules apply (license numbers, seat-pool and BU-quota checks). Seat licenses
  already respect `start_date` (the seat pool only sums rows with `now() BETWEEN start_date AND
  end_date`), so a future-dated seat grant needs no change.
- **Interface main-contract rule during confirm (designer's call).** Today the interface create
  path requires the BU's main contract to be active *now*. For intake confirm, the rule is
  satisfied if **either** an existing subscription of the BU covers the interface's `start_date`,
  **or** the same intake carries module groups whose subscription (created first, in the same
  transaction) covers it. Create order inside confirm: subscription → seats → interfaces. If
  neither holds, confirm fails with that message and nothing is written. The manual interface
  create path keeps its current rule.

**Who can confirm (designer's call).** Backstage staff only, via global RBAC
(`subscription.approve`); cluster-admin (customer-side) users never see the queue. No per-cluster
scoping of the BU picker in this phase.

**Overlap warning (owner).** When a BU is picked, the detail shows that BU's existing live seat
licenses, subscriptions (with module chips) and interface licenses with their dates. Any existing
row of the same kind whose period overlaps the intake's period is flagged with a warning that
seats / features will **stack** during the overlap (e.g. renewal pushed as a new sale starting
before the old term ends). The warning does not block: the person can still confirm. Needs a
read endpoint for a BU's licenses in one call (or reuse existing ones — builder's call). The
confirm request records whether an overlap warning was shown, for the audit trail.

**Reject.** Requires a reason; nothing is created. A rejected intake cannot be confirmed later;
the license master would push a new sale id.

**FE.** New page "License intake" under Licenses: list with status filter (default pending),
AR, customer (or "AR not found" with a create-customer shortcut), what was sold (seats, module
chips, interface chips), dates, received time. Row → detail with BU picker (suggested first),
Confirm / Reject via `<ConfirmDialog>`. Pending count badge on the nav item **(designer's call)**. Detail page shows the overlap warning described above.

## Rollout notes

- Backend before FE for every part (FE pages call endpoints that must exist).
- Seed the two new permissions and the license-master system user + application (with secret) on
  DEV; add intake `api_name` to that application's allow-list only.
- Run the backend audit gates (api-system permission coverage in particular) before pushing.
- Share the intake contract (payload, idempotency rule, error shapes) with the license-master team
  as a short doc or the swagger entry once the endpoint exists.

## Service placement (designer's call)

Customer and intake (push, queue, confirm, reject) live in **micro-cluster**, which already owns
BU seat and interface licenses. Confirm must be one Prisma transaction on the backstage schema;
subscriptions are created today by micro-business, so confirm writes `tb_subscription` /
`tb_subscription_bu` / `tb_subscription_bu_group` directly through shared helpers (extract them
into `@repo/prisma-shared-schema-backstage` if needed) rather than an RPC hop that would break the
transaction. The gateway only hosts the controllers and the new machine guard.

`tb_user` has no system-account flag today; add one (e.g. `is_system_account`) and make login
paths refuse it.

## Left to the builder

Table/column naming within repo conventions, exact routes, which micro-service owns customer and
intake (micro-cluster owns BU licenses today), state name for not-yet-started subscriptions,
address structure, list page columns beyond those named, i18n keys (TH/EN both required).
