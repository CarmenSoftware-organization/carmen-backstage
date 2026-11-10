---
title: "ด่าน audit:fe-license-fixture ของ backend อ่าน main ของ inventory FE ทำให้ต้อง merge FE…"
author: Thammanoon
date: 2026-11-09
id: l-6eb925fe
scope: repo
status: active
touches:
  - "scripts/fill-vendor-address.mjs#main"
  - "scripts/generate-preconfig-mock.mjs#main"
  - "scripts/release.mjs#main"
---

## Decided
`carmen-turborepo-backend-v2` มีด่าน CI `audit:fe-license-fixture` (`scripts/audit-fe-license-fixture/run.ts`) ที่ดึงไฟล์ `constant/__fixtures__/license-catalog.ts` จาก **branch `main` ของ carmen-inventory-frontend-react** (ผ่าน `FE_FIXTURE_REF ?? 'main'`) แล้วเทียบกับ catalog ของตัวเอง

**Why:** เพิ่มคีย์ license ใหม่ฝั่ง backend เมื่อไหร่ ด่านนี้แดงทันทีและ**แดงค้างจนกว่า commit ที่ regenerate fixture จะ merge เข้า `main` ของ FE** — PR ของ backend ปลดล็อกตัวเองไม่ได้ ไม่ว่าจะแก้อะไรในกิ่งตัวเอง เจอจริงตอนเพิ่มคีย์ `interface.*` 12 ตัว (2026-09-07): ด่านฟ้อง 13 คีย์หาย

## Watch out
เพิ่มคีย์ลง license catalog เมื่อไหร่ ต้อง `bun run gen:license-fixture` ฝั่ง inventory FE แล้ว **merge FE ก่อน BE เสมอ** ห้าม hand-edit fixture · ตรวจในเครื่องด้วย `FE_FIXTURE_URL=file://<path>` ชี้ไปที่ไฟล์ในกิ่งได้ · ดู interface-entitlement-to-license

_From Claude Code's memory of this repo, last updated Sep 7._
