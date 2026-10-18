# License hard delete + soft delete/restore Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **User preference (overrides TDD):** skip all "write failing test / run tests" steps. Do NOT create `*.spec.ts` / `*.test.ts`. Each task = implement → typecheck + lint → commit. Manual verification (curl / browser) happens in Task 9. Existing suites must still pass before merge.

**Goal:** superadmin ลบใบ license ที่ลบแบบซ่อน/ยกเลิกแล้วได้ถาวรโดยเลขใบไม่ถูกออกซ้ำ · ทุกชนิดใบลบแบบซ่อนและกู้คืนได้

**Architecture:** ตารางใหม่ `tb_license_number_retired` ใน platform schema เก็บเลขของใบที่ลบถาวร; `nextLicenseNumber` ทั้ง 5 จุดอ่านเลขจากตารางนี้เพิ่ม ·
แต่ละ micro service (micro-cluster ×3 ชนิด, micro-business subscription) ได้ handler `listDeleted` / `restore` / `hardDelete` ·
gateway เพิ่ม route ต่อชนิด: `GET .../deleted` + `DELETE .../:id/hard` ใต้ `PlatformSuperAdminGuard`, `POST .../:id/restore` ใต้ `subscription.manage` ·
FE (carmen-platform) เพิ่มสวิตช์ "แสดงใบที่ลบแล้ว" (superadmin) ที่สลับไปตาราง `DeletedLicenseTable` ตัวใหม่ + dialog พิมพ์เลขยืนยัน

**Tech Stack:** NestJS + Prisma 7 (backend-v2 monorepo, bun/turbo) · React + Vite + TanStack Table (carmen-platform)

**Spec:** `carmen-platform/docs/superpowers/specs/2026-10-18-license-hard-delete-design.md`

**Repos / branches:** `carmen-turborepo-backend-v2` → `feature/license-hard-delete` (Tasks 1–5) · `carmen-platform` → `feature/license-hard-delete` (มีแล้ว, Tasks 6–8)

## Global Constraints

- ลบถาวรได้เฉพาะแถวที่ `deleted_at IS NOT NULL` หรือ (bu-quota) `cancelled_at IS NOT NULL` — แถว active → 409 `LICENSE_HARD_DELETE_ACTIVE`
- ลบถาวร + ดูรายการที่ลบแล้ว = `PlatformSuperAdminGuard` เท่านั้น · ลบแบบซ่อน + กู้คืน = `@RequirePlatformPermission('subscription.manage')`
- เลขที่เคยออกห้ามออกซ้ำตลอดไป · insert `tb_license_number_retired` กับ delete แถวใบต้องอยู่ใน `$transaction` เดียวกัน
- ตัวออกเลขอ่าน **ตารางใบก่อน แล้วค่อยอ่านตารางเลข** (ลำดับนี้กันการแข่งกันโดยไม่ต้อง lock)
- ใบ bu-quota ที่ยกเลิก: กู้คืนไม่ได้, คงอยู่ใน list ปกติ, superadmin เห็นปุ่มลบถาวรบนแถว
- ห้ามแก้ partial unique index เดิม · ห้ามแก้ไฟล์ generated ด้วยมือ (`rpc-contract/src/contracts/*`, `app-api-catalog.generated.ts`) — ใช้ `bun run gen:rpc-contract` / `bun run scripts/generate-app-api-catalog/run.ts`
- ข้อความ UI ใหม่ต้องมีทั้ง `src/i18n/en.ts` และ `th.ts`
- Commit message ภาษาไทย (conventional prefix อังกฤษ), merge แบบ merge commit ห้าม squash
- ลำดับ deploy: migration platform → เติม allowlist `api_name` ใหม่ทุก env (หรือยืนยัน `allow_all`) → BE → FE · dev DB ใช้ร่วมกัน ต้อง backup + ขออนุมัติก่อนรัน migration

## Review Focus

