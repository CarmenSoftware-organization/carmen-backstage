# เปลี่ยนชื่อเป็น Carmen Blue Backstage — Checklist

ไฟล์นี้คือจุดเริ่มต้นเวลาทำต่อ อ่านจากบนลงล่าง: **สถานะปัจจุบัน** → ขั้นถัดไปที่ยังไม่ติ๊ก
อัปเดตไฟล์นี้ทุกครั้งที่จบขั้นตอน (ติ๊ก `[x]` + ใส่ลิงก์ PR/spec/วันที่)

## สถานะปัจจุบัน

- **อยู่ที่:** โปรเจกต์ 1 — ขั้น 1.6 ลงมือ + final review เสร็จ (Task 1–8) รอผู้ใช้อนุมัติ push + เปิด PR (Task 9)
- **plan:** `docs/superpowers/plans/2026-10-25-carmen-blue-backstage-rename-p1.md` · ledger: `.superpowers/sdd/2026-10-25-carmen-blue-backstage-rename-p1/progress.md` (gitignored)
- **กิ่ง:** `feature/carmen-blue-backstage-rename` ทุก repo — repo นี้ทำในโฟลเดอร์หลัก; อีก 7 repo อยู่ใน worktree `../<repo>-rename`
  (carmen-inventory-frontend-react, carmen-turborepo-backend-v2, carmen-turborepo-backend-bruno, micro-notification,
  carmen-platform-support-usermanual, carmen-platform-e2e, carmen-wiki) — push + เปิด PR แล้ว (ดู 1.6)
- **ค้างตัดสิน (minor):** `invitationHint1`/`signupHint1` เรียกแอปหลักว่า "Carmen Blue inventory app"; `signInSubtitle` "Carmen Blue operations console"
- **คำถามที่ค้างอยู่:** อนุมัติ merge 8 PR (ลำดับใน 1.6) → จากนั้นตรวจ DEV ในเบราว์เซอร์ (plan Task 9 Step 3–4)
- **อัปเดตล่าสุด:** 2026-10-25

## วิธีทำต่อ (สำหรับเซสชันใหม่)

1. อ่าน "สถานะปัจจุบัน" และ "การตัดสินใจ" ด้านล่าง — ห้ามถามซ้ำเรื่องที่ตัดสินแล้ว
2. ถ้าโปรเจกต์ปัจจุบันมี spec แล้ว อ่าน spec นั้น ถ้ามี plan แล้ว อ่าน plan แล้วทำ task ถัดไปที่ยังไม่ติ๊ก
3. ถ้ายังอยู่ขั้น brainstorm ให้เรียก `superpowers:brainstorming` ต่อจากคำถามที่ค้าง
4. แม่แบบที่ใช้ได้: การเปลี่ยนชื่อรอบก่อน (21 ต.ค.) —
   `../carmen-inventory-frontend-react/docs/superpowers/specs/2026-10-21-carmen-blue-rename-design.md`
   และ `.../plans/2026-10-21-carmen-blue-rename.md` (ตารางชื่อ, anti-goals, ข้อควรระวัง worktree/ไฟล์ค้าง)

## การตัดสินใจ (Owner เป็นคนกำหนด — 2026-10-25)

- เหตุผล: "Carmen Blue Platform" จะเป็นชื่อของ **frontend application หลัก**; คอนโซลผู้ดูแลนี้ทำงานเบื้องหลัง → **Carmen Blue Backstage**
- คอนโซลนี้ (`carmen-platform`) → **Carmen Blue Backstage**
- แอปหลัก (`carmen-inventory-frontend-react`, ตอนนี้ชื่อ "Carmen Blue") → **Carmen Blue Platform**
- เปลี่ยน **ทุกชั้น**: ชื่อที่ผู้ใช้เห็น, repo/package/deploy, โดเมน/ระบบภายนอก, ตัวระบุใน backend, ฐานข้อมูล
- คำว่า "platform" ใน backend/DB เปลี่ยนเป็น **"backstage" ทุกจุด** — รวมส่วนที่เป็นข้อมูลระดับระบบที่แอปหลักใช้ด้วย
  (`carmen_platform` → `carmen_backstage`, `tb_platform_*` → `tb_backstage_*`, `/platform/*` → `/backstage/*`)
  - Claude ทักท้วงแล้วว่าชั้นนี้เสี่ยงสูงและผู้ใช้ไม่เห็นความต่าง — Owner ยืนยันให้เปลี่ยน
