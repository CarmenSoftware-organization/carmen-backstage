---
title: Google sign-in config stays in gateway env; only PUBLIC_API_BASE_URL moved to backstage config
author: Thammanoon
date: 2026-10-26
branch: feature/backstage-config-google-oauth-frontend-urls
cost: { minutes: 13, tokens: 89953 }
id: l-5fafbad4
scope: repo
status: active
replaces: l-373710bf
src: agent
touches:
  - src/pages/backstageConfig/TextFieldsConfigCard.tsx
---

## Decided
- GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GATEWAY_PUBLIC_URL, CARMEN_WEB_URL and CARMEN_BACKSTAGE_WEB_URL stay in the backend-gateway env (apps/backend-gateway/src/libs/config.env.ts). The user reverted the move to backstage config in PR #933: the client secret cannot go into tb_backstage_config, and keeping all five values in one place was preferred over splitting them between env and DB.
- PUBLIC_API_BASE_URL was removed. The only source is backstage config `external_api.base_url`, with no env fallback (ExternalApiBaseUrlService).

## Tried and ruled out
- Moving the Google values to backstage config (`google_oauth` and `frontend_urls`, both super-admin-only). It was built, then reverted. If it is revisited, both keys must be super-admin-only write: frontend_urls is where Google tokens are delivered, and client_id plus the redirect host controls which OAuth consent screen users see.
- Putting GOOGLE_CLIENT_SECRET in tb_backstage_config: the value column is plain JSONB that GET /api-system/backstage/configs returns to every backstage_config.read holder. Doing it safely would need encrypt-on-write with @repo/secret-crypto (like smtp_password), write-only reads, and a dedicated internal RPC for the gateway. Judged not worth it for a secret that rarely rotates and is already managed by Terraform/Secret Manager.

## Watch out
- The older learnings from 2026-10-26 that say the Google URLs live in backstage config are superseded by this one.
