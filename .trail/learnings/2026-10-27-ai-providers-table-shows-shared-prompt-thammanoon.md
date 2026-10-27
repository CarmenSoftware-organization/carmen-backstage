---
title: "AI Providers table shows shared-prompt count, not a prompt excerpt; provider logos are a copy of carmen-frontend's"
author: Thammanoon
date: 2026-10-27
branch: main
cost: { minutes: 1, tokens: 45642 }
id: l-7ac4f617
scope: repo
status: active
src: agent
touches:
  - src/pages/AiProviderManagement.tsx
  - src/components/icons/ProviderIcons.tsx
  - src/pages/aiProviders/AiProviderEditDialog.tsx
---

## Decided
- `src/pages/AiProviderManagement.tsx` prompt column shows length + "shared with N more / unique" — seeded prompts are identical across all providers, so the admin's real question is which one was customised.
- Provider logos live in `src/components/icons/ProviderIcons.tsx`, a copy of carmen-frontend `components/icons/provider-icons.tsx` (no shared package between the repos). Icon precedence matches FE: `icon_url` wins over `icon_key`.

## Tried and ruled out
- Showing the first line of `default_prompt` in the table: identical on every row, zero signal.

## Watch out
- Changing a logo means editing both repos.
- After adding i18n keys, the dev server's vite-plugin-checker overlay can keep reporting "not assignable to TKey" even though `npx tsc --noEmit` passes — restart the dev server, it is a stale watcher, not a real error.
