# Carmen Blue Backstage rename — โปรเจกต์ 5 (ฐานข้อมูลและค่าที่เก็บ)

วันที่: 2026-10-26 · สถานะ: ผู้ใช้สั่ง "DEV อย่างเดียว ยังไม่มีใครใช้จริง ทำได้เลย" (ข้ามรอบถาม-ตอบ)
checklist: `docs/superpowers/carmen-blue-backstage-rename-checklist.md`

## เจตนา

ปิดงานเปลี่ยนชื่อ `platform` → `backstage` ในชั้นที่ผูกกับฐานข้อมูล ซึ่งโปรเจกต์ 4 ตั้งใจเลี่ยงไว้:
ค่าที่เก็บในแถวข้อมูล, ค่าบนสายที่ต้องเปลี่ยนคู่กับข้อมูล, ชื่อตาราง/คอลัมน์ และ package schema

## ขอบเขตสภาพแวดล้อม

- ลงมือและตรวจบน **DEV เท่านั้น**
- migration อยู่ใน `main` เหมือนทุกตัว → **deploy backend รอบถัดไปของ UAT/production จะรัน migration ชุดนี้อัตโนมัติ** (deploy-gcp.yml มี job migrate) — ผู้ใช้รับทราบว่ายังไม่มีผู้ใช้จริง
- GCP ไม่แตะ (คำสั่งผู้ใช้ตั้งแต่โปรเจกต์ 3)

## ข้อเท็จจริงจาก DEV (สำรวจ 2026-10-26, อ่านอย่างเดียว)

- ไม่มีฐานข้อมูลชื่อ `carmen_platform` บน DEV — ตารางระบบอยู่ใน schema `CARMEN_SYSTEM` ของ DB `postgres` → **ไม่ต้องเปลี่ยนชื่อฐานข้อมูล**; ชื่อ `carmen_platform` เหลือแค่ใน terraform (GCP), test fixture god-mode, `.env.example` micro-data
- ตาราง 6: `tb_platform_config`, `tb_platform_permission`, `tb_platform_role`, `tb_platform_role_tb_permission`, `tb_platform_super_admin`, `tb_user_tb_platform_role`; คอลัมน์ 3: `platform_role_id` (×2), `platform_permission_id`; ชื่อ index/constraint ที่มี platform 12 ตัว; ไม่มี view ใดอ้าง
- ค่าในแถว: `tb_platform_permission.resource` ∈ {`platform_config`, `platform_role`, `user_platform`} (8 แถว); `tb_platform_config.key = 'platform_migration'`; JSON key `platform` ใน `google_sign_in`; feature-flag key `platform_config`/`platform_roles`/`user_platform`/`platform_migrations` ใน `feature_flags`; ชื่อ role "Platform Admin"/"platform admin"; ชื่อ application "platform-web-management"
- `api_name` (`platform-config.get` ฯลฯ) **ไม่มีอยู่ในแถวข้อมูลบน DEV** — อยู่ในโค้ดและ catalog ที่ generate เท่านั้น
- micro-notification อ่าน `tb_platform_config` ผ่าน package ที่ publish แล้ว `@carmensoftware-organization/prisma-shared-schema-platform@1.0.0`
- god-mode รัน migration ผ่านโฟลเดอร์ package ใน checkout ของ backend (`BACKSTAGE_PACKAGE_DIR`)
- migration ของ backend อาจถูก apply ขึ้น DEV เองหลัง push กิ่ง (เคยเกิด 3 ครั้ง) หรืออาจไม่ apply เลย (เคยเกิด) → ถือว่าต้องรันเองเสมอ ตรวจ `_prisma_migrations` ก่อน/หลัง

## แบ่งงาน

### 5a — ค่าในข้อมูลและค่าบนสาย (ชื่อตารางยังเดิม)

- migration `UPDATE` ข้อมูล: resource ของ permission, config key, JSON key ใน `google_sign_in` และ `feature_flags`, ชื่อ role/application ตั้งต้น — พร้อมแก้ seed ให้สร้างค่าใหม่ (ไม่งั้น seed รอบถัดไปสร้างค่าเก่ากลับมา)
- โค้ดที่อ่าน/ตรวจค่าเหล่านี้: guard/decorator ฝั่ง backend, `<Can>`/permission helper และ feature-flag ฝั่งคอนโซล
- `api_name` ใน `AppIdGuard(...)` + regenerate `app-api-catalog.generated.ts`
- literal บนสาย: OAuth `target=platform` + state, body `{ type: 'platform' }`, `EntityOwnership.kind`, `AuditScope`, `summary.platform_wide`, `tenant_id: 'platform'`, seed script id `seed-platform-*`/`check-platform-*`
- route `/api/user/permission/platform` → `/api/user/permission/backstage` และฟิลด์ตอบกลับ `platform` → `backstage` (การตัดสินของ Claude: Owner สั่ง "ทุกจุด"; คอนโซลเป็นผู้เรียกรายเดียว)
- ไม่แก้ประวัติ: `tb_activity.meta_data`, `tb_god_mode_audit` (แถวเก่าจะมี `platform` ปนกับแถวใหม่ — ยอมรับ)

### 5b — schema และ package

- migration `ALTER TABLE ... RENAME` ตาราง 6, คอลัมน์ 3, index/constraint 12 (ข้อมูลไม่หาย ไม่ DROP)
- Prisma model/field ใหม่ทั้งหมด + โค้ดที่ใช้ accessor
- package `@repo/prisma-shared-schema-platform` → `@repo/prisma-shared-schema-backstage` (ชื่อ + โฟลเดอร์ + import ทั่ว monorepo) + publish รุ่นใหม่ขึ้น GitHub Packages ด้วยสคริปต์ในเรพ (token มี `write:packages`; Actions ติด billing)
- ผู้ใช้ภายนอก monorepo: micro-notification (เปลี่ยน dependency + accessor `tb_backstage_config`), god-mode (path default ของ package), คอนโซล 1 ไฟล์, แอปหลัก 2 ไฟล์

## ลำดับ deploy บน DEV (ทุก slice)

1. ตรวจ `_prisma_migrations` ว่าตรงกับ `main`
2. push กิ่ง → เปิด PR → merge ทันที (ช่วงพังสั้นที่สุด)
3. บนเครื่อง DEV: `git pull --ff-only` → `db:deploy` (ถ้ายังไม่ถูก apply) → build → restart
4. merge FE ที่ผูกกัน → deploy-dev อัตโนมัติ
5. ตรวจ: `_prisma_migrations`, route ใหม่, log ไม่มี error ใหม่, micro-notification ยังอ่าน config ได้ (5b)

## Anti-goals

- ห้าม DROP ตาราง/คอลัมน์ หรือสร้างใหม่แล้วคัดลอก — ใช้ RENAME เท่านั้น
- ห้ามแก้ migration เก่า (119+ โฟลเดอร์)
- ห้ามแตะ UAT/production/GCP เอง
- ห้ามแก้แถวประวัติ (audit/activity)
