# โปรเจกต์ 2: ชื่อ repo, package, การอ้างอิงข้าม repo

วันที่: 2026-10-25 · โปรเจกต์ 2 จาก 5 (สถานะรวม: `docs/superpowers/carmen-blue-backstage-rename-checklist.md`)
ผู้ใช้สั่ง "ทำได้เลย" — ใช้คนเดียว ไม่ต้องนัดใคร

## ชื่อใหม่ (ผู้ใช้กำหนด)

| repo เดิม (GitHub) | ชื่อใหม่ | โฟลเดอร์ในเครื่องเดิม |
|---|---|---|
| `carmen-platform` | `carmen-backstage` | `carmen-platform` |
| `carmen-platform-e2e` | `carmen-backstage-e2e` | `carmen-platform-e2e` |
| `carmen-platform-usermanual` | `carmen-backstage-support-usermanual` | `carmen-platform-support-usermanual` |
| `carmen-inventory-frontend-react` | `carmen-frontend` | เหมือนชื่อ repo |
| `carmen-inventory-frontend-e2e` | `carmen-frontend-e2e` | เหมือนชื่อ repo |
| `carmen-inventory-mobile` | `carmen-mobile` | เหมือนชื่อ repo |
| `carmen-inventory-god-mode` | `carmen-god-mode` | เหมือนชื่อ repo |
| `carmen-turborepo-backend-v2` | `carmen-turborepo-backend` | เหมือนชื่อ repo |
| `carmen-turborepo-backend-bruno` | คงเดิม | — |

ไม่มีชื่อใหม่ไหนชนชื่อเก่า → GitHub redirect URL/clone เก่าได้ครบ

## ขั้นตอน

1. rename repo บน GitHub (`gh repo rename`) ทั้ง 8 ตัว — redirect ทำให้ของเดิมยังใช้ได้ระหว่างทาง
2. แต่ละ repo: PR แทนชื่อเก่า → ใหม่ ใน `package.json` (name/description/repository), lockfile (ชื่อ root), workflow name/concurrency group,
   path พี่น้องแบบ `../<repo>` ในสคริปต์, URL GitHub/raw (เช่น `audit-fe-license-fixture` อ่าน raw.githubusercontent ของแอปหลัก), เอกสารที่ยังใช้งาน (CLAUDE.md, README, AGENTS, agent-os, skills, wiki)
3. merge แล้วตั้ง remote ในเครื่อง → ย้ายโฟลเดอร์ → ย้ายโฟลเดอร์ memory ของ Claude (`~/.claude/projects/-Users-samutpra-GitHub-carmensoftware-organize-<folder>`) ตาม — ทำ **เป็นขั้นสุดท้าย** เพราะเซสชันที่รันอยู่ในโฟลเดอร์เดิมจะหลุด

## กติกาการแทน (ลำดับยาวไปสั้น)

`carmen-platform-support-usermanual`/`carmen-platform-usermanual` → `carmen-backstage-support-usermanual` · `carmen-platform-e2e` → `carmen-backstage-e2e` · `carmen-platform` → `carmen-backstage` ·
`carmen-inventory-frontend-react` → `carmen-frontend` · `carmen-inventory-frontend-e2e` → `carmen-frontend-e2e` · `carmen-inventory-mobile` → `carmen-mobile` ·
`carmen-inventory-god-mode` → `carmen-god-mode` · `carmen-turborepo-backend-v2` → `carmen-turborepo-backend`

## ไม่แตะในโปรเจกต์นี้ (ผมตัดสินใจเอง — ย้ายไปโปรเจกต์ที่เหมาะ)

- **path บนเซิร์ฟเวอร์ DEV** (`/var/www/carmen-platform`, `/var/www/carmen-inventory`, `$HOME/carmen-turborepo-backend-v2`, `/root/carmen-inventory-god-mode`) — ผูกกับ nginx/SSH บนเครื่อง ต้องย้ายพร้อม config → **โปรเจกต์ 3**
- **ชื่อในระบบภายนอก**: bucket `carmen-platform-web`, `carmen-platform-web.pncsb-app.com`, nginx `carmen-platform.conf/.crt/.key`, Cloud Build trigger `carmen-platform-deploy`, image registry (`deploy-docker.sh`, `docker-compose.yml`) → **โปรเจกต์ 3**
- **ทั้งโฟลเดอร์ `infra/`** ไม่แตะ (ชื่อ bucket/โดเมน/WIF อยู่รวมกัน) · **Terraform `github_repo` (WIF)**: ต้องแก้ค่าแล้ว `terraform apply` ก่อน `deploy-gcs.yml` ครั้งถัดไป (OIDC claim `repository` จะเป็นชื่อใหม่) → apply ใน **โปรเจกต์ 3**; ระหว่างนี้ไม่มีอะไรพังเอง เพราะ `deploy-gcs.yml` เป็น manual-only
- **OTel service name** `SERVICE_NAME = 'carmen-platform'` (`src/lib/telemetry.ts`) — identifier ที่ dashboard ผูก → **โปรเจกต์ 4**
- **ประวัติ**: migration SQL (ห้ามแก้เด็ดขาด — checksum), `CHANGELOG*`, `changelog.json`, `docs/superpowers/**` ลงวันที่, `.planning/`, `.superpowers/`, `.specs/`, `graft/` (generated)

## สิ่งที่เกิดขึ้นจริง (2026-10-25)

- `carmen-mobile` และ `carmen-turborepo-backend` ในองค์กรเป็น redirect ของ repo ที่ถูกโอนไป `CarmenSoftware-dev` — ผู้ใช้สั่งเปลี่ยนชื่อตัวเก่าเป็น
  `CarmenSoftware-dev/carmen-mobile-app_old` และ `CarmenSoftware-dev/carmen-turborepo-backend_old` แล้วจึงใช้ชื่อใหม่ (redirect เก่าจากองค์กรเดิมของสองตัวนั้นหายไป)
- rename ครบ 8 repo; ตั้ง `git remote` ในเครื่องชี้ชื่อใหม่แล้ว
- สคริปต์แทนชื่อ: regex ตามกติกาด้านบน + ข้ามรายการยกเว้น (รวม `infra/`, migrations, lockfile ที่แก้แยกเฉพาะชื่อ root)

## ตรวจว่าเสร็จ

- `gh repo view CarmenSoftware-organization/<ใหม่>` ได้ครบ 8
- แต่ละ repo: `git grep` ชื่อเก่านอกรายการยกเว้น = 0; static check/เทสต์ที่มีผ่าน; `bun install --frozen-lockfile` ผ่าน
- `audit:fe-license-fixture` ของ backend อ่าน URL ใหม่ได้
- โฟลเดอร์ในเครื่องเป็นชื่อใหม่ + `git remote -v` ชี้ชื่อใหม่ + memory ย้ายแล้ว
