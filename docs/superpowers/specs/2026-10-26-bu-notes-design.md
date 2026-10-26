# BU Notes — บันทึกภายในทีมพร้อมไฟล์แนบ ราย Business Unit

วันที่: 2026-10-26 · สถานะ: ร่างเพื่อให้ผู้ใช้อนุมัติ
ต่อยอดจาก: `docs/superpowers/specs/2026-10-26-cluster-notes-design.md` (เรียกต่อไปว่า "สเปก cluster")
repo ที่เกี่ยว: `carmen-turborepo-backend` (micro-cluster, backend-gateway, schema backstage) + `carmen-backstage` (FE)

## เจตนา

ทีมงานต้องการจดบันทึกพร้อมไฟล์แนบในระดับ **BU** ด้วย ทำงานเหมือนบันทึกของ cluster ทุกอย่าง
แต่ **แยกกันเด็ดขาด** และมี **คนดูแล/สิทธิ์แยก** จากบันทึกของ cluster (ผู้ใช้ตัดสิน)

## สิ่งที่ผู้ใช้ตัดสินแล้ว

- tab "บันทึก" บนหน้า BU Edit (`/business-units/:id/edit`) — พฤติกรรม/หน้าตาเหมือนสเปก cluster ทุกข้อ:
  ข้อความธรรมดา, แนบไฟล์ (ชนิด/ขนาด/จำนวนเดียวกัน), แผง "ไฟล์ทั้งหมด" (แบบ B), แก้ไขได้รวมไฟล์แนบ + เก็บประวัติ,
  soft delete + "แสดงบันทึกที่ลบแล้ว" + กู้คืน, ไอคอนตามชนิดไฟล์, ไม่ทำแชทสด/แจ้งเตือน/ค้นข้ามที่
- **แยกจาก cluster:** บันทึกของ BU ไม่แสดงในหน้า cluster และบันทึกของ cluster ไม่แสดงในหน้า BU
- **สิทธิ์แยก:** `bu_note.view` / `bu_note.manage` (ไม่ผูกกับ `cluster_note.*`) — role mapping:
  Backstage Admin → `bu_note.*` · Support Manager → `bu_note.view` + `bu_note.manage` · Support Staff → `bu_note.view` · Security Officer → ไม่มี
- `manage` ใช้ได้เฉพาะเมื่อถือคู่กับ `view`
- ลูกค้าเห็นไม่ได้ทุกทาง — ทั้ง cluster admin (สมาชิกภาพ `tb_cluster_user`) และผู้ใช้ใน BU (`tb_user_tb_business_unit`)
- **สิทธิ์แบบผูก cluster ใช้ได้:** ผู้ถือ `bu_note.view` แบบผูก cluster A เห็นบันทึกของทุก BU ใน cluster A เท่านั้น

## ไม่ทำ

- ไม่รวมบันทึก BU เข้าหน้า cluster (และกลับกัน) · ไม่มีหน้ารวมบันทึกข้าม BU
- ไม่ย้าย/ไม่แก้ตารางและ endpoint ของ cluster notes (ตรวจผ่านแล้วและกำลังขึ้น DEV)

## สิ่งที่ถือว่าล้มเหลวแม้จะทำงานได้

- คนที่ถือแค่ `cluster_note.*` อ่าน/เขียนบันทึก BU ได้ หรือคนที่ถือแค่ `bu_note.*` อ่านบันทึก cluster ได้ — สิทธิ์สองชุดต้องไม่รั่วข้ามกัน
- ผู้ใช้ฝั่งลูกค้าเข้าถึงบันทึก/ไฟล์ของ BU ทางใดก็ตาม (UI, notes routes, `/files/url`, `activity-logs`)
- token ไฟล์ของ BU ใช้ขอ URL ผ่าน route ของ BU อื่นหรือของ cluster ได้

## ข้อเท็จจริงจากโค้ด (สำรวจ 2026-10-26)

- cluster notes (สเปก cluster) อยู่บน branch `feature/cluster-notes` ทั้งสอง repo — ใช้เป็นต้นแบบโดยตรง:
  micro-cluster `src/cluster/cluster-note/`, gateway `src/backstage/backstage_cluster-notes/`,
  FE `src/pages/clusterEdit/notes/` + `sections/NotesSection.tsx` + `src/services/clusterNoteService.ts`
