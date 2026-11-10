---
title: "ครบ 3 แผน merged (FE #292 #293, BE #559) + push production 3d7c4cf"
author: Thammanoon
date: 2026-11-09
id: l-5ac3270f
scope: repo
status: active
touches:
  - docs/superpowers/specs/2026-09-09-sortable-column-headers-design.md
---

## Decided
งาน 2026-09-09: spec `docs/superpowers/specs/2026-09-09-sortable-column-headers-design.md` + แผน 3 ไฟล์
`docs/superpowers/plans/2026-09-09-sortable-headers-{1-frontend-a,2-backend,3-frontend-b}.md`
ลำดับบังคับ: FE-A → BE (carmen-turborepo-backend-v2) → FE-B (เปิดคอลัมน์กลุ่ม B ได้ก็ต่อเมื่อ BE ขึ้น DEV แล้ว
ไม่งั้น 500/422 ทุกคลิก)

- **FE-A:** PR #292 merged (squash 199c8d5) → DEV auto-deploy
- **BE:** PR #559 merged (squash 57d9c22c7) หลัง final review 2 รอบ — **Deploy Dev ล้มใน 3 วิ ไม่มี step รัน = Actions billing ของ repo private** (ล้มแบบเดียวกับ f656c51f2 ก่อนหน้า) → DEV backend ยังเป็นโค้ดเก่า; ต้องให้เจ้าของแก้ billing หรือ deploy มือ
- **FE-B:** PR #293 merged (squash 3d7c4cf) ตามคำสั่งเจ้าของ 9 ก.ย. 14:36 ทั้งที่ผมเตือนว่า backend ยังไม่ขึ้น DEV — และ `git push origin main:vercel` (e67ef0d→3d7c4cf ส่ง #288–#293 ทั้งชุด) → **production ชี้ DEV backend ตัวเดิม** จึงพัง 12 หัวคอลัมน์จนกว่า backend #559 จะ deploy · กิ่ง feature ลบหมดแล้วทั้ง 2 repo

**Why:** BE final review จับได้ว่า FE ที่ deploy แล้วเรียง broadcast ตาม scope/status ได้อยู่แล้ว การโยน unknown-key จะทำให้ 400 → เพิ่ม scope ใน whitelist + status เป็น bucket ก่อน merge · Applications/News backend ทิ้ง `sort` เงียบ (hardcode orderBy หลัง spread) — หัวคอลัมน์บนสองหน้านั้นที่
กดได้ตอนนี้ไม่มีผลจริงจนกว่า BE plan 2 จะขึ้น · โพรบบน DEV พิสูจน์แล้ว: Prisma JSON path `NOT {OR}` ได้ 0 แถว
สำหรับแถวที่ไม่มีคีย์ ต้องใช้ `equals: Prisma.DbNull` ที่ path

## Watch out
backend local (`bun run dev` watchers ใน backend-v2 checkout, gateway :4000) hot-reload จาก checkout ที่อยู่บน main → ใช้ตรวจ FE end-to-end แทน DEV ได้เมื่อ DEV ติด billing · ห้ามเปิดคอลัมน์กลุ่ม B ใน FE ก่อน BE ขึ้น DEV · TanStack ต้องมี accessorFn ถึงจะเป็นปุ่ม และ
accessorFn บนตาราง client-side จะติด global search → ใส่ `enableGlobalFilter: false` (บั๊กที่ final review จับได้)
· ดู licenses-table-sort project-cluster-view-column-sort feedback-auto-merge-dont-wait-for-ci

_From Claude Code's memory of this repo, last updated Sep 9._