1. **ข้อมูลเก่าที่เลขซ้ำ** — ลบถาวรใบที่สองที่เลขซ้ำกับใบแรกที่ลบไปแล้วต้องสำเร็จ (unique คือ `(license_number, original_id)`); กู้คืนใบที่เลขชนใบ active → 409 `LICENSE_RESTORE_CONFLICT` ไม่ใช่ 500 จาก partial index
2. **ยิง API ตรงโดยไม่ใช่ superadmin** — `DELETE .../:id/hard` และ `GET .../deleted` ต้อง 403 แม้ผู้ใช้มี `subscription.manage` (Platform Admin)
3. **ลบถาวร subscription ที่มีลูกหลาย BU** — ลูก `_bu_group` → `_bu` ถูกลบหมด (รวมลูกที่ถูกลบแบบซ่อนไว้ก่อนแยกต่างหาก) ไม่ค้างและไม่ติด FK
4. **กู้คืน subscription** — กู้เฉพาะลูกที่ `deleted_at` + `deleted_by_id` ตรงกับแม่เป๊ะ; ลูกที่ถูกเอาออกก่อนหน้าต้องยังลบอยู่
5. **parent ถูกลบไปแล้ว** — กู้คืนใบของ BU/cluster ที่ `deleted_at` ไม่ว่าง หรือ interface ที่กลุ่มถูกลบ/ไม่ใช่ kind `interface` → 409 `LICENSE_RESTORE_CONFLICT` พร้อมเหตุผล

ทั้ง 5 ข้อตรวจด้วยมือใน Task 9 (ตามข้อตกลงไม่เขียนเทสต์)

---

### Task 1: ตารางเลขที่เคยออก + ตัวออกเลขอ่านตารางนี้ (backend-v2)

**Files:**
- Modify: `packages/prisma-shared-schema-platform/prisma/schema.prisma` (เพิ่ม model ต่อท้ายกลุ่ม license ใกล้ `tb_cluster_license` :1353)
- Create: `packages/prisma-shared-schema-platform/prisma/migrations/20261018130000_license_number_retired/migration.sql`
- Modify: `packages/prisma-shared-schema-platform/src/license-number.ts`, `src/index.ts:188`
- Modify call sites: `apps/micro-business/src/subscription/subscription.service.ts:509`, `apps/micro-cluster/src/cluster/cluster/cluster.service.ts:281`, `.../business-unit-interface-license/business-unit-interface-license.service.ts:433`, `.../cluster-license/cluster-license.service.ts:255`, `.../business-unit-license/business-unit-license.service.ts:239`

**Interfaces:**
- Produces: model `tb_license_number_retired { id uuid pk default gen_random_uuid(); license_number varchar; kind varchar /* 'SUB'|'SEAT'|'BUQ'|'INF' */; original_id uuid; business_unit_id uuid?; cluster_id uuid?; snapshot Json; deleted_by_id uuid?; deleted_at timestamptz default now() }`
  `@@unique([license_number, original_id], map: "license_number_retired_number_original_u")` · `@@index([license_number], map: "license_number_retired_number_idx")` · ไม่มี FK (แถวเดิมหายไปแล้ว)
- Produces: `export async function readRetiredLicenseNumbers(tx: { tb_license_number_retired: { findMany: ... } }, prefixWithMonth: string): Promise<string[]>` ใน `license-number.ts` + export จาก `index.ts`
  (ใช้ type ของ Prisma client/tx ของ platform schema ที่ไฟล์ข้าง ๆ ใช้อยู่ — ดูวิธีที่ `bu-quota.ts`/`seat-pool.ts` รับ client)

