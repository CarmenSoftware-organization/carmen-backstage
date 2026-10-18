# ลบใบ license ถาวร (hard delete) + ลบแบบซ่อน/กู้คืน ครบทุกชนิด

วันที่: 2026-10-18 · รีโป: `carmen-platform` (หน้า `/licenses`) + `carmen-turborepo-backend-v2`

## เจตนา

ทีมออกใบ license ทดสอบไว้จำนวนมากจนหน้า `/licenses` รก ต้องการทางล้างใบทดสอบออกจากระบบถาวร
โดยให้ทำได้เฉพาะ **superadmin** และไม่ทำลายความถูกต้องของระบบเลขใบ

## สิ่งที่ตัดสินแล้ว (โดย user)

1. **ลบถาวรได้ทุกชนิดใบ** ในหน้า `/licenses` — subscription (`SUB-`), seat (`SEAT-`),
   bu-quota (`BUQ-`), interface (`INF-`) · แท็บ "cluster" เป็นรายการ cluster ไม่ใช่แถวใบ จึงไม่เกี่ยว
2. **ลบถาวรได้เฉพาะใบที่ถูกลบแบบซ่อน (`deleted_at` ไม่ว่าง) หรือถูกยกเลิก (`cancelled_at` ไม่ว่าง — มีเฉพาะ bu-quota)**
   ใบที่ยังใช้งานอยู่ลบถาวรไม่ได้ — backend ต้องปฏิเสธ ไม่ใช่แค่ซ่อนปุ่ม
3. **เฉพาะ superadmin** (`tb_platform_super_admin`) — ไม่ใช่ `subscription.manage`
4. **ห้ามใช้เลขใบซ้ำตลอดไป** — ตอนลบถาวรให้บันทึกเลขไว้ใน **ตารางแยก** และตัวออกเลข (`nextLicenseNumber`)
   ต้องนับเลขจากตารางนั้นด้วย
