# Cluster Notes — บันทึกภายในทีมพร้อมไฟล์แนบ ราย cluster

วันที่: 2026-10-26 · สถานะ: ร่างเพื่อให้ผู้ใช้อนุมัติ
repo ที่เกี่ยว: `carmen-turborepo-backend` (micro-cluster, backend-gateway, schema backstage) + `carmen-backstage` (FE)

## เจตนาและที่มา

ทีมงานฝั่งเราคุยเรื่องแต่ละ cluster (ลูกค้า) กันในกลุ่ม LINE ข้อมูลจึงกระจายไปหมดและย้อนหาได้ยาก
ของที่ต้องย้อนกลับไปหาบ่อยที่สุดคือ **ไฟล์สัญญา license** และ **สรุปที่ตกลงกับลูกค้า**

เป้าหมายคือให้ทุกเรื่องของ cluster หนึ่งตัวอยู่ในหน้า cluster นั้น เปิดหน้า cluster ที่รู้อยู่แล้วก็เห็นว่า
เคยตกลงอะไร ใครเขียน เมื่อไหร่ และไฟล์สัญญาอยู่ไหน

ผู้ใช้ขอมาในชื่อ "internal message like chat + attachment" แต่ระหว่างคุยกันตกลงว่า **บันทึกพร้อมไฟล์ก็พอ**
ไม่ต้องเป็นแชทสด สิ่งที่แก้ปัญหาจริงคือการหาย้อนหลัง ไม่ใช่การคุยแบบเรียลไทม์

## เป้าหมาย

1. tab "บันทึก" (Notes) บนหน้า Cluster Edit (`/clusters/:id/edit`) ต่อจาก Licensing / Business Units / Users
2. ทีมงานเขียนบันทึกเป็นข้อความธรรมดา และแนบไฟล์ได้หลายไฟล์ต่อบันทึก
3. แผง "ไฟล์ทั้งหมด" ของ cluster หาไฟล์สัญญาได้โดยไม่ต้องไล่อ่านบันทึก
4. แก้ไขได้ แต่ **เก็บประวัติของเดิมไว้ให้ย้อนดูได้** ว่าเคยเขียนอะไร ใครแก้ แก้เมื่อไหร่
5. เห็นได้ **เฉพาะทีมงานฝั่งเรา** ลูกค้าไม่เห็นไม่ว่าทางไหน

## ไม่ทำ (ตั้งใจ)

- แชทสด / real-time push, แจ้งเตือน, @mention, สถานะอ่านแล้ว (ผู้ใช้ตกลงว่าบันทึกพอ)
- ค้นหาข้าม cluster (ผู้ใช้: "เปิดจาก cluster ที่รู้อยู่แล้ว ไม่ต้องค้นข้าม cluster")
- บันทึกระดับ BU (ผู้ใช้: "เกี่ยวกับ cluster ไม่ใช่ bu")
- ให้ลูกค้า / cluster admin เห็น
- rich text / markdown
- ผูกไฟล์เข้ากับใบ license / ใบซื้อโดยตรง เก็บไว้เป็นรอบถัดไปถ้าต้องการ

## สิ่งที่ถือว่าล้มเหลวแม้จะทำงานได้ (anti-goals)

- **ลูกค้าเข้าถึงบันทึกหรือไฟล์ได้ทางใดทางหนึ่ง** ไม่ว่าจะผ่าน UI, endpoint ของ notes, endpoint ประวัติ
  (`activity-logs`), presigned URL ที่หลุดไปกับ payload ของ cluster, หรือหน้า `/cluster-admin/...`
  ข้อนี้สำคัญที่สุด เพราะในบันทึกมีสัญญาและเงื่อนไขทางการค้า
- แก้หรือลบแล้วของเดิมหายถาวร หรือประวัติชี้ไปหาไฟล์ที่ถูกลบจาก storage ไปแล้ว
- กันสิทธิ์ไว้แค่ที่ FE (ซ่อนปุ่ม) แต่ API ยังตอบ