- [ ] **Step 1:** เพิ่ม model ใน `schema.prisma` ตาม Interfaces พร้อม doc comment ไทยว่ามีไว้กันการออกเลขซ้ำ ไม่ใช่ทางกู้คืน และทำไม unique เป็นคู่ (เลขซ้ำในข้อมูลเก่า + เลขพิมพ์มือ `SUB-2608-0002-EXTRA`)
- [ ] **Step 2:** เขียน `migration.sql` ด้วยมือ (CREATE TABLE + unique + index) ให้ตรงกับ model — ตามแบบ migration ล่าสุด `20261018120000_move_external_interface_under_export`; **ห้ามรันกับ dev DB** ใน task นี้
- [ ] **Step 3:** เพิ่ม `readRetiredLicenseNumbers` แล้วแก้ทั้ง 5 call site ให้ callback คืน `[...rowsFromLicenseTable, ...await readRetiredLicenseNumbers(tx, withMonth)]` — อ่านตารางใบก่อนเสมอ; อัปเดต doc comment ของ `nextLicenseNumber` ว่า `readSameMonth` ต้องรวมตารางเลขด้วย
- [ ] **Step 4:** `cd packages/prisma-shared-schema-platform && bun run db:generate && bun run build` แล้ว `bun run typecheck`/`tsc --noEmit` ของ micro-cluster + micro-business — Expected: ไม่มี error
- [ ] **Step 5:** Commit `feat(license): ตารางเลขใบที่ลบถาวร + ตัวออกเลขนับเลขจากตารางนี้`

### Task 2: Error catalog + micro-cluster handlers (seat, bu-quota, interface)

**Files:**
- Modify: `packages/error-catalog/src/catalog.ts` (ต่อจาก `LICENSE_ALREADY_CANCELLED` :518)
- Modify: `apps/micro-cluster/src/cluster/business-unit-license/business-unit-license.{service,controller}.ts`
- Modify: `apps/micro-cluster/src/cluster/cluster-license/cluster-license.{service,controller}.ts`
- Modify: `apps/micro-cluster/src/cluster/business-unit-interface-license/business-unit-interface-license.{service,controller}.ts`
- Regenerate: `packages/rpc-contract/src/contracts/{business-unit-licenses,cluster-licenses,business-unit-interface-licenses}.ts`

**Interfaces:**
- Produces catalog entries (module 211):
  - `LICENSE_HARD_DELETE_ACTIVE` id 6, 409, en `'Only a deleted or cancelled licence can be permanently deleted'`, th `'ลบถาวรได้เฉพาะใบที่ถูกลบหรือยกเลิกแล้ว'`
  - `LICENSE_RESTORE_CONFLICT` id 7, 409, en `'This licence cannot be restored: {reason}'`, th `'กู้คืนใบนี้ไม่ได้: {reason}'`
- Produces ต่อ service (ชื่อเดียวกันทั้งสาม):
  - `listDeleted(paginate: any, userId?: string): Promise<Result<unknown>>` — รูปเดียวกับ `listPlatform` (paginate + `paginate` meta) แต่ where `deleted_at: { not: null }` แทน `deleted_at: null`; เรียงตาม `deleted_at desc`; แต่ละแถวมี `deleted_at`, `deleted_by_id` (audit enrich ที่ gateway)
  - `restore(id: string, userId?: string): Promise<Result<{ id: string }>>` — หาแถวที่ `deleted_at: { not: null }` (ไม่พบ → NOT_FOUND); ตรวจ: parent (BU/cluster) `deleted_at: null`, ไม่มีแถว active อื่นที่ `license_number` เดียวกัน, (interface) กลุ่มผ่าน `assertInterfaceGroup` (:250); ไม่ผ่าน → `LICENSE_RESTORE_CONFLICT` พร้อม `{ reason }`; ผ่าน → `deleted_at: null, deleted_by_id: null, updated_by_id: userId`
  - `hardDelete(id: string, userId?: string): Promise<Result<{ id: string; license_number: string }>>` — หาแถว (ไม่กรอง deleted_at); ไม่พบ → NOT_FOUND; active (`deleted_at` null และ — bu-quota — `cancelled_at` null) → `LICENSE_HARD_DELETE_ACTIVE`; ใน `$transaction`: create `tb_license_number_retired` (`kind` = `SEAT`/`BUQ`/`INF`, `snapshot` = แถวเต็ม, owner id ตามชนิด) แล้ว `delete`
  - bu-quota: `restore` ปฏิเสธแถวที่ `cancelled_at` ไม่ว่างแต่ `deleted_at` ว่าง ด้วย NOT_FOUND (ไม่ใช่ใบที่ลบ) — uncancel ไม่มี
