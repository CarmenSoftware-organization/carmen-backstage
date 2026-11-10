---
title: The repo proxies TWO separate backends
author: Thammanoon
date: 2026-11-09
id: l-0a0247ab
scope: repo
status: active
touches:
  - docs/superpowers/specs/2026-05-28-broadcast-notification-design.md
---

## Decided
The Carmen platform frontend talks to **two different backend services** via vite proxies (`vite.config.ts` server.proxy):

- `/api/...` — the main application backend (notifications, etc.)
- `/api-system/...` — the admin/system backend (clusters, business units, users, report templates, print mappings, news)

**Why:** Most existing services in `src/services/` happen to live on `/api-system/` (cluster, businessUnit, user, news, etc.), so it's tempting to default new services to `/api-system/`. But endpoints in the OpenAPI doc at `https://dev.blueledgers.com:4001/swagger` are under `/api/` paths — those are the main-backend endpoints. The notifications/broadcasts endpoints live on the main `/api` backend, not the admin one.

## Watch out
Before writing a new service, check the swagger spec to see the actual path. If the path starts with `/api/notifications/...` (or other `/api/...` patterns), use `/api/` in the service URL, not `/api-system/`. Don't copy the prefix from a nearby existing service file — copy the path from the swagger.

Caught during the broadcast notification feature (`docs/superpowers/specs/2026-05-28-broadcast-notification-design.md`) — first draft used `/api-system/notifications/broadcasts/...` matching surrounding services; correct path was `/api/notifications/broadcasts/...`. Fixed in commit `579b3f7`.

_From Claude Code's memory of this repo, last updated Aug 30._