## ข้อเท็จจริงจากโค้ด (สำรวจ 2026-10-26)

- **ที่เก็บไฟล์:** `micro-file` (repo แยก, MinIO + `tb_file_tag` ใน schema `CARMEN_FILE`) contract อยู่ที่
  `packages/file-contract/src/rpc.ts` (`Files.upload`, `Files.presignedUrl`, `Files.delete`, `Files.updateTags`, …)
  ฝั่ง cluster ใช้อยู่แล้วตอนอัปโหลดโลโก้/avatar: `apps/backend-gateway/src/backstage/backstage_clusters/backstage_clusters.service.ts`
  (`uploadLogo` ส่ง `bu_code: 'cluster'` และเก็บ `fileToken` ไว้ในคอลัมน์) เป็นต้นแบบเส้นทางอัปโหลดที่ใช้ได้
- **รูปแบบ "ข้อความ + ไฟล์แนบ" มีต้นแบบ:** โมดูล `*-comment` ใน micro-business เช่น
  `apps/micro-business/src/master/location-comment/` และ gateway `apps/backend-gateway/src/config/config_location-comments/`
  แต่ละแถวมี `message`, `attachments` (JSONB ตาม `common/dto/attachment.schema.ts`: `fileName`, `fileToken`, `contentType`, `size`),
  `doc_version`, และ update รับ delta `{ add, remove }` ของไฟล์แนบ
  **แต่ทั้งหมดอยู่ใน schema tenant (ราย BU)** ส่วน cluster อยู่ใน schema backstage
  (`packages/prisma-shared-schema-backstage/prisma/schema.prisma`, `model tb_cluster`) จึงลอกรูปแบบได้ แต่ต้องสร้างตารางใหม่ฝั่ง backstage
- **audit trail มีอยู่แล้ว:** `tb_activity` + `BackstageActivityInterceptor` ใน micro-cluster
  ลงทะเบียน cmd แบบ allowlist ที่ `apps/micro-cluster/src/common/activity/backstage-activity-registry.ts`
  ไทม์ไลน์ของเรคอร์ดอ่านผ่าน `apps/micro-cluster/src/log/activity-log/` (`RELATED_ACTIVITY` เป็น allowlist,
  `entity-ownership.ts` มี `CLUSTER_OWNED`) และ gateway `apps/backend-gateway/src/backstage/backstage-activity-logs/`
  ซึ่ง gate ด้วย `activity_log.read` / `activity_log.detail` (+ cluster scope ผ่าน `activity-log-scope.ts`)
  FE มีปุ่ม/Sheet ประวัติอยู่แล้วบนหน้า Cluster Edit
- **cluster admin** = `tb_cluster_user.role='admin'` เป็นคนฝั่งลูกค้า เข้าหน้า `/cluster-admin/...` ของตัวเองได้
  ต่างจากสิทธิ์ RBAC ของ backstage ที่ผูก cluster scope ได้เช่นกัน
- หน้า FE: `src/pages/ClusterEdit.tsx` (`tabs` ที่บรรทัด ~504), ส่วนย่อยอยู่ใน `src/pages/clusterEdit/`

## การออกแบบ

### ข้อมูล (schema backstage)

ตารางใหม่ `tb_cluster_note` (ชื่อเป็น call ของผม):

| คอลัมน์ | ชนิด | หมายเหตุ |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `cluster_id` | uuid FK → `tb_cluster` | index `(cluster_id, deleted_at, created_at desc)` |
| `message` | text | ต้องมีข้อความ หรือไฟล์แนบอย่างน้อย 1 |
| `attachments` | jsonb default `[]` | รูปเดียวกับ `AttachmentSchema` (`fileName`, `fileToken`, `contentType`, `size`) + `uploaded_at`, `uploaded_by_id` เพื่อใช้แสดงในแผงไฟล์ |
| `doc_version` | int default 0 | optimistic locking ตาม `docs/doc-version-optimistic-locking-spec.md` |
| `created_at/by_id`, `updated_at/by_id`, `deleted_at/by_id` | | ตามธรรมเนียมตารางอื่น |

