---
title: "งานตาราง 4 PR (162-165) merged+deployed DEV"
author: Thammanoon
date: 2026-11-09
id: l-80fcc93e
scope: repo
status: active
touches:
  - agent-os/standards/styling/table-sticky-columns.md
  - "src/pages/ClusterEdit.tsx#ClusterEdit"
  - "src/pages/sqlWorkbench/ResultPanel.tsx#ResultPanel"
---

## Decided
27 ส.ค. 2026 — PR #160–#168 merged ครบ, deploy DEV แล้ว และ **push `main:vercel` ขึ้น production
แล้ว** (`d985480`) — ทั้งชุดถึงผู้ใช้จริงโดยไม่เคยเปิดดูในเบราว์เซอร์เลยสักหน้า

**`ui/table.tsx` ไม่ใช่ wrapper กลาง ๆ** — คลาสถูก tune เพื่อ DataTable (`TableHead h-11`,
`TableCell p-3`, `TableHeader bg-muted`, `TableRow zebra-row`) เดิมมี consumer เดียวคือ
`data-table.tsx` (import ผ่าน `'./table'` จึงไม่โผล่ตอน grep หา `ui/table`) ตอนนี้มี 4 ไฟล์
หน้า Edit ใช้ด้วย **แต่ 11 ไฟล์ที่เหลือจงใจไม่แปลง**: mini-table ในการ์ด (`px-2 py-1`) จะสูงขึ้น
เกือบเท่าตัว, `ResultPanel` เป็น spreadsheet grid, `ClusterEdit` เลือก plain table เพื่อเลี่ยง
คอลัมน์ `#` — อย่าไล่แปลงให้ครบโดยไม่ดูคลาสก่อน

**`TableRow` มี `zebra-row` ติดมาเสมอ** ทำให้หัวตาราง hover เปลี่ยนสี — DataTable เป็นแบบนี้
อยู่แล้วทั้งแอป แก้ต้องแตะ `src/components/ui/` ซึ่งกติกาข้อ 2 ห้าม

**Why:** สองข้อนี้หาไม่เจอจากโค้ด — ข้อแรกต้องเทียบคลาสของทุกตารางกับ `ui/table` ข้อสองเห็นตอน
render จริงเท่านั้น

## Watch out
ก่อนแปลง `<table>` ดิบเป็น `<Table>` ให้เทียบ padding ของ `th`/`td` กับ
`h-11`/`p-3` ก่อน ถ้าห่างมากแปลว่าเป็น mini-table — อย่าแปลง

กฎ sticky-right กับ `--sticky-right-bg` อยู่ใน `agent-os/standards/styling/table-sticky-columns.md`
แล้ว (อัปเดตใน #163) ไม่ต้องจำซ้ำ — แต่จำไว้ว่า **test ของตารางพวกนี้ไม่ assert โครงสร้าง DOM
เลย** เขียวไม่ใช่หลักฐาน ต้อง probe DOM เอง ดู reference-tab-split-makes-tests-vacuous

**ยังไม่เคยตรวจในเบราว์เซอร์สักหน้าเดียว** — ทั้งหัวตารางที่ถอด uppercase, nowrap, และคอลัมน์
ที่ตรึง/เลิกตรึง ดู project-browser-checklist-2026-08-24 สำหรับวิธีตรวจ 390px

_From Claude Code's memory of this repo, last updated Aug 30._
