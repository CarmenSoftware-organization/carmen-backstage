---
title: "คอนโซล seed/check ของ platform DB"
author: Thammanoon
date: 2026-11-09
id: l-203ff6b0
scope: repo
status: active
touches:
  - package.json
---

## Decided
2026-09-02: พอร์ตชุด `db:seed.*` / `db:check.*` ของ `packages/prisma-shared-schema-platform` มาเป็นคอนโซลในหน้า `/platform/migrations` — merged ทั้ง 2 repo และขึ้น DEV แล้ว
- backend PR #472 + fix #473, #474 · frontend PR #246
- spec/แผน: `docs/superpowers/{specs,plans}/2026-09-02-platform-seed-console*` ใน carmen-platform

**พิสูจน์แล้วว่าใช้ได้**: `bun` และไฟล์ `prisma/*.ts` อยู่ใน image ของ micro-business จริง (catalog คืน `missing:false` ครบ 14 ตัว) · spawn + สตรีม NDJSON ผ่าน gateway ทำงานจริง เห็น log ไหลถึงหน้าจอ

**P1001 แก้แล้ว (ยืนยัน 2026-09-07)** — สาเหตุตรงกับสมมติฐานเดิม: สคริปต์เรียก `makePlatformClient(process.env.SYSTEM_DIRECT_URL)` ซึ่งชี้พอร์ต direct (5432) ที่เข้าไม่ถึงจากใน cluster ทางแก้อยู่ที่ `buildChildEnv()` ของ `platform_seed.service.ts` — **allowlist จงใจไม่ส่ง `SYSTEM_DIRECT_URL`** ให้ตกไปใช้ `SYSTEM_DATABASE_URL` (พอร์ต pooler 6432) เอง ส่วน `prisma migrate` ผ่านมาตลอดเพราะ `prisma.config.ts` ตั้ง `url: SYSTEM_DATABASE_URL` อยู่แล้ว

รันจริงผ่านแล้วบน DEV: `seed-role-permission` หลาย BU (exit 0 ทุกตัว) และ `check-application-api` (exit 0)
…

## Watch out
- **ห้ามเพิ่ม `SYSTEM_DIRECT_URL` กลับเข้า allowlist ของ `buildChildEnv()`** — นั่นคือตัวที่ทำให้เกิด P1001 คอมเมนต์ในไฟล์เตือนไว้แล้ว
- เพิ่ม op ใหม่ = แก้ 2 repo และ **FE ต้อง deploy ก่อน backend**: หน้า map ป้ายชื่อจาก `t('pages.platformMigration.ops.<camelCase(id)>.label')` ตรง ๆ ไม่มี fallback ถ้า backend ขึ้นก่อนผู้ใช้จะเห็นคีย์ดิบ (ตรงข้ามกับ project_platform_config_v2_schema ที่ BE ต้องขึ้นก่อน) — `Translations = typeof en` ทำให้ tsc จับคีย์ที่ขาดใน th.ts ให้เอง
- `HIDDEN_OPS` ใน `PlatformMigrationManagement.tsx` ซ่อน `check-seat-pool-view` ไว้ฝั่ง FE — catalog คืน 16 แต่หน้าจอแสดง 15
…

_From Claude Code's memory of this repo, last updated Nov 2._
