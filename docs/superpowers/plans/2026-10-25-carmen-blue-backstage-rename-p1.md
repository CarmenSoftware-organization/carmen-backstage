# โปรเจกต์ 1: ชื่อที่ผู้ใช้เห็น — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** คอนโซลแสดงชื่อ "Carmen Blue Backstage", แอปหลักแสดง "Carmen Blue Platform" และข้อความที่เกี่ยวข้องใน 8 repo ใช้ชื่อตรงกัน

**Architecture:** แก้ข้อความล้วน ไม่มี identifier/contract เปลี่ยน — หนึ่ง task ต่อหนึ่ง repo = หนึ่ง PR ตัดสินแต่ละจุดตาม **ความหมาย** ตามตารางชื่อใน spec ไม่ใช่ find-and-replace

**Tech Stack:** React/Vite (bun), NestJS (bun/jest), VitePress, Playwright, Bruno, Markdown

**Spec:** `docs/superpowers/specs/2026-10-25-carmen-blue-backstage-rename-p1-design.md` · **สถานะรวม:** `docs/superpowers/carmen-blue-backstage-rename-checklist.md`

## Global Constraints

- ตารางชื่อ: แบรนด์/ทั้งตระกูล = **Carmen Blue** · แอปหลัก = **Carmen Blue Platform** · คอนโซล = **Carmen Blue Backstage**
- ไทยใช้อักษรโรมัน "Carmen Blue Backstage" ไม่ทับศัพท์
- **ห้ามแตะ:** คำว่า "Platform"/"platform" เดี่ยว ๆ (เมนู Platform Config/Users/Roles/Migrations, "platform administrator", "admin platform", "actor: Platform user") — เป็นงานโปรเจกต์ 4; คีย์ i18n; identifier (`PRODUCT_BRAND`, `googleSignInPlatform`, `platform-email`, ฯลฯ); ชื่อ repo `carmen-platform*`; prefix `CP-`; โลโก้/alt โลโก้; `CHANGELOG.md`, `src/data/changelog.json`, ไฟล์ลงวันที่ใน `docs/superpowers/`, `.planning/`, `.superpowers/`
- **ไม่เขียนเทสต์ใหม่** (ความต้องการของผู้ใช้) — แก้เทสต์เดิมที่ assert ข้อความเก่าเท่านั้น; static check (typecheck/lint) + ชุดเทสต์เดิมต้องผ่าน
- repo พี่น้อง: ทำใน **worktree แยกจาก `origin/main`** บนกิ่ง `feature/carmen-blue-backstage-rename` — ห้าม stash/reset/checkout ทับไฟล์ค้างของเซสชันอื่น; ห้าม commit ลง `main`
- repo นี้ (`carmen-platform`): ทำบนกิ่งปัจจุบัน `feature/carmen-blue-backstage-rename`
- กันพลาดทุก repo หลังแก้: `git grep -n -E "Carmen Blue Backstage Backstage|Carmen Blue Platform Platform|CarmenBlue"` = ว่าง
- ห้าม push `main:vercel` หรือ merge เองโดยไม่ได้รับอนุมัติ

## Review Focus

1. **"Carmen Blue Platform" ที่ตั้งใจหมายถึงแอปหลักถูกแทนผิดเป็น Backstage** — สวิตช์ `googleSignInApp` และหน้าคู่มือ platform-config ต้องเหลือ "Carmen Blue Platform" สำหรับแอปหลัก (Task 1, 6: grep หลังแก้แล้วอ่านทุกบรรทัดที่เหลือ)
2. **คู่มือ quote ข้อความ UI ไม่ตรงตัวอักษรกับ i18n ใหม่** — ข้อความ error Google และป้ายสวิตช์ (Task 6 Step 3 เทียบกับ `src/i18n/{en,th}.ts`)
3. **คำว่า "Platform" เดี่ยว ๆ ถูกแทนไปด้วย** — diff ต้องไม่มีบรรทัดที่เปลี่ยน "Platform Config/Users/…" (ทุก task: ตรวจ `git diff` ก่อน commit)
4. **swagger ที่หมายถึงทั้งระบบถูกเปลี่ยนเป็น Backstage** แทน "Carmen Blue" (Task 3)
5. **Landing/Login แสดงชื่อใหม่ในภาษาเดียว** — ต้องตรวจทั้ง TH และ EN ในเบราว์เซอร์ (Task 9)

---

### Task 1: `carmen-platform` — คอนโซล → Carmen Blue Backstage

