---
title: Recharts ต้องการ react-is เป็น peer dep
author: Thammanoon
date: 2026-11-09
id: l-1c8a3561
scope: repo
status: active
touches:
  - bun.lock
  - package-lock.json
  - ".github/workflows/verify.yml"
---

## Decided
`recharts` ประกาศ `react-is` เป็น **peerDependency** และ repo นี้มี `.npmrc` ตั้ง
`legacy-peer-deps=true` → npm ไม่ติดตั้ง peer ให้ → clean install (Vercel) ไม่มี
`react-is` เลย, Rolldown ล้มด้วย `failed to resolve import "react-is"`

**Why:** เครื่อง dev build ผ่านเสมอเพราะ bun เผอิญ hoist `react-is@17.0.2` ขึ้น
top-level (ติดมากับ `pretty-format` ใน testing stack) — recharts หาเจอโดยบังเอิญ
ไม่ใช่เพราะประกาศไว้ บั๊กนี้จึงเป็นไปได้ที่จะหลุด CI ทุกครั้งที่ CI ใช้ bun อย่างเดียว
เกิดมาแล้ว **สองรอบ**: `c73285a` (2 ก.ค.) แก้ครั้งแรก → `c9406d1` ถอด recharts
ก็ถอด react-is ตาม → `aedcc24` (6 ส.ค.) เอา recharts กลับมาโดยลืม react-is

## Watch out
- ถ้าเห็น "resolve ไม่เจอ" เฉพาะบน CI/Vercel แต่ local ผ่าน → สงสัย peer dep +
  package manager hoisting ก่อนเสมอ; ทดสอบด้วย clean `npm ci` ใน temp dir ไม่ใช่
  build ในเครื่อง (build ในเครื่องคือสิ่งที่ปล่อยให้บั๊กหลุดมาตั้งแต่แรก)
- repo มี **2 lockfile**: `bun.lock` (ที่ dev ใช้) + `package-lock.json` (ที่ Vercel
  อ่าน) ตัวหลัง stale ได้ง่ายมาก — รอบนี้เก่ากว่าเดือนนึงและไม่มี recharts อยู่เลย
  เพิ่ม dep ใหม่ต้องอัปเดตทั้งสอง (`bun install` + `npm install --package-lock-only`)
- **guard ที่มีแล้ว:** PR #79 เพิ่ม job `verify-npm` ใน `.github/workflows/verify.yml`
…

_From Claude Code's memory of this repo, last updated Aug 6._
