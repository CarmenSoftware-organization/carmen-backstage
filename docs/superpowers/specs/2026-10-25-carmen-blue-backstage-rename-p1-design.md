# โปรเจกต์ 1: ชื่อที่ผู้ใช้เห็น — Carmen Blue Backstage / Carmen Blue Platform

วันที่: 2026-10-25 · โปรเจกต์ที่ 1 จาก 5 ในงานเปลี่ยนชื่อ (สถานะรวม: `docs/superpowers/carmen-blue-backstage-rename-checklist.md`)
แม่แบบ: การเปลี่ยนชื่อรอบก่อน `../carmen-inventory-frontend-react/docs/superpowers/specs/2026-10-21-carmen-blue-rename-design.md`

## ทำไม

Owner กำหนดให้ "Carmen Blue Platform" เป็นชื่อของ **แอปหลัก** ที่ผู้ใช้งานจริงใช้ (`carmen-inventory-frontend-react`)
ส่วนคอนโซลผู้ดูแลนี้ (`carmen-platform`) ทำงานเบื้องหลัง จึงเปลี่ยนเป็น **Carmen Blue Backstage**
ตอนนี้ชื่อสลับที่กันอยู่: คอนโซลเรียกตัวเองว่า "Carmen Blue Platform" (ตั้งเมื่อ 21 ต.ค., PR #359) ส่วนแอปหลักเรียกตัวเองว่า "Carmen Blue"

โปรเจกต์นี้แก้เฉพาะ **ข้อความที่คนเห็น** — ชื่อ repo, โดเมน, identifier ในโค้ด และฐานข้อมูลอยู่ในโปรเจกต์ 2–5

## ตารางชื่อ (กติกาหลัก — ผู้ใช้ยืนยันแล้ว)

| หมายถึง | ใช้ชื่อ |
|---|---|
| แบรนด์ / ผลิตภัณฑ์ทั้งตระกูล | **Carmen Blue** (คงเดิม) |
| ตัวแอปหลักที่ผู้ใช้งานจริงเข้าใช้ | **Carmen Blue Platform** |
| คอนโซลผู้ดูแล (repo นี้) | **Carmen Blue Backstage** |

- ตัดสินจาก **ความหมาย** ไม่ใช่ตัวอักษร: "Carmen Blue Platform" ที่มีอยู่วันนี้ส่วนใหญ่หมายถึงคอนโซล → Backstage
  แต่ใน swagger backend บางประโยคหมายถึง **ทั้งระบบ** → "Carmen Blue"
- ภาษาไทยใช้อักษรโรมัน "Carmen Blue Backstage" ไม่ทับศัพท์ (ตามกติกาเดิม)
- ห้าม "CarmenBlue", "Carmen Blue Backstage Backstage", "Carmen Blue Platform Platform"

## เป้าหมาย

1. คอนโซลแสดงชื่อ "Carmen Blue Backstage" ทุกจุดที่ตอนนี้แสดง "Carmen Blue Platform"
2. แอปหลักแสดง "Carmen Blue Platform" ในจุดที่เป็น **ชื่อตัวแอป**
3. ข้อความนอก repo ที่หมายถึงคอนโซล (อีเมลทดสอบ, คู่มือ, e2e, wiki) ใช้ชื่อเดียวกัน

## ไม่ใช่เป้าหมาย

- ชื่อ repo, package, workflow, deploy path → โปรเจกต์ 2
- โดเมน, Vercel, nginx, CORS, OAuth → โปรเจกต์ 3
- identifier ในโค้ด (`PRODUCT_BRAND`, `platformConfig`, route `/platform/*`, env var) → โปรเจกต์ 4
- ฐานข้อมูล → โปรเจกต์ 5
- โลโก้ (`public/logo_*.svg`, wordmark ของแอปหลัก) และภาพหน้าจอในคู่มือ/wiki — ทำหลังมีโลโก้ใหม่ *(ผมตัดสินใจเอง)*
- ประวัติ: `CHANGELOG.md`, `src/data/changelog.json`, spec/plan ลงวันที่ใน `docs/superpowers/`, `.planning/`, `.superpowers/` *(ตามกติการอบก่อน)*
- ข้อมูลที่บันทึกใน DB แล้ว (เช่น `from_name` ของ sender profile) *(ผมตัดสินใจเอง)*

## Anti-goals

- find-and-replace แบบหว่าน "Platform" → "Backstage" จนแตะ identifier, คีย์ i18n, route, หรือคำว่า "Platform" เดี่ยว ๆ ที่ยกไปโปรเจกต์ 4
- เปลี่ยน "Carmen Blue" ที่หมายถึงแบรนด์เป็น "Carmen Blue Platform" (เช่น "Connections between Carmen Blue and…")
- ข้อความในคู่มือ/e2e ไม่ตรงกับ UI หลังแก้

## ขอบเขตราย repo

### `carmen-platform` (คอนโซล) — "Carmen Blue Platform" → "Carmen Blue Backstage"

| ไฟล์ | จุด |
|---|---|
| `index.html` | `:7` meta description, `:12` `<title>` |
| `src/components/Sidebar.tsx` | `:56` `PRODUCT_BRAND.name`; comment `:76` |
| `src/components/ClusterAdminLayout.tsx` | comment `:24`, `:28` |
| `src/pages/Login.tsx` | `:243` heading |
| `src/i18n/en.ts` / `th.ts` | `pages.landing.brand` (en `:1017` / th `:784`), `googleSignInPlatform` (`:3844` / `:2704`), ข้อความ error Google (`:5047` / `:3992`) |
| เอกสารปัจจุบัน | `README.md:1`, `SITEMAP.md:3`, `docs/OVERVIEW.md:1,7`, `docs/ui/INDEX.md`, `docs/ui/project-config.md`, หัว `docs/ui/**` ที่เขียน "Carmen Blue Platform" |

- **การ์ด Google sign-in (`GoogleSignInConfigCard.tsx`) มีสองสวิตช์ — ต้องแก้ทั้งคู่** *(ผมตัดสินใจเอง, จาก builder check)*:
  - `googleSignInPlatform` "Carmen Blue Platform" → "Carmen Blue Backstage" (hint "The login page of this admin app." คงเดิม)
  - `googleSignInApp` "App" → "Carmen Blue Platform"; hint "The inventory web app and every other client that is not Platform."
    → "The main Carmen Blue Platform web app and every other client that is not Backstage." (th แปลตามความหมายเดียวกัน)
  - ตามแก้คู่มือ `site/screens/platform/platform-config.md` + `site/en/...` ให้ตรง
  - คีย์ i18n (`googleSignInPlatform`/`googleSignInApp`) คงเดิม → โปรเจกต์ 4
- ข้อความ error Google "No Carmen Blue Platform account…" มาจาก i18n ของคอนโซลเท่านั้น — แอปหลักใช้ข้อความกลาง "No account exists for this Google email address." (ตรวจแล้ว) เปลี่ยนเฉพาะคอนโซลได้
- meta description: "Carmen Blue Backstage - Management System" (คง "Management System") *(ผมตัดสินใจเอง)*
- `docs/ui/**`: เปลี่ยนเฉพาะ string "Carmen Blue Platform"; คำว่า "actor: Platform user" คงเดิม (โปรเจกต์ 4); prefix เอกสาร `CP-` คงเดิม (เป็น ID อ้างอิงข้ามเอกสาร) *(ผมตัดสินใจเอง)*
- `PRODUCT_BRAND` ถูกเทียบโดย `isProductBrand()` (`Sidebar.tsx:62`) — ผู้ใช้มีแค่ `Layout.tsx`, `ClusterAdminLayout.tsx`, `Sidebar.tsx` (ตรวจแล้ว 25 ต.ค.) ไม่มีค่าที่บันทึกไว้จากภายนอก เปลี่ยน string ได้ปลอดภัย
- `EmailSettingCard.test.tsx:112,115` ใช้ 'Carmen Platform' เป็นค่าที่ผู้ใช้พิมพ์ในฟอร์ม — เป็นข้อมูลทดสอบ ไม่ใช่ชื่อแอป → คงเดิม *(ผมตัดสินใจเอง)*
- `heroBody` ("Carmen Blue brings … into a single admin platform") — "Carmen Blue" เป็นแบรนด์ คงเดิม; "admin platform" → โปรเจกต์ 4
- ตรวจเทสต์ที่ assert ข้อความเดิม: `git grep -n "Carmen Blue Platform" -- 'src/**/*.test.*'` แล้วแก้ค่าที่คาดให้ตรง (แก้เทสต์เดิม ไม่ใช่เขียนใหม่)

### `carmen-inventory-frontend-react` (แอปหลัก) — ชื่อแอป → "Carmen Blue Platform"

| ไฟล์ | จุด |
|---|---|
| `index.html` | `:7` `<title>Carmen Blue</title>` → `Carmen Blue Platform` (+ meta description ถ้ามี) |

- **คงเดิม:** `messages/*.json` ทั้ง ~37 จุด — ทุกจุดหมายถึงแบรนด์ ("Your Carmen Blue account", "Connections between Carmen Blue…", "Carmen Blue API reference")
  *(ผมจัดเอง: บัญชีผู้ใช้ใช้ร่วมกันทั้งตระกูล จึงเป็น "Carmen Blue account")*
- **คงเดิม:** `alt="Carmen Blue"` ของโลโก้ (`app-sidebar.tsx`, `auth-split-shell.tsx`, `legal-page.tsx`, `api-docs.route.tsx`) และ `carmen-logo.tsx` `title` — alt ต้องตรงกับข้อความในภาพ wordmark ซึ่งเขียนว่า CARMEN BLUE จะเปลี่ยนพร้อมโลโก้ *(ผมตัดสินใจเอง)*
- **คงเดิม:** External API OpenAPI (`lib/external-api/openapi*.json`) — เป็น API ของผลิตภัณฑ์ ใช้ชื่อแบรนด์
- **CSP:** `index.html` มี inline script hash — การเปลี่ยน `<title>` ไม่กระทบ แต่ถ้าแตะ inline script ต้องอัปเดต sha256

### `carmen-turborepo-backend-v2` — swagger

| ไฟล์ | หมายถึง | เป็น |
|---|---|---|
| `platform-user.controller.ts:89,347,568` | ทั้งระบบ (ผู้ใช้ระดับระบบ) | "Carmen Blue" |
| `platform_clusters.controller.ts:285` | ทั้งระบบ (onboard โรงแรม) | "Carmen Blue" |
| `platform_email-settings/swagger/request.ts:29,79`, `response.ts:24` | ตัวอย่าง `from_name` ของอีเมลที่คอนโซลส่ง | "Carmen Blue Backstage" |

- ถ้ามี OpenAPI snapshot/generated ที่ต้อง regenerate ให้ regenerate; ถ้า generator ลากความต่างอื่นมาด้วยให้หยุดรายงาน
- รัน audit gate ของ backend-v2 ก่อน push (ดู memory `reference_backend_v2_audit_gates`)

### `carmen-turborepo-backend-bruno`

- 4 ไฟล์ `.bru` ที่ copy คำอธิบายจาก swagger → ให้ตรงกับ backend หลังแก้ (sync จาก swagger ถ้ามีสคริปต์ ไม่งั้นแก้มือให้ตรงตัวอักษร)

### `micro-notification`

- `src/platform-email/platform-email.service.ts:145,147,149` — อีเมลทดสอบที่ส่งจากหน้า Email Settings ของคอนโซล → "Carmen Blue Backstage"
- แก้ spec ที่ assert ข้อความเดิม (ถ้ามี)

### `carmen-platform-support-usermanual` (คู่มือของคอนโซล)

- "Carmen Blue Platform" ~23 จุดใน 8 ไฟล์ (`README.md`, `site/.vitepress/config.mts`, `site/{,en/}index.md`, `site/{,en/}getting-started/login.md`, `site/{,en/}screens/platform/platform-config.md`) → "Carmen Blue Backstage"
  — คู่มือเล่มนี้เป็นของคอนโซลล้วน แทนได้ทุกจุด ยกเว้นประโยคที่หมายถึงแอปหลัก/สวิตช์ App ในหน้า platform-config (ใช้ตารางชื่อ)
  (ตัวเลข ~72 จากการสำรวจรวมชื่อ repo `carmen-platform` ด้วย ซึ่งเป็นงานโปรเจกต์ 2)
- ข้อความที่ quote UI ต้องตรงกับ i18n ของคอนโซลหลังแก้ (เช่นข้อความ error Google)
- **ลำดับ:** merge หลัง PR ของ `carmen-platform`

### `carmen-platform-e2e`

- `scripts/capture-screens.ts:3` comment, `tests/auth/login.spec.ts:23,30` annotation/comment → "Carmen Blue Backstage"
- ไม่มี assertion ผูกกับชื่อ (ตรวจรอบก่อน) — ถ้าเจอให้แก้ค่าที่คาด

### `carmen-wiki`

- เฉพาะเล่ม/หน้าที่พูดถึงคอนโซล: "Carmen Blue Platform" → "Carmen Blue Backstage"; ที่หมายถึงแอปหลักเดิมเรียก "Carmen Blue" — ปล่อยไว้ ยกเว้นตรงที่หมายถึงตัวแอปชัดเจน
- **มีไฟล์ค้างไม่ commit** (รอบก่อน 239 ไฟล์ .png) — ห้ามแตะ/ทับ ทำใน worktree แยก ถ้าเป้าหมายทับไฟล์ค้างให้ข้ามแล้วรายงาน

### นอกขอบเขต (ตรวจแล้ว ไม่มีชื่อคอนโซล)

`micro-report`, `micro-data`, `carmen-inventory-mobile`, `carmen-inventory-god-mode`, `carmen-inventory-frontend-e2e`
(`carmen_platform` ใน god-mode/micro-data คือชื่อ DB → โปรเจกต์ 5)

## ลำดับ

1. `carmen-platform`, `carmen-inventory-frontend-react`, `micro-notification`, `backend-v2` → `bruno` — ไม่มี contract เปลี่ยน merge ลำดับไหนก็ได้
2. `carmen-platform-support-usermanual`, `carmen-platform-e2e`, `carmen-wiki` — หลัง `carmen-platform` merge (ต้อง quote ข้อความใหม่)

## ข้อควรระวัง

- **ทำทุก repo ใน worktree แยกจาก `origin/main`** — ผู้ใช้รันหลายเซสชันพร้อมกัน ห้าม stash/reset/checkout ทับไฟล์ค้าง
- subagent ที่ทำงานใน repo พี่น้องต้องได้ชื่อ branch ชัดเจน ไม่งั้นมัน commit ลง main
- push `main` ของ `carmen-platform` = deploy DEV อัตโนมัติ; production (Vercel) ต้อง `git push origin main:vercel` แยก — ต้องได้รับอนุมัติ
- backend-v2 / micro-notification: push `main` = deploy DEV อัตโนมัติ (ถ้า Actions ไม่ติด billing)
- static check: `bun run typecheck` + `bun run lint` ทุก repo ที่มี; ชุดเทสต์เดิมต้องผ่าน

## ตรวจว่าเสร็จ

- `git grep -n "Carmen Blue Platform"` ใน `carmen-platform` (นอกประวัติ) เหลือเฉพาะจุดที่ตั้งใจหมายถึงแอปหลัก (`googleSignInApp` + hint, en/th) — ตรวจทีละบรรทัดว่าไม่มีจุดอื่น
- `git grep -n -E "Carmen Blue Platform"` ใน backend-v2, micro-notification, e2e, bruno = 0 (ยกเว้นประวัติ); usermanual เหลือเฉพาะจุดที่หมายถึงแอปหลักในหน้า platform-config
- แอปหลัก: แท็บเบราว์เซอร์แสดง "Carmen Blue Platform"
- คอนโซลบน DEV: แท็บ, sidebar, Landing, Login, การ์ด Google sign-in แสดง "Carmen Blue Backstage" ทั้ง TH/EN
- ส่งอีเมลทดสอบจากหน้า Email Settings → หัวเรื่อง "Carmen Blue Backstage email test"
- grep กันพลาด: `Carmen Blue Backstage Backstage|Carmen Blue Platform Platform|CarmenBlue` = 0

## ตัดสินแล้ว: คำว่า "Platform" เดี่ยว ๆ ใน UI คอนโซล → โปรเจกต์ 4

~90 ข้อความ EN / ~86 TH เช่นเมนู "Platform Config", "Platform Users", "Platform Roles", "Platform Migrations",
"platform administrator", "platform database", และ "actor: Platform user" ใน `docs/ui/**` — **ไม่แตะในโปรเจกต์นี้**
ย้ายไปเปลี่ยนพร้อม route `/platform/*`, permission และ API ในโปรเจกต์ 4 (ผู้ใช้ตกลง 2026-10-25: "ทั้งหมดยังอยู่ใน dev stage"
— ช่วงที่คอนโซลชื่อ Backstage แต่เมนูยังเขียน "Platform …" รับได้)
ข้อยกเว้นเดียว: hint ของสวิตช์ `googleSignInApp` ที่ต้องแก้เพราะอ้างชื่อคอนโซล (ดู §`carmen-platform`)