- Produces RPC patterns: `<service>.list-deleted`, `<service>.restore`, `<service>.hard-delete` (เช่น `cluster-licenses.hard-delete`) — controller payload `{ id, user_id }` / `{ paginate, user_id }` ตามแบบ handler `delete` / `listPlatform` เดิม
  - หมายเหตุ: `cluster-licenses.delete` เดิมรับ `cluster_id` ด้วย — handler ใหม่สามตัวรับแค่ `id` (route ใหม่อยู่ใต้ `/platform/...`)

- [ ] **Step 1:** เพิ่ม catalog entries ทั้งสอง
- [ ] **Step 2:** เพิ่ม 3 methods ใน service ทั้งสาม (ใช้ `@TryCatch`, `isNonEmptyString` guard แบบ `delete` เดิม)
- [ ] **Step 3:** เพิ่ม `@MessagePattern` ด้วย literal ชั่วคราว → `bun run gen:rpc-contract` → แทนที่ด้วย `ClusterLicenses.hardDelete.pattern` ฯลฯ (ขั้นตอนตาม header ของไฟล์ contract)
- [ ] **Step 4:** build `packages/error-catalog` + `packages/rpc-contract` (dist) แล้ว typecheck + `bunx eslint` ไฟล์ที่แก้ใน micro-cluster — Expected: ผ่าน
- [ ] **Step 5:** Commit `feat(license): micro-cluster รายการใบที่ลบ/กู้คืน/ลบถาวร ของ seat bu-quota interface`

### Task 3: micro-business subscription handlers

**Files:**
- Modify: `apps/micro-business/src/subscription/subscription.{service,controller}.ts`
- Regenerate: `packages/rpc-contract/src/contracts/subscription.ts`

**Interfaces:**
- Consumes: catalog entries จาก Task 2, `tb_license_number_retired` จาก Task 1
- Produces: `listDeleted(paginate: any, userId?: string)`, `restore(id: string, userId: string)`, `hardDelete(id: string, userId: string)` + patterns `subscription.list-deleted` / `.restore` / `.hard-delete` (ใช้ชื่อ service ใน contract เดิม)
  - `restore`: ตรวจ cluster `deleted_at: null`, ไม่มีสัญญา active เลขเดียวกัน, BU ของลูกที่จะกู้ยัง `deleted_at: null`; ใน `$transaction` กู้แม่ + `tb_subscription_bu` ที่ `subscription_id = id AND deleted_at = parent.deleted_at AND deleted_by_id = parent.deleted_by_id` + `tb_subscription_bu_group` ของ BU เหล่านั้นด้วยเงื่อนไขเวลา/ผู้ลบเดียวกัน (ตรงกับที่ `delete()` :719 เขียน `now` ค่าเดียว)
  - `hardDelete`: แถวต้อง `deleted_at` ไม่ว่าง (subscription ไม่มี cancel) ไม่งั้น `LICENSE_HARD_DELETE_ACTIVE`; ใน `$transaction`: อ่านลูกทั้งหมด (ไม่กรอง deleted_at) → create retired (`kind: 'SUB'`, `cluster_id`, `snapshot` = `{ subscription, business_units: [...], groups: [...] }`) → `deleteMany` `_bu_group` → `deleteMany` `_bu` → `delete` subscription

- [ ] **Step 1:** implement 3 methods + MessagePattern (literal → gen → reference)
- [ ] **Step 2:** typecheck + eslint micro-business — Expected: ผ่าน
- [ ] **Step 3:** Commit `feat(subscription): รายการสัญญาที่ลบ/กู้คืน/ลบถาวร พร้อมแถวลูก`

