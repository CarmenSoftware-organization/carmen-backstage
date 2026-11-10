---
title: License feature catalog เป็นต้นไม้ n ชั้น
author: Thammanoon
date: 2026-11-09
id: l-4bb23990
scope: repo
status: active
touches:
  - docs/superpowers/specs/2026-09-03-license-feature-tree-design.md
  - src/utils/featureTree.ts
  - "scripts/fill-vendor-address.mjs#main"
  - "scripts/generate-preconfig-mock.mjs#main"
  - "scripts/release.mjs#main"
  - "src/pages/licenseCatalog/FeatureCatalogPanel.tsx#FeatureCatalogPanel"
  - "src/pages/licenses/subscriptionEdit/featureSelection.ts#groupCatalog"
  - "src/pages/licenses/subscriptionEdit/FeatureSelectionCard.tsx#FeatureSelectionCard"
  - "src/pages/ReportFormGroupManagement.tsx#ReportFormGroupManagement.build"
---

## Decided
คำขอ "เพิ่ม license feature" (2026-09-03) เปิดข้อเท็จจริงว่า **เพิ่มด้วยมือไม่ได้** —
แถวใน `tb_license_feature` มาจาก `scripts/generate-license-catalog/run.ts` ฝั่ง
`carmen-turborepo-backend-v2` เท่านั้น ซึ่ง derive จาก `permission.route-map.ts` +
`seed.permission.data.ts` · **feature key คือ permission resource ตรงๆ** และ resource มีได้
เพราะมี route ชี้ไปหามัน ดู project-two-backends

แบ่งเป็น 3 เฟส สเปกอยู่ที่ `docs/superpowers/specs/2026-09-03-license-feature-tree-design.md`
(ฝั่ง carmen-platform) แผน Phase A อยู่ที่ `docs/superpowers/plans/`

**Phase A (โครงสร้าง n ชั้น) — merged + ขึ้น DEV แล้ว:**
BE `#487` (+ lint fix `#488`) · FE `#272`
- `parent_key` = prefix ที่ยาวที่สุดที่มีอยู่จริง ไม่ใช่ข้อความก่อนจุดแรก
- หลานใช้ `sort_order` แถบ `+500` ของโมดูลราก เพื่อไม่ให้เลขของแถวเดิมขยับ
- generator ปล่อย `LICENSE_FEATURE_ANCESTORS` · `RouteFeature` เปลี่ยนเป็น `{feature, ancestors}`
- `evaluateLicense` ตรวจบรรพบุรุษทุกชั้น (เดิมตรวจแค่ใบกับยอด ข้ามชั้นกลาง)
- FE: `src/utils/featureTree.ts` ใหม่ · `groupCatalog` แบนลูกหลานทุกชั้นพร้อม `depth`

**Phase B (`system_admin.workflow.<type>`) — merged + ขึ้น DEV แล้ว 2026-09-03:**
BE `#489` · fixture `carmen-inventory-frontend-react#124` · เอกสาร `carmen-platform#273`
catalog 76 → 79 · `"config:workflows"` ย้ายไป `SUB_PATH_RESOURCE_MAP` (รูปเดียวกับ `app:reports`)
**action เป็น `view` อย่างเดียวโดยตั้งใจ — การเขียนยังคุมที่พ่อ** เพราะ `workflow_type` เป็น
optional ใน update schema และ DELETE ไม่มี body (D3′ / §5.1)
…

## Watch out
- **หนี้โพรบสด ปิดแล้ว 2026-09-03** — ผลเต็มอยู่ใน §5.0 ของสเปก · แถวที่สำคัญที่สุด: ถือ
  `[system_admin, system_admin.workflow]` แล้วยิงรายประเภทได้ 403 แต่รายการรวมได้ 200
  = ฟีเจอร์ที่ Phase B ขายจริงทำงาน · ท่ายิงอยู่ใน reference-dev-license-probe-recipe
- **โพรบงัดเจอบั๊กที่อ่านโค้ดไม่เจอ** — API สร้างกลุ่มที่ขาดชั้นกลางได้เอง
  ดู reference-license-group-ancestor-backfill (แก้แล้ว BE `#490`)
- ตรวจเบราว์เซอร์แล้วทั้ง desktop และ 390px: ลูกเยื้องใต้พ่อจริง (paddingLeft 16 → 36px)
  ไม่มี element ล้นขอบ
…

_From Claude Code's memory of this repo, last updated Sep 3._