- `tb_business_unit` (schema backstage) มี `cluster_id` → scope ราย cluster หาได้จากแถว BU ตรงๆ
  micro-cluster มี `ClusterAdminAuthzService.clusterIdForBusinessUnit(id)` (lookup อย่างเดียว ไม่ได้ให้สิทธิ์)
- หน้า BU Edit: tab ids `general | location | formats | technical | users | licenses`
  (`src/pages/businessUnitEdit/BusinessUnitTabs.tsx`), render ใน `BusinessUnitDocument.tsx` ผ่าน slot props
  (เช่น `usersSlot`) — tab ใหม่ `notes` ควรเข้ามาเป็น slot แบบเดียวกัน
- audit trail: registry/snapshot includes ใน `apps/micro-cluster/src/common/activity/backstage-activity-registry.ts`
  และตัวกรอง `HIDDEN_ENTITY_TYPES` ใน `apps/micro-cluster/src/log/activity-log/activity-log.service.ts`

## การออกแบบ (ต่างจากสเปก cluster เฉพาะที่ระบุ)

### ข้อมูล
- ตารางใหม่ `tb_business_unit_note` — คอลัมน์เหมือน `tb_cluster_note` แต่ `business_unit_id` (FK → `tb_business_unit`) แทน `cluster_id`
  index `(business_unit_id, deleted_at, created_at desc)` · attachments JSONB รูปเดียวกัน (มี `removed_at`)
- migration ใหม่แยก ต้องมาหลัง migration ของ cluster notes

### Backend
- micro-cluster โมดูล `business-unit-note` (RPC service `business-unit-notes`) — cmd ชุดเดียวกับ cluster notes
  (`find-all-by-business-unit`, `files`, `find-one`, `create`, `update`, `delete`, `restore`, `history`, `owns-file`)
  scope ภายใน micro: `note.business_unit_id === payload.business_unit_id` else NOT_FOUND
- **ไม่แตะโมดูล cluster-note ฝั่ง backend ในรอบนี้** (call ของผม แก้หลังผู้ตรวจถาม): ไม่มีเทสคุ้มกัน refactor ของที่ตรวจผ่านแล้ว
  จึงสร้าง helper กลางไฟล์ใหม่ (`apps/micro-cluster/src/cluster/common/note-helpers.ts` หรือที่ใกล้เคียง) ที่ business-unit-note ใช้
  ย้าย cluster-note มาใช้ helper เป็นงานติดตามผลแยก (บันทึกเป็นหนี้)
- RPC lookup: cmd บาง ๆ `business-unit-notes.owner-cluster` `{ business_unit_id }` → `{ cluster_id }` หรือ NOT_FOUND
  (อ่าน `tb_business_unit` ที่ `deleted_at: null`) gateway เรียกก่อน notes RPC ทุกครั้ง ยอมรับ hop เพิ่ม 1 ครั้ง
- audit: ลงทะเบียน `tb_business_unit_note` (create/update/delete/restore→update) + snapshot include `{}` และเพิ่ม
  `'business_unit_note'` เข้า `HIDDEN_ENTITY_TYPES` — ประวัติอ่านผ่าน `business-unit-notes.history` เท่านั้น
- gateway โมดูล `backstage_business-unit-notes` ที่ `api-system/business-units/:businessUnitId/notes` — route ชุดเดียวกับ cluster
  (รวม `POST files/url` body `{ fileToken }`), AppId `buNote.<name>`, permission literal `bu_note.view` / `bu_note.manage`
- **fine scope:** gateway ต้องรู้ cluster ของ BU ก่อนตัดสิน — เรียก RPC หา `cluster_id` ของ BU (lookup) แล้ว
  `resolveAllowedClusterIds(eff, 'bu_note.view' | 'bu_note.manage')` ต้องครอบ cluster นั้น; BU ไม่พบ → 404;
  ทำ **ก่อน** เรียก RPC ของ notes ทุกตัว · ห้ามใช้ `readableClusterScope` หรืออะไรที่อิงสมาชิกภาพ