### Task 4: Gateway routes + api catalog

**Files:**
- Modify: `apps/backend-gateway/src/platform/platform_business-unit-licenses/*` · `platform_cluster-licenses/*` · `platform_business-unit-interface-licenses/*` · `platform_subscriptions/*` (controller + service + swagger response DTO)
- Regenerate: `apps/backend-gateway/src/platform/applications/app-api-catalog.generated.ts`

**Interfaces:**
- Consumes: RPC patterns จาก Task 2–3
- Produces routes บน controller `api-system/platform/...` (ตัวที่มี `listPlatform`, เช่น `platform_cluster-licenses.controller.ts:333`) — **FE Task 6 ใช้ path เหล่านี้ตรงตัว**:

| ชนิด | base | list deleted | restore | hard delete |
|---|---|---|---|---|
| seat | `/api-system/platform/business-unit-licenses` | `GET /deleted` | `POST /:id/restore` | `DELETE /:id/hard` |
| bu-quota | `/api-system/platform/cluster-licenses` | `GET /deleted` | `POST /:id/restore` | `DELETE /:id/hard` |
| interface | `/api-system/platform/interface-licenses` | `GET /deleted` | `POST /:id/restore` | `DELETE /:id/hard` |
| subscription | `/api-system/platform/subscriptions` | `GET /deleted` | `POST /:id/restore` | `DELETE /:id/hard` |

  - `GET /deleted` ต้องประกาศ **ก่อน** `GET /:id` ใน controller (ไม่งั้น `deleted` ไปชน `ParseUUIDPipe`)
  - api_name: `<module>.listDeleted` / `.restore` / `.hardDelete` (module เดิม เช่น `clusterLicense`, ดูชื่อจาก `app-api-catalog.generated.ts:1110`)
  - guards: list/hard → `@UseGuards(new AppIdGuard('…'), PlatformSuperAdminGuard)`; restore → `@UseGuards(new AppIdGuard('…'), PlatformPermissionGuard)` + `@RequirePlatformPermission('subscription.manage')`
  - `@EnrichAuditUsers` บน list deleted ให้ได้ชื่อผู้ลบ (ดูว่า `listPlatform` ตัวเดิมใช้ paths อะไร — ใช้แบบเดียวกัน)
  - ตรวจว่า `PlatformSuperAdminGuard` ถูก provide ใน module ของแต่ละ controller (ดู `platform-super-admins` module)

- [ ] **Step 1:** เพิ่ม routes + service passthrough + swagger (`operationId` เช่น `clusterLicense_hardDelete`)
- [ ] **Step 2:** `bun run scripts/generate-app-api-catalog/run.ts` แล้ว `bun run audit:app-api-catalog-drift` — Expected: ไม่มี drift
- [ ] **Step 3:** รัน `bun run db:check.endpoint-permission` และ `db:check.api-system-permission` ใน `packages/prisma-shared-schema-platform` — ถ้ารายงาน route ใหม่ที่ใช้ super-admin guard ให้ลงทะเบียนตามที่ checker ต้องการ (ไม่ข้าม)
- [ ] **Step 4:** typecheck + eslint gateway — Expected: ผ่าน
- [ ] **Step 5:** Commit `feat(gateway): route รายการใบที่ลบ/กู้คืน/ลบถาวร ทั้ง 4 ชนิด (ลบถาวรเฉพาะ superadmin)`

### Task 5: Backend PR

- [ ] **Step 1:** รัน jest ของ gateway, micro-cluster, micro-business (ใช้ jest ไม่ใช่ `bun test`) — Expected: เขียวเท่ากับ main
- [ ] **Step 2:** push + เปิด PR (body อังกฤษ) ระบุ: migration `20261018130000_license_number_retired`, api_name ใหม่ 12 ตัวที่ต้องเติม allowlist, ลำดับ deploy, ยังไม่รัน migration กับ env ใด

