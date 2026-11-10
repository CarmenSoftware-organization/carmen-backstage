---
title: "หน้า /applications วัดสิทธิ์ API เทียบ catalog 883 endpoint แทน badge เทา"
author: Thammanoon
date: 2026-11-09
id: l-457dd2e4
scope: repo
status: active
touches:
  - src/utils/device.ts
  - "src/pages/applicationManagement/ApplicationReachCell.tsx#ApplicationReachCell"
  - "src/utils/device.ts#formatDevice"
---

## Decided
`/applications` (PR #254, merged 2026-09-02, commit `89ba8a8`) เลิกวาดสิทธิ์เข้าถึง API
เป็น badge outline เทา เปลี่ยนเป็น `ApplicationReachCell` ที่วัดเทียบ catalog

- **catalog มี 883 endpoint** — ค่านี้ได้จาก `applicationService.getApiCatalog()` แบบ
  best-effort (พัง = บาร์กับตัวหารหายทั้งคู่ ไม่สเกลกับตัวแทนอื่น)
- `allow_all` วาดเป็น `883/883` + โทนเตือน ไม่ใช่คำ เพื่อให้อยู่บนไม้บรรทัดเดียวกับ
  แถวที่จำกัดขอบเขต — บน DEV มี 3 ใน 5 แอปที่ถือครบทั้ง catalog
- **ถอดคอลัมน์ Status ทิ้ง** ย้าย badge `Inactive` (warning) ไปข้างชื่อ วาดเฉพาะข้อยกเว้น
  ท่าเดียวกับ project-user-platform-registry / UserPlatformManagement (#250)
- `formatDevice` อยู่ที่ `src/utils/device.ts` — กฎเดียวสำหรับ 3 จุด (แถบสรุป, ตาราง,
  ApplicationIdentityHero) `pos` → `POS` ไม่ใช่ CSS `capitalize` ที่ให้ `Pos`

**Why:** เป็นข้อบกพร่องรูปแบบเดียวกับ `/platform/roles` (#252) — เลขที่ไม่มีตัวหาร
อ่านไม่ได้ และสถานะความเสี่ยงที่วาดเหมือนสถานะปกติเท่ากับไม่ได้วาด

## Watch out
หน้าอื่นที่โชว์ "จำนวนสิทธิ์/ขอบเขต" เป็นเลขเปล่าหรือ badge เทา ให้หา
catalog มาเป็นตัวหารก่อน และให้กรณีปกติเงียบ กรณียกเว้นดัง ไม่ใช่กลับกัน

ดู reference-stale-vite-checker-overlay — ระหว่างทำงานนี้ overlay ขึ้น TS error ปลอม
เรื่องคีย์ i18n ที่เพิ่งเพิ่ม ทั้งที่ `tsc --noEmit` เขียว

_From Claude Code's memory of this repo, last updated Sep 2._