- **ห้ามเก็บ presigned URL** ลง DB และห้ามคืน URL ไปกับรายการ notes เก็บแค่ `fileToken`
- migration ใหม่ใน package schema backstage ให้ระวังเรื่องลำดับ deploy/migrate ตาม runbook ของ backend
  (backend push main แล้ว auto-deploy DEV แต่ **ไม่มีขั้น migrate** ต้องรัน migration เอง)
- หมายเหตุ: โปรเจกต์ rename 5 (`2026-10-26-carmen-blue-backstage-rename-p5-design.md`) กำลังเปลี่ยนชื่อตาราง
  `tb_platform_*` ฝั่งเดียวกัน ให้ builder ตรวจก่อนว่าชื่อตาราง/ชื่อ package ตอนลงมือเป็นแบบไหน

### Backend

**micro-cluster** โมดูลใหม่ `cluster-note` (วางโครงตาม `location-comment` แต่บน prisma backstage):
- cmd: `cluster-notes.find-all-by-cluster` (paginate 20 ต่อหน้า, เรียงใหม่→เก่า, ไม่รวมที่ลบ),
  `cluster-notes.files` (ไฟล์ทั้งหมดของ cluster จากบันทึกที่ยังไม่ลบ ไม่ paginate),
  `cluster-notes.find-one`, `cluster-notes.create`, `cluster-notes.update` (รับ `message` + delta `attachments {add, remove}` + `doc_version`),
  `cluster-notes.delete` (soft delete), `cluster-notes.restore` (ล้าง `deleted_at`/`deleted_by_id`)
  — `find-all-by-cluster` รับ flag `deleted=true` เพื่อคืนเฉพาะบันทึกที่ลบแล้ว (เรียงตาม `deleted_at` ใหม่→เก่า)
  restore ต้องลงทะเบียนเข้า audit ด้วย ถ้า `AuditAction` ไม่มีค่า restore ให้ใช้ `update` ตามที่ระบบรองรับ
- contract เพิ่มใน `packages/rpc-contract` ตามรูปแบบเดิม และรันด่าน audit ของ backend ก่อน push
  (ดู memory/บันทึกเรื่อง audit gates 9 ตัว โดยเฉพาะ app-api-catalog)
- ลงทะเบียน create/update/delete เข้า `backstage-activity-registry.ts` ด้วย `entityName: 'tb_cluster_note'`
  เพื่อให้ได้ประวัติก่อน-หลังแบบเต็มแถวจาก audit ที่มีอยู่ **ไม่สร้างตารางเวอร์ชันแยก**
- `fileToken` ใน attachments **ต้องไม่ถูก redact** ใน snapshot ของ audit (ต่างจาก `logo_file_token`)
  เพราะหน้าประวัติต้องเปิดไฟล์เวอร์ชันเก่าได้ ความลับของ token ถูกคุมด้วยการกันสิทธิ์ endpoint ประวัติแทน (ดูหัวข้อสิทธิ์)
- **ไม่ลบไฟล์ออกจาก MinIO** เมื่อเอาไฟล์ออกจากบันทึกหรือลบบันทึก เพื่อให้ประวัติเปิดไฟล์เดิมได้
- **ไม่เพิ่ม `cluster_note` เข้า `RELATED_ACTIVITY` ของ cluster** ประวัติของบันทึกอยู่แยกจากไทม์ไลน์ของ cluster
  (กันข้อความสัญญาไปโผล่ในประวัติ cluster ที่คนถือ `activity_log.read` เห็น)