5. **เพิ่มปุ่มลบแบบซ่อนให้ interface และ subscription** (ตอนนี้ UI ไม่มี — interface มี endpoint แต่ไม่มีผู้เรียก,
   subscription เคยมีแล้วถูกถอดออกตาม review B2#1 เพราะ "ลบแล้วมองไม่เห็น/ย้อนไม่ได้")
6. **มีปุ่มกู้คืน** สำหรับใบที่ลบแบบซ่อน — ซึ่งปิดเหตุผลของ B2#1 ทั้งสองข้อ

## เป้าหมาย / ไม่ใช่เป้าหมาย / ห้ามเกิด

**เป้าหมาย:** superadmin เห็นใบที่ลบ/ยกเลิกแล้ว แล้วกู้คืนหรือลบถาวรได้ทีละใบ · ทุกชนิดใบลบแบบซ่อนได้

**ไม่ใช่เป้าหมาย:** ลบหลายใบพร้อมกัน · uncancel ใบ bu-quota (ตั้งใจไม่มีทางกลับตาม schema comment — คงไว้)
· ลบถาวรใบ active · แก้ cache 60 วิของ gateway

**ห้ามเกิด (ถึงจะ "ใช้ได้" ก็ถือว่าล้มเหลว):**
- เลขใบที่เคยออกถูกออกซ้ำ
- ผู้ใช้ที่ไม่ใช่ superadmin ลบถาวรได้ด้วยการยิง API ตรง
- ลบถาวรใบ active ได้ (BU เสียสิทธิ์ทันที)
- subscription ลบถาวรแล้วทิ้งแถวลูก (`tb_subscription_bu`, `tb_subscription_bu_group`) ค้าง หรือลบล้มกลางทางเพราะ FK

## สภาพปัจจุบัน (อ้างอิง)

| ชนิด | ตาราง | soft delete ฝั่ง BE | ปุ่มใน UI | gateway DELETE |
|---|---|---|---|---|
| subscription | `tb_subscription` → `_bu` → `_bu_group` | `micro-business/src/subscription/subscription.service.ts:719` (cascade ในทรานแซกชัน) | ไม่มี (ถอดตาม B2#1, `SubscriptionTable.tsx:453`) | `platform_subscriptions.controller.ts:374` |
| seat | `tb_business_unit_license` | `micro-cluster/.../business-unit-license.service.ts:370` | `sections/SeatSection.tsx:130` | `platform_business-unit-licenses.controller.ts:228` |
| bu-quota | `tb_cluster_license` (+ `cancelled_at`) | `micro-cluster/.../cluster-license.service.ts:405` | `sections/BuQuotaSection.tsx:366` + ปุ่มยกเลิกใน `LicensePurchaseForm.tsx:1117` | `platform_cluster-licenses.controller.ts:228` |
| interface | `tb_business_unit_interface_license` | `micro-cluster/.../business-unit-interface-license.service.ts:541` | ไม่มี | `platform_business-unit-interface-licenses.controller.ts:236` |

- DELETE ทุกเส้นใช้ `KeycloakGuard` + `AppIdGuard` + `PlatformPermissionGuard` + `@RequirePlatformPermission('subscription.manage')`
- ทุกรายการกรอง `deleted_at: null` — ใบที่ลบแล้วไม่มีทางแสดงผล
- ตัวออกเลขจงใจนับแถวที่ลบแบบซ่อนรวมด้วย (`business-unit-license.service.ts:235`, interface `:429`, subscription `:509`)
  เพื่อไม่ให้เลขซ้ำ — hard delete จะทำลายข้อนี้ถ้าไม่มีตารางเลข
- เลขใบ unique ด้วย partial index `WHERE deleted_at IS NULL` เท่านั้น
- ไม่มีตารางใดมี FK ชี้มาที่สามตารางใบซื้อ; ความสัมพันธ์ทั้งหมด `onDelete: NoAction`
- superadmin: `tb_platform_super_admin`, guard `auth/guards/platform-super-admin.guard.ts` (`PlatformSuperAdminGuard`),
  FE `isSuperAdmin` จาก `context/AuthContext.tsx:341`
- ต้นแบบ UX ยืนยันแบบพิมพ์ชื่อ: hard delete user ใน `pages/UserManagement.tsx:837-880`
- gateway cache ผล license 60 วิต่อ instance (`backend-gateway/src/license/license.service.ts:18`) — การกู้คืน/ลบมีผลช้าสุด 60 วิ ยอมรับได้

## การออกแบบ

### 1. ตารางเลขที่เคยออก (platform schema)

ตารางใหม่ เช่น `tb_license_number_retired` (ชื่อเป็น call ของ builder) เก็บเลขของใบที่ถูก **ลบถาวร**:
`license_number`, ชนิด (`SUB`/`SEAT`/`BUQ`/`INF`), `original_id` ของแถวเดิม,
`business_unit_id`/`cluster_id` เท่าที่มี, `deleted_by_id`, `deleted_at`, และ snapshot JSON ของแถวเดิม
(รวมแถวลูกของ subscription) — *call ของผม:* เพื่อให้ตอบได้ว่า "ใบที่หายไปคืออะไร ใครลบ" โดยไม่ต้องมีทางกู้จากตารางนี้

- unique บน `(license_number, original_id)` ไม่ใช่ `license_number` เดี่ยว — *call ของผม:* ข้อมูลเก่ามีเลขซ้ำกันได้ในแถวที่ลบแบบซ่อน
  (partial index บังคับแค่แถว active, และมีเลขพิมพ์มือแบบ `SUB-2608-0002-EXTRA`) unique เดี่ยวจะทำให้ลบถาวรใบซ้ำใบที่สองไม่ได้
  ตารางนี้มีไว้กันการ *ออก* เลขซ้ำ ไม่ได้ต้องการให้เลขในตารางนี้ไม่ซ้ำกันเอง
- ไม่ต้อง backfill — ตัวออกเลขยังนับแถวในตารางใบเดิม (รวมที่ลบแบบซ่อน) **บวก** แถวในตารางนี้
- `nextLicenseNumber` มี **5** จุดเรียก (รวม `micro-cluster/src/cluster/cluster/cluster.service.ts:281` ที่ออกเลข BUQ ใบแรกตอนสร้าง cluster)
  ทุกจุดต้องรวมเลขจากตารางนี้ (กรองตาม prefix + เดือนเหมือนเดิม)
- insert แถวนี้กับ delete แถวใบต้องอยู่ใน **ทรานแซกชันเดียวกัน**
- กันเลขซ้ำตอนทำพร้อมกัน: ไม่มี constraint คร่อมสองตาราง ตัวออกเลขต้องอ่าน **ตารางใบก่อน แล้วค่อยอ่านตารางเลข**
  (ลำดับนี้ปลอดภัยโดยไม่ต้อง lock เพราะ hard delete เขียนตารางเลขและลบแถวใบใน commit เดียว) + retry P2002 เดิมยังอยู่

### 2. Backend endpoints (gateway `/api-system/...`)

ต่อชนิดใบ เพิ่ม:
- **list ใบที่ลบ/ยกเลิกแล้ว** — เช่น query `?state=deleted` บน list endpoint เดิม หรือ endpoint แยก (call ของ builder)
  คืนเฉพาะแถวที่ `deleted_at` ไม่ว่าง — **superadmin เท่านั้น**
  (ใบ bu-quota ที่ยกเลิกยังอยู่ใน list ปกติเหมือนเดิม ไม่ย้าย — ตัดสินโดย user)
- **restore** `POST .../:id/restore` — ล้าง `deleted_at`/`deleted_by_id` · สิทธิ์ `subscription.manage`
  (*call ของผม:* สิทธิ์เดียวกับลบแบบซ่อน — คนที่ลบได้ก็ควรย้อนได้)
  - ต้องผ่านการตรวจแบบเดียวกับตอนสร้าง (BU/cluster ยังอยู่, ช่วงวันที่/กลุ่มชนกับใบ active หรือไม่ ฯลฯ เท่าที่ create ตรวจ)
    ไม่ผ่าน → 409 พร้อมเหตุผล แถวยังลบอยู่
  - subscription: กู้แถวลูก `_bu`/`_bu_group` ที่ถูกลบมาพร้อมกันในการลบครั้งนั้นด้วย (ไม่กู้ลูกที่ถูกลบก่อนหน้าแยกต่างหาก)
    ระบุลูกด้วย `deleted_at` + `deleted_by_id` ที่ตรงกับแม่เป๊ะ (soft delete ที่ `subscription.service.ts:719` เขียนค่าเดียวกันในครั้งเดียว)
  - เลขของใบที่จะกู้ตอนนี้เป็นของใบ active อื่นอยู่ (ข้อมูลเก่าที่ซ้ำ) → 409 ไม่กู้
  - ใบ bu-quota ที่ **ยกเลิก** (ไม่ได้ลบ) กู้คืนไม่ได้ — คงกติกาเดิม
- **hard delete** `DELETE .../:id/hard` (ล้อ `DELETE /api-system/user/:user_id/hard`) — `PlatformSuperAdminGuard`
  - ปฏิเสธ (409) ถ้าแถวยัง active (ไม่ถูกลบและไม่ถูกยกเลิก)
  - subscription: ลบ `_bu_group` → `_bu` → `tb_subscription` ในทรานแซกชันเดียว
  - บันทึกเลขลงตารางเลขที่เคยออก (ข้อ 1) ในทรานแซกชันเดียวกัน

เพิ่ม RPC contract ใน `packages/rpc-contract/src/contracts/*` ตามแบบที่มีอยู่

**`api_name` ใหม่ต้องเข้า app-id allowlist ก่อน deploy FE** (กับดักเดิม: allowlist ที่ไม่เติม = 401 = ผู้ใช้หลุด)

### 3. ลบแบบซ่อนให้ interface + subscription (FE)

endpoint มีครบแล้ว — เพิ่มปุ่มใน UI ใต้ `<Can permission="subscription.manage">` พร้อม `ConfirmDialog`
ตำแหน่ง: แบบเดียวกับ seat/bu-quota (หน้าแก้ไขใบ / section) — call ของ builder

### 4. มุมมองใบที่ลบ/ยกเลิกแล้ว (FE `/licenses`)

- แท็บ subscription / seat / bu-quota / interface มีสวิตช์ "แสดงใบที่ลบแล้ว" — **เห็นเฉพาะ `isSuperAdmin`**
  (*call ของผม*)
- เปิดแล้วตารางแสดงเฉพาะใบที่ลบแบบซ่อน (ไม่ปนกับ active) พร้อมป้าย "ลบแล้ว" + ใคร/เมื่อไร
- ต่อแถว: ปุ่ม **กู้คืน** และ **ลบถาวร**
- **ใบ bu-quota ที่ยกเลิก คงอยู่ในตารางปกติเหมือนเดิม** (ผู้มี `subscription.manage` ยังเห็น — ตัดสินโดย user)
  แถวที่ยกเลิกมีปุ่ม **ลบถาวร** เพิ่ม เห็นเฉพาะ `isSuperAdmin` · สวิตช์ของแท็บ bu-quota แสดงเฉพาะใบที่ลบแบบซ่อน
- ลบถาวร: dialog พิมพ์เลขใบให้ตรงก่อนปุ่มจะกดได้ (ต้นแบบ `UserManagement.tsx:837-880`) พร้อมคำเตือนว่าย้อนไม่ได้
  และเลขนี้จะไม่ถูกออกซ้ำ · *call ของผม:* ทำเป็น prop ใหม่ของ `components/ui/confirm-dialog.tsx` หรือคอมโพเนนต์แยก — call ของ builder
- ข้อความใหม่ทั้งหมดผ่าน i18n (en/th)

## ข้อจำกัด

- ลำดับ deploy: migration platform → allowlist `api_name` ใหม่ → BE → FE
- dev DB ใช้ร่วมกัน — backup ก่อนรัน migration และก่อนทดสอบ hard delete กับข้อมูลจริง
- ห้ามแก้ partial unique index เดิม

## ปล่อยให้ builder ตัดสิน

ชื่อตาราง/คอลัมน์/endpoint · รูปแบบ list ของใบที่ลบ (query param หรือ endpoint แยก) · ตำแหน่งปุ่มลบแบบซ่อน ·
โครงสร้างคอมโพเนนต์ dialog · รายละเอียด snapshot JSON