### Task 6: FE services + type-to-confirm dialog (carmen-platform)

**Files:**
- Modify: `src/services/businessUnitLicenseService.ts`, `clusterLicenseService.ts`, `businessUnitInterfaceLicenseService.ts`, `subscriptionService.ts`
- Create: `src/components/TypeToConfirmDialog.tsx`
- Modify: `src/i18n/en.ts`, `src/i18n/th.ts`

**Interfaces:**
- Produces (ทั้ง 4 service, path จากตาราง Task 4):
  `listDeleted(paginate?: PaginateParams): Promise<…same response type as listPlatform…>` · `restore(id: string): Promise<unknown>` · `hardDelete(id: string): Promise<unknown>`
- Produces: `TypeToConfirmDialog(props: { open: boolean; onOpenChange(open: boolean): void; title: string; description: string; confirmValue: string; confirmLabel: string; busy: boolean; onConfirm(): void })` — ปุ่มยืนยัน disabled จนกว่า input `=== confirmValue` (trim ไม่ได้); ปิดไม่ได้ระหว่าง busy; ล้างค่า input เมื่อปิด; ล้อ markup ของ `UserManagement.tsx:837-880` (ไม่ต้องย้าย UserManagement มาใช้ — YAGNI)
- Produces i18n keys ใต้ `pages.licenses.deleted.*`: `toggle` ("แสดงใบที่ลบแล้ว"/"Show deleted"), `empty`, `deletedAt`, `deletedBy`, `restore`, `restoreConfirm`, `restored`, `hardDelete`, `hardDeleteTitle`, `hardDeleteWarning` (ระบุว่าย้อนไม่ได้ และเลขนี้จะไม่ถูกออกซ้ำ), `hardDeleteType` (ให้พิมพ์เลขใบ), `hardDeleted`, `softDelete`, `softDeleteConfirm`
  — **ห้ามมี `{`/`}` หรือ `<คำ>` ในข้อความ** นอกจาก placeholder ที่ระบบ i18n ของรีโปนี้รองรับ (ตรวจรูปแบบ placeholder จาก key ที่มีอยู่ใน `en.ts`)

- [ ] **Step 1:** implement services, dialog, i18n
- [ ] **Step 2:** `bun run typecheck && bun run lint` — Expected: ผ่าน
- [ ] **Step 3:** Commit `feat(licenses): service ใบที่ลบ/กู้คืน/ลบถาวร + dialog พิมพ์ยืนยัน`

### Task 7: มุมมองใบที่ลบแล้ว + ปุ่มลบถาวรของ bu-quota ที่ยกเลิก

**Files:**
- Create: `src/pages/licenses/DeletedLicenseTable.tsx`
- Modify: `src/pages/licenses/LicenseCenter.tsx` (สวิตช์ + สลับตาราง :169-180)
- Modify: `src/pages/licenses/PurchaseLicenseTable.tsx` (คอลัมน์ action สำหรับ bu-quota ที่ `cancelled`)

**Interfaces:**
- Consumes: services + `TypeToConfirmDialog` จาก Task 6; `useAuth().isSuperAdmin`; `<Can permission="subscription.manage">`
- Produces: `DeletedLicenseTable(props: { kind: 'subscription' | 'seat' | 'bu-quota' | 'interface' })` — คอลัมน์: เลขใบ, เจ้าของ (BU/cluster), ช่วงวันที่, ลบเมื่อ, ลบโดย, actions (กู้คืนใต้ `<Can permission="subscription.manage">`, ลบถาวรเห็นเมื่อ `isSuperAdmin`); ใช้ `DataTable` + pagination แบบเดียวกับ `PurchaseLicenseTable`; หลังสำเร็จ toast + reload; error 409 แสดงข้อความจาก catalog
- LicenseCenter: สวิตช์แสดงเฉพาะ `isSuperAdmin` และเฉพาะแท็บ subscription/seat/bu-quota/interface (ไม่ใช่ cluster); เปิดแล้ว render `DeletedLicenseTable` แทนตารางปกติ; จำค่าสวิตช์ต่อแท็บใน URL query (`deleted=1`) ไม่ใช่ localStorage
- PurchaseLicenseTable: เมื่อ `config.kind === 'bu-quota' && isSuperAdmin` เพิ่มคอลัมน์ action ท้ายตาราง แสดงปุ่มลบถาวรเฉพาะแถว status `cancelled`; ไม่แสดงคอลัมน์นี้กับผู้ใช้อื่น (คอลัมน์ลำดับ +1 ที่ :639 ต้องนับให้ถูก)

