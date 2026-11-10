---
title: Super Admins page
author: Thammanoon
date: 2026-11-09
id: l-da5113c9
scope: repo
status: active
touches:
  - "src/components/UserMultiSelect.tsx#UserMultiSelect"
  - "src/components/UserPicker.tsx#UserPicker"
  - "src/hooks/useUserSearch.ts#useUserSearch"
---

## Decided
`/platform/super-admins` moved its user join from the client to the backend and replaced a 200-user
`<Select>` with a server-side typeahead.

**State on 2026-08-06:** complete, review-clean, browser-verified against a real stack — but **nothing
pushed, no PR opened, nothing deployed**.
- backend `carmen-turborepo-backend-v2` branch `feature/super-admin-email-join` → `88522d3a6`
- frontend `carmen-platform` branch `feature/super-admin-email` → `2b4e6892b`

**Deploy order is load-bearing:** backend first — and micro-business **and** backend-gateway together
(the join lives in micro-business, the swagger DTO in the gateway). Inverted order does not crash; every
row just renders `—` until the backend ships. No migration, no permission seed, no new guard.

**Why:** `GET /api-system/platform/super-admins` returned only `{id, user_id, created_at}`, so the page
fetched the first 200 users and joined client-side — super admins outside that window showed a bare UUID
and could not be granted at all.

**Non-obvious things this work established:**
- `@EnrichAuditUsers()` on a gateway route collapses `created_at` into `audit.created.at`. The "Added"
  column had been dead (`-` on every row) long before this branch because nobody noticed. Six pages now
  carry the same inline `item.created_at ?? item.audit?.created?.at` shim — a `utils/audit.ts` extraction
  is an open repo-wide follow-up.
- The Escape guard needs a ref, not state — see reference-radix-dismiss-layer-guard-needs-ref.
…

_From Claude Code's memory of this repo, last updated Aug 6._
