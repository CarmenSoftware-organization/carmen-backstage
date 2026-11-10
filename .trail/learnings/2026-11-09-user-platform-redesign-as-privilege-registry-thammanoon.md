---
title: User Platform redesign as privilege registry
author: Thammanoon
date: 2026-11-09
id: l-74a6ef14
scope: repo
status: active
touches:
  - "src/pages/licenses/subscriptionManagement/buildAdvance.test.ts#advance"
  - "src/pages/userBackstageManagement/BackstageAccessSummary.test.tsx#summary"
---

## Decided
`/platform/user-platform` เปลี่ยนจาก "ไดเรกทอรีผู้ใช้ทั้งหมด" เป็น "ทะเบียนผู้ถือ platform role"
สถานะ 2026-08-07: **PR เปิดครบทั้งสองรีโป รีวิวจบแล้ว ยังไม่ merge ยังไม่ deploy DEV**
- backend `carmen-turborepo-backend-v2` PR **#310** — 10 commits, head `fb151b36f`
- frontend `carmen-platform` PR **#81** — 15 commits, head `a77e92c`
- branch ชื่อเดียวกันทั้งคู่: `feature/user-platform-registry`
- spec + plan อยู่ใน `docs/superpowers/{specs,plans}/2026-08-06-user-platform-registry*`

**Why:** วัดบน DEV — หน้าเดิมแสดง 39 แถวโดยมีความหมายจริง 2 แถว และยิง ~78 request จาก N+1 สองชุด

**How to apply — ลำดับที่ห้ามสลับ:**
1. merge #310 → deploy DEV → **เช็คก่อนว่า application record เปิด `allow_all` หรือมี api_name ใหม่ 2 ตัว** (`user-platform.list`, `user-platform-role.assign-bulk`) ไม่งั้น `AppIdGuard` throw 401 แล้ว reactive token refresh ฝั่ง FE จะทำลาย session แล้วเตะไป `/login` โดยไม่มี error ที่อ่านรู้เรื่อง (คอมเมนต์ไว้ใน PR #310 แล้ว)
2. merge #81
3. แล้วค่อยทำ T11 (ตรวจเบราว์เซอร์) กับ T12 (E2E ใน `carmen-platform-e2e` — **branch `feature/user-platform-registry` ไม่ใช่ main**) ซึ่งยังไม่เริ่มเลย

**บทเรียนที่ค้นพบจากงานนี้ ไม่มีในเอกสารเดิม:**
- `@EnrichAuditUsers` บน route แบบแบ่งหน้าต้องใช้ path `roles` **ไม่ใช่** `data.roles` — `StdResponse.fromResult` hoist `{data,paginate}` ออกก่อน `respond()` ส่งเข้า enricher ผิดชั้นแล้วเงียบสนิท ไม่มี error
…

_From Claude Code's memory of this repo, last updated Aug 6._
