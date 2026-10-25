# เปลี่ยนชื่อเป็น Carmen Blue Backstage — Checklist

ไฟล์นี้คือจุดเริ่มต้นเวลาทำต่อ อ่านจากบนลงล่าง: **สถานะปัจจุบัน** → ขั้นถัดไปที่ยังไม่ติ๊ก
อัปเดตไฟล์นี้ทุกครั้งที่จบขั้นตอน (ติ๊ก `[x]` + ใส่ลิงก์ PR/spec/วันที่)

## สถานะปัจจุบัน

- **อยู่ที่:** โปรเจกต์ 2 เสร็จ (2026-10-25) → ถัดไป **โปรเจกต์ 3 ขั้น 3.1** · โปรเจกต์ 1 ยังมีงานค้างที่ผู้ใช้ต้องทำเอง (ด้านล่าง)
- **repo ถูก rename แล้ว** — ชื่อใหม่: carmen-backstage, carmen-backstage-e2e, carmen-backstage-support-usermanual, carmen-frontend, carmen-frontend-e2e, carmen-mobile, carmen-god-mode, carmen-turborepo-backend (โฟลเดอร์ในเครื่องย้ายตามแล้ว — เปิด Claude ใหม่ใน `~/GitHub/carmensoftware-organize/carmen-backstage`)
- **ผู้ใช้ต้องทำเอง (ค้างจากโปรเจกต์ 1):**
  1. production คอนโซล: `git push origin origin/main:refs/heads/vercel` ใน carmen-backstage (fast-forward ได้ — vercel..main มีแค่งานเปลี่ยนชื่อ) — ระบบสิทธิ์ของ Claude ปฏิเสธ push production
  2. production แอปหลัก: **ยังไม่ควร push** — vercel ตามหลัง main 640 commit รวมงาน POS ที่มีลำดับ deploy บังคับ; `<title>` ใหม่จะขึ้นพร้อมรอบ deploy ปกติของ inventory
  3. backend-v2 (#914) และ micro-notification (#16) ยังไม่ขึ้น DEV — GitHub Actions ติด billing (CI ล้มใน 2 วินาที) ต้อง deploy มือหรือรอ billing
  4. ตรวจหน้าจอจริง: Login จอใหญ่ (แผงโลโก้ CARMEN BLUE / BACKSTAGE), Landing, Platform Config → การ์ด Google sign-in (TH/EN) — Claude ตรวจในเบราว์เซอร์ไม่ได้ (นโยบายบล็อกโฮสต์ dev.blueledgers.com) ตรวจได้แค่ด้วย curl
  5. ส่งอีเมลทดสอบจากหน้า Email Settings (หลัง micro-notification ขึ้น DEV) → หัวเรื่อง "Carmen Blue Backstage email test"
- **คำถามที่ค้างอยู่:** ไม่มี
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
- [x] 1.6 PR แต่ละ repo + merge (2026-10-25)
  - [x] carmen-platform #360, #361 (ข้อความ minor: แอปหลัก = Carmen Blue Platform, คำบรรยาย Login)
  - [x] carmen-inventory-frontend-react #440
  - [x] carmen-turborepo-backend-v2 #914 — gates ในเครื่อง: ผ่าน 16 ล้ม 3 (prettier 349 ไฟล์ไม่ใช่ของ PR, audit:dependencies, micro-business test 3 suites — ล้มเหมือนกันบน origin/main)
  - [x] carmen-turborepo-backend-bruno #38
  - [x] micro-notification #16 (CI ล้มเพราะ billing; build+eslint+jest ในเครื่องผ่าน)
  - [x] carmen-platform-support-usermanual #4
  - [x] carmen-platform-e2e #16
  - [x] carmen-wiki #21
- [ ] 1.7 deploy DEV + ตรวจ — คอนโซลขึ้น DEV แล้ว (550296ef, curl ยืนยัน title + bundle); backend/micro-notification ค้าง (billing); ตรวจหน้าจอจริงค้าง (ผู้ใช้)
- [ ] 1.8 ขึ้น production — ค้าง (ผู้ใช้ push เอง ดู "สถานะปัจจุบัน")

## โปรเจกต์ 2 — ชื่อ repo, package, deploy path

- [x] 2.1 brainstorm · [x] 2.2 spec `docs/superpowers/specs/2026-10-25-carmen-blue-backstage-rename-p2-design.md` · [x] 2.3 ผู้ใช้สั่ง "ทำได้เลย" (ไม่ทำ plan แยก) · [x] 2.5 ลงมือ · [x] 2.6 PR/merge · [x] 2.7 ตรวจ (2026-10-25)
- rename 8 repo บน GitHub; ชื่อ `carmen-mobile`/`carmen-turborepo-backend` เดิมเป็น redirect ของ repo ที่โอนไป `CarmenSoftware-dev` → ผู้ใช้สั่งเปลี่ยนตัวเก่าเป็น `carmen-mobile-app_old`, `carmen-turborepo-backend_old`
- PR แทนชื่อในเอกสาร/package/lockfile/path พี่น้อง (merged): backstage #363, backstage-e2e #17, backstage-support-usermanual #5, frontend #441, frontend-e2e #77, mobile #5, god-mode #30, turborepo-backend #915, bruno #39, micro-file #9, micro-keycloak #9, micro-notification #17, micro-report #67, wiki #22
- ตรวจ: bun install --frozen-lockfile + typecheck ผ่าน 6 repo FE; raw URL fixture ใหม่ของ backend ตอบ 200
- **ส่งต่อโปรเจกต์ 3:** path บนเซิร์ฟเวอร์ (`/var/www/carmen-platform`, `/var/www/carmen-inventory`, `$HOME/carmen-turborepo-backend-v2`, `/root/carmen-inventory-god-mode`), ทั้ง `infra/` (bucket `carmen-platform-web`, **WIF `github_repo` ต้อง apply ก่อนรัน deploy-gcs.yml ครั้งถัดไป** — OIDC claim เป็นชื่อใหม่แล้ว), `.cloudbuild` trigger `carmen-platform-deploy`, ชื่อ image/registry (`docker-compose.yml`, `scripts/deploy-docker.sh`)
- **ส่งต่อโปรเจกต์ 4:** OTel `SERVICE_NAME = 'carmen-platform'` (`src/lib/telemetry.ts`), Expo `slug: carmen-inventory-mobile` (`carmen-mobile/app.json` — ผูก EAS)

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
