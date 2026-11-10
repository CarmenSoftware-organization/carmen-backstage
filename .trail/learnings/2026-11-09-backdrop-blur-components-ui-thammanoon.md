---
title: "แถบที่ปักอยู่กับที่ทุกจุดในแอปเป็นทึบหมดแล้ว ไม่เหลือ backdrop-blur นอก components/ui"
author: Thammanoon
date: 2026-11-09
id: l-0e313e54
scope: repo
status: active
touches:
  - "src/components/Layout.tsx#Layout"
  - "src/pages/businessUnitEdit/BusinessUnitDocument.tsx#BusinessUnitDocument"
  - "src/pages/clusterEdit/ClusterPlate.tsx#ClusterPlate"
---

## Decided
**PR #214** (merge `26f4f06`, 2026-09-01) — ขึ้น DEV + production (`dpl_CfJa99yzVBAd3niYNo99UJVQMi6e`) แล้ว

ทำทึบครบ 4 จุด ซึ่งเป็น `backdrop-blur` ทั้งหมดที่เหลืออยู่นอก `components/ui/`:

| จุด | เดิม | ตอนนี้ |
|---|---|---|
| `Layout` desktop header | `bg-background/80 backdrop-blur` | `bg-background` |
| แถบ tab — `ClusterPlate` | `bg-background/95 backdrop-blur` | `bg-background` |
| แถบ tab — `BusinessUnitDocument` | `bg-background/95 backdrop-blur` | `bg-background` |
| `thead` — `sqlWorkbench/ResultPanel` | `bg-muted/60 backdrop-blur` | `bg-muted` |

**Why:** เบลอไม่ได้ทำให้อ่านไม่ออก แต่ทำให้ของที่เลื่อนผ่านใต้แถบกลายเป็นเงาจางทับสิ่งที่กำลังอ่าน
(badge สีวิ่งผ่าน breadcrumb เห็นชัดสุด) · header ของมือถือทึบอยู่ก่อนแล้ว และ glassmorphism
ถูกถอดออกตั้งแต่ enterprise redesign (project-enterprise-ui-redesign) แถบพวกนี้เป็นของตกค้าง

## Watch out
ถ้าจะเพิ่มแถบปักอยู่กับที่ใหม่ ให้ทึบตั้งแต่แรก อย่าใช้ `backdrop-blur`
และเช็คว่า parent สูงพอให้ sticky เดินทางจริง — ดู reference-sticky-needs-tall-parent

_From Claude Code's memory of this repo, last updated Aug 31._
