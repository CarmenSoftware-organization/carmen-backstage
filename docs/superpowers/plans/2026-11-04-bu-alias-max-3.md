# BU alias ≤ 3 ตัว + ห้ามซ้ำใน cluster (เฟส 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** บังคับให้ alias ของ BU ว่างได้หรือยาว 1–3 ตัวและไม่ซ้ำกันใน cluster, แสดง alias ใน avatar, ตัดข้อมูลเดิมที่ยาวเกินเหลือ 3 ตัว และแสดงรายการที่ตัดแล้วชนกันให้ admin แก้เอง

**Architecture:** backend เป็นคนบังคับกฎตอนเขียน (micro-cluster) และมี RPC ใหม่ `business-units.alias-conflicts` ที่ gateway เปิดเป็น `GET /api-system/business-units/alias-conflicts` ตามขอบเขต `readableClusterScope` ส่วน migration ข้อมูลทำครั้งเดียวด้วย SQL โดยไม่เปลี่ยน schema (column ยังเป็น `VarChar(10)` จนถึงเฟส 2) ฝั่ง frontend ดึงรายการทั้งก้อน (ขนาดจำกัดโดยธรรมชาติ) แล้วกรองตารางใน memory

**Tech Stack:** NestJS + Prisma + zod (BE monorepo, bun) · React + TS + Vite + shadcn (FE, bun)

**Spec:** `docs/superpowers/specs/2026-11-04-bu-alias-avatar-design.md` (อ่านคู่กันเสมอ)

## Global Constraints

- **ไม่เขียนเทสต์ใหม่** (ความชอบของผู้ใช้): ข้ามทุกขั้น "write failing test / run test" แต่ต้องรัน typecheck + lint และเทสต์ชุดเดิมต้องผ่าน
- alias ของ BU: ว่าง (`null`) หรือยาว 1–3 ตัวหลัง trim · เทียบซ้ำแบบ**ไม่สนตัวพิมพ์** · ขอบเขตคือ `cluster_id` เดียวกันและ `deleted_at IS NULL`
- **update:** ตรวจความยาวเฉพาะเมื่อ alias เปลี่ยน, ตรวจซ้ำเมื่อ alias เปลี่ยน **หรือ** `cluster_id` เปลี่ยน (และ alias ไม่ว่าง) — ค่าเดิมยาว 10 ตัวที่ส่งกลับมาเฉย ๆ ต้องผ่าน
- ล้าง alias ได้: ส่ง `''` หรือ `null` → เก็บเป็น `NULL` (ตาม convention เดิมของ cluster-admin form ที่ส่ง `''` เพื่อล้าง)
- รหัส error ใหม่: `BUSINESS_UNIT_ALIAS_TAKEN` (409, `makeId(MODULE.BUSINESS_UNIT, 6)`), `BUSINESS_UNIT_ALIAS_TOO_LONG` (400, `makeId(MODULE.BUSINESS_UNIT, 7)`) — ตรวจว่า 6/7 ยังว่างก่อนใช้
- AppIdGuard ของ route ใหม่ใช้ key เดิม `businessUnit.findAll` **ห้ามตั้ง key ใหม่** (key ที่ไม่อยู่ใน allow-list = 401 = เตะผู้ใช้ออก)
- avatar ของ cluster และ user ไม่แตะ · `tb_cluster.alias_name` ไม่แตะ · `bu_code` ไม่แตะ
- กิ่ง: `feature/bu-alias-max-3` ใน**ทั้งสอง repo** (subagent ต้องได้ชื่อกิ่งนี้ ไม่งั้น commit ลง main) · ห้าม push จนกว่าผู้ใช้สั่ง — push กิ่ง BE ที่มี migration = apply บน DEV ภายใน ~2 นาที
- ข้อความผู้ใช้เห็นต้องมีทั้ง `src/i18n/th.ts` และ `en.ts`

## Review Focus

