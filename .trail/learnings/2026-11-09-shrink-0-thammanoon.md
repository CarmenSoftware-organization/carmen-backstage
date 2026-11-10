---
title: Shrink-0 บนกลุ่มปุ่มทำให้ปุ่มขวาสุดถูกตัดขอบการ์ดที่จอแคบ…
author: Thammanoon
date: 2026-11-09
id: l-a01153ff
scope: repo
status: active
touches:
  - "src/components/FeatureStateToggle.tsx#FeatureStateToggle"
---

## Decided
**เกิดจริง 2026-08-31** — `FeatureStateToggle` มี `shrink-0` มาตั้งแต่หน้า `/platform/features`
และไม่เคยแสดงอาการ เพราะชุดคำแปลที่นั่นสั้น (กลุ่มปุ่มกว้าง 310px พอดี) พอหน้า
`/license-features` ใช้คำยาวกว่า ("Closed to new sales") กลุ่มปุ่มจบที่ **391px** ขณะที่
การ์ดจบที่ **330px** → ปุ่มขวาสุดถูกตัดและ **กดไม่ได้บนมือถือ**

**Why:** `shrink-0` เป็นตัวห้ามไม่ให้ยุบ ปุ่มจึงไม่มีทางขึ้นบรรทัดใหม่ได้เลยไม่ว่าพื้นที่จะแคบแค่ไหน
และ **`document.scrollWidth` ไม่จับอาการนี้** — การ์ดมี `overflow` ของตัวเอง ตัวเลขหน้าเว็บจึง
บอกว่า "ไม่ล้น" (384 < 390) ทั้งที่ปุ่มถูกตัดจริง

## Watch out
- ตรวจ overflow ในการ์ด/คอนเทนเนอร์ด้วย `el.getBoundingClientRect().right` เทียบกับ
  `parent.getBoundingClientRect().right` **อย่าดูแค่ `documentElement.scrollWidth`**
- ทดสอบวิธีแก้ด้วยการ inject `<style>` เข้า iframe ก่อนแก้โค้ดจริง — ได้ตัวเลขก่อน/หลังทันที
- component ที่ใช้ร่วมหลายหน้า: คำแปลของหน้าใหม่ที่ยาวกว่าคือตัวจุดชนวน ไม่ใช่ layout ที่เปลี่ยน
- แก้ด้วย `inline-flex max-w-full flex-wrap` + ปุ่ม `px-2 sm:px-3`

ดู reference-iframe-viewport-probe · reference-tailwind-jit-probe-measurement ·
project-license-feature-state

_From Claude Code's memory of this repo, last updated Aug 31._