**Files (ทั้งหมดใน repo นี้):**
- Modify: `index.html:7,12`
- Modify: `src/components/Sidebar.tsx:56,76`
- Modify: `src/components/ClusterAdminLayout.tsx:24,28` (comment)
- Modify: `src/pages/Login.tsx:243`
- Modify: `src/i18n/en.ts:1017,3844,3846-3847,5047`
- Modify: `src/i18n/th.ts:784,2704,2706-2707,3992`
- Modify: `README.md:1`, `SITEMAP.md:3`, `docs/OVERVIEW.md:1,7`, `docs/ui/INDEX.md:1`, `docs/ui/project-config.md:2,12`, `docs/ui/modals/CP-MODAL-008-add-user-to-cluster.md:4`, `docs/ui/modules/CP-MOD-02-clusters.md:4`, `docs/ui/pages/CP-PAGE-006-cluster-list.md:4`, `docs/ui/pages/CP-PAGE-007-cluster-edit.md:4`

**Interfaces:** Produces — ข้อความ UI ใหม่ที่ Task 6 ต้อง quote ให้ตรง:
- en `googleNoAccount`: `'No Carmen Blue Backstage account exists for this Google email address. Ask an administrator to add you first.'`
- th: `'ไม่พบบัญชี Carmen Blue Backstage สำหรับอีเมล Google นี้ กรุณาให้ผู้ดูแลระบบเพิ่มบัญชีให้ก่อน'`
- ป้ายสวิตช์: `googleSignInPlatform` = `'Carmen Blue Backstage'` · `googleSignInApp` = `'Carmen Blue Platform'`

- [ ] **Step 1: แทน "Carmen Blue Platform" → "Carmen Blue Backstage"** ในทุกบรรทัดที่ระบุข้างบน ยกเว้นบรรทัดสวิตช์ App
  - `index.html:7` → `content="Carmen Blue Backstage - Management System"`; `:12` → `<title>Carmen Blue Backstage</title>`
  - `docs/ui/**`: เปลี่ยนเฉพาะ "Carmen Blue Platform" — "actor: Platform user" คงเดิม
- [ ] **Step 2: แก้สวิตช์ App (ข้อความกำหนดตายตัว)**
  - en `googleSignInApp: 'Carmen Blue Platform'`, `googleSignInAppHint: 'The main Carmen Blue Platform web app and every other client that is not Backstage.'`
  - th `googleSignInApp: 'Carmen Blue Platform'`, `googleSignInAppHint: 'เว็บหลัก Carmen Blue Platform และ client อื่นทุกตัวที่ไม่ใช่ Backstage'`
- [ ] **Step 3: ตรวจที่เหลือ**
  Run: `git grep -n "Carmen Blue Platform" -- . ':!docs/superpowers/**' ':!.planning/**' ':!.superpowers/**' ':!CHANGELOG.md' ':!src/data/changelog.json' ':!graft/**'`
  Expected: เหลือ 4 บรรทัด — `googleSignInApp` + `googleSignInAppHint` ใน en.ts และ th.ts เท่านั้น
- [ ] **Step 4: ตรวจว่า diff ไม่แตะ "Platform" เดี่ยว ๆ** — `git diff | grep '^[-+]' | grep -v "Carmen Blue"` ต้องไม่มีบรรทัดที่เปลี่ยนคำว่า Platform
- [ ] **Step 5: static check + เทสต์เดิม**
  Run: `bun run typecheck && bun run lint && bun run test`
  Expected: ผ่านทั้งหมด (ถ้าเทสต์ใด assert ข้อความเก่า ให้แก้ค่าที่คาด)
- [ ] **Step 6: Commit**
  ```bash
  git add index.html src/components/Sidebar.tsx src/components/ClusterAdminLayout.tsx src/pages/Login.tsx src/i18n/en.ts src/i18n/th.ts README.md SITEMAP.md docs/OVERVIEW.md docs/ui
  git commit -m "fix(branding): เปลี่ยนชื่อคอนโซลเป็น Carmen Blue Backstage"
  ```

### Task 2: `carmen-inventory-frontend-react` — แอปหลัก → Carmen Blue Platform

**Files:** Modify: `index.html:7`

- [ ] **Step 1: เตรียม worktree** — `git -C ../carmen-inventory-frontend-react fetch origin && git -C ../carmen-inventory-frontend-react worktree add ../carmen-inventory-frontend-react-rename -b feature/carmen-blue-backstage-rename origin/main` (ถ้าโฟลเดอร์ซ้ำ ใช้ชื่ออื่นแล้วรายงาน)
- [ ] **Step 2:** `<title>Carmen Blue</title>` → `<title>Carmen Blue Platform</title>` — ไม่แตะ meta description ("Hospitality Supply Chain"), inline script (CSP hash), `messages/*.json`, alt โลโก้
- [ ] **Step 3:** Run: `bun install --frozen-lockfile && bun run typecheck && bun run lint` — Expected: ผ่าน
- [ ] **Step 4: Commit** — `git commit -am "fix(branding): ตั้งชื่อแท็บแอปหลักเป็น Carmen Blue Platform"`