- **"Carmen Blue" ยังเป็นชื่อแบรนด์/ผลิตภัณฑ์ทั้งตระกูล** — ใช้ "Carmen Blue Platform" เฉพาะจุดที่หมายถึงตัวแอปหลัก
  ข้อความแบบ "Connections between Carmen Blue and…" คงเป็น "Carmen Blue"
- ผู้ใช้ระบุ: "ทั้งหมดยังอยู่ใน dev stage" — สถานะชื่อปนกันชั่วคราวระหว่างโปรเจกต์รับได้ (ใช้ประกอบการออกแบบช่วงเปลี่ยนผ่านในโปรเจกต์ 3–5 แต่ยังต้องยืนยันว่า production บน Vercel มีผู้ใช้จริงหรือไม่)
- แบ่งเป็น 5 โปรเจกต์ ทำตามลำดับ แต่ละโปรเจกต์มี spec + plan ของตัวเอง

## ผลสำรวจ (2026-10-25, อ่านอย่างเดียว)

| ชั้น | จุดหลัก |
|---|---|
| ชื่อที่เห็น | `carmen-platform/src` 9 ไฟล์ 16 จุด (index.html, Sidebar `PRODUCT_BRAND` — `isProductBrand()` เทียบ string นี้, Login, i18n th/en); inventory FE "Carmen Blue" ~14 ไฟล์ (messages th/en ~37, openapi ~13, index.html, sidebar, auth shell, legal); backend swagger "Carmen Blue Platform" ~10; micro-notification อีเมลทดสอบ 3; usermanual 72; carmen-platform-e2e 46; wiki ~1,650 |
| repo/deploy | GitHub repo `carmen-platform`, `carmen-platform-e2e`, `carmen-platform-usermanual`; `package.json` name; `deploy-dev.yml` (`/var/www/carmen-platform`, `carmen-platform-build.tgz`); Terraform bucket `carmen-platform-web`; เอกสารใน repo นี้ ~750 จุดอ้างชื่อ repo; memory ของ Claude ผูกกับ path โฟลเดอร์ |
| ระบบภายนอก | Vercel `carmen-inventory-platform.vercel.app` (อยู่ใน CORS allowlist backend); `nginx/carmen-platform.conf` + cert; GCP `carmen-platform-web.pncsb-app.com`; `CARMEN_PLATFORM_WEB_URL` (Google OAuth redirect) |
| backend/DB | backend-v2 คำว่า platform ~13,500 จุด ~1,040 ไฟล์; package `prisma-shared-schema-platform`; model `tb_platform_*` 5 ตัว; migration เดิม 119 โฟลเดอร์ (ห้ามแก้ — ต้องเขียน migration ใหม่ rename ทับ); DB `carmen_platform` (อ้างใน god-mode, micro-data); repo นี้ `src/` 194 ไฟล์มีคำว่า platform |

## โปรเจกต์ 1 — ชื่อที่ผู้ใช้เห็น (เสี่ยงต่ำ)

ขอบเขต: คอนโซล → Carmen Blue Backstage, แอปหลัก → Carmen Blue Platform, และข้อความที่ตามมา (swagger, อีเมล, คู่มือ, wiki, e2e)