- ขยาย union ของ `resolveAllowedClusterIds` ให้รับ `BuNotePermissionKey`
- เพิ่ม permission `bu_note.view` / `bu_note.manage` + resource `bu_note` + role mapping ตามที่ผู้ใช้ตัดสิน

### FE
- ทำ component ชุดเดิมของ notes ให้ไม่ผูกกับ cluster: ย้ายไป `src/components/notes/` (หรือคงที่เดิมแต่รับ "เจ้าของ")
  โดยรับ service adapter `{ list, files, fileUrl, create, update, remove, restore, history }` + ชื่อสิทธิ์ view/manage
  หน้า cluster ต้องทำงานเหมือนเดิมทุกอย่าง
- service ใหม่ `src/services/businessUnitNoteService.ts` (base `/api-system/business-units/${id}/notes`)
- BU Edit: เพิ่ม `notes` เข้า `BuTabId`, tab ซ่อนเมื่อไม่มี `bu_note.view` (ส่ง `clusterId` ของ BU เข้า `hasPermission`),
  `?tab=notes` ไม่มีสิทธิ์ → ตกไป `general`, นับจำนวนบนแท็บตอนโหลด (เหมือน cluster), mount ค้างไว้หลังเปิดครั้งแรก
- i18n TH+EN

### ลำดับ deploy
เหมือน cluster: migration มือ → seed permission → seed role-permission → BE → FE · ตรวจว่า app id ของ backstage อนุญาต `buNote.*`

## การตรวจที่ต้องทำ
- curl: Backstage Admin ครบวงจร (สร้าง/ไฟล์/แก้/ลบ/กู้/ประวัติ)
- ผู้ถือแค่ `cluster_note.*` → ทุก route ของ BU notes 403 · ผู้ถือแค่ `bu_note.*` → ทุก route ของ cluster notes 403
- ผู้ใช้ใน BU / cluster admin (ไม่มี role backstage) → 403 ทุก route
- `bu_note.view` ผูก cluster A → BU ใน cluster B 403
- `/files/url` ด้วย token ของ BU อื่น / ของ cluster → 404
- `activity-logs` record/detail ของแถว `business_unit_note` → ปฏิเสธ
- หน้า cluster notes ยังทำงานเหมือนเดิม (regression หลัง refactor helper/component)
- เบราว์เซอร์: desktop + 390px, TH/EN

## สิ่งที่เป็น call ของผม (ผู้ใช้ยังไม่ได้ยืนยัน)
- BU ที่ถูก soft delete → notes ของ BU นั้นเข้าไม่ได้ (404) จนกว่าจะกู้ BU คืน · ถ้า BU ย้าย cluster สิทธิ์ผูก cluster ตาม cluster ปัจจุบันของ BU
- สิทธิ์ใหม่ลงที่เดียวกับที่ cluster notes ลง (seed permission data + resource + role mapping) และต้องผ่าน audit `api-system-permission` / `app-api-catalog-drift`
- ไม่เพิ่มเทสใหม่ (ความชอบของผู้ใช้) — FE refactor ให้ components รับ adapter แล้วตรวจ regression หน้า cluster ด้วยเบราว์เซอร์
- tab บันทึกบน BU Edit ซ่อนจนกว่าข้อมูล BU (รวม `cluster_id`) โหลดเสร็จ ไม่ให้กระพริบขึ้นมา
- ตารางแยก `tb_business_unit_note` แทนตารางรวมที่มีชนิดเจ้าของ — เพราะไม่ต้องแตะตาราง/endpoint cluster ที่ตรวจผ่านแล้ว และ FK ตรงไปตรงมา
- ชื่อ route `api-system/business-units/:businessUnitId/notes`, AppId `buNote.*`, RPC service `business-unit-notes`
- เริ่มงานหลัง push backend ของ cluster notes บน branch ใหม่ `feature/bu-notes` แตกจาก `feature/cluster-notes`
- FE: refactor components ให้ใช้ร่วม (adapter) · BE: helper ไฟล์ใหม่ cluster-note ไม่แตะ