### Task 3: `carmen-turborepo-backend-v2` — swagger

**Files:**
- Modify: `apps/backend-gateway/src/platform/platform-user/platform-user.controller.ts:89,347,568` — "Carmen Blue Platform" → **"Carmen Blue"** (หมายถึงทั้งระบบ)
- Modify: `apps/backend-gateway/src/platform/platform_clusters/platform_clusters.controller.ts:285` — → **"Carmen Blue"**
- Modify: `apps/backend-gateway/src/platform/platform_email-settings/swagger/request.ts:29,79`, `swagger/response.ts:24` — example → **'Carmen Blue Backstage'**

- [ ] **Step 1:** worktree แบบเดียวกับ Task 2 (`../carmen-turborepo-backend-v2-rename`, กิ่ง `feature/carmen-blue-backstage-rename`)
- [ ] **Step 2:** แก้ 7 บรรทัดตามตาราง ตรวจไวยากรณ์หลังแทน เช่น "into the Carmen Blue database", "in the Carmen Blue."
- [ ] **Step 3:** ค้นว่ามี OpenAPI snapshot ที่ฝังข้อความเหล่านี้หรือไม่: `git grep -l "Onboards a new hotel chain"` — ถ้ามีไฟล์ generated ให้ regenerate ด้วยสคริปต์ของ repo; ถ้า regenerate ลากความต่างอื่นมาด้วย ให้หยุดและรายงาน
- [ ] **Step 4:** Run: `bun run gates` (หรือ audit gate ที่เกี่ยวข้อง — ห้ามใช้ `bun run lint` ระดับ root เพราะมี `--fix` เขียนทับทั้ง repo; ใช้ `bunx eslint <ไฟล์ที่แก้>`) — Expected: ผ่าน หรือแดงเฉพาะ gate ที่แดงอยู่แล้วบน main (เทียบกับ main แล้วรายงาน)
- [ ] **Step 5: Commit** — `git commit -am "docs(swagger): ปรับชื่อผลิตภัณฑ์ใน swagger ตาม Carmen Blue Backstage"`

### Task 4: `carmen-turborepo-backend-bruno` — sync คำอธิบาย

**Files:** Modify: `collections/carmen-inventory/platform/clusters/POST-create-cluster-platform-clusters.bru:43`, `.../platform-user/POST-fetch-users-platform-platform-user.bru:33`, `.../user/DELETE-delete-user-platform-user.bru:28`, `.../user/POST-create-user-platform-user.bru:42`

**Interfaces:** Consumes — ข้อความหลังแก้จาก Task 3 (ต้องตรงตัวอักษร)

- [ ] **Step 1:** worktree (`../carmen-turborepo-backend-bruno-rename`)
- [ ] **Step 2:** แทน "Carmen Blue Platform" → "Carmen Blue" ให้ข้อความตรงกับ controller ใน Task 3 ทุกตัวอักษร
- [ ] **Step 3:** `git grep -n "Carmen Blue Platform"` = ว่าง
- [ ] **Step 4: Commit** — `git commit -am "docs: sync คำอธิบายจาก swagger (Carmen Blue)"`

### Task 5: `micro-notification` — อีเมลทดสอบ

**Files:** Modify: `src/platform-email/platform-email.service.ts:145,147,149`

- [ ] **Step 1:** worktree (`../micro-notification-rename`)
- [ ] **Step 2:** "Carmen Blue Platform" → "Carmen Blue Backstage" ทั้ง 3 บรรทัด (subject = `'Carmen Blue Backstage email test'`)
- [ ] **Step 3:** Run: `bun run build && bunx eslint src/platform-email/platform-email.service.ts && bunx jest src/platform-email --runInBand --forceExit` — Expected: ผ่าน (ห้าม `bun run lint` เพราะมี `--fix` ทั้ง repo)
- [ ] **Step 4: Commit** — `git commit -am "fix(branding): อีเมลทดสอบใช้ชื่อ Carmen Blue Backstage"`

### Task 6: `carmen-platform-support-usermanual` — คู่มือคอนโซล

**Files:** Modify: `README.md:1,3`, `site/.vitepress/config.mts:29,38,39,68,69`, `site/index.md:5`, `site/en/index.md:5`, `site/getting-started/login.md:3,7,22,38,40,50`, `site/en/getting-started/login.md:3,7,22,38,40,50`, `site/screens/platform/platform-config.md` (แถวสวิตช์ Google ~:85), `site/en/screens/platform/platform-config.md` (~:85)

**Interfaces:** Consumes — ข้อความ UI จาก Task 1 Interfaces (ตรงตัวอักษร)