- **ประวัติของบันทึกเสิร์ฟผ่าน endpoint ของ notes เอง ไม่ผ่าน `activity-logs`** (call ของผมหลังตรวจ):
  cmd ใหม่ `cluster-notes.history` อ่านแถว `tb_activity` ของ `entity_type = cluster_note` ของบันทึกนั้น
  คืนรายการเวอร์ชันพร้อมข้อความ/ไฟล์ก่อน-หลัง gate ด้วย `cluster_note.view` อย่างเดียว
  เหตุผล: ข้อความเต็มใน `activity-logs` มาจาก `GET :activity_log_id/detail` ซึ่ง gate ด้วย `activity_log.detail`
  ถ้าใช้ทางนั้น คนที่อยากให้เห็นต้องได้ `activity_log.detail` เพิ่ม และคนที่ถือ `activity_log.*` แต่ไม่ใช่ทีมดูแลบันทึกก็จะอ่านสัญญาได้
- **ไฟล์ที่เอาออกไม่ถูกตัดทิ้งจาก JSONB** แต่ประทับ `removed_at` / `removed_by_id` ไว้ในรายการนั้น (แก้หลังตรวจโค้ด:
  `files.info` ของ micro-file ไม่คืน tag อ้างอิง การตรวจผ่าน tag จะต้องแก้ repo ที่ 3) ผลคือแถวบันทึกถือ token ทุกตัวที่เคยแนบ
  endpoint `/url` จึงตรวจได้ใน micro-cluster ทีเดียว: มีบันทึกของ cluster นี้ (รวมที่ลบแล้ว) ที่ `attachments` มี `fileToken` นั้นไหม
  API ที่คืนบันทึกให้ FE ส่งเฉพาะไฟล์ที่ไม่มี `removed_at` ส่วน `Files.upload` ใส่ tag `reference_type='cluster_note'` ไว้เพื่อการดูแลระบบเท่านั้น
- ความสอดคล้องของ upload + เขียนแถว: ถ้าอัปโหลดแล้วแต่สร้าง/แก้แถวล้ม (รวม 409) ทั้งคำขอล้ม ไฟล์ที่อัปโหลดไปแล้ว
  กลายเป็นไฟล์กำพร้าใน MinIO ซึ่งยอมรับได้ เพราะกติกาไม่ลบไฟล์อยู่แล้ว ส่วน gateway แปลง `files[]` เป็น
  `attachments.add` (token) ก่อนส่งให้ micro ตามรูป delta `{add, remove}` ของ `location-comment`
- `fileToken` ใน JSONB ไม่ถูก redact เพราะไม่อยู่ใน `sensitiveFields` (`micro-cluster/app.module.ts`, จับชื่อทั้งคำ)
  ตรงตามที่ต้องการ ให้มีเทสต์ยืนยันว่า snapshot ของ `tb_cluster_note` ยังมี token อยู่ และ log fallback `./logs/audit`
  ถือว่าอยู่ในขอบเขตที่เชื่อถือได้ (เป็นของฝั่ง server)

**backend-gateway** (โฟลเดอร์ `src/backstage/backstage_cluster-notes/`, prefix เดียวกับ `api-system/clusters/:clusterId/licenses`):
- `GET    /api-system/clusters/:clusterId/notes?page&perpage`
- `GET    /api-system/clusters/:clusterId/notes/files`
- `POST   /api-system/clusters/:clusterId/notes` (multipart: `message` + `files[]`) อัปโหลดผ่าน `Files.upload` ก่อนแล้วค่อยสร้างแถว
- `PATCH  /api-system/clusters/:clusterId/notes/:note_id` (multipart: `message`, `files[]` ใหม่, `remove[]` = fileToken, `doc_version`)
- `DELETE /api-system/clusters/:clusterId/notes/:note_id`
- `GET    /api-system/clusters/:clusterId/notes/:note_id/history`
- `GET    /api-system/clusters/:clusterId/notes?deleted=true` (ต้องมี `cluster_note.view`)
- `POST   /api-system/clusters/:clusterId/notes/:note_id/restore` (ต้องมี `cluster_note.manage` + `.view`)
- `GET    /api-system/clusters/:clusterId/notes/files/:file_token/url` คืน presigned URL หลังตรวจว่า token นั้น
  อยู่ในบันทึก (ปัจจุบันหรือในประวัติ) ของ cluster นี้จริง กันการเอา token ของ cluster อื่นมาขอ