1. **ย้าย BU ไป cluster อื่นโดยไม่แตะ alias** แล้ว alias ไปชนกับ BU ใน cluster ปลายทาง → ต้องได้ 409 (Task 1)
2. **BU ที่ alias ยาว 10 ตัวค้างอยู่** แก้ชื่อแล้วกด Save ทั้งจากหน้า super admin และ cluster admin → ต้องบันทึกได้ ไม่ใช่ 400 (Task 1 + Task 4)
3. **alias ที่ต่างกันแค่ตัวพิมพ์/ช่องว่าง** (`" bk"` กับ `"BK"`) → นับว่าซ้ำ และเก็บแบบ trim แล้ว (Task 1, Task 3)
4. **backend ยังไม่มี route `alias-conflicts`** (FE ขึ้นก่อน) → แถบไม่แสดง ไม่มี toast error ไม่ 401 (Task 6)
5. **409 alias ซ้ำถูกตีความเป็น doc_version conflict** → ต้องแสดง error ที่ช่อง alias และห้ามเรียก `notifyVersionConflict` (Task 4)

แต่ละข้อมีขั้นตรวจมือในงานที่เป็นเจ้าของ

---

## ไฟล์ที่แตะ

**BE (`carmen-turborepo-backend`)**
- `packages/error-catalog/src/catalog.ts` — 2 รหัสใหม่ (+ `gen:reference` ถ้า reference ต้องตาม)
- `apps/backend-gateway/src/common/dto/business-unit/business-unit.dto.ts:29,:270` — กฎ DTO
- `apps/micro-cluster/src/cluster/business-unit/business-unit-alias.helper.ts` (ใหม่) — normalize + ตรวจ + หา conflict (pure)
- `apps/micro-cluster/src/cluster/business-unit/business-unit.service.ts` — create (~`:240-300`), update (~`:460-600`), `aliasConflicts()` ใหม่ข้าง `businessUnitSummary` (`:1025`)
- `apps/micro-cluster/src/cluster/business-unit/business-unit.controller.ts` — handler ใหม่ข้าง `:129`
- `apps/micro-cluster/src/cluster/business-unit/interface/business-unit.interface.ts:15,:76` — `alias_name?: string | null`
- `packages/rpc-contract/src/contracts/business-units.ts` — generated
- `apps/backend-gateway/src/backstage/backstage_business-units/backstage_business-units.{controller,service}.ts` + `swagger/response.ts`
- `packages/prisma-shared-schema-backstage/prisma/migrations/20261106090000_bu_alias_trim_to_3/migration.sql` (ใหม่)

**FE (`carmen-backstage`)**
- `src/pages/businessUnitEdit/types.ts`, `src/utils/validation.ts`, `src/i18n/{th,en}.ts`
- `src/pages/BusinessUnitEdit.tsx`, `src/pages/clusterAdmin/BusinessUnitForm.tsx`
- `src/components/BrandMark.tsx`, `src/components/BrandingImageUpload.tsx` + call sites ของ BU
- `src/types/index.ts`, `src/services/businessUnitService.ts`
- `src/pages/businessUnitManagement/aliasConflicts.ts` (ใหม่), `src/pages/businessUnitManagement/AliasConflictBanner.tsx` (ใหม่)
- `src/pages/BusinessUnitManagement.tsx`, `src/pages/clusterAdmin/BusinessUnitList.tsx`

---

### Task 1 (BE): กฎตอนเขียน — DTO, error catalog, micro-cluster create/update

**Files:** catalog.ts, business-unit.dto.ts, business-unit-alias.helper.ts (ใหม่), business-unit.service.ts, business-unit.interface.ts

**Interfaces — Produces:**
```ts
// business-unit-alias.helper.ts
export const BU_ALIAS_MAX = 3;
/** trim; '' / whitespace / null → null; undefined → undefined (ไม่แตะ) */
export function normalizeBuAlias(raw: string | null | undefined): string | null | undefined;
/** key สำหรับเทียบซ้ำ: upper(left(trim(alias), 3)) — ใช้ร่วมกับ Task 2 */
export function buAliasKey(alias: string): string;
```

