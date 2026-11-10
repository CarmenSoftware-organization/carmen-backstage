---
title: "ในรอบ database-pool ทุก Critical/Important ที่รีวิวจับได้มาจากแผนเอง ไม่ใช่จาก implementer"
author: Thammanoon
date: 2026-11-09
id: l-027ab5da
scope: repo
status: active
touches:
  - CLAUDE.md
  - "src/pages/businessUnitEdit/HeroName.tsx#HeroName"
  - "src/pages/businessUnitEdit/InlineField.tsx#InlineField"
  - "src/pages/clusterAdmin/businessUnitForm/AddressBlock.tsx#AddressBlock"
  - "src/pages/clusterAdmin/businessUnitForm/ClusterBuDocument.tsx#ClusterBuDocumentProps"
  - "src/utils/errorParser.ts#getErrorDetail"
---

## Decided
รอบ database-pool frontend (2026-08-13) รัน subagent-driven development 7 task พร้อมรีวิวทุก task
**ข้อบกพร่องระดับ Important ทุกข้อที่รีวิวจับได้ มาจากตัวแผนเอง ไม่ใช่จากการที่ implementer ทำผิด** —
implementer ทำตามแผนอย่างซื่อสัตย์ทุกครั้ง ข้อบกพร่องทั้ง 6:

1. แผนสั่งเขียน `as never` (6 จุดรวมทั้งใน sample code ของเทสต์) ทั้งที่ signature แก้ให้ตรงได้
2. แผนสั่ง hand-roll response type ทั้งที่ `ApiListResponse<T>` มีอยู่และ 8 entity ใช้อยู่ —
   แถมชื่อฟิลด์เพี้ยน (`pages?` vs `totalPages?`)
3. แผนระบุตำแหน่ง JSX call site ผิดไฟล์ (`BusinessUnitEdit.tsx` แต่จริงอยู่ที่ `BusinessUnitDocument.tsx`)
   → เทสต์แดงเพิ่มอีกไฟล์ที่แผนไม่ได้คาด
4. แผนเขียน logic ยืนยัน repoint ที่ ⌘S กดซ้ำทะลุได้ (Radix บล็อกคลิก ไม่บล็อก global keydown)
5. แผนวาง `useEffect` โหลดข้อมูลไว้นอก `<Can>` — effect รันโดยไม่สนว่า render ออกอะไร ทำให้ผู้ใช้ที่ไม่มี
   สิทธิ์โดน 403 + toast แดงทุกครั้ง ทั้งที่ UI แสดง fallback ถูกต้อง
6. แผนสั่งใช้ `getErrorDetail` กับ error ที่สเปกออกแบบมาให้แสดงข้อความ backend ตรงๆ —
   `getErrorDetail` redact เป็น "Please try again later." บน production เท่านั้น **dev มองไม่เห็นเลย**

## Watch out
เขียนแผนแล้วอย่าเชื่อว่าโค้ดตัวอย่างในแผนถูก — สิ่งที่ต้องตรวจก่อนส่งให้ implementer คือ
(ก) type cast ทุกตัวมีเหตุผลจริงไหม (ข) มี abstraction ที่ codebase มีอยู่แล้วไหม (ค) ระบุ file:line
จาก grep แล้วตรวจซ้ำว่าเป็นไฟล์ที่ render จริง (ง) helper ที่เลือกใช้มีพฤติกรรมต่างกันระหว่าง dev/prod ไหม
และ (จ) effect กับ JSX gate อยู่หลังด่านเดียวกันหรือเปล่า

**Why:** รีวิวต่อ task + รีวิวรวมทั้งกิ่งจับได้ครบทั้ง 6 ข้อ แต่ 2 ข้อสุดท้าย (5 และ 6) รอดมาถึงรีวิว
whole-branch เพราะมันมองไม่เห็นทั้งใน dev และในเทสต์ — ถ้าไม่มีรีวิวรวมชั้นสุดท้ายจะหลุดขึ้น production
…

_From Claude Code's memory of this repo, last updated Aug 13._
