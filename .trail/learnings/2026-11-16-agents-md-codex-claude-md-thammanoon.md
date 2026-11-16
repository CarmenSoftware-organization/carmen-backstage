---
title: AGENTS.md ของ Codex เป็นสำเนาเต็มของ CLAUDE.md ต้องแก้คู่กันเสมอ
author: Thammanoon
date: 2026-11-16
branch: main
cost: { minutes: 1, tokens: 1684 }
id: l-d5ce3761
scope: repo
status: active
src: agent
touches:
  - AGENTS.md
  - CLAUDE.md
---

## Decided
AGENTS.md ทั้ง 4 ไฟล์ (ที่ root และใน src/pages, src/services, src/components) เป็นสำเนาเต็มของ CLAUDE.md ที่คู่กัน ไม่ได้เป็นไฟล์สั้นที่ชี้ไป CLAUDE.md เพราะแบบสั้นทำให้ Codex ต้องตามลิงก์ไปอ่านอีกไฟล์ก่อนจะได้กฎของรีโป

## Watch out
- แก้ CLAUDE.md แล้วต้องแก้ AGENTS.md ที่คู่กันด้วย เพราะไม่มีด่านไหนจับได้ถ้าสองไฟล์ไม่ตรงกัน แล้ว Codex จะทำตามกฎเก่า
- อย่าแทนคำว่า "claude" ด้วย "Codex" ทั้งไฟล์แบบหาแล้วแทน เพราะรอบแรกทำแบบนั้นแล้วได้ path สกิล `.Codex/skills/` ที่ไม่มีอยู่จริง ทำให้ Codex หาสกิล release/deploy ไม่เจอ สกิลอยู่ที่ `.agents/skills/`

In the code: `AGENTS.md`, `src/{pages,services,components}/AGENTS.md`, `.agents/skills/`. เช็คด้วย `diff CLAUDE.md AGENTS.md` ความต่างที่ตั้งใจไว้มีแค่หัวไฟล์ ชื่อไฟล์ที่อ้างถึง และ path ของสกิล
