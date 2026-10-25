# เปลี่ยนชื่อเป็น Carmen Blue Backstage — Checklist

ไฟล์นี้คือจุดเริ่มต้นเวลาทำต่อ อ่านจากบนลงล่าง: **สถานะปัจจุบัน** → ขั้นถัดไปที่ยังไม่ติ๊ก
อัปเดตไฟล์นี้ทุกครั้งที่จบขั้นตอน (ติ๊ก `[x]` + ใส่ลิงก์ PR/spec/วันที่)

## สถานะปัจจุบัน

- **อยู่ที่:** โปรเจกต์ 3–5 เสร็จ + ขึ้น DEV ครบ (2026-10-26) · โปรเจกต์ 1 ยังมีงานค้างที่ผู้ใช้ต้องทำเอง (ด้านล่าง) · UAT/production จะได้ migration ของโปรเจกต์ 5 ตอน deploy backend รอบถัดไป (ต้อง deploy micro-notification คู่กัน)
- **repo ถูก rename แล้ว** — ชื่อใหม่: carmen-backstage, carmen-backstage-e2e, carmen-backstage-support-usermanual, carmen-frontend, carmen-frontend-e2e, carmen-mobile, carmen-god-mode, carmen-turborepo-backend (โฟลเดอร์ในเครื่องย้ายตามแล้ว — เปิด Claude ใหม่ใน `~/GitHub/carmensoftware-organize/carmen-backstage`)
- **ผู้ใช้ต้องทำเอง (ค้างจากโปรเจกต์ 1):**
  1. production คอนโซล: `git push origin origin/main:refs/heads/vercel` ใน carmen-backstage (fast-forward ได้ — vercel..main มีแค่งานเปลี่ยนชื่อ) — ระบบสิทธิ์ของ Claude ปฏิเสธ push production
  2. production แอปหลัก: **ยังไม่ควร push** — vercel ตามหลัง main 640 commit รวมงาน POS ที่มีลำดับ deploy บังคับ; `<title>` ใหม่จะขึ้นพร้อมรอบ deploy ปกติของ inventory
  3. ~~backend-v2 (#914) และ micro-notification (#16) ยังไม่ขึ้น DEV~~ — ขึ้น DEV แล้วด้วยการ deploy มือ (2026-10-26, รวมอยู่ใน backend #921+ / micro-notification #18)
  4. ตรวจหน้าจอจริง: Login จอใหญ่ (แผงโลโก้ CARMEN BLUE / BACKSTAGE), Landing, Platform Config → การ์ด Google sign-in (TH/EN) — Claude ตรวจในเบราว์เซอร์ไม่ได้ (นโยบายบล็อกโฮสต์ dev.blueledgers.com) ตรวจได้แค่ด้วย curl
  5. ส่งอีเมลทดสอบจากหน้า Email Settings (หลัง micro-notification ขึ้น DEV) → หัวเรื่อง "Carmen Blue Backstage email test"
- **คำถามที่ค้างอยู่:** ไม่มี
- **อัปเดตล่าสุด:** 2026-10-26

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
- [ ] 1.7 deploy DEV + ตรวจ — คอนโซล, backend, micro-notification ขึ้น DEV ครบแล้ว (2026-10-26); เหลือตรวจหน้าจอจริง + ส่งอีเมลทดสอบ (ผู้ใช้)
- [ ] 1.8 ขึ้น production — ค้าง (ผู้ใช้ push เอง ดู "สถานะปัจจุบัน")

## โปรเจกต์ 2 — ชื่อ repo, package, deploy path

- [x] 2.1 brainstorm · [x] 2.2 spec `docs/superpowers/specs/2026-10-25-carmen-blue-backstage-rename-p2-design.md` · [x] 2.3 ผู้ใช้สั่ง "ทำได้เลย" (ไม่ทำ plan แยก) · [x] 2.5 ลงมือ · [x] 2.6 PR/merge · [x] 2.7 ตรวจ (2026-10-25)
- rename 8 repo บน GitHub; ชื่อ `carmen-mobile`/`carmen-turborepo-backend` เดิมเป็น redirect ของ repo ที่โอนไป `CarmenSoftware-dev` → ผู้ใช้สั่งเปลี่ยนตัวเก่าเป็น `carmen-mobile-app_old`, `carmen-turborepo-backend_old`
- PR แทนชื่อในเอกสาร/package/lockfile/path พี่น้อง (merged): backstage #363, backstage-e2e #17, backstage-support-usermanual #5, frontend #441, frontend-e2e #77, mobile #5, god-mode #30, turborepo-backend #915, bruno #39, micro-file #9, micro-keycloak #9, micro-notification #17, micro-report #67, wiki #22
- ตรวจ: bun install --frozen-lockfile + typecheck ผ่าน 6 repo FE; raw URL fixture ใหม่ของ backend ตอบ 200
- **ส่งต่อโปรเจกต์ 3:** path บนเซิร์ฟเวอร์ (`/var/www/carmen-platform`, `/var/www/carmen-inventory`, `$HOME/carmen-turborepo-backend-v2`, `/root/carmen-inventory-god-mode`), ทั้ง `infra/` (bucket `carmen-platform-web`, **WIF `github_repo` ต้อง apply ก่อนรัน deploy-gcs.yml ครั้งถัดไป** — OIDC claim เป็นชื่อใหม่แล้ว), `.cloudbuild` trigger `carmen-platform-deploy`, ชื่อ image/registry (`docker-compose.yml`, `scripts/deploy-docker.sh`)
- **ส่งต่อโปรเจกต์ 4:** OTel `SERVICE_NAME = 'carmen-platform'` (`src/lib/telemetry.ts`), Expo `slug: carmen-inventory-mobile` (`carmen-mobile/app.json` — ผูก EAS)

## โปรเจกต์ 3 — โดเมนและระบบภายนอก

- [x] 3.1 brainstorm — ผู้ใช้: "ไม่มีใครใช้จริง ยังอยู่ใน dev stage ทำได้เลย" + "ทำใน dev (ssh root@dev.blueledgers.com -p 2206) ได้เลย ยกเว้น GCP ไม่ต้องทำ" → ข้าม spec/plan · [x] 3.5 ลงมือ · [x] 3.6 PR/merge · [x] 3.7 ตรวจ (2026-10-26)
- **เครื่อง DEV** (backup ก่อนแก้: `/root/rename-p3-backup-20261025-165948.tgz` — nginx sites, init.d god-mode, gateway `.env`):
  - `/var/www/carmen-platform` → `/var/www/carmen-backstage`, `/var/www/carmen-inventory` → `/var/www/carmen-frontend`; nginx site + ชื่อไฟล์ log เปลี่ยนตาม (`sites-*/carmen-backstage`, `carmen-frontend`); log เก่า `carmen-platform.*.log` / `carmen-inventory.*.log` ยังค้างอยู่ใน `/var/log/nginx` ไม่ได้ลบ
  - `/root/carmen-inventory-god-mode` → `/root/carmen-god-mode` (`/etc/init.d/carmen-god-mode` แก้ `directory=`)
  - `/root/carmen-turborepo-backend-v2` → `/root/carmen-turborepo-backend`; `/root/deploy-all.sh` symlink ชี้ใหม่; restart gateway/business/cluster จากโฟลเดอร์ใหม่
  - git remote ของ checkout บนเครื่องชี้ชื่อ repo ใหม่ (backend, god-mode)
  - gateway `.env` `CORS_ALLOWED_ORIGINS` เติม `https://carmen-backstage.vercel.app,https://carmen-frontend.vercel.app` (ของเก่ายังอยู่)
- **Vercel:** project → `carmen-backstage`, `carmen-frontend`, `carmen-god-mode`, `carmen-backstage-support-usermanual`; เพิ่มโดเมน `carmen-backstage.vercel.app`, `carmen-frontend.vercel.app` — โดเมนเดิม (`carmen-inventory-platform.vercel.app`, `carmen-inventory.vercel.app`) **ยังติดอยู่โดยตั้งใจ** ถอดได้เมื่อไม่มีใครใช้ลิงก์เก่า (ถอดแล้วชื่อ `*.vercel.app` อาจถูกคนอื่นจองไป)
- **โค้ด:** workflow deploy-dev ของ backstage/frontend/god-mode + build.yml backend ชี้ path ใหม่; ชื่อ docker image `carmen-frontend` (ถ้าเคย push ไป ECR ต้องสร้าง repository ชื่อใหม่ก่อน); `nginx/carmen-backstage.conf` ใน backend; `.env.example` CORS
- **ไม่ได้ทำ (ผู้ใช้สั่ง):** GCP ทั้งหมด — `infra/gcp` (bucket `carmen-platform-web`, WIF `github_repo` — deploy-gcs.yml จะล้มที่ auth จนกว่าจะ apply), `.cloudbuild` trigger `carmen-platform-*`
- **ข้อยกเว้นอื่น:** `CARMEN_PLATFORM_WEB_URL` (ชื่อ env var) → โปรเจกต์ 4; บน DEV ไม่ได้ตั้งค่านี้ใน gateway `.env`

## โปรเจกต์ 4 — ตัวระบุในโค้ด

- [x] 4.1 brainstorm — ผู้ใช้: "ทำโปรเจกต์ 4 ต่อเลย"; ตัดสิน: ค่าที่เก็บใน DB ย้ายไปโปรเจกต์ 5 · ตัดเปลี่ยนตรง ไม่มี route คู่ · ข้าม spec/plan · แบ่ง 4 slice · [x] 4.5 ลงมือ · [x] 4.6 PR/merge · [x] 4.7 deploy DEV + ตรวจ (2026-10-26)
- **4a ข้อความ UI** — backstage #366: ค่า i18n en/th "Platform" → "Backstage" (ความหมายผลิตภัณฑ์ทั้งตระกูล → "Carmen Blue"), docs/ui
- **4b route** `api-system/platform/*` → `api-system/backstage/*` (20 controller) — backend #917, backstage #367, bruno #40, backstage-e2e #18; deploy backend DEV มือผ่าน SSH (Actions ติด billing) ก่อน merge คอนโซล; ตรวจ: route ใหม่ 401 / เก่า 404
- **4c env var** `PLATFORM_*` → `BACKSTAGE_*` (`CARMEN_BACKSTAGE_WEB_URL`, `BACKSTAGE_DEPLOY_TOKEN`, `BACKSTAGE_PERMISSION_MODE`, `BACKSTAGE_PRISMA_*`, `BACKSTAGE_*_TIMEOUT_MS`, `BACKSTAGE_DATABASE_URL`, `BACKSTAGE_SCHEMA`, `BACKSTAGE_PACKAGE_DIR`) — backend #918, micro-data #28, micro-report #68, micro-cronjobs #16, god-mode #32; DEV `.env`: micro-data/micro-report เหลือแต่คีย์ใหม่ (ตรวจแล้วต่อ DB ได้), backup `.env.bak.p4c`
  - ⚠️ **micro-cronjobs ยังไม่ deploy** — main มีงาน POS Simphony ของคนอื่นที่ยังไม่ขึ้น DEV; `.env` มีทั้ง `PLATFORM_SCHEMA` และ `BACKSTAGE_SCHEMA` → ลบคีย์เก่าหลัง deploy รอบถัดไป
- **4d ชื่อภายใน** — backend #919 (320 git mv, RPC pattern 36, error code wire 5 ตัว `PLATFORM_*`/`USER_PLATFORM_*` → `BACKSTAGE_*`, swagger tag), micro-data #29, micro-report #69 (identifier Go), backstage #368 (37 ไฟล์, i18n key, SPA route `/platform/*` → `/backstage/*` + redirect จาก path เก่า, OTel `carmen-backstage`, localStorage `*_user_backstage` — ค่าที่จำไว้รีเซ็ต), frontend #443 (message key error code)
  - ตรวจ: tsc ไม่มี error ใหม่; jest gateway 475/475, cluster 43/43, business 448/451 (3 suite แดงเหมือน main); audit เท่ากับ main ทุกตัว (แก้ชื่อ guard ใน `check.api-system-permission-coverage.ts`); DEV: gateway map 176 route `backstage` / 0 `platform`, micro-data/report "connected to backstage database"
  - SigNoz: service name คอนโซลแยกเป็น `carmen-backstage` นับจาก 2026-10-26 (ประวัติเก่าอยู่ใต้ `carmen-platform`)
- **ไม่ได้ทำ (ตั้งใจ):** Expo slug `carmen-inventory-mobile` (ผูก EAS, ไม่เกี่ยวกับ platform); RPC `notifications.platform-email-*` + `PlatformEmail*` ใน notification-contract (เจ้าของคือ repo micro-notification — ต้องเปลี่ยนคู่กัน); เอกสารนอกโฟลเดอร์ที่สแกน (root `CLAUDE.md`/`AGENTS.md`/skills ของ backend, `docs/*.md`) ยังอ้างชื่อเก่าบางจุด; route `/api/user/permission/platform` (คนละ backend `/api` — ให้ผู้ใช้ตัดสิน)

## โปรเจกต์ 5 — ฐานข้อมูล

- [x] 5.1 brainstorm — ผู้ใช้: "DEV อย่างเดียว ยังไม่มีใครใช้จริง ทำได้เลย" · [x] 5.2 spec `docs/superpowers/specs/2026-10-26-carmen-blue-backstage-rename-p5-design.md` (2026-10-26) · ข้ามอนุมัติ/plan ตามคำสั่ง · [x] 5.5 ลงมือ 5a · [x] 5.5 ลงมือ 5b · [x] 5.6 PR/merge · [x] 5.7 apply **DEV เท่านั้น** (2026-10-26) (UAT/production จะได้ migration ตอน deploy backend รอบถัดไป — ผู้ใช้รับทราบ)
- **5a merged + DEV:** backend #920 (migration `20261026120000_rename_platform_values_to_backstage` — ไม่ auto-apply ต้องรัน `db:deploy` เอง), คอนโซล #371, god-mode #33, bruno #41 · ตรวจ: ค่าใน DB เปลี่ยนครบ, `/api/user/permission/backstage` 401 / `/platform` 404, bundle คอนโซลไม่มี route เก่า
- **5b merged + DEV:** backend #921 (migration `20261026130000_rename_platform_tables_to_backstage` — RENAME ตาราง 6/คอลัมน์ 3/pkey 6/fkey 3/index 12), micro-notification #18, god-mode #34, คอนโซล #372 (filter `backstage_role_id`), แอปหลัก #444 (comment) · publish `prisma-shared-schema-backstage@1.0.0` + `notification-contract@2.0.1` · ตรวจ: ไม่เหลือตาราง `tb_platform_*`, role-permission 323 แถวอยู่ครบ, log backend ไม่มี 42P01, micro-notification healthy + dist อ่าน `tb_backstage_config`
- **กับดักที่เจอ:** โฟลเดอร์ package เปลี่ยนชื่อ → `.env` (gitignored) ไม่ตามมา ต้อง `cp` จากโฟลเดอร์เก่าบนเครื่อง DEV ก่อน `db:deploy` (UAT/production ก็ต้องทำ) · micro-notification ต้อง `NODE_AUTH_TOKEN` ตอน deploy เพราะ dependency เปลี่ยน
- **เก็บกวาดหลังโปรเจกต์ 5 (2026-10-26):** `generate-test-user-bu` ใช้ `tb_backstage_*` + route `/api-system/backstage/*` แล้ว (route `/platform` ก็พังมาตั้งแต่ 4b) · `audit:backstage-permission-resource` + `BACKSTAGE_PERMISSION_RESOURCE_SEED` (backend #922) · bun.lock sync notification-contract 2.0.1 (#923 — lock เก่าทำ `git pull` บน DEV ล้ม) · ลบโฟลเดอร์ package เก่าบน DEV แล้ว (สำรอง `.env` ไว้ `/root/rename-p5-oldpkg-env.tgz`) · god-mode health check แก้แล้ว (god-mode #35 ยิง `127.0.0.1:$PORT` แทน nginx :9903) · ลบ `PLATFORM_SCHEMA` จาก `.env` micro-cronjobs บน DEV แล้ว (โค้ดเก่าที่รันอยู่ fallback เป็น `CARMEN_SYSTEM` = ค่าเดิม, โค้ด main อ่าน `BACKSTAGE_SCHEMA`; สำรอง `.env.bak.p5-cleanup`; ไม่ได้ restart)
- **ตั้งใจไม่แก้:** index `platform_dashboard_*` 2 ตัวอยู่บนตาราง backup `tb_dashboard_*_widget_bak_20261006` (ตารางจริงถูก DROP ใน migration 20261006)
- ผลสำรวจ DEV: ไม่มี DB `carmen_platform` (ตารางอยู่ใน schema `CARMEN_SYSTEM` ของ DB `postgres`) → ไม่ต้องเปลี่ยนชื่อฐานข้อมูล; `api_name` ไม่มีในแถวข้อมูล
- **รับงานต่อจากโปรเจกต์ 4 (ค่าที่เก็บใน DB / ผูกกับ schema):**
  - permission key `platform_role.*`, `platform_config.*`, `user_platform.*`, `platform_migration` (seed + ข้อมูลใน DB + `<Can>` ฝั่ง FE)
  - `api_name` เช่น `platform-config.get`, `platform-role.findAll` (เก็บต่อ application ใน DB + `app-api-catalog.generated.ts`)
  - config key ใน DB (`platform_migration.api_enabled`, `google_sign_in` JSON key `platform`), feature-flag key (`platform_config`, `platform_roles`, `user_platform`, `platform_migrations`)
  - literal `'platform'` บนสาย: OAuth `target=platform` + state `${nonce}.platform.`, body `{ type: 'platform' }`, `EntityOwnership.kind`, `AuditScope`, `summary.platform_wide`, `tenant_id: 'platform'`, seed script id `seed-platform-*`
  - package `@repo/prisma-shared-schema-platform` (ชื่อ + โฟลเดอร์ — ใช้ใน micro-notification 20 ไฟล์, god-mode 7 ไฟล์ผ่าน `BACKSTAGE_PACKAGE_DIR`, คอนโซล 1, แอปหลัก 2)
  - Prisma model `tb_platform_*` + คอลัมน์ `platform_*_id` + DB `carmen_platform`
- ประเด็นที่รู้แล้ว: แยกจากโปรเจกต์ 4 เพื่อให้ย้อนกลับได้; ต้องมีหน้าต่าง downtime; push กิ่งที่มี migration = apply DEV อัตโนมัติภายใน ~2 นาที (ระวัง)
