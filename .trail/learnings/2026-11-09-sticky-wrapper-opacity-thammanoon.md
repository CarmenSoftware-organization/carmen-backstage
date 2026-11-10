---
title: Sticky ที่อยู่ใน wrapper ซึ่งจบเร็วจะไม่เคยปักจริง และ opacity…
author: Thammanoon
date: 2026-11-09
id: l-ad05a55f
scope: repo
status: active
touches:
  - "src/pages/businessUnitEdit/BusinessUnitDocument.tsx#BusinessUnitDocument"
  - "src/pages/clusterEdit/ClusterPlate.tsx#ClusterPlate"
---

## Decided
`position: sticky` **เดินทางได้แค่ในกล่องของ parent ตัวเอง** ถ้า wrapper จบตรงไหน มันหยุดปักตรงนั้น
แล้วเลื่อนหายไปเหมือน element ธรรมดา — **ไม่มี error ไม่มีอะไรเตือน** คอมเมนต์ในไฟล์อ้างว่าปักได้
มาหลายเดือนโดยไม่มีใครจับได้ (`ClusterPlate` แถบ tab, ปิดใน PR #214 commit `44ebc2a`)

รูปที่พัง — แถบ tab ถูกหุ้มรวมกับแผ่นป้าย ส่วน tab body เป็นพี่น้องอยู่ข้างนอก:
```tsx
return (
  <div className="space-y-3">   {/* กล่องนี้จบทันทีที่แผ่นป้ายจบ */}
    {backLink}{card}
    <div className="sticky top-14 md:top-16">{tabs}</div>   {/* ไม่มีที่ให้ปัก */}
  </div>
);
```
แก้: คืน **Fragment** แล้วปล่อยแถบเป็นพี่น้องของแผ่นป้าย จะได้ตกไปอยู่ใน container ของหน้า
ซึ่งครอบ tab body ด้วย · `BusinessUnitDocument` ไม่มีบั๊กนี้เพราะ root `space-y-4` ครอบ tab body อยู่แล้ว

**วิธีตรวจที่ใช้ได้จริง** (`resize_window` ใช้ไม่ได้ ดู reference-iframe-viewport-probe):
```js
w.scrollTo({top:420, behavior:'instant'});
strip.getBoundingClientRect().top   // ต้อง = ความสูง header (64) ไม่ใช่ค่าติดลบ
strip.parentElement.getBoundingClientRect().bottom  // ต้องมากกว่า top ของ strip เยอะ ๆ
```
ก่อนแก้ได้ `stripTop: -91` / `parentBottom: -46` · หลังแก้ `64` / `688`

**บทเรียนการตรวจที่แพงกว่าตัวบั๊ก**
PR #213 เพิ่มฟีเจอร์ "ตัวเลขสำรองเผยตอนแผ่นป้ายพ้นจอ" แล้วตรวจด้วยการวัด `opacity` กับ
`aria-hidden` — **ผ่านทั้งคู่ และรายงานว่าใช้ได้** แต่มันสลับอยู่บน element ที่เลื่อนพ้นจอไปแล้ว
**สถานะของ element ที่ถูกต้อง ไม่ใช่หลักฐานว่าผู้ใช้มองเห็นมัน** — ต้องวัด `getBoundingClientRect()`
…

_From Claude Code's memory of this repo, last updated Aug 31._