- [x] 1.1 brainstorm รายละเอียด (2026-10-25)
- [x] 1.2 เขียน spec `docs/superpowers/specs/2026-10-25-carmen-blue-backstage-rename-p1-design.md` + builder check (2026-10-25)
- [x] 1.3 Owner/ผู้ใช้อนุมัติ spec (2026-10-25, commit 256a12d1)
- [x] 1.4 เขียน plan `docs/superpowers/plans/2026-10-25-carmen-blue-backstage-rename-p1.md` (2026-10-25)
- [x] 1.5 ลงมือ Task 1–8 + final review + แก้ 2 ข้อ Important (2026-10-25) — console 1393/1393 tests, typecheck/lint ผ่านทุก repo
- [ ] 1.6 PR แต่ละ repo + merge ← **อยู่ตรงนี้** — เปิด PR แล้ว 2026-10-25, รออนุมัติ merge
  - [ ] carmen-platform #360 (merge ก่อน)
  - [ ] carmen-inventory-frontend-react #440
  - [ ] carmen-turborepo-backend-v2 #914 (eslint/gates ยังไม่รันในเครื่อง — ดู CI)
  - [ ] carmen-turborepo-backend-bruno #38
  - [ ] micro-notification #16
  - [ ] carmen-platform-support-usermanual #4 (หลัง #360)
  - [ ] carmen-platform-e2e #16 (หลัง #360)
  - [ ] carmen-wiki #21 (หลัง #360)
- [ ] 1.7 deploy DEV + ตรวจเบราว์เซอร์
- [ ] 1.8 ขึ้น production (`git push origin main:vercel` — ต้องได้รับอนุมัติ)

## โปรเจกต์ 2 — ชื่อ repo, package, deploy path

- [ ] 2.1 brainstorm · [ ] 2.2 spec · [ ] 2.3 อนุมัติ · [ ] 2.4 plan · [ ] 2.5 ลงมือ · [ ] 2.6 PR/merge · [ ] 2.7 deploy + ตรวจ
- ประเด็นที่รู้แล้ว: GitHub redirect ชื่อเก่าให้อัตโนมัติ; path DEV `/var/www/carmen-platform`; ย้ายโฟลเดอร์ในเครื่อง = memory ของ Claude หลุด (ต้องย้าย `~/.claude/projects/<path>` ตาม)

## โปรเจกต์ 3 — โดเมนและระบบภายนอก

- [ ] 3.1 brainstorm · [ ] 3.2 spec · [ ] 3.3 อนุมัติ · [ ] 3.4 plan · [ ] 3.5 ลงมือ · [ ] 3.6 PR/merge · [ ] 3.7 deploy + ตรวจ
- ประเด็นที่รู้แล้ว: เปิดโดเมนใหม่คู่โดเมนเก่าก่อน แล้วค่อยปิด; CORS + OAuth redirect ต้องรับทั้งคู่ช่วงเปลี่ยนผ่าน

## โปรเจกต์ 4 — ตัวระบุในโค้ด backend

- [ ] 4.1 brainstorm · [ ] 4.2 spec · [ ] 4.3 อนุมัติ · [ ] 4.4 plan · [ ] 4.5 ลงมือ · [ ] 4.6 PR/merge · [ ] 4.7 deploy + ตรวจ
- **รับงานต่อจากโปรเจกต์ 1:** คำว่า "Platform" เดี่ยว ๆ ใน UI คอนโซล ~90 EN / ~86 TH (เมนู "Platform Config/Users/Roles/Migrations", "platform administrator", "admin platform" ใน heroBody, "actor: Platform user" ใน `docs/ui/**`) + คู่มือที่ quote ข้อความเหล่านี้
- ประเด็นที่รู้แล้ว: env var, route `/platform/*`, package/service name; ช่วงเปลี่ยนผ่านรับทั้งชื่อเก่า+ใหม่ เพื่อให้ FE/BE deploy ไม่พร้อมกันได้

## โปรเจกต์ 5 — ฐานข้อมูล

- [ ] 5.1 brainstorm · [ ] 5.2 spec · [ ] 5.3 อนุมัติ · [ ] 5.4 plan · [ ] 5.5 ลงมือ · [ ] 5.6 PR/merge · [ ] 5.7 apply DEV → UAT → production
- ประเด็นที่รู้แล้ว: แยกจากโปรเจกต์ 4 เพื่อให้ย้อนกลับได้; ต้องมีหน้าต่าง downtime; push กิ่งที่มี migration = apply DEV อัตโนมัติภายใน ~2 นาที (ระวัง)