- [ ] **Step 1:** worktree (`../carmen-platform-support-usermanual-rename`)
- [ ] **Step 2:** แทน "Carmen Blue Platform" → "Carmen Blue Backstage" ทุกจุดที่หมายถึงคอนโซล (ทุกจุดในไฟล์ข้างบน ยกเว้นข้อ 3)
- [ ] **Step 3: หน้า platform-config (th/en)** — แถว `| **Carmen Blue Platform** |` → `| **Carmen Blue Backstage** |`; แถวสวิตช์ App (ถ้ามี) → ป้าย `**Carmen Blue Platform**` และคำอธิบายตาม hint ใหม่ของ Task 1; แถว error ในหน้า login ต้องตรงกับ `googleNoAccount` ของ Task 1 ทุกตัวอักษร
- [ ] **Step 4:** ตรวจ: `git grep -n "Carmen Blue Platform"` — Expected: เหลือเฉพาะแถวสวิตช์ App (หรือว่าง)
- [ ] **Step 5:** Run: `bun run typecheck` — Expected: ผ่าน
- [ ] **Step 6: Commit** — `git commit -am "docs(branding): เปลี่ยนชื่อในคู่มือเป็น Carmen Blue Backstage"` · PR body: "merge หลัง carmen-platform PR"

### Task 7: `carmen-platform-e2e` — annotation/comment

**Files:** Modify: `scripts/capture-screens.ts:3`, `tests/auth/login.spec.ts:23,30`

- [ ] **Step 1:** worktree (`../carmen-platform-e2e-rename`)
- [ ] **Step 2:** "Carmen Blue Platform" → "Carmen Blue Backstage" (ไม่แตะ `docs/superpowers/**`)
- [ ] **Step 3:** Run: `bun run typecheck` — Expected: ผ่าน
- [ ] **Step 4: Commit** — `git commit -am "test: ปรับ annotation เป็น Carmen Blue Backstage"`

### Task 8: `carmen-wiki` — เล่มคอนโซล

**Files:** 37 ไฟล์ 50 จุด (`git grep -l "Carmen Blue Platform"`) — ส่วนใหญ่ใต้ `en/platform/**`, `th/platform/**`, `home.md`, `overview.md`, `README.md`, `CLAUDE.md`

- [ ] **Step 1:** worktree (`../carmen-wiki-rename`) — ตรวจ `git -C ../carmen-wiki status --short` ก่อน ถ้ามีไฟล์ค้างที่ทับเป้าหมาย ข้ามไฟล์นั้นแล้วรายงาน
- [ ] **Step 2:** ทุกจุดที่เขียน "Carmen Blue Platform" ใน wiki ปัจจุบันหมายถึงคอนโซล (แอปหลักเรียก "Carmen Blue") → แทนเป็น "Carmen Blue Backstage"; อ่านทีละจุด ถ้าเจอประโยคที่หมายถึงทั้งระบบ ใช้ "Carmen Blue"
- [ ] **Step 3:** ไม่แตะ path/ลิงก์ (`/en/platform`, `prisma-shared-schema-platform`) และ "Platform" เดี่ยว ๆ
- [ ] **Step 4:** `git grep -n "Carmen Blue Platform"` = ว่าง
- [ ] **Step 5: Commit** — `git commit -am "docs(branding): เล่มคอนโซลใช้ชื่อ Carmen Blue Backstage"`

### Task 9: PR, merge, deploy DEV, ตรวจเบราว์เซอร์

- [ ] **Step 1:** push กิ่ง + เปิด PR ทั้ง 8 repo (body อ้าง spec + บอกลำดับ: Task 6/7/8 merge หลัง Task 1)
- [ ] **Step 2:** merge ตามลำดับเมื่อผู้ใช้อนุมัติ (`gh pr merge --auto` ได้ ไม่ต้องรอ CI วน)
- [ ] **Step 3:** ตรวจ DEV (`dev.blueledgers.com:9902`) ทั้ง TH/EN: แท็บ, sidebar, Landing, Login, Platform Config → การ์ด Google sign-in แสดง "Carmen Blue Backstage" + "Carmen Blue Platform"; แท็บแอปหลักแสดง "Carmen Blue Platform"
- [ ] **Step 4:** ส่งอีเมลทดสอบจากหน้า Email Settings → หัวเรื่อง "Carmen Blue Backstage email test" (ต้องรอ micro-notification ขึ้น DEV)
- [ ] **Step 5:** ขอผู้ใช้อนุมัติก่อน `git push origin main:vercel` (production)
- [ ] **Step 6:** อัปเดต checklist: ติ๊ก 1.5–1.8 + ลิงก์ PR, ย้าย "สถานะปัจจุบัน" ไปโปรเจกต์ 2 ขั้น 2.1; ลบ worktree ที่สร้าง
