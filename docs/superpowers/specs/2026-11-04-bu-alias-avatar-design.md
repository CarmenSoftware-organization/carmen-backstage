# BU alias เป็นตัวอักษรใน avatar: ยาวไม่เกิน 3 ตัว และห้ามซ้ำใน cluster

วันที่: 2026-11-04 · repo: `carmen-turborepo-backend` (BE) + `carmen-backstage` (FE)

## เจตนา

`alias_name` ของ business unit เปลี่ยนจาก "ชื่อย่อสำหรับรายงาน ยาวไม่เกิน 10 ตัว" มาเป็น
**ตัวอักษรที่แสดงใน avatar ของ BU** ซึ่งต้องสั้นพอใส่ในวงกลมเล็ก ๆ และต้องไม่ซ้ำกับ BU อื่นใน
cluster เดียวกัน ไม่งั้น avatar สองตัวในรายการจะแยกกันไม่ออก

ส่วน `bu_code` ยังเป็นค่าที่กรอกได้ครั้งเดียวตอนสร้าง และห้ามแก้หลังจากนั้น งานนี้ไม่ได้เปลี่ยนกฎนี้
แค่ยืนยันว่ากฎยังใช้ได้จริง

## กฎ (ผู้ใช้กำหนด)

1. `alias_name` ของ BU **ว่างได้** หรือยาว **1, 2 หรือ 3 ตัวอักษร**
2. alias **ห้ามซ้ำกันใน cluster เดียวกัน** ส่วน BU ที่อยู่คนละ cluster ใช้ alias เดียวกันได้
3. ข้อมูลเดิมที่ยาวเกิน 3 ตัว ให้ **ตัดเหลือ 3 ตัวแรก**
4. ถ้าตัดแล้ว **ชนกับ BU อื่น** ใน cluster เดียวกัน ระบบไม่ตัดสินแทน แต่แสดงรายการให้ admin แก้เอง
5. คนแก้รายการได้ทั้ง **super admin** ที่หน้า `/business-units` (เห็นทุก cluster) และ **cluster admin**
   ที่หน้า BU ของ cluster ตัวเอง (`/cluster-admin/:clusterId/business-units`) โดย cluster admin
   เห็นเฉพาะ cluster ตัวเอง
6. รูปแบบรายการคือ **แบบ A** (ผู้ใช้เลือกจาก mockup) มีแถบเตือนใต้ summary บอกจำนวน BU ที่ต้องแก้
   และปุ่ม "ดูรายการ" กดแล้วตารางเดิมจะกรองเหลือเฉพาะ BU ที่ต้องแก้ พร้อมคอลัมน์ "ต้องแก้เพราะ" เช่น
   "ตัดเหลือ BKK แล้วชนกับ Bangkok Sukhumvit" หรือ "ซ้ำกับ Phuket Town (PK)" แถบนี้หายเองเมื่อไม่มี
   BU ที่ต้องแก้เหลืออยู่

## เป้าหมาย / ไม่ใช่เป้าหมาย / ห้ามเกิด

**เป้าหมาย**
- ทุกช่องทางที่เขียน alias ของ BU (สร้างหรือแก้ ทั้งจาก super admin และ cluster admin) บังคับกฎ 1–2
  ที่ backend
- avatar ของ BU แสดง alias
- ข้อมูลเดิมเข้ากฎได้โดยไม่มีใครเสีย alias ไปเงียบ ๆ

**ไม่ใช่เป้าหมาย**
- alias ของ **cluster** (`tb_cluster.alias_name`, `VarChar(3)`) ไม่เปลี่ยนกฎ และไม่เพิ่มกฎห้ามซ้ำ
- avatar ของ cluster และของ user (`Layout.tsx:128`) ไม่แตะ
- ไม่ทำให้ `bu_code` แก้ได้

