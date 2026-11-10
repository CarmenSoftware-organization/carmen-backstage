---
title: Staff-only notes+attachments on Cluster Edit and BU Edit
author: Thammanoon
date: 2026-11-09
id: l-31fcf8c5
scope: repo
status: active
touches:
  - docs/superpowers/specs/2026-10-26-cluster-notes-design.md
---

## Decided
Cluster notes (BE #936, FE #389) and BU notes (BE #937, FE #390) merged to main 2026-10-26 (merge commits). Specs: `docs/superpowers/specs/2026-10-26-cluster-notes-design.md`, `2026-10-26-bu-notes-design.md`.

Still pending (user must approve — shared env):
- DEV: run migrations `20261026150000_add_cluster_note` + `20261026160000_add_business_unit_note` by hand, then `db:seed.backstage-permission` → `db:seed.backstage-role-permission`
- backstage app id must allow `clusterNote.*` + `buNote.*` — BU Edit fetches the note count on every visit, a 401 logs users out
- curl permission matrix + browser check (Cluster Edit regression after FE refactor to `src/components/notes/`), nginx `client_max_body_size` with a ~5 MB file
- branch `feature/cluster-notes` / `feature/bu-notes` ลบครบทั้ง local+remote แล้ว 2026-10-26
- production (`main:vercel`) not pushed

Follow-ups found (not fixed): `GET /api/:bu_code/documents/:filetoken` signs any token with `/` (IDOR on note files); cluster-note micro debug-logs file tokens (BU module uses `safeNoteLog`); note uploads share `bu_code: 'cluster'` — reserve that BU code; cluster-note not yet migrated to `cluster/common/note-helpers.ts`.

**Why:** notes hold customer contracts — authz must be backstage RBAC only, see learning in `.trail/learnings/` (platform-audit-traps).

## Watch out
check live state before trusting "pending"; never add membership-based scope to note routes.

_From Claude Code's memory of this repo, last updated Oct 26._
