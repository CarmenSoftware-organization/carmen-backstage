---
title: "หน้า /platform/migrations + ย้ายสวิตช์ API จาก env มาที่ platform config"
author: Thammanoon
date: 2026-11-09
id: l-b9e9c0ce
scope: repo
status: active
touches:
  - "src/pages/PermissionCatalog.test.tsx#resolve"
---

## Decided
2026-09-02: พอร์ตหน้า platform-migrations จาก `carmen-inventory-god-mode` มาเป็นหน้า `/platform/migrations` ใน carmen-platform แล้วย้ายสวิตช์เปิด/ปิด API จาก env มาที่ platform config ทั้งสองงานอยู่บนกิ่ง ยังไม่ push
- carmen-platform: `feature/platform-db-migrations` (2 commit)
- carmen-turborepo-backend-v2: `feature/platform-migration-switch-to-config` (1 commit)

**god-mode โคลนตรงๆ ไม่ได้** ของเดิมเป็น Next.js route ที่ spawn `bun run db:*` เป็น child process บนเครื่องที่มี repo backend carmen-platform เป็น SPA ล้วนจึงทำไม่ได้ backend เปิดไว้แค่ 3 endpoint (`status`/`deploy`/`resolve` ใต้ `api-system/platform/migrations`) ส่วน seed 9 ตัว check 6 ตัว tenant-views และ migrate reset ของ god-mode **ไม่มี endpoint** จึงไม่ได้ทำ

**สวิตช์ย้ายจาก `PLATFORM_MIGRATION_API_ENABLED` (env ของ backend-gateway) ไปเป็น `platform_migration.api_enabled` ใน tb_platform_config** guard อ่าน DB ตรงๆ + cache 60 วิ ลอกรูป `LicenseService.isEnforcementEnabled()` แต่ความหมาย fail-safe กลับด้าน: ที่ license ค่า false = ไม่บล็อก ที่นี่ false = ปฏิเสธ

**Why:** ค่านี้เป็นสิ่งที่ผู้ดูแลเปิด/ปิดเอง ไม่ใช่สายไฟของการ deploy — เหตุผลเดียวกับที่ `signup`/`email_verification`/`password_reset` ย้ายมาก่อนหน้านี้ แต่มันแลกไปหนึ่งอย่าง: การเปิดไม่ต้องใช้สิทธิ์เข้าเครื่องอีกแล้ว

## Watch out
- **BE ต้อง deploy ก่อน FE เสมอ** ถ้า FE ขึ้นก่อน การบันทึกคีย์นี้จะได้ 422 เพราะ registry ยังไม่รู้จัก (ดู project_platform_config_v2_schema)
- คีย์นี้ **เขียนได้เฉพาะ super-admin** ไม่ใช่ `platform_config.manage` — `mayWriteKey` ถูกเปลี่ยนเป็น `writeKeyDenial` คืนตัวปฏิเสธแทน boolean เพราะสองคีย์ (`license`, `platform_migration`) ปฏิเสธคนละข้อความ ใครที่แก้ตรงนี้ต่อต้องรักษาไว้ ไม่งั้นคนเปิดประตูกับคนเดินผ่านประตูจะเป็นคนละกลุ่ม
…

_From Claude Code's memory of this repo, last updated Sep 1._