**ห้ามเกิด** (ถ้าเกิดถือว่าล้มเหลวแม้ระบบจะทำงานได้)
- migration ตัด alias แล้วทำให้สอง BU ใน cluster เดียวกันกลายเป็น alias เดียวกัน
- migration ล้ม หรือ deploy ไม่ขึ้น เพราะใส่ unique index ขณะที่ยังมีข้อมูลซ้ำอยู่
- BU ที่ alias ยังผิดกฎบันทึกฟิลด์อื่นไม่ได้เลยจนกว่าจะแก้ alias (การ์ดใดใช้ `InlineField` ต้องบันทึกได้
  ถ้าไม่ได้แตะ alias) — *การตัดสินใจของผม ดูหัวข้อ "การตัดสินใจที่ผมเลือกเอง"*

## สถานะปัจจุบัน (ตรวจแล้ว 2026-11-04)

- DB: `tb_business_unit.alias_name String? @db.VarChar(10)`
  (`packages/prisma-shared-schema-backstage/prisma/schema.prisma:221`) และยังไม่มี unique index
  บน alias
- Gateway DTO: ทั้งตอนสร้างและแก้ใช้ `z.string().min(1).max(10).optional()`
  (`apps/backend-gateway/src/common/dto/business-unit/business-unit.dto.ts:29`, `:270`) ซึ่งเพิ่งแก้ใน
  BE PR #997
- micro-cluster เขียน `alias_name: data.alias_name` ตรง ๆ ทั้ง create (`business-unit.service.ts:264`)
  และ update (`:584`)
- `bu_code` ล็อกไว้แล้ว: ตอน update ฝั่ง BE เขียน `code: businessUnit.code` (ค่าเดิมเสมอ, `:579`)
  และฝั่ง FE `BusinessUnitEdit.tsx:533` `delete payload.code` ส่วนหน้าแก้แสดง code เป็น
  `StaticValue` (`BusinessUnitDocument.tsx:287`)
- FE: `BU_ALIAS_MAX = 10` และ `aliasBound` (`src/pages/businessUnitEdit/types.ts`), `validateField('alias_name')`
  (`src/utils/validation.ts:110`, ค่า default 3 สำหรับ cluster) และตอน Save
  `BusinessUnitEdit.tsx:565` ตรวจ alias ที่ไม่ว่าง
- Avatar: `BrandMark` → `brandInitials(name, code)` (`src/components/BrandMark.tsx:19`) ใช้ code ก่อน
  แล้วค่อย name และให้ผลยาว 2 ตัวเสมอ BU ใช้ `BrandMark` ที่ `BusinessUnitManagement.tsx:279`,
  `Sidebar.tsx`, `Layout.tsx:235` และหัวหน้าแก้ `BusinessUnitDocument.tsx:210`
- ผู้ใช้ alias อื่น: `purchase-order.service.ts:6258` ส่ง `bu_alias_name` ออกไปกับเอกสาร PO
  **ถ้าตัด alias เหลือ 3 ตัว ใบ PO ที่ออกหลังจากนี้จะแสดง alias ที่สั้นลง** ข้อนี้ผู้ใช้รับทราบแล้ว
- ฟอร์ม BU ของ cluster admin: `src/pages/clusterAdmin/businessUnitForm/ClusterBuDocument.tsx`

## ทำแบบไหน

### เฟส 1 ทำตอนนี้

**BE**
1. Gateway DTO (create และ update): alias ว่างได้ หรือยาว 1–3 ตัว ต้องยังคงล้างค่า alias ได้
   (ส่ง `null` หรือ `''`) และ builder ต้องตรวจว่าตอนนี้ FE ล้าง alias ด้วยรูปแบบไหน
2. micro-cluster create/update: ตรวจว่ามี BU อื่นใน `cluster_id` เดียวกันที่ `alias_name` ตรงกันแบบไม่สน
   ตัวพิมพ์ และ `deleted_at IS NULL` หรือไม่ ถ้ามีตอบ **409** พร้อมรหัส error ที่ FE แยกออกจาก
   doc_version conflict ได้ (doc_version ก็ใช้ 409) **กรณี update ต้องตรวจเฉพาะเมื่อ alias เปลี่ยนจากค่าเดิม**
   เพื่อให้ BU ที่ alias ผิดกฎค้างอยู่ยังบันทึกฟิลด์อื่นได้ และใช้กฎเดียวกับความยาว: ถ้า alias
   ไม่เปลี่ยน ไม่ต้องตรวจความยาว (ค่าเดิมยาว 10 ตัวต้องผ่านได้)