- [ ] **Step 1:** สร้างกิ่ง `git checkout -b feature/bu-alias-max-3` จาก `main` ที่ pull ล่าสุด
- [ ] **Step 2:** เพิ่ม `BUSINESS_UNIT_ALIAS_TAKEN` (409; en `"Another business unit in this cluster already uses this alias"`, th `"alias นี้มี BU อื่นใน cluster เดียวกันใช้อยู่แล้ว"`) และ `BUSINESS_UNIT_ALIAS_TOO_LONG` (400; en `"Alias must be at most 3 characters"`, th `"alias ยาวได้ไม่เกิน 3 ตัวอักษร"`) ใน catalog แล้ว build package (`bun run build:package` ใน `packages/error-catalog` — dist ที่ค้างจะทำให้ tsc เห็นรหัสไม่ครบ)
- [ ] **Step 3:** Gateway DTO
  - create (`:29`): ว่างได้ (`''`/`null`/ไม่ส่ง) หรือ string ที่ trim แล้วยาว 1–3
  - update (`:270`): ว่างได้ (`''`/`null`/ไม่ส่ง) หรือ string ยาวไม่เกิน **10** — ความยาว 3 ตัวบังคับใน micro-cluster เฉพาะเมื่อเปลี่ยน (ค่าเดิมยาวต้องผ่าน DTO ได้)
  - แก้ `.meta` description/example ให้ตรง (`example: 'CBR'` ใช้ได้)
- [ ] **Step 4:** เขียน helper ตาม Interfaces และแก้ interface เป็น `alias_name?: string | null`
- [ ] **Step 5:** micro-cluster **create**: `alias = normalizeBuAlias(data.alias_name)`; ถ้า alias ยาวเกิน 3 → `BUSINESS_UNIT_ALIAS_TOO_LONG`; ถ้าไม่ว่าง → `findFirst({ where: { cluster_id, deleted_at: null, alias_name: { equals: alias, mode: 'insensitive' } } })` เจอ → `BUSINESS_UNIT_ALIAS_TAKEN`; เขียน `alias_name: alias ?? null`
- [ ] **Step 6:** micro-cluster **update**: `next = normalizeBuAlias(data.alias_name)` · `aliasChanged = next !== undefined && next !== businessUnit.alias_name` · `targetCluster = data.cluster_id ?? businessUnit.cluster_id` · `effective = next !== undefined ? next : businessUnit.alias_name`
  - `aliasChanged && next && next.length > 3` → TOO_LONG
  - `effective && (aliasChanged || targetCluster !== businessUnit.cluster_id)` → ตรวจซ้ำใน `targetCluster` (ไม่สนตัวพิมพ์, `deleted_at: null`, `id: { not: data.id }`) เจอ → TAKEN
  - วางการตรวจไว้ก่อน seat guard/transaction เหมือนด่านชื่อซ้ำที่ `:486`; ใน `update` เขียน `alias_name: next` (undefined = ไม่แตะ, null = ล้าง)
- [ ] **Step 7:** ตรวจ path อื่นที่เขียน `alias_name` ของ BU ใน micro-cluster (`grep -n "alias_name" business-unit.service.ts` และ `updateForMember`) — ถ้าเขียนได้ต้องผ่านกฎเดียวกัน
- [ ] **Step 8:** `bun run check-types` ใน `apps/micro-cluster`, `apps/backend-gateway`, `packages/error-catalog` + `bunx eslint <ไฟล์ที่แตะ>` (**ห้าม** `bun run lint` — มี `--fix` เขียนทับทั้ง repo) + jest ของ business-unit เดิมต้องผ่าน (`--runInBand --forceExit`)
- [ ] **Step 9:** Commit `feat(business-unit): alias ยาวไม่เกิน 3 ตัวและห้ามซ้ำใน cluster`

### Task 2 (BE): รายการ alias ที่ต้องแก้ — RPC + gateway route

**Interfaces — Consumes:** `buAliasKey` จาก Task 1
**Produces (wire shape, ทั้ง RPC และ HTTP `data`):**
```ts
interface BuAliasConflict {
  id: string; name: string; code: string;
  cluster_id: string; cluster_name: string;
  alias_name: string;
  reason: 'too_long' | 'duplicate';      // too_long = ยาว > 3, ไม่งั้น duplicate
  truncated_to: string | null;           // left(alias,3) เมื่อ too_long
  conflicts_with: { id: string; name: string; alias_name: string }[];
}
// GET /api-system/business-units/alias-conflicts → { data: BuAliasConflict[] }
```

