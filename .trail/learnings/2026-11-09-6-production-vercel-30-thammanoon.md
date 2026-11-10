---
title: "ตรวจเบราว์เซอร์ 6 หน้าที่ค้างมานานบน production Vercel 30 ส.ค"
author: Thammanoon
date: 2026-11-09
id: l-189b4a46
scope: repo
status: active
touches:
  - "src/utils/capacity.ts#seatUtilization"
  - "src/utils/capacity.ts#utilization"
  - "src/utils/dialogXmlEdit.test.ts#read"
---

## Decided
ปิดรายการ "ตรวจเบราว์เซอร์ที่ไม่เคยทำ" ใน project-pending-work เมื่อ 2026-08-30

**ตรวจที่ไหน — production Vercel ไม่ใช่ DEV**

**เปิด DEV `http://dev.blueledgers.com:9902` ในเบราว์เซอร์ไม่ได้** — Chrome HTTPS-First อัปเกรดเป็น
https เองแล้วได้ `ERR_SSL_PROTOCOL_ERROR` ทั้งที่ curl ผ่าน 200 · ปิดสวิตช์เบราว์เซอร์ไม่ได้
**ทางออกคือใช้ `https://carmen-inventory-platform.vercel.app`** ซึ่ง**ต่อ `dev.blueledgers.com:4001`
อยู่แล้ว** (ยืนยันจาก `performance.getEntriesByType('resource')`) → ได้ทั้งข้อมูล DEV จริงและ build
ที่ผู้ใช้เห็นจริงในการตรวจครั้งเดียว

**ผ่าน 5 หน้า**

- **`/licenses`** — แถบ fleet + สลับ 4 มุมมองครบ (cluster / subscription / seat licence / BU quota) ·
  **ทุกตัวเลขตรงกับที่ probe จาก DB เป๊ะ**: BU 11/30 · users 41/89 · โควตาและที่นั่งราย cluster ตรงหมด
- **`/licenses/:clusterId`** — 3 ชั้นในหน้าเดียว + scrollspy ซ้ายมือ · Add/Edit/Remove ครบทุกชั้น
- **purchase parity** — เลข `SEAT-2608-####` / `BUQ-2608-####` แสดงครบ พร้อม coverage/status/reference ·
  ใบ 2099 แสดงเป็น **"No expiry"** ตามข้อตกลง
- **`/platform/configs`** — 7 การ์ดมีค่าจริงครบ · การ์ด **License Enforcement = "Enforced / On"**
  ตรงกับสวิตช์ใน DB · audit metadata ครบทุกการ์ด (ปิด checklist ของ project-audit-metadata-everywhere ด้วย)
- **`/platform/database-pools`** — 1 pool, Export CSV, Add Pool · **ไม่มีการโชว์รหัสผ่าน** ยืนยันว่า
  `revealDbPassword` ถูกถอดจริง · 4 ข้อที่เหลือของ project-database-pool-frontend ต้องเขียนข้อมูล
  จึงยังไม่ทำบน DEV ที่ใช้ร่วมกัน
…

## Watch out
เทียบวันหมดอายุของสองสิ่งที่ต้องคุ้มครองกัน **ให้เทียบ timestamp เต็ม** ส่วนการกัน
false positive ให้ใช้ tolerance ที่ระบุชัด (เช่น "ไม่ถือว่าเป็นช่องว่างถ้าน้อยกว่า X") ไม่ใช่ปัดทิ้งทั้งเวลา ·
และ **อย่า hardcode วันเป้าหมายเมื่อของจริงอ่านได้จาก DB**

_From Claude Code's memory of this repo, last updated Aug 30._