- ตรวจไฟล์ฝั่ง gateway: PDF, jpg/png, doc/docx, xls/xlsx · ไฟล์ละ ≤ 10 MB · ≤ 5 ไฟล์ต่อครั้ง (ค่าเป็น call ของผม)
- path/ชื่อ endpoint สุดท้ายให้ยืนยันกับ swagger หลังทำ (FE ห้ามเดา path)

### สิทธิ์ (ส่วนที่สำคัญที่สุด)

- เพิ่มสิทธิ์ใหม่ใน RBAC ของ backstage: **`cluster_note.view`** (เห็น tab, อ่านบันทึก, ขอ URL ไฟล์, ดูประวัติบันทึก)
  และ **`cluster_note.manage`** (สร้าง/แก้/ลบ **ได้ทุกบันทึก** ไม่จำกัดเฉพาะของตัวเอง — ผู้ใช้ตัดสิน)
- ทุก endpoint ข้างบนกันด้วยสิทธิ์นี้ **ที่ backend** ใช้ guard/permission key แบบเดียวกับ endpoint backstage ตัวอื่น
- **การเป็นสมาชิก cluster หรือ cluster admin (`tb_cluster_user`) ต้องไม่ให้สิทธิ์ใดๆ กับ notes** — ต่างจาก
  endpoint ของ cluster บางตัว (เช่น `clusters.update` ที่ "รับผู้ดูแลแบบสมาชิกภาพ") ให้ builder ตรวจว่า guard ที่เลือกไม่มีกิ่ง membership
- cluster-scoped grant ของ `cluster_note.*` ใช้ได้ตามกลไก scope ที่มีอยู่ (`BackstagePermissionGuard` +
  `resolveAllowedClusterIds`) ผู้ถือสิทธิ์แบบผูก cluster เห็นและจัดการได้เฉพาะ cluster ของตัวเอง
- **`cluster_note.manage` ต้องใช้คู่กับ `.view`** (call ของผม): endpoint เขียนตรวจทั้งสองคีย์ seed ผูกทั้งคู่ให้ role ที่จัดการได้
  FE ซ่อนช่องเขียนเว้นแต่ถือทั้งคู่ กันไม่ให้มี role ที่เขียนได้แต่อ่านไม่ได้
- **ปิดทาง `activity-logs` สำหรับบันทึก:** ทั้ง `record/:id` และ `:activity_log_id/detail` ต้อง **ปฏิเสธ** แถวที่
  `entity_type = cluster_note` สำหรับทุกคน (รวม platform-wide `activity_log.*`) เพราะประวัติของบันทึกมี endpoint ของมันเองแล้ว
  ถ้าไม่ปิด `detail` ซึ่งรับ activity id จะเป็นช่องให้คนถือ `activity_log.detail` อ่านข้อความสัญญาได้
  **ไม่เพิ่ม `cluster_note` เข้า `CLUSTER_OWNED`** ใน `entity-ownership.ts` (คีย์ในนั้นไม่มี `tb_`) เพราะไม่ได้ใช้ทางนี้
  การปฏิเสธต้องเป็นกฎชัดเจน ไม่ใช่ปล่อยให้ fallback platform-only ทำงานแทน เพราะ fallback นั้นยังเปิดให้ platform-wide grant
- seed สิทธิ์ใหม่บน DEV และผูกเข้า role ของทีมงาน (เช่น Platform Admin) ลำดับ seed ต้องให้สิทธิ์มีก่อนผูก role
- FE: ซ่อน tab ด้วย `<Can>` เมื่อไม่มี `cluster_note.view`, ซ่อนช่องเขียน/เมนูแก้ลบเมื่อไม่มี `cluster_note.manage`
  และ **ไม่เพิ่มอะไรในหน้า `/cluster-admin/...`**

### หน้าจอ (FE `carmen-backstage`) — แบบ B ที่ผู้ใช้เลือก

