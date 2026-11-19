---
title: "Backend periodic jobs run from the external cron service hitting an internal gateway endpoint, never an in-process scheduler"
author: Thammanoon
date: 2026-11-19
branch: docs/ocr-page-credit-design
cost: { minutes: 5, tokens: 69995 }
id: l-c7d47626
scope: repo
status: active
src: agent
touches:
  - docs/superpowers/plans/2026-11-19-ai-credit-license.md
  - docs/superpowers/specs/2026-11-19-ai-credit-license-design.md
  - package.json
---

## Decided
- In carmen-turborepo-backend, a periodic task (sweeps, measurements, expiries) is built like this:
  - a job in micro-cronjobs, which is written in Go;
  - it POSTs to `api/internal/...` on the gateway;
  - that endpoint is guarded by `InternalJobGuard`, which checks the `x-internal-token` header and fails closed;
  - the gateway then calls an RPC on the microservice, and the logic lives there in TypeScript, once.

## Tried and ruled out
- A NestJS scheduler inside micro-cluster, to expire AI credit reservations. Rejected:
  - nothing in the backend uses `@nestjs/schedule`, and it is in no package.json;
  - a scheduler would run once per replica.
- Writing the sweep logic in Go inside micro-cronjobs. Rejected: the lock and release rules would then exist twice, in two languages.

## Watch out
- Copy an existing pair when adding one. The storage measure job is the reference.

In the code:
- R/apps/backend-gateway/src/storage-quota/storage-quota-internal.controller.ts
- R/apps/backend-gateway/src/auth/guards/internal-job.guard.ts
- micro-cronjobs/internal/executor/storage_measure.go
