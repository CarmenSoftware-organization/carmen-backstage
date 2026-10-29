# License Intake API (Part 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The external license master can push one sale per call to `POST /api-system/license-intakes`. It authenticates with app id + secret only. The sale is stored as a `pending` intake row, and no licence is created.

**Architecture:**
- **Gateway:** a new machine guard runs after `AppIdGuard`. It admits only an application that has `require_secret = true`, has `allow_all = false`, holds an explicit grant of `license-intake.push`, and is bound to a seeded system user (`tb_application.system_user_id`).
- **micro-cluster:** a new `license-intake` module normalizes the payload, validates group codes, enforces idempotency on `source_sale_id`, resolves the AR to a customer, and writes `tb_license_intake`.
- **Part 4 columns:** the table carries the confirm/reject columns now, so Part 4 needs no second migration on it.

**Tech Stack:**
- NestJS gateway plus micro-cluster (RPC via `@repo/rpc-contract`)
- Prisma backstage schema (`packages/prisma-shared-schema-backstage`) with hand-written idempotent SQL migrations
- zod v4 DTOs
- error catalog (`@repo/error-catalog`)

**Spec:** `docs/superpowers/specs/2026-10-29-license-intake-customer-design.md`. Part 3 is implemented here. Part 4 contributes the "Data" paragraph, i.e. the table shape. Part 2 (Customer, backend PR #968) is a prerequisite.

**Recon:** `.superpowers/sdd/intake-recon.md` in carmen-backstage holds the file:line evidence behind every claim below. Implementers should read the sections it cites.

## Global Constraints

### Repo and branch
- Backend repo: `carmen-turborepo-backend`.
- Branch: `feature/license-intake-api`, cut from `feature/customer-ar`, because it needs `tb_customer`.
- **Do not push until backend PR #968 is merged.** Then rebase onto `main` and open the PR against `main`.
  - Stacked PR trap: deleting the base branch closes a child PR permanently.
  - Pushing any branch that contains a migration applies it to DEV within about 2 minutes.

### Working rules
- **No new test files** (user preference). The loop is: implement → type-check → `bunx eslint <changed files>` → commit. Existing suites must still pass.
- Never run `bun run lint`; it rewrites the repo.
- Gates: run `bun run gates` before push. These reds already exist and can be ignored:
  - audit:raw-sql (document-number.helper.ts:219)
  - audit:dependencies (systeminformation)
  - micro-cluster `BusinessUnitService › setDefaultTenant`
  - prettier, on pre-existing files only
- Add no new env vars. `audit:env-drift` would flag them. Use code constants instead.
- Use no `$queryRaw` in new code (`audit:raw-sql`).
- DTOs import from `'zod/v4'`.

### Names
| Thing | Value |
|---|---|
| api_name | `license-intake.push` |
| rpc service | `license-intakes`, cmd `license-intakes.push`, served by `micro-cluster` |
| contract export | `LicenseIntakes` (as generated) |
| route | `POST /api-system/license-intakes` |
| table | `tb_license_intake` |
| enum | `enum_license_intake_status` = `pending` \| `confirmed` \| `rejected` |
| error-catalog module | `LICENSE_INTAKE: 815` |
| seeded application name | `license-master`, device `interface`, `allow_all: false`, api_names `['license-intake.push']` |
| system user id | `00000000-0000-4000-8000-00000000a001` |
| system user username | `license-master` |
| system user email | `license-master@system.invalid` |
| system user flags | `is_active: true`, `email_verified_at: now()`, `is_system_account: true` |

### Normalization (spec)
- `ar_number` is `trim().toUpperCase()`.
- Group-code arrays are trimmed, deduped and sorted.
- Dates are `YYYY-MM-DD` calendar days, stored as `00:00:00Z`.
- `end_date` is inclusive, so `end_date === start_date` is valid. `end_date < start_date` is a 400.

### Idempotency (spec)
- `source_sale_id` is unique.
- Same id with the same canonical payload: return `200` with the existing intake, whatever its status.
- Same id with a different payload: `409 LICENSE_INTAKE_SALE_ID_CONFLICT`.
- "Same" is decided by `payload_hash`: sha256 over canonical JSON of the normalized fields in a fixed key order. The fields are `ar_number`, `seats`, `module_group_codes`, `interface_group_codes`, `start_date`, `end_date`, `note`, `customer_hint`.

### Behaviour of a push
- An unknown AR is **not** an error. `customer_id` stays null and the response carries `ar_found: false`.
- Nothing is stored on any 4xx.
- No licence row is ever created by a push.

## Rulings (planner's calls, where the spec is silent)

- **R1 — "sold something":** at least one of these must hold:
  - `seats` ≥ 1
  - a non-empty `module_group_codes`
  - a non-empty `interface_group_codes`

  `seats: 0` alone is `400 LICENSE_INTAKE_NOTHING_SOLD`.
- **R2 — group codes:** a group code must match a live group (`deleted_at IS NULL`) **and** have `is_active = true`. It must also be in the right list: kind `standard` in `module_group_codes`, kind `interface` in `interface_group_codes`. Existing create paths do not check `is_active`. A sale of a retired group should be caught at push time, not at confirm.
- **R3 — table shape:** the intake table has no `deleted_at`. Intakes are never deleted, because reject is a status. That lets `source_sale_id` use a plain `@unique`, with no partial index.
- **R4 — system account hardening:**
  - `tb_user.is_system_account` is added as the spec requires.
  - The micro-business login paths refuse it with the **same** error they give for bad credentials, so they don't reveal that the account exists.
  - Hiding system accounts from user lists is deferred.
- **R5 — binding the system user:** the system user is bound through `tb_application.system_user_id`, which is nullable and an FK to `tb_user`. It is not an env var. The guard refuses any app where the column is null. Per-environment setup is: seed, then rotate the secret, then enable enforcement. No env change is needed.
- **R6 — throttle:** `@Throttle({ default: { ttl: 60_000, limit: 60 } })` on the route, as a code constant.

## Review Focus

1. **The FE app id must not reach the route.** A caller sending only a known FE `x-app-id` (an `allow_all` app with no secret) must get 401 and no row. The same goes for the `license-master` app before secret enforcement is turned on.
2. **Concurrent pushes must not create two rows.** Two pushes of the same new `source_sale_id` racing each other produce one row. The loser gets the `200`-existing answer, not a generic `COMMON_UNIQUE_CONSTRAINT_VIOLATION` 409.
3. **The comparison is on normalized values.** A re-push differing only in AR case or whitespace, or in group-code order or duplicates, is the *same* sale and returns 200. A re-push with a changed `end_date` or `seats` returns 409.
4. **A bad group code stores nothing.** An interface code put in `module_group_codes`, or the other way round, or an inactive or deleted code, returns 400. The error names the offending codes per field, and no row is written.
5. **The system user cannot sign in.** The system user's email is refused by password login, Google login and forgot-password with the ordinary "invalid credentials" style errors. Sign-up with that email must not soft-delete it.

---

### Task 1: Schema, migration, seeds, error catalog

**Files:**
- Modify: `packages/prisma-shared-schema-backstage/prisma/schema.prisma`
  - `tb_user`: add `is_system_account Boolean @default(false)`.
  - `tb_application`: add `system_user_id String? @db.Uuid` plus a relation to `tb_user`.
  - Add model `tb_license_intake` and enum `enum_license_intake_status`.
- Create: `packages/prisma-shared-schema-backstage/prisma/migrations/20261029140000_add_license_intake/migration.sql`. Write it idempotently, in the style of `20261029120000_add_customer`.
- Create: `packages/prisma-shared-schema-backstage/prisma/seed.system-user.ts`.
  - It upserts the system user from Global Constraints by id.
  - On update it re-asserts `is_system_account`, `is_active` and `email_verified_at`.
  - Add a package script `db:seed.system-user`.
- Modify: `packages/prisma-shared-schema-backstage/prisma/seed.application-api.data.ts` and `seed.application-api.ts`.
  - Add the `license-master` entry.
  - Support an optional `system_user_id` on an entry. Set it on create, and on update only when the column is null.
  - Never touch `require_secret` or the secret.
- Modify: `packages/error-catalog/src/module.ts` (add `LICENSE_INTAKE: 815`) and `packages/error-catalog/src/catalog.ts`. Bilingual messages:

| code | http | params |
|---|---|---|
| `LICENSE_INTAKE_SALE_ID_CONFLICT` | 409 | `{ source_sale_id }` |
| `LICENSE_INTAKE_INVALID_GROUP_CODES` | 400 | `{ field, codes, reason }`, where reason is `unknown` \| `wrong_kind` \| `inactive` |
| `LICENSE_INTAKE_NOTHING_SOLD` | 400 | — |
| `LICENSE_INTAKE_DATE_RANGE_INVALID` | 400 | — |
| `LICENSE_INTAKE_CALLER_NOT_ALLOWED` | 401 | — |

**`tb_license_intake` columns:**
- `id` uuid pk `gen_random_uuid()`
- `source_sale_id varchar(128)`, `@unique`
- `ar_number varchar(64)`, normalized
- `customer_id uuid?`, FK `tb_customer`, `ON DELETE SET NULL`
- `customer_hint Json?`
- `seats int?`
- `module_group_codes text[]`, default `{}`
- `interface_group_codes text[]`, default `{}`
- `start_date timestamptz`, `end_date timestamptz`
- `note text?`
- `raw_payload Json`
- `payload_hash char(64)`
- `status enum_license_intake_status`, default `pending`
- `business_unit_id uuid?`, FK `tb_business_unit`
- `confirmed_by_id uuid?`, `confirmed_at timestamptz?`
- `rejected_by_id uuid?`, `rejected_at timestamptz?`, `reject_reason text?`
- `overlap_warning_shown boolean?`
- `doc_version int`, default 0
- `created_at`, `created_by_id` (FK `tb_user`), `updated_at`, `updated_by_id`

**Indexes:** `(status, created_at)` and `(customer_id)`.

**Interfaces:**
- Produces:
  - the Prisma model `tb_license_intake`
  - `tb_application.system_user_id`
  - `tb_user.is_system_account`
  - the `ERROR_CATALOG.LICENSE_INTAKE_*` entries
  - the constant `LICENSE_MASTER_SYSTEM_USER_ID = '00000000-0000-4000-8000-00000000a001'`, exported from `@repo/prisma-shared-schema-backstage` (src/index.ts)

- [ ] **Step 1:** Create the branch with `git checkout -b feature/license-intake-api feature/customer-ar`. Then make the schema and migration edits and run `bunx prisma generate` in the package. Expected: the client generates.
- [ ] **Step 2:** Add the seeds and the catalog entries. Run the error-catalog package's existing spec. Expected: PASS, with uniqueness intact.
- [ ] **Step 3:** Type-check the package and `apps/micro-cluster` (no consumers yet; this is a compile check). Run `bunx eslint` on the changed `.ts` files.
- [ ] **Step 4:** Commit `feat(license-intake): schema, migration, system user + license-master app seeds`.

### Task 2: System accounts cannot sign in (micro-business)

**Files:**
- Modify: `apps/micro-business/src/authen/auth/auth.service.ts`. The recon §5 line numbers are approximate; locate each function by name.
  - `login` (~:361): after the tb_user lookup, refuse when `is_system_account`.
  - `loginWithGoogle` (~:766): refuse when the resolved user `is_system_account`.
  - `forgotPassword` (~:2076): when the user `is_system_account`, return the same success-shaped answer as for an unknown email and send no mail.
  - `resetPassword` / `resetPasswordWithToken` (~:2218, ~:2328): refuse.
  - `refreshToken` (~:1970): refuse when the token's user `is_system_account`.
  - The sign-up / `resolveAddress` path (~:1106–1156): a live system user is never classified as `reclaimable`.

**Interfaces:**
- Consumes: `tb_user.is_system_account` (Task 1).
- Produces: none.

- [ ] **Step 1:** Implement the refusals. Each refusal reuses the error the function already returns for bad credentials, an unknown user or an invalid token. No new message is added.
- [ ] **Step 2:** Type-check `apps/micro-business` (memory: this check-types can OOM, so if exit 137 run it with `NODE_OPTIONS=--max-old-space-size=8192`). Run `bunx eslint` on the file. Run the micro-business auth specs with `bun test` for that folder, or with jest `--runInBand --forceExit`. Expected: pass.
- [ ] **Step 3:** Commit `feat(auth): refuse sign-in for system accounts`.

### Task 3: micro-cluster `license-intake` module + app snapshot

**Files:**
- Create in `apps/micro-cluster/src/cluster/license-intake/`:
  - `license-intake.module.ts`
  - `license-intake.controller.ts`
  - `license-intake.service.ts`
  - `license-intake.normalize.ts`, holding `normalizeIntake(input)` and `payloadHash(normalized)`
  - `interface/license-intake.interface.ts`

  Use `cluster/customer/` as the model.
- Modify: `apps/micro-cluster/src/app.module.ts` to register the module.
- Modify: the application allow-list snapshot builder in micro-cluster (`application.service.ts`, around the snapshot near :975–1010) to include `system_user_id` in each app's snapshot.
- Modify: `packages/rpc-contract`. Regenerate it via `bun run gen:rpc-contract` after writing a temporary literal `@MessagePattern('license-intakes.push')`, then swap the literal for `LicenseIntakes.push.pattern`.

**Interfaces:**
- Consumes: Task 1 model and catalog; `LICENSE_MASTER_SYSTEM_USER_ID` is not needed here, because identity arrives in the payload.
- Produces:
  - RPC `LicenseIntakes.push`. Its payload is `{ data: LicenseIntakePushInput, user_id: string }`. Its response data is `ILicenseIntakePushResult` = `{ id: string; source_sale_id: string; status: 'pending' | 'confirmed' | 'rejected'; customer_id: string | null; ar_found: boolean; created: boolean }`.
  - The handler returns `HttpStatus.CREATED` when `created`, otherwise `HttpStatus.OK`.
  - `LicenseIntakePushInput` = `{ source_sale_id: string; ar_number: string; customer_hint?: { company_name?: string; hotel_name?: string; account_name?: string }; seats?: number; module_group_codes?: string[]; interface_group_codes?: string[]; start_date: string; end_date: string; note?: string }`.
  - The snapshot field `system_user_id: string | null` on each app entry.

- [ ] **Step 1:** Write `normalizeIntake` and `payloadHash`. They are pure: they apply the normalization rules, and the hash is sha256 hex of `JSON.stringify` over an object built in the fixed key order from Global Constraints. Absent optional fields are `null`; empty arrays are `[]`.
- [ ] **Step 2:** Write `LicenseIntakeService.push(input, user_id)` with `@TryCatch`. Order:
  1. Assert the actor: a live `tb_user` with `id = user_id` and `is_system_account = true`. Otherwise return `LICENSE_INTAKE_CALLER_NOT_ALLOWED`.
  2. Normalize. Check R1 (`LICENSE_INTAKE_NOTHING_SOLD`) and the date range (`LICENSE_INTAKE_DATE_RANGE_INVALID`).
  3. Look up an existing row by `source_sale_id`. If the hash is equal, return it with `created: false`. If not, return `LICENSE_INTAKE_SALE_ID_CONFLICT`.
  4. Validate the codes in both arrays against `tb_license_feature_group`, following R2. Return the first failing field as `LICENSE_INTAKE_INVALID_GROUP_CODES` with every offending code for that field and reason.
  5. Resolve `customer_id` from a live `tb_customer` with the normalized `ar_number`.
  6. Create the row with `created_by_id = updated_by_id = user_id` and `raw_payload = input` as received.
  7. On a P2002 for `source_sale_id`, catch it inside the method (not via `@TryCatch`), re-read the row, and apply step 3 again.
- [ ] **Step 3:** Write the controller with `runWithAuditContext` (as in the customer controller). Choose the status from `created`. Write the module and registration. Extend the snapshot.
- [ ] **Step 4:** Run `bun run gen:rpc-contract`, then swap in the generated pattern. Type-check micro-cluster. Run `bunx eslint` on the changed files. Run the micro-cluster jest suite. Expected: pass, except the known `setDefaultTenant` failure.
- [ ] **Step 5:** Commit `feat(license-intake): micro-cluster push with idempotency and code validation`.

### Task 4: Gateway machine guard, route, docs gates

**Files:**
- Create in `apps/backend-gateway/src/license-intakes/`:
  - `license-intake-app.guard.ts`
  - `license-intakes.controller.ts`
  - `license-intakes.service.ts`
  - `license-intakes.module.ts`
  - `swagger/response.ts`
- Create: `apps/backend-gateway/src/common/dto/license-intake/license-intake.dto.ts`.
- Modify:
  - `apps/backend-gateway/src/app.module.ts` (registration)
  - `apps/backend-gateway/src/common/guard/app-allowlist.store.ts`: add `system_user_id` to the stored entry, plus an accessor `getMachineActor(appId)`
  - the refresher, if it maps snapshot fields explicitly
  - `packages/prisma-shared-schema-backstage/prisma/check.api-system-permission-coverage.ts`: add `API_SYSTEM_PERMISSION_ALLOWLIST['POST api-system/license-intakes'] = { reason: 'machine-only intake for the license master; authenticated by LicenseIntakeAppGuard (app secret + explicit grant + bound system user), not by user RBAC' }`
  - `apps/backend-gateway/src/backstage/applications/app-api-catalog.generated.ts`, via `bun run scripts/generate-app-api-catalog/run.ts`

**Interfaces:**
- Consumes: `LicenseIntakes.push` and `ILicenseIntakePushResult` (Task 3); the snapshot `system_user_id` (Task 3).
- Produces: `POST /api-system/license-intakes`.
  - `201` or `200` with body data `ILicenseIntakePushResult`.
  - `400` for zod shape errors, or `LICENSE_INTAKE_*`.
  - `401` for app or secret failures, or `LICENSE_INTAKE_CALLER_NOT_ALLOWED`.
  - `409` for `LICENSE_INTAKE_SALE_ID_CONFLICT`.

- [ ] **Step 1:** Write the DTO (zod v4, `.strict()`). The fields come from `LicenseIntakePushInput`:
  - `source_sale_id`: 1–128 chars, matching `/^[A-Za-z0-9._:\-\/]+$/`
  - `ar_number`: 1–64 chars
  - `customer_hint`: `.strict()` object, each value ≤ 255 chars
  - `seats`: int, 0–100000
  - each code array: ≤ 50 items, each code 1–64 chars
  - `start_date` and `end_date`: `/^\d{4}-\d{2}-\d{2}$/` and a real calendar date
  - `note`: ≤ 2000 chars
  - Add a `.meta` example on each field.
- [ ] **Step 2:** Write `LicenseIntakeAppGuard`, a `CanActivate` used as an **instance**. It must run after `new AppIdGuard('license-intake.push')`, which keeps the one-string-literal form that the catalog regex needs. It reads `x-app-id` and requires all of the following from `appAllowlistStore`:
  - the app state exists
  - `require_secret === true`
  - `allow_all !== true`
  - the app's explicit apis include `license-intake.push`
  - `system_user_id` is non-null

  On any failure it throws `UnauthorizedException`, the same shape AppIdGuard uses for "api not allowed". On success it sets `request.machine_actor = { application_id, user_id: system_user_id }`.
- [ ] **Step 3:** Write the controller:
  - `@Controller('api-system/license-intakes')`, with no `KeycloakGuard`.
  - `@UseGuards(new AppIdGuard('license-intake.push'), new LicenseIntakeAppGuard())`
  - `@Throttle(R6)`
  - `@ApiHeaderRequiredXAppId()` plus an `@ApiHeader({ name: 'x-app-secret', required: true })`
  - `@ApiOperation`, EN + TH, with `operationId: 'licenseIntakePush'`, and response docs for 200/201/400/401/409

  The service calls `rpc.send(LicenseIntakes.push, { data: body, user_id: req.machine_actor.user_id })`. It returns `Result.ok(data)` on 2xx and `Result.fromMicroserviceError` otherwise. The controller then calls `this.respond(res, result, data.created ? HttpStatus.CREATED : HttpStatus.OK)`.
- [ ] **Step 4:** Regenerate the app-api catalog and add the permission-allowlist entry. Type-check the gateway. Run `bunx eslint` on the changed files. Run `bun run gates`. Expected: only the known reds. In particular, audit:api-system-permission, audit:app-api-catalog-drift, audit:rest-contract, audit:tcp-drift, audit:message-pattern-literal and audit:guard-providers must be green.
- [ ] **Step 5:** Commit `feat(license-intake): POST /api-system/license-intakes behind machine guard`.

### Task 5: Contract doc for the license-master team

**Files:**
- Create: `docs/license-intake/README.md` in the backend repo. If the repo keeps API docs elsewhere, put it next to them and note the path in the commit.

- [ ] **Step 1:** Write a short document of about one page, in Thai with English field names. It covers:
  - Auth headers: `x-app-id`, `x-app-secret`, and the 60 s propagation after a rotate.
  - The payload table with limits, taken from the Task 4 DTO.
  - Normalization rules.
  - The idempotency rule, with one 200 example and one 409 example.
  - Every error code with its HTTP status.
  - The rate limit.
  - A note that a push creates no licence: a person confirms each intake in backstage.
  - A `curl` example.
- [ ] **Step 2:** Run `bunx prettier --check` on the file.
- [ ] **Step 3:** Commit `docs(license-intake): intake contract for the license master`.

### Task 6: Manual verification on DEV (for the user, after deploy; not dispatched)

1. Run `db:seed.system-user`, then `db:seed.application-api`. In backstage Applications, open `license-master`, rotate its secret, and turn on enforcement. Wait about 60 s.
2. Send a curl with the FE app id and no secret. Expected: 401. Send a curl as `license-master` without the secret. Expected: 401.
3. Send a valid push. Expected: 201 with `ar_found` true or false. Re-push it with a lower-case AR and the codes reordered. Expected: 200 with the same id. Re-push with `seats + 1`. Expected: 409.
4. Push with an interface code inside `module_group_codes`. Expected: 400, and no row in `tb_license_intake`.
5. Try password login and forgot-password with `license-master@system.invalid`. Expected: the ordinary failure and the ordinary "sent" answer, with no mail.