- [ ] **Step 1:** micro-cluster `aliasConflicts(user_id?: string): Promise<Result<BuAliasConflict[]>>` ข้าง `businessUnitSummary`: ใช้ `readableClusterScope(user_id)` แบบเดียวกัน (`scope.all ? {} : { cluster_id: { in: scope.clusterIds } }`), โหลด BU ที่ `deleted_at: null` และ `alias_name` ไม่ null พร้อม `tb_cluster.name`, จัดกลุ่มด้วย `(cluster_id, buAliasKey(alias))` — แถวที่อยู่ในกลุ่มขนาด ≥ 2 **หรือ** ยาว > 3 ถือเป็นรายการ, `conflicts_with` = สมาชิกอื่นของกลุ่ม เรียงตาม cluster_name แล้ว name; ใส่ใน helper เป็น pure function `findBuAliasConflicts(rows)` เพื่อให้ตรรกะอยู่ที่เดียว
- [ ] **Step 2:** controller handler ด้วย `@MessagePattern({ cmd: 'business-units.alias-conflicts', service: 'micro-cluster' })` ชั่วคราว → `bun run gen:rpc-contract` → แทนด้วย `BusinessUnits.aliasConflicts.pattern` (ทำตาม 3 ขั้นที่หัวไฟล์ contract)
- [ ] **Step 3:** gateway `@Get('alias-conflicts')` วาง**เหนือ** `@Get(':business_unit_id')` (เหตุผลเดียวกับ `summary` ที่ `:138`), `@UseGuards(new AppIdGuard('businessUnit.findAll'))`, ส่งต่อ `user_id` (ห้ามหลุด — `undefined` = เห็นทุก cluster), swagger response DTO + `operationId: 'backstageBusinessUnit_aliasConflicts'`; service method ลอกรูปจาก `getBusinessUnitSummary`
- [ ] **Step 4:** รัน `bun run scripts/generate-app-api-catalog/run.ts` แล้ว audit ทั้ง 9 ตัว:
  ```bash
  for a in tcp-drift env-drift api-system-permission license-catalog app-api-catalog-drift \
           rest-contract message-pattern-literal guard-providers bu-scope-guard; do
    printf "%-28s " "$a"; bun run "audit:$a" >/dev/null 2>&1 && echo PASS || echo FAIL
  done
  ```
  Expected: PASS ทั้ง 9 (ถ้า FAIL ตัวใดเป็นของเดิมบน main ให้รายงาน ไม่ต้องแก้)
- [ ] **Step 5:** check-types + eslint ไฟล์ที่แตะ + commit `feat(business-unit): endpoint รายการ alias ที่ต้องแก้`

### Task 3 (BE): migration ข้อมูล

**File:** `packages/prisma-shared-schema-backstage/prisma/migrations/20261106090000_bu_alias_trim_to_3/migration.sql` (timestamp ต้องมากกว่า `20261105090000`; schema.prisma **ไม่เปลี่ยน**)

