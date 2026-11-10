---
title: "หน้า /tenant-seeds ตรวจ+seed ทุก BU"
author: Thammanoon
date: 2026-11-09
id: l-f0102f53
scope: repo
status: active
touches:
  - src/index.tsx
  - "src/pages/tenantSeed/SeedSetPickerDialog.tsx#SeedSetPickerDialog"
---

## Decided
2026-09-29: PR #303 (`feature/tenant-seed-fleet-page`) — หน้า `/tenant-seeds` FE ล้วน วนเรียก endpoint ต่อ BU (`/api-system/tenant/seeds/:bu_id/status` + `deploy/stream`) แบบหน้า `/tenant-migrations`; flag `tenant_seeds`
Spec/plan: `docs/superpowers/{specs,plans}/2026-09-28-tenant-seed-fleet-page*`

**ยังไม่เคยตรวจจริง:** Seed ทีละแถว / สองแถวพร้อมกัน / Seed all / abort กลางทาง / แถว No DB / non-super-admin — local ทุก BU seed ครบแล้ว
**Minor ที่เลื่อนไว้ 3 ข้อ** อยู่ใน body ของ PR #303

**กับดักที่ใช้ซ้ำได้:** ref แบบ "unmounted/cancelled" ที่ตั้ง true ใน cleanup ของ useEffect ต้อง **รีเซ็ตเป็น false ตอนต้น effect** — `React.StrictMode` (เปิดใน `src/index.tsx`) รัน cleanup หนึ่งรอบใน dev แล้ว remount ถ้าไม่รีเซ็ต ทุก setState ถูก guard ทิ้งเงียบ หน้าค้าง skeleton (typecheck/lint/test เขียวหมด จับได้เฉพาะเบราว์เซอร์)
**กับดัก ConfirmDialog:** `onConfirm` ที่คืน promise ของงานยาว ทำให้ dialog ค้าง loading (Cancel/Escape ใช้ไม่ได้) ถ้าเปิดซ้ำระหว่างงานยังไม่จบ — งาน stream ให้ fire-and-forget

**Why:** ทั้งสองบั๊กมาจากโค้ดในแผนเอง ไม่ใช่ implementer — ตรงกับ reference_plan_defects_found_by_review

## Watch out
หน้าไหนมี cancelledRef/unmountedRef ให้เช็คบรรทัดรีเซ็ตก่อนเชื่อว่าใช้ได้; ก่อน merge ต้องทดสอบ Seed กับ BU ที่ขาดข้อมูลจริง (ขอผู้ใช้เลือก BU)

**2026-09-29 เพิ่ม set picker (PR #304, merge 240bb47):** `SeedSetPickerDialog` checkbox ราย set ทั้ง Seed แถว + Seed all (Seed all ส่ง set ที่ติ๊ก ∩ set ที่ BU ขาดจริง) — ขึ้น DEV อัตโนมัติ, **ยังไม่ push `vercel`** (production ยังเป็น eb9e8c0 ที่ไม่มี picker)
…

_From Claude Code's memory of this repo, last updated Sep 28._
