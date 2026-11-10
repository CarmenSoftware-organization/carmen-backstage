---
title: "กฎ \"ลูกลากพ่อ\" ของ license feature group เคยตัดคีย์ที่จุดแรก ทำให้ API…"
author: Thammanoon
date: 2026-11-09
id: l-eeb6d9a9
scope: repo
status: active
touches:
  - "src/pages/licenses/subscriptionEdit/featureSelection.ts#toggleFeature"
---

## Decided
`LicenseFeatureGroupService.setFeatures`
(`apps/micro-business/src/license-feature-group/license-feature-group.service.ts`)
เติม "พ่อ" ให้คีย์ที่ส่งเข้ามา เดิมทำด้วย `k.indexOf('.')` ซึ่งถูกตอน catalog เป็น 2 ชั้น
พอ catalog กลายเป็นต้นไม้ n ชั้น การส่ง `system_admin.workflow.purchase_request` ได้กลับมาแค่
`[system_admin, system_admin.workflow.purchase_request]` — **ขาดชั้นกลาง**

กลุ่มแบบนั้น **ขายแล้วลูกค้าใช้ไม่ได้** เพราะ `evaluateLicense` เรียกครบทุกชั้นของ
`LICENSE_FEATURE_ANCESTORS` · หน้าเว็บกันไว้แล้ว (`toggleFeature` เติมครบสาย) แต่ API เปิดโล่ง
แก้แล้ว 2026-09-03 (backend PR #490) เป็นไต่ `parent_key` จนสุดสาย

**บทเรียนที่ใช้ซ้ำได้:** ตอนเปลี่ยนโครงสร้างคีย์จาก 2 ชั้นเป็น n ชั้น ให้ `grep` หา
`indexOf('.')` / `split('.')[0]` ทุกจุดที่แตะคีย์นั้น — จุดที่ frontend กันไว้ให้แล้วคือจุดที่
มองข้ามง่ายที่สุด เพราะ UI ดูถูกต้องหมด

ระวังแยกจาก **permission key** (`resource.action`) ที่ตัดจุดแรกถูกแล้วจริง ๆ —
`platform_role.service.ts:72` และ `platform-scope.service.ts:36` เป็นของคนละเรื่อง ห้ามแก้ตาม

ดู project-license-feature-tree · reference-license-subsystem-traps

_From Claude Code's memory of this repo, last updated Sep 3._
