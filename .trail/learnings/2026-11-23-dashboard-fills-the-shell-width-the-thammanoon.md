---
title: Dashboard fills the shell width; the activity row caps its name column instead of the page
author: Thammanoon
date: 2026-11-23
branch: fix/dashboard-full-width
cost: { minutes: 11, tokens: 147529 }
id: l-d5987345
scope: repo
status: active
src: agent
touches:
  - src/pages/Dashboard.tsx
  - src/pages/dashboard/ActivityStream.tsx
---

## Decided
The Dashboard no longer caps itself (was `lg:max-w-[calc(47.5rem+236px)]` with a 46rem stream). The user's layout rules (carmen-blue-ui-design skill, rule 1) forbid a max-w around page content. The original worry — a log line stretched wide opens a gulf between the entity name and its right-margin meta — is handled inside the row: the name column is capped at `@2xl:max-w-lg`, so the verb/actor column stays ~12px from the name at every width.

The verb/actor column now switches on the timeline's own width (`@container` + `@2xl:`), not the screen (`md:`). At a 768 screen the sidebar leaves the stream ~470px; with `md:flex` the 16rem meta column appeared anyway and squeezed entity names to 47px ("TES…").

## Tried and ruled out
Keeping `md:` and only removing the page cap — leaves the 768 truncation. Removing the cap without capping the name — name and meta end up ~700px apart at 1920 (rule 2).

## Watch out
The shell itself (`Layout` `<main className="container">`) still caps every page at 1400px; that is a shell-wide decision the user has not made.

In the code: src/pages/Dashboard.tsx (grid `lg:grid-cols-[minmax(0,1fr)_236px]`), src/pages/dashboard/ActivityStream.tsx `Timeline`.
