---
title: "แยกหน้าเป็น tab ทำให้เทสต์ queryBy...toBeNull() ผ่านฟรีเพราะ element ถูก unmount…"
author: Thammanoon
date: 2026-11-09
id: l-1bb21f99
scope: repo
status: active
touches:
  - "src/pages/businessUnitEdit/BusinessUnitTabs.tsx#tabForField"
---

## Decided
ตอนแยกหน้าเดียวออกเป็นหลาย tab (Radix Tabs = unmount tab ที่ไม่ active) เทสต์แนว
"control นี้ต้องไม่โผล่เมื่อไม่มีสิทธิ์" — `expect(screen.queryByRole(...)).toBeNull()` —
จะกลายเป็น **pass ปลอม**: มันผ่านเพราะ tab ปิดอยู่ ไม่ใช่เพราะ permission gate ทำงาน
เทสต์ยังเขียว แต่เลิกคุ้มครองอะไรเลย

เจอกับ BusinessUnitEdit (2026-08-23): 6 ตัวแดงทันทีเพราะหา element ไม่เจอ (ตรวจง่าย)
แต่ `hides the copy-from-hotel-address action without cluster.update` **ยังเขียว** ทั้งที่
ปุ่มย้ายไป tab Location — อันนี้อันตรายกว่า เพราะไม่มีสัญญาณอะไรบอก

**วิธีทำ:** helper `goToTab(user, /^technical$/i)` แล้วให้ทุก assertion เชิงลบเปิด tab
ที่เป็นเจ้าของ control ก่อน; ให้เทสต์คู่ (discriminating control ฝั่งมีสิทธิ์) เดิน tab
ชุดเดียวกันเพื่อพิสูจน์ว่าไม่ vacuous

**ตรวจหลังแยก tab เสมอ:** ไล่ `queryBy*`/`not.toBeInTheDocument()` ทุกตัวในไฟล์เทสต์ แล้วถามว่า
"ตอนนี้มันยังอยู่ tab ที่เปิดอยู่ไหม" — ตัวที่ยังเขียวคือตัวที่ต้องสงสัย ไม่ใช่ตัวที่แดง

ผูกฟิลด์กับ tab ด้วยฟังก์ชันเดียว (`tabForField()` ใน project-bu-edit-tab-split) แล้วให้เทสต์
`it.each` เรียกใช้ฟังก์ชันนั้นเลือก tab เอง — mapping ผิดจะแดงทันที แทนที่จะหายเงียบ

_From Claude Code's memory of this repo, last updated Aug 22._