- [ ] **Step 1:** เขียน SQL ตามรูปไฟล์ migration ข้างเคียง (คอมเมนต์ไทย/อังกฤษ, idempotent — รันซ้ำแล้วไม่เปลี่ยนอะไรเพิ่ม):
  ```sql
  -- 1. trim; ว่าง/ช่องว่างล้วน → NULL (ทุกแถว รวมที่ลบแล้ว)
  UPDATE "tb_business_unit" SET "alias_name" = NULLIF(btrim("alias_name"), '')
  WHERE "alias_name" IS NOT NULL AND "alias_name" IS DISTINCT FROM NULLIF(btrim("alias_name"), '');

  -- 2. แถวที่ยังไม่ลบ: ตัดเหลือ 3 เฉพาะแถวที่ key upper(left(alias,3)) ไม่ซ้ำกับใครใน cluster
  WITH live AS (
    SELECT "id", "cluster_id", "alias_name", upper(left("alias_name", 3)) AS k
    FROM "tb_business_unit" WHERE "deleted_at" IS NULL AND "alias_name" IS NOT NULL
  ), grp AS (SELECT "cluster_id", k, count(*) AS n FROM live GROUP BY "cluster_id", k)
  UPDATE "tb_business_unit" b SET "alias_name" = left(b."alias_name", 3)
  FROM live l JOIN grp g ON g."cluster_id" = l."cluster_id" AND g.k = l.k
  WHERE b."id" = l."id" AND length(l."alias_name") > 3 AND g.n = 1;

  -- 3. แถวที่ลบแล้วไม่นับเป็นคู่ชน → ตัดได้เลย (เตรียมเฟส 2 VarChar(3))
  UPDATE "tb_business_unit" SET "alias_name" = left("alias_name", 3)
  WHERE "deleted_at" IS NOT NULL AND length("alias_name") > 3;
  ```
  (key ของข้อ 2 ครอบทั้งกรณี "ตัดแล้วตรงกับ alias สั้นที่มีอยู่" และ "สองแถวยาวตัดแล้วตรงกัน" — แถวในกลุ่มที่ n ≥ 2 คงค่าเดิมและจะโผล่ใน Task 2)
- [ ] **Step 2:** ลองรันบน DB local (หรือ `BEGIN; … ROLLBACK;` บน DEV โดยผู้ใช้อนุญาต) นับก่อน/หลัง:
  `SELECT count(*) FILTER (WHERE length(alias_name) > 3) FROM tb_business_unit WHERE deleted_at IS NULL;`
  Expected: หลังรัน = จำนวนแถวที่ Task 2 คืน `reason: 'too_long'`
- [ ] **Step 3:** Commit `chore(db): ตัด alias ของ BU ที่ยาวเกินเหลือ 3 ตัว (ยกเว้นตัวที่ชนกัน)` — **ห้าม push** จนกว่าผู้ใช้สั่ง

### Task 4 (FE): กฎ 1–3 ตัวในฟอร์ม + ล้างค่าได้ + 409 alias ซ้ำ

**Files:** `businessUnitEdit/types.ts`, `utils/validation.ts`, `BusinessUnitEdit.tsx`, `clusterAdmin/BusinessUnitForm.tsx`, i18n

- [ ] **Step 1:** สร้างกิ่ง `feature/bu-alias-max-3` ใน `carmen-backstage`
- [ ] **Step 2:** `BU_ALIAS_MAX = 3` และแก้ JSDoc ที่อธิบาย VarChar(10) ให้ตรง (column ยัง 10 จนถึงเฟส 2 แต่กฎคือ 3) — จะยุบ `aliasBound` หรือไม่เป็นดุลยพินิจ; อัปเดตข้อความ i18n ของ alias ให้บอก "1–3 ตัว"
- [ ] **Step 3:** `BusinessUnitEdit.tsx`
  - `validateRequired` (`:565`): ตรวจ alias เฉพาะเมื่อ `formData.alias_name !== savedFormData.alias_name` และไม่ว่าง
  - `buildPayload`: ถ้า alias ไม่เปลี่ยนจาก `savedFormData` → **ไม่ส่ง** `alias_name`; ถ้าเปลี่ยนเป็น `''` → ส่ง `alias_name: ''`
  - catch (`:640-670`): `status === 409 && code === 'BUSINESS_UNIT_ALIAS_TAKEN'` → `fieldErrors.alias_name = t('pages.businessUnits.aliasTakenError')` และใช้ข้อความนี้ใน `setError` แทน message ดิบ (แบบเดียวกับ `isDuplicateName`); ยืนยันว่า `isVersionConflict` (`utils/docVersion.ts:27`) คืน false สำหรับรหัสนี้
