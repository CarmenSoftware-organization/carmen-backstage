---
title: "สเปกเตือนความเสี่ยงไว้ถูก การตรวจก็เกิดขึ้นจริง แต่ใช้ modality ผิด"
author: Thammanoon
date: 2026-11-09
id: l-5d4733a4
scope: repo
status: active
touches:
  - "src/components/AvatarCropDialog.tsx#AvatarCropDialog.onKeyDown"
  - "src/components/typeahead/useTypeahead.ts#useTypeahead.onKeyDown"
  - "src/pages/businessUnitEdit/InlineField.tsx#InlineField.onKeyDown"
  - "src/pages/businessUnitEdit/shared.tsx#CollapsibleSection"
---

## Decided
รอบ cluster-admin BU redesign (2026-08-20) สเปกเขียนเตือนตัวเองไว้เป๊ะที่ §2.3 ว่า
`CollapsibleSection` มีแต่เส้นทาง `forceOpen` ที่ถูกใช้จริง หน้านี้จะเป็น **ผู้ใช้รายแรก**
ของเส้นทางยุบ/กาง จึง "ต้องตรวจในเบราว์เซอร์ ไม่ใช่สันนิษฐานว่าใช้ได้"

การตรวจเกิดขึ้นจริงและรายงานว่าผ่าน — **ด้วยเมาส์อย่างเดียว** แต่สิ่งที่พังคือคีย์บอร์ด:
header เป็น `<div>` ที่มีแค่ `onClick` ไม่มี `role`/`tabIndex`/`onKeyDown`/`aria-expanded`
ผลคือ ~25 ฟิลด์ (Billing entity + System settings ทั้งหมด) เข้าไม่ถึงเลยถ้าไม่มีเมาส์
ทั้งที่ก่อนรื้อทุกช่องเป็น `<Input>` ที่ Tab ถึง — **regression จริงเทียบ main** ที่รอดมาถึง
final whole-branch review

ตัวช่วยอัตโนมัติมองไม่เห็นทั้งหมด: `jsx-a11y/click-events-have-key-events` ตรวจเฉพาะ
element ตัวพิมพ์เล็ก ส่วนนี่เป็น custom component (`CardHeader`) และเทสต์ที่มีอยู่
(`shared.test.tsx`) ยืนยันแค่ว่ามีคลาส `.cursor-pointer` ไม่เคยคลิกและไม่เคยกดปุ่ม

## Watch out
เวลาเขียนคำเตือนไว้ในสเปก ให้ระบุ **วิธีตรวจ** ไม่ใช่แค่ "ต้องตรวจ" —
"ต้องกด Tab ไปให้ถึงแล้วกด Enter/Space" ไม่ใช่ "ต้องคลิกดู" และเวลาส่ง dispatch ให้ implementer
ก็ระบุ modality เดียวกันซ้ำ เพราะคนที่ตรวจจะเลือกวิธีที่ง่ายที่สุดเสมอ
กฎง่าย ๆ: ถ้าของที่กำลังจะเพิ่มคือ **ตัวควบคุมที่ไม่ใช่ `<button>`/`<a>`** ให้ตรวจด้วยคีย์บอร์ดเป็นค่าเริ่มต้น

**Why:** คำเตือนที่ไม่ผูกกับวิธีตรวจ ให้ความรู้สึกว่าจัดการความเสี่ยงแล้วทั้งที่ยังไม่ได้จัดการ —
อันตรายกว่าการไม่เขียนคำเตือนเลย เพราะทุกคนที่อ่านต่อจะเชื่อว่ามีคนดูแล้ว
…

_From Claude Code's memory of this repo, last updated Aug 20._