- [ ] **Step 1:** implement
- [ ] **Step 2:** `bun run typecheck && bun run lint` — Expected: ผ่าน
- [ ] **Step 3:** Commit `feat(licenses): มุมมองใบที่ลบแล้วสำหรับ superadmin พร้อมกู้คืน/ลบถาวร`

### Task 8: ปุ่มลบแบบซ่อนให้ interface + subscription

**Files:**
- Modify: `src/pages/licenses/LicensePurchaseForm.tsx` (ข้างปุ่ม cancel :1117-1150 — แสดงเมื่อ `config.kind === 'interface'` และเป็นหน้าแก้ไข)
- Modify: `src/pages/licenses/SubscriptionForm.tsx` (ในบล็อก `<Can permission="subscription.manage">` :568 — เฉพาะหน้าแก้ไข)
- Modify: `src/pages/licenses/SubscriptionTable.tsx:453` (แก้ comment B2#1 ให้ตรงความจริงใหม่: ลบได้จากหน้าแก้ไข, มองเห็น/กู้คืนได้ที่มุมมองใบที่ลบแล้ว)

**Interfaces:**
- Consumes: `businessUnitInterfaceLicenseService.delete(buId, id)` (มีอยู่แล้ว), `subscriptionService.delete` (มีอยู่แล้ว :109), `ConfirmDialog`
- ลบสำเร็จ → toast `pages.licenses.deleted.softDelete…` → navigate กลับ list ของแท็บนั้น

- [ ] **Step 1:** implement (ใต้ `<Can permission="subscription.manage">` + `ConfirmDialog`)
- [ ] **Step 2:** `bun run typecheck && bun run lint && bun run test` — Expected: ผ่าน (`SubscriptionForm.test.tsx`/`SubscriptionTable.test.tsx` เดิมต้องยังเขียว)
- [ ] **Step 3:** Commit `feat(licenses): ลบแบบซ่อนได้จากหน้าแก้ไขใบ interface และสัญญา`

### Task 9: ตรวจด้วยมือ + FE PR

ทำหลังได้อนุมัติให้รัน migration บน dev (backup ก่อน, dev DB ใช้ร่วมกัน) และ deploy/รัน BE ในเครื่องชี้ local

- [ ] **Step 1:** ด้วย curl (ตัวแปร shell สำหรับ token — ห้ามใส่ token จริงในไฟล์): ตรวจ Review Focus 1–5 + ลบถาวรใบ active → 409 + สร้างใบใหม่หลังลบถาวรเลขล่าสุดของเดือน → ได้เลขถัดไป ไม่ใช่เลขเดิม
- [ ] **Step 2:** เบราว์เซอร์ `http://localhost:3304/licenses`: superadmin เห็นสวิตช์/ปุ่ม, Platform Admin ไม่เห็น; dialog พิมพ์ผิดกดไม่ได้; ทั้ง light/dark
- [ ] **Step 3:** push + เปิด FE PR (อังกฤษ) ระบุว่า BE ต้อง deploy ก่อน และ api_name ใหม่ต้องอยู่ใน allowlist ก่อน deploy FE ไม่งั้นผู้ใช้โดน 401 หลุดออกจากระบบ