- [ ] **Step 4:** `clusterAdmin/BusinessUnitForm.tsx`
  - ถอด `alias_name` ออกจาก `NOT_CLEARABLE_KEYS` (และลบคีย์ i18n `pages.clusterAdmin.aliasCannotBeCleared` ถ้าไม่มีที่ใช้อื่น) + แก้คอมเมนต์ swagger เก่า (`:42-46`)
  - `buildPayload` (`:449`): alias ที่ไม่อยู่ใน `changed` → ไม่ส่ง; validate onBlur ของ alias ต้องไม่ค้าง error กับค่าเดิมที่ยาวเกินถ้าผู้ใช้ไม่ได้แก้
  - catch (`:501`): 409 `BUSINESS_UNIT_ALIAS_TAKEN` → error ที่ช่อง alias
- [ ] **Step 5:** i18n th/en: `pages.businessUnits.aliasTakenError` (th `"alias นี้มี BU อื่นใน cluster เดียวกันใช้อยู่แล้ว"`, en `"Another business unit in this cluster already uses this alias"`)
- [ ] **Step 6:** `bun run typecheck && bun run lint && bun run test` — Expected: ผ่าน (แก้ assertion ของเทสต์เดิมที่อ้าง "1-10" ให้ตรงกฎใหม่ได้)
- [ ] **Step 7:** ตรวจมือ (Review Focus 2, 5): BU ที่ alias ยาว 10 ตัว → แก้ชื่อ → Save ผ่าน, ทั้ง `/business-units/:id/edit` และ `/cluster-admin/:clusterId/business-units/:buId/edit`; ล้าง alias → Save → reload แล้วว่าง
- [ ] **Step 8:** Commit `feat(bu-edit): alias ของ BU 1-3 ตัว ล้างได้ และแจ้งเมื่อซ้ำใน cluster`

### Task 5 (FE): avatar แสดง alias

**Interfaces — Produces:**
```ts
// BrandMark.tsx
export const brandInitials: (name?: string, code?: string, alias?: string | null) => string;
// alias.trim() ไม่ว่าง → alias.trim().slice(0, 3).toUpperCase(); ไม่งั้นกฎเดิม
// BrandMarkProps เพิ่ม alias?: string | null ; BrandingImageUpload เพิ่ม fallbackAlias?: string | null
```

- [ ] **Step 1:** แก้ `brandInitials`/`BrandMark` ตาม Interfaces; เมื่อผลยาว 3 ตัวให้ใช้ขนาดตัวอักษรเล็กลงหนึ่งขั้นต่อ size (`xs` 24px ต้องไม่ล้น/ไม่ถูกตัด) — เพิ่ม map ข้าง `SIZES`; อัปเดต JSDoc "Two-character identity token"
- [ ] **Step 2:** ส่ง alias ของ BU ทุกจุด: `BusinessUnitManagement.tsx:279` (`row.original.alias_name`), `BusinessUnitDocument.tsx:210` (`brandInitials(f.name, f.code, f.alias_name)`), `BusinessUnitBrandingCard.tsx:40`, `ClusterBuDocument.tsx:186` (ผ่าน `fallbackAlias`) — **ไม่แตะ** call site ของ cluster/user/app
- [ ] **Step 3:** typecheck + lint + test
- [ ] **Step 4:** ตรวจมือ: แถวตาราง BU ที่ alias 3 ตัว (`xs`) และหัวหน้าแก้ BU — วัด `scrollWidth <= clientWidth` ของ fallback ในเบราว์เซอร์ ไม่ใช่ดูด้วยตา
- [ ] **Step 5:** Commit `feat(brand-mark): avatar ของ BU แสดง alias`

### Task 6 (FE): แถบเตือน + ตัวกรองบน `/business-units`

**Interfaces — Consumes:** wire shape `BuAliasConflict` จาก Task 2
**Produces:**
```ts
// src/types/index.ts
export interface BuAliasConflict { /* ตาม Task 2, ทุกฟิลด์ตามสาย */ }
// businessUnitService
getAliasConflicts: () => Promise<BuAliasConflict[]>;   // 404 → [] (BE ยังไม่ขึ้น)
// src/pages/businessUnitManagement/aliasConflicts.ts
export function aliasConflictReason(c: BuAliasConflict, t: TFn): string;
export function useAliasConflicts(clusterId?: string): { conflicts: BuAliasConflict[]; loading: boolean };
// src/pages/businessUnitManagement/AliasConflictBanner.tsx
export function AliasConflictBanner(props: { count: number; active: boolean; onToggle: () => void }): JSX.Element | null;
```

