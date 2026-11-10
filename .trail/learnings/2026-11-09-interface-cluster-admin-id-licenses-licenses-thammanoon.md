---
title: "การ์ดสัญญา/ใบ interface บน /cluster-admin/:id/licenses + แท็บ Licenses ในฟอร์ม BU ของ…"
author: Thammanoon
date: 2026-11-09
id: l-c14e3e1f
scope: repo
status: active
touches:
  - "src/pages/clusterAdmin/licenses/CoverageCard.tsx#CoverageCard"
  - "src/pages/clusterAdmin/licenses/InterfaceLicensesCard.tsx#InterfaceLicensesCard"
  - "src/pages/clusterAdmin/licenses/SubscriptionsCard.tsx#SubscriptionsCard"
  - "src/pages/Dashboard.tsx#Dashboard.where"
  - "src/utils/dialogXmlEdit.test.ts#read"
---

## Decided
งานวันที่ 2026-09-09 — merged ครบ: FE PR #291 (`51384f3`, DEV deploy เขียว) · BE PR #557 (`922148c2e`) แต่ **Deploy Dev ของ backend ล้มเพราะ Actions ถูกระงับ (billing, steps=0)** → DEV backend ยังไม่มี route ใหม่ การ์ดสัญญาบน DEV จะขึ้น "โหลดสัญญาไม่สำเร็จ" จนกว่าจะ deploy backend ด้วยมือ/ปลด billing · ยังไม่ขึ้น production (Vercel):

- **FE (`carmen-platform`, main)**: `CoverageCard` (`src/pages/clusterAdmin/licenses/`) ใช้ร่วมโดย `SubscriptionsCard` + `InterfaceLicensesCard` — จัดกลุ่มตาม BU, วาดเฉพาะใบ live (`state==='active'` / `in_force`) แต่หัวการ์ดนับ `totalCount` ทั้งหมด, แถวลิงก์ไป `/cluster-admin/:clusterId/business-units/:buId/edit?tab=licenses` เสมอ (ผู้ใช้เคาะ: ห้ามพาออกไป `/licenses/*`) · ฟอร์ม BU ของ cluster-admin มีแท็บ `licenses` แล้ว (ย้ายการ์ดที่นั่งออกจากแท็บ People)
- **BE (`carmen-turborepo-backend-v2`, PR #557 merged main)**: `GET api-system/clusters/:clusterId/subscriptions` ใน `platform_subscriptions.controller.ts` — ไม่มี `@RequirePlatformPermission`; authz ใน `PlatformSubscriptionsService.listForCluster` ถาม `clusters.admin-scope` (perpage -1) แล้วเช็ค `summary.all || data.some(id)`; บังคับ `cluster_id` โดย AND ทับ `advance.where` ของผู้เรียก; ใช้ `AppIdGuard('subscription.list')` ตัวเดิม (catalog ไม่เปลี่ยน); allowlist เพิ่มใน `check.api-system-permission-coverage.ts`

**Why:** cluster admin แบบสมาชิกภาพไม่มี `subscription.read` — `/platform/subscriptions` ตอบ 403/401 แล้ว `tokenRefresh.ts` เตะออกจากระบบ จึงไม่มีทาง FE-only

## Watch out
เช็คว่า DEV backend มี `GET api-system/clusters/:id/subscriptions` ก่อนเชื่อว่าการ์ดพัง (ยิง route ใหม่เทียบ route ปลอม ไม่ใช่ /version) — FE ขึ้น DEV ไปก่อน BE แล้ว ถ้า BE ยังไม่ขึ้นการ์ดขึ้น "โหลดสัญญาไม่สำเร็จ" · ทาง 403 ของ route ใหม่ยังไม่เคยทดสอบจริง (บัญชี localhost มี `adminScope.all=true`) ต้องลองบน DEV ด้วยบัญชีที่ดูแลคลัสเตอร์เดียว · `useBusinessUnitSubscriptions(buId, { clusterId })` และ `useClusterSubscriptions(clusterId, 'cluster')` คือสวิตช์เลือก route · ดู project-cluster-admin-bu-redesign reference-api-system-permission-audit

_From Claude Code's memory of this repo, last updated Sep 9._
