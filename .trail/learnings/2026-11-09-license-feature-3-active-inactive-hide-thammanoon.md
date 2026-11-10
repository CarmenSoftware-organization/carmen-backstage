---
title: License feature ได้สถานะ 3 ค่า active/inactive/hide แทน is_active พร้อมหน้าจัดการ…
author: Thammanoon
date: 2026-11-09
id: l-390318a5
scope: repo
status: active
touches:
  - "src/constants/featureFlags.ts#FeatureState"
  - "src/utils/dialogXmlEdit.test.ts#read"
---

## Decided
**เสร็จ 2026-08-31** — `tb_license_feature` เลิกใช้ `is_active` เปลี่ยนเป็น
`state: enum_license_feature_state` (`active` / `inactive` / `hide`) สะกดตรงกับ `FeatureState`
ฝั่ง frontend เป๊ะ ไม่มีตัวแปลงกลางทาง

- `active` ติ๊กเข้ากลุ่มไหนก็ได้ · `inactive` กลุ่มที่ผูกไว้แล้วเก็บได้แต่เพิ่มใหม่ไม่ได้ ·
  `hide` หายจากแค็ตตาล็อกสนิท
- **ไม่มีค่าไหนกระทบสิทธิ์ runtime ของ BU ที่ซื้อไปแล้ว** — evaluator อ่าน
  `license-catalog.generated.ts` ไม่เคยอ่านตารางนี้ (พิสูจน์แล้วระดับข้อมูล)

PR: backend #451 (state + route + สิทธิ์) · frontend #203 (หน้า `/license-features`) ·
frontend #204 (แก้ปุ่มถูกตัดที่ 390px) · backend #453 (DROP `is_active`) — merged ครบ

**Why:** เดิม `tb_license_feature` seed จาก generator อย่างเดียว ผู้ดูแลหยุดขาย feature หนึ่งตัว
ไม่ได้เลยโดยไม่แก้โค้ดและ deploy ใหม่

## Watch out
- หัวใจของงานอยู่ที่ `seed.license-feature.ts` — สาขา `update` **ต้องไม่เขียน `state`**
  ถ้าเขียนเมื่อไร seed รอบถัดไปล้างค่าที่ผู้ดูแลเคาะทิ้งเงียบ ๆ ตรวจด้วยการรัน seed จริง
  แล้วดูว่าค่ารอด ไม่ใช่อ่านโค้ดแล้วสรุป (รันจริงแล้ว: `updated 76` แต่ทั้ง 3 ตัวรอด)
- กติกา "เก็บของเดิมได้ เพิ่มใหม่ไม่ได้" อยู่ใน `license-feature-group.service.ts` `setFeatures`
  — `PUT /features` เป็น replace semantics จึงต้องเทียบกับสมาชิกปัจจุบันของกลุ่มเอง
  อนุญาต = `state='active'` ∪ (คีย์ที่กลุ่มถืออยู่แล้วและ `inactive`)
…

_From Claude Code's memory of this repo, last updated Aug 31._