- [ ] **Step 1:** type + service + `aliasConflictReason`:
  - `too_long` + มี `conflicts_with` → `"ตัดเหลือ {truncated} แล้วชนกับ {names}"` / `"Trimmed to {truncated}, clashes with {names}"`
  - `too_long` + ไม่มี → `"ยาวเกิน 3 ตัว"` / `"Longer than 3 characters"`
  - `duplicate` → `"ซ้ำกับ {names}"` / `"Same as {names}"` — `{names}` = `name (alias)` คั่นด้วย `, `
- [ ] **Step 2:** `useAliasConflicts`: โหลดครั้งเดียวตอน mount, race guard ตาม `agent-os/standards/hooks/`, error ใด ๆ → `[]` + `devLog` (ไม่ toast — แถบนี้เป็นของเสริม); `clusterId` ระบุ → กรอง `cluster_id === clusterId`
- [ ] **Step 3:** `AliasConflictBanner`: คืน `null` เมื่อ `count === 0`; ใช้ token `--warning` (ห้ามสีดิบ), ข้อความ `"{count} BU มี alias ที่ต้องแก้ (ยาวเกิน 3 ตัว หรือซ้ำใน cluster)"` + ปุ่ม `"ดูรายการ"` / `"แสดงทั้งหมด"` ตาม `active`; ใช้ได้ที่ 390px
- [ ] **Step 4:** `BusinessUnitManagement.tsx`: วางแถบใต้ `<BuSummary>` (`:421`); `?alias=conflicts` ใน URL คือสถานะ active; เมื่อ active ให้แสดง `DataTable` แบบ client-side ของ conflicts (คอลัมน์ Name+avatar+link `/business-units/:id/edit`, Cluster, Alias mono, "ต้องแก้เพราะ") แทนตาราง server-side — คอลัมน์ใน `useMemo`; ถ้าออกจากโหมดหรือ conflicts กลายเป็น 0 ให้ลบ param
- [ ] **Step 5:** typecheck + lint + test
- [ ] **Step 6:** ตรวจมือ (Review Focus 4): ชี้ backend ที่ยังไม่มี route → แถบไม่แสดง, ไม่มี toast, ไม่ถูก logout
- [ ] **Step 7:** Commit `feat(bu-list): แถบเตือน alias ที่ต้องแก้ พร้อมตัวกรอง`

### Task 7 (FE): แถบเดียวกันในหน้า BU ของ cluster admin

**Consumes:** `useAliasConflicts(clusterId)`, `AliasConflictBanner`, `aliasConflictReason` จาก Task 6

- [ ] **Step 1:** `clusterAdmin/BusinessUnitList.tsx`: แถบใต้ `PageHeader` (`:279`), `?alias=conflicts`, ตาราง conflicts ลิงก์ไป `/cluster-admin/:clusterId/business-units/:id/edit` (ไม่ใช่ `/business-units/...` — cluster admin ถูก bounce)
- [ ] **Step 2:** typecheck + lint + test
- [ ] **Step 3:** ตรวจมือด้วยบัญชี cluster admin: เห็นเฉพาะ cluster ตัวเอง, 390px, TH/EN
- [ ] **Step 4:** Commit `feat(cluster-admin): แถบเตือน alias ที่ต้องแก้ในหน้า BU`

### ปิดงาน

- [ ] Commit spec + plan นี้ในกิ่ง FE (`docs(spec): BU alias ≤ 3 ตัว`)
- [ ] `trail check` ทั้งสอง repo
- [ ] รายงานผู้ใช้: ลำดับ deploy **BE ก่อน FE**, migration จะ apply บน DEV ทันทีที่ push กิ่ง BE, และผลกับใบ PO (`bu_alias_name` สั้นลง) — รอผู้ใช้สั่ง push/PR