3. Migration ข้อมูล: ตัด alias เหลือ 3 ตัวแรก **เฉพาะ** แถวที่ตัดแล้วไม่ชนกับ alias ของ BU อื่นใน cluster
   เดียวกัน ทั้ง alias ปัจจุบันของตัวอื่นและ alias ที่ตัวอื่นจะได้หลังตัด (ไม่สนตัวพิมพ์) แถวที่ชนกันให้คงค่าเดิมไว้
   และ trim ช่องว่าง โดยให้ alias ที่เป็นช่องว่างล้วนกลายเป็น `NULL`
4. Endpoint หรือ filter สำหรับ "alias ที่ต้องแก้": คืน BU ที่ (ก) alias ยาวเกิน 3 ตัว หรือ (ข) alias ซ้ำกับ
   BU อื่นที่ยังไม่ถูกลบใน cluster เดียวกัน (ไม่สนตัวพิมพ์) พร้อมเหตุผลและ BU ที่ชนด้วย
   ใช้ขอบเขตสิทธิ์เดียวกับรายการ BU ปกติ คือ super admin เห็นทุก cluster และ cluster admin เห็นเฉพาะ
   cluster ตัวเอง จำนวนรวมต้องไปแสดงในแถบเตือนได้ เช่นเพิ่มใน `summary` ของ list หรือแยกเป็น endpoint
   ของตัวเอง ให้ builder เลือก
   *ข้อควรรู้:* list BU ใช้ `QueryParams` ของ micro-cluster ซึ่งปฏิเสธบางคีย์สำหรับผู้เรียกที่ไม่ใช่ระดับ
   backstage (learning 2026-10-29) ถ้าทำเป็น filter บน list ต้องทดสอบด้วยสิทธิ์ cluster admin
5. ทุก endpoint ใหม่ต้องผ่าน audit gate ของ backend-v2 เช่น app-api-catalog และ api-system-permission

**FE**
1. `BU_ALIAS_MAX` = 3 (ตอนนี้ใช้ค่าเท่ากับ cluster ได้แล้ว จะรวม `aliasBound` ทิ้งหรือไม่ให้ builder เลือก)
   และอัปเดต i18n ทั้ง th และ en
2. ตอน Save บน `BusinessUnitEdit` และ `ClusterBuDocument`: ตรวจความยาวเฉพาะเมื่อ alias **เปลี่ยน**
   จากค่าที่บันทึกไว้ (ตรงกับข้อ BE 2) และเมื่อได้ 409 alias ซ้ำ ให้แสดง error ที่ช่อง alias และต้องไม่ไปเรียก
   `notifyVersionConflict()`
3. Avatar ของ BU ใช้ลำดับ: รูปที่อัปโหลด → `alias_name` (ตัวพิมพ์ใหญ่) → `brandInitials` แบบเดิม
   ทุกจุดที่แสดง avatar ของ BU ต้องส่ง alias ไปด้วย และถ้าเป็น alias 3 ตัว ต้องใส่ขนาด `xs` (24px) ได้
   โดยไม่ล้นหรือถูกตัด
4. แถบเตือนแบบ A บน `/business-units` และ `/cluster-admin/:clusterId/business-units` มีจำนวน BU, ปุ่ม
   "ดูรายการ" ที่กรองตาราง, คอลัมน์เหตุผล และแต่ละแถวพาไปหน้าแก้ BU นั้น เป็นไปตาม
   Management page pattern (`agent-os/standards/pages/management-page.md`) แถบนี้ไม่แสดงเมื่อจำนวนเป็น 0
   หรือ backend ยังไม่ส่งข้อมูลนี้มา (ให้ FE deploy ก่อน BE ได้โดยไม่พัง)
5. สถานะของตัวกรองควรอยู่ใน URL (เช่น `?alias=conflicts`) เพื่อให้ refresh แล้วยังอยู่ ให้ builder เลือกชื่อ param เอง

### เฟส 2 ทำเมื่อรายการว่างทุก environment

