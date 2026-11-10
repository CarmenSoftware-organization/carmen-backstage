---
title: Curl หน้า SPA บน Vercel คืน index.html จาก edge cache รุ่นเก่า
author: Thammanoon
date: 2026-11-09
id: l-ced6dc39
scope: repo
status: active
touches:
  - index.html
---

## Decided
**อย่าสรุปว่า "ยังไม่ deploy" จาก `curl https://<app>/` เปล่า ๆ** — 2026-08-21 ผมตรวจ carmen-platform
บน `carmen-inventory-platform.vercel.app` ได้ `index-Cdw24vBq.js` (บิลด์ 19 ส.ค.) และ chunk
`PlatformConfigManagement-DwfgWpz1.js` ที่ **ไม่มี** การ์ด License Enforcement → รายงานไปว่า FE ค้าง
ตามหลัง main 51 commit · **ผิดทั้งข้อ** เบราว์เซอร์โหลด `index-K51abBxQ.js` จริง และการ์ดอยู่บนหน้า
ทำงานได้ปกติ

**สาเหตุ: edge cache ของ HTML** — ยิงซ้ำด้วย `curl "https://…/?cb=$$" -H 'Cache-Control: no-cache'`
ได้ hash เดียวกับเบราว์เซอร์ทันที เรื่องเดียวกันเกิดกับ `config.json` ของ inventory: รอบแรกได้ไฟล์
3 คีย์ (ไม่มี `LICENSE_ENFORCEMENT` → ตีความว่า "คีย์หาย") รอบ cache-buster ได้ 4 คีย์
`"LICENSE_ENFORCEMENT": false` ซึ่งคือ **จงใจปิด** คนละความหมายกัน

**วิธีที่เชื่อได้ เรียงจากแข็งไปอ่อน:** (1) `performance.getEntriesByType('resource')` ในแท็บจริง
(2) อ่านหน้าจอ/`get_page_text` ว่า UI นั้นมีจริงไหม (3) `git merge-base --is-ancestor <commit> <deployed>`
เมื่อรู้ commit ที่ deploy แน่ (4) curl **พร้อม cache-buster** · **Vercel `list_deployments` ก็หลอกได้**
— `latestDeployment` ตอบ `f9ce63388` (19 ส.ค.) ทั้งที่ของจริงใหม่กว่านั้น

**อีกกับดักในชุดเดียวกัน:** grep หา literal ใน bundle เดียวแล้วไม่เจอ **ไม่ได้แปลว่าไม่มีฟีเจอร์** —
Vite code-split ย้ายมันไป chunk ของหน้านั้น ต้องไล่ chunk ให้ครบหรือเปิดหน้าดูตรง ๆ

ดู reference-browser-responsive-verification reference-stale-package-dist-fake-type-errors
…

_From Claude Code's memory of this repo, last updated Aug 30._
