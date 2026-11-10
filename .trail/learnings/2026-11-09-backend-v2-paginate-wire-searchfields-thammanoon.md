---
title: "Backend-v2: คีย์ paginate บนสาย wire คือ searchfields ตัวเล็กล้วน"
author: Thammanoon
date: 2026-11-09
id: l-ebf10d98
scope: repo
status: active
touches:
  - "src/utils/QueryParams.ts#QueryParams"
---

## Decided
ใน `carmen-turborepo-backend-v2` คีย์ paginate ที่ gateway ส่งไป micro-service คือ
**`searchfields` ตัวเล็กล้วน** — นิยามที่ `apps/backend-gateway/src/shared-dto/paginate.dto.ts`
(`PaginateQuery()` คืน `searchfields: string[]`) และ **ทั้ง repo ไม่มีที่ไหนผลิต camelCase เลย**
ทุกที่ที่เขียน `searchFields:` เป็น field/param ของคลาส `QueryParams` เองล้วน ๆ

**ทำไมอ่านผิดแล้วไม่มีใครรู้:** service เขียนว่า `list(paginate: any)` → TypeScript ไม่มีสัญญาให้ตรวจ
`p.searchFields` จึงคอมไพล์ผ่านและได้ `undefined` เสมอ · แล้ว `QueryParams` มี
`if (this.searchFields.length === 0) this.searchFields = this.defaultSearchFields` →
**คำค้นที่ผู้เรียกส่งมาหายไปเงียบ ๆ ระบบถอยไปค้นเฉพาะ field default ไม่มี error สักบรรทัด**
ของ subscription คือค้นได้แค่ `subscription_number` ค้นด้วยชื่อ cluster ไม่มีวันทำงาน

พบผิด 4 จุดพร้อมกัน (subscription, platform_role, permission, role — `role_permission` ถูกอยู่แล้ว)
แก้ครบใน PR #350 ดู project-license-model-rollout

**ทางกันไม่ให้เกิดซ้ำที่ยังไม่ได้ทำ:** ให้ service รับ `IPaginate` แทน `any` แล้ว tsc จะจับ casing ผิด
ตั้งแต่ build · ตราบใดที่ยังเป็น `any` ให้ **grep `\.searchFields ??` ทุกครั้งที่แตะ service ใหม่**

เกี่ยวข้อง: reference-license-subsystem-traps เคยบันทึกบั๊กนี้ไว้ว่าอยู่จุดเดียว ซึ่งน้อยกว่าความจริง 4 เท่า
— ตรงกับ reference-plan-defects-found-by-review ที่ว่าบันทึกจากรีวิวมักระบุขอบเขตแคบกว่าของจริง

_From Claude Code's memory of this repo, last updated Aug 18._