- Migration: เปลี่ยน column เป็น `VarChar(3)` และเพิ่ม unique index บน `(cluster_id, lower(alias_name))`
  แบบ partial `WHERE alias_name IS NOT NULL AND deleted_at IS NULL`
- ถอดกฎ "ไม่ตรวจถ้า alias ไม่เปลี่ยน" ออก และให้ P2002 กลายเป็น 409 แบบเดียวกับข้อ BE 2
- **ห้ามรวมเฟส 2 ไว้ในกิ่งเดียวกับเฟส 1** เพราะ migrate deploy จะลง migration ทั้งชุด
  (memory: `reference_prisma_migrate_deploy_applies_pending_set`)
- เฟส 2 เป็นแผนแยกต่างหาก ยังไม่ต้องวางแผนตอนนี้ แต่เฟส 1 ต้องไม่ทำอะไรที่ขวางเฟส 2

## ลำดับ deploy

BE (DTO + 409 + migration ข้อมูล + endpoint รายการ) → FE ถ้า FE ขึ้นก่อน หน้าจอจะยอมให้กรอก alias สั้นลง
ซึ่งไม่มีปัญหา และแถบเตือนก็จะไม่แสดง จึงไม่เกิดอะไรพัง แต่อย่าลืมว่าเมื่อ push กิ่งที่มี migration
migration จะ apply บน DEV ภายในประมาณ 2 นาที (memory: `reference_migration_applied_without_merge`)

## การตัดสินใจที่ผมเลือกเอง (ตรวจดูได้)

- ตรวจซ้ำแบบ**ไม่สนตัวพิมพ์** (`bk` = `BK`) เพราะใน avatar แสดงเป็นตัวพิมพ์ใหญ่
- เวลาเก็บค่า เก็บตามที่ผู้ใช้กรอก แต่ avatar แสดงเป็นตัวพิมพ์ใหญ่
- BU ที่ถูก soft-delete ไม่นับเป็นตัวที่ชน
- BU ที่ alias ผิดกฎยัง**บันทึกฟิลด์อื่นได้** ระบบบังคับกฎเฉพาะตอนที่แก้ alias เอง
- ลำดับ avatar: รูปที่อัปโหลด → alias → ตัวย่อเดิม
- เลือกใช้เฟส 2 (column + unique index) เพื่อให้ DB กันซ้ำเองในที่สุด เพราะการ query ก่อนเขียนอย่างเดียว
  ยังเปิดช่องให้สองคำขอที่มาพร้อมกันบันทึกค่าซ้ำได้ ช่องนี้จะปิดเมื่อทำเฟส 2

## ที่เหลือให้ builder ตัดสินใจ

- รูปของ endpoint/filter รายการที่ต้องแก้ และชื่อรหัส error ของ 409
- จะรวม `BU_ALIAS_MAX` กับกฎของ cluster หรือไม่
- ขนาดตัวอักษรของ avatar เมื่อ alias ยาว 3 ตัว
- ชื่อ query param ของตัวกรอง

## ตรวจด้วยมือ (ไม่มีเทสต์อัตโนมัติตามความชอบของผู้ใช้ — typecheck/lint ยังต้องผ่าน)

- DEV: นับ BU ที่ alias ยาวเกิน 3 ตัว ก่อนและหลัง migration และดูว่ากลุ่มที่ชนยังคงค่าเดิม
- เบราว์เซอร์: สร้าง/แก้ BU ด้วย alias 0/1/3/4 ตัว และด้วย alias ซ้ำกับ BU อื่นใน cluster เดียวกัน (ต้องได้ 409)
  และซ้ำกับ BU ใน cluster อื่น (ต้องผ่าน) ทั้งในหน้า super admin และ cluster admin
- BU ที่ alias ยาว 10 ตัวค้างอยู่ ต้องแก้ชื่อแล้วบันทึกได้
- แถบเตือน: จำนวนตรงกับข้อมูล, กรองตารางได้, กดแล้วไปหน้าแก้ได้ และหายเองเมื่อแก้ครบ ทดสอบบนหน้าจอ 390px และทั้ง TH/EN
- avatar ที่มี alias 3 ตัวในแถวตาราง (`xs`) ต้องไม่ล้น