mockup: `.superpowers/brainstorm/47153-1792985325/content/notes-tab-layout.html` (ตัวเลือก B)

- tab ที่ 4 ใน `TabStrip` ของ `ClusterEdit.tsx` ชื่อ "บันทึก" / "Notes" พร้อม `count` จำนวนบันทึก
  ต้องขยาย union `ClusterTabId` + `CLUSTER_TAB_IDS` ใน `src/pages/clusterEdit/clusterTabs.ts` และตรวจ `ClusterEditNav` /
  `useScrollSpy` ว่ารองรับ tab ที่บางคนไม่เห็น (tab ซ่อนตามสิทธิ์) ได้ ไม่ใช่แค่เพิ่มรายการใน array `tabs`
- **ซ้าย:** ช่องเขียน (textarea + ปุ่มแนบไฟล์ + ปุ่มบันทึก) อยู่บนสุด ใต้ลงมาเป็นไทม์ไลน์ใหม่→เก่า
  แต่ละบันทึกแสดงชื่อคนเขียน, เวลา (ใช้ helper `fmt` ตาม CLAUDE.md), ข้อความ (คง line break), ชิปไฟล์แนบ
  บันทึกที่เคยถูกแก้แสดง "แก้ไขแล้ว · ดูประวัติ" เปิด Sheet ที่อ่านจาก endpoint `/history` ของ notes
  (ใช้ Sheet ประวัติเดิมได้ถ้าป้อนข้อมูลจาก endpoint นี้ได้ ไม่งั้นทำ Sheet ใหม่ที่หน้าตาใกล้กัน)
  เมนู ⋯ มี แก้ไข (inline) / ลบ (`ConfirmDialog`) ปุ่ม "ดูเพิ่ม" โหลดหน้าถัดไป
- **บันทึกที่ลบแล้ว (ผู้ใช้ขอ):** ปุ่ม/สวิตช์ "แสดงบันทึกที่ลบแล้ว (n)" ใต้ไทม์ไลน์ เปิดรายการบันทึกที่ลบแล้ว
  แต่ละอันแสดงข้อความ ไฟล์แนบ (เปิดได้) ใครลบ ลบเมื่อไหร่ ดูประวัติได้ และปุ่ม "กู้คืน" (เฉพาะผู้มี `.manage`)
  กู้คืนแล้วบันทึกกลับเข้าไทม์ไลน์ตามเวลาที่สร้างเดิม และไฟล์กลับเข้าแผง "ไฟล์ทั้งหมด"
  บันทึกที่ลบแล้วแก้ไม่ได้จนกว่าจะกู้คืน · ไม่มีการลบถาวรจากหน้าจอ
- **ขวา (`lg` ขึ้นไป):** แผง "ไฟล์ทั้งหมด (n)" เรียงใหม่→เก่า ชื่อไฟล์ + วันที่ + คนแนบ
  คลิกไฟล์ → ขอ URL จาก endpoint `/url` ตอนคลิกแล้วเปิดแท็บใหม่ · ไฟล์ที่ถูกเอาออกหรือบันทึกที่ถูกลบไม่แสดงในแผง
- **ใต้ `lg`:** แผงไฟล์ย้ายไปอยู่บนสุดแบบพับได้ ต้องตรวจที่ 390px
- ว่าง: `<EmptyState>` ชวนเขียนบันทึกแรก · โหลดครั้งแรก: skeleton ตาม Loading States Decision Table
- 409 จาก `doc_version` → `notifyVersionConflict()` + refetch บันทึกนั้น (`src/utils/docVersion.ts`)
- ยังพิมพ์ค้าง (ช่องเขียนใหม่หรือกำลังแก้) แล้วจะออก → `useUnsavedChanges`
- error ทุกจุดผ่าน `utils/errorParser.ts` และ feedback ผ่าน `toast.*`
- service ใหม่ใน `src/services/` (ฐาน `/api-system`), type ใน `src/types/index.ts`, ข้อความ i18n ทั้ง TH และ EN

### ลำดับ deploy

