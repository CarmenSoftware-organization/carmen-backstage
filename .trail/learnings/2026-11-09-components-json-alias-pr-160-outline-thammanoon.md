---
title: "Components.json + alias @/ ตั้งแล้ว (PR #160) พร้อมกับดัก outline-none และ vitest.config…"
author: Thammanoon
date: 2026-11-09
id: l-6a6bce7a
scope: repo
status: active
touches:
  - components.json
  - tailwind.config.js
  - src/index.css
---

## Decided
`bunx shadcn@latest add <name>` ใช้ได้แล้วตั้งแต่ PR #160 (27 ส.ค. 2026) — ก่อนหน้านั้น repo มี
22 primitive แต่ไม่มี `components.json` และไม่มี alias `@/` เลย ต้อง copy มือทุกครั้ง

**ทุกครั้งที่ `add` ต้องแก้ 1 อย่าง:** CLI เขียน `focus-visible:outline-none` แต่ repo ใช้
`outline-hidden` (51 ครั้ง vs 1) เพราะ Tailwind v4 เปลี่ยนความหมายของ `outline-none` —
ไม่แก้แล้ว lint ไม่แดง แต่ focus ring หายใน Windows High Contrast Mode

**`components.json` ชี้ `tailwind.config: "tailwind.config.js"` ไม่ใช่ `""` โดยตั้งใจ** —
`src/index.css` มี `@config` bridge อยู่ ถ้าตั้งเป็น v4 ล้วน CLI จะเขียน `size-4` + คาด `oklch()`
ซึ่งไม่เข้ากับ primitive เดิมที่เป็น `h-4 w-4` + `hsl(var(--x))` ดู project-tailwind-css-first-not-needed

**`vitest.config.ts` ไม่ merge กับ `vite.config.ts`** — vitest อ่านไฟล์นั้นแทนทั้งหมด alias จึง
ประกาศ 2 ที่ ถ้ามีใครไปลบออกที่ใดที่หนึ่ง อาการคือ **test แดงทั้งที่ typecheck กับ build เขียว**

**Why:** กับดักทั้งสามหาไม่เจอจากโค้ด — ตัวแรกกับตัวที่สองเห็นได้เฉพาะตอนเทียบ output ของ CLI
กับของเดิม ตัวที่สามเห็นตอน test แดงเท่านั้น

## Watch out
`add` ด้วย `--dry-run` ก่อนเสมอ → `add` จริง → แก้ `outline-none` →
`bun run typecheck && bun run lint`

งานที่คุยไว้แต่ยังไม่ทำ (ผู้ใช้เลือก "ขั้น 0 อย่างเดียว"): `<label>` ดิบ 11 ไฟล์, `<table>` ดิบ
15 ไฟล์ (0 ไฟล์ import `ui/table`), `selectClassName` copy-paste 4 ที่, checkbox ดิบ 2 จุดใน
`clusterEdit/sections/UsersSection.tsx` — ผู้ใช้สั่งชัดว่า `<select>` "ยังไม่แตะ คุยรอบหน้า"

_From Claude Code's memory of this repo, last updated Aug 30._