1. backend: schema + migration (รันเองบน DEV) → micro-cluster + gateway → seed สิทธิ์ + ผูก role บน DEV
2. FE ขึ้นทีหลัง BE (tab ซ่อนอยู่แล้วถ้าไม่มีสิทธิ์ แต่ถ้ามีสิทธิ์แล้ว BE ยังไม่ขึ้น tab จะพัง)
3. production (`main:vercel`) เป็นขั้นแยกที่ผู้ใช้สั่งเอง

## การตรวจที่ต้องทำ (ผูกกับความเสี่ยงข้างบน)

- ด้วยบัญชี **cluster admin ฝั่งลูกค้า** ยิงทุก endpoint ของ notes, endpoint `/url`, และ `activity-logs/record/<note_id>` → ต้อง 403 ทั้งหมด
- ด้วยบัญชี platform-wide ที่ถือ `activity_log.read` + `.detail` (ไม่มี `cluster_note.view`) ยิง `record/<note_id>`
  และ `<activity_id ของแถว note>/detail` → ปฏิเสธทั้งคู่ และไทม์ไลน์ของ cluster ไม่มีแถว note
- ด้วยบัญชีที่มี `cluster_note.view` แบบผูก cluster A ยิง notes/history/url ของ cluster B → 403
- ขอ URL ด้วย `file_token` ของ cluster อื่นผ่าน path ของ cluster นี้ → ปฏิเสธ
- แก้บันทึก + เปลี่ยนไฟล์ → ประวัติแสดงข้อความเดิมและเปิดไฟล์เดิมได้
- ลบ → หายจากไทม์ไลน์และแผงไฟล์ → โผล่ใน "บันทึกที่ลบแล้ว" → กู้คืน → กลับมาครบพร้อมไฟล์ และประวัติมีแถวลบ+กู้คืน
- บัญชีที่มีแค่ `.view` เห็นรายการที่ลบแล้วแต่ไม่เห็นปุ่มกู้คืน และยิง `/restore` ตรงๆ → 403
- GET cluster ปกติไม่มีข้อมูล notes/URL ติดไปด้วย
- เบราว์เซอร์: desktop + 390px, TH/EN, 409 สองแท็บ

## สิ่งที่เป็น call ของผม (ผู้ใช้ยังไม่ได้ยืนยัน)

- ชื่อ `tb_cluster_note`, `cluster_note.view` / `cluster_note.manage`, path ของ endpoint
- ชนิดไฟล์, 10 MB ต่อไฟล์, 5 ไฟล์ต่อครั้ง
- ข้อความธรรมดา ไม่ทำ rich text · paginate 20 + "ดูเพิ่ม"
- ไม่ลบไฟล์จาก MinIO เลย · ไม่ redact fileToken ใน audit
- ประวัติบันทึกแยกจากไทม์ไลน์ของ cluster และเสิร์ฟผ่าน `/history` ของ notes; `activity-logs` ปฏิเสธแถว `cluster_note`
- `cluster_note.manage` ต้องถือคู่กับ `.view`
- ไฟล์ที่เอาออกประทับ `removed_at` แทนการตัดทิ้ง และใช้ตรวจสิทธิ์ขอ URL
- ไฟล์กำพร้าเมื่อเขียนแถวล้มหลังอัปโหลด ยอมรับได้
- บันทึกที่ลบแล้วอ่านได้ด้วย `.view` กู้คืนต้องมี `.manage` · ไม่มีการลบถาวรจากหน้าจอ · ลบแล้วต้องกู้คืนก่อนแก้
- คลิกไฟล์ในแผงขวาเปิดไฟล์ (ไม่ได้กระโดดไปที่บันทึกต้นทาง)

## เหลือให้ builder ตัดสินเอง

- รูปแบบ guard/permission key ที่ตรงกับ endpoint backstage ตัวอื่นตอนลงมือ
- การแบ่ง component ใน `src/pages/clusterEdit/`
- รายละเอียดการแสดงชิปไฟล์และไอคอนตามชนิดไฟล์
