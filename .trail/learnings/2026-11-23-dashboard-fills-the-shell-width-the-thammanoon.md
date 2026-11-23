---
title: Dashboard fills the shell width; the activity row caps its name column instead of the page
author: Thammanoon
date: 2026-11-23
branch: fix/dashboard-full-width
cost: { minutes: 16, tokens: 203405 }
id: l-d5987345
scope: repo
status: active
src: agent
touches:
  - src/pages/Dashboard.tsx
  - src/pages/dashboard/ActivityStream.tsx
  - src/index.css
  - tailwind.config.js
---

## Decided
The Dashboard no longer caps itself (was `lg:max-w-[calc(47.5rem+236px)]` with a 46rem stream). The user's layout rules (carmen-blue-ui-design skill, rule 1) forbid a max-w around page content. The original worry — a log line stretched wide opens a gulf between the entity name and its right-margin meta — is handled inside the row: the name column is capped at `@2xl:max-w-lg`, so the verb/actor column stays ~12px from the name at every width.

The verb/actor column now switches on the timeline's own width (`@container` + `@2xl:`), not the screen (`md:`). At a 768 screen the sidebar leaves the stream ~470px; with `md:flex` the 16rem meta column appeared anyway and squeezed entity names to 47px ("TES…").
The carmen-blue-ui-design skill arrived as a byte-for-byte copy of carmen-frontend's. Its rules (full width, columns not wider fields, container queries, compact, no text overflow) are the user's and apply here, but every component and selector it named did not exist in backstage. It was rewritten against backstage's code. Where existing code conflicts with a rule, the skill records a "known deviation — ask first" instead of changing code: the shell's 1400px container cap, ReadOnlyField boxing view values, DataTable's viewport mobileBreakpoint and Edit pages' lg:grid-cols-2, ClusterEdit's scrollspy.

## Tried and ruled out
Keeping `md:` and only removing the page cap — leaves the 768 truncation. Removing the cap without capping the name — name and meta end up ~700px apart at 1920 (rule 2).
Writing the backstage version from memory. Seven claims came out wrong and were only caught by reading the code and running the probe: the unsaved bar's look and position, the search-row markup, the frozen-column background, the rule-8 example, the config-page grid, and two probe criteria.

## Watch out
The shell itself (`Layout` `<main className="container">`) still caps every page at 1400px; that is a shell-wide decision the user has not made.

In the code: src/pages/Dashboard.tsx (grid `lg:grid-cols-[minmax(0,1fr)_236px]`), src/pages/dashboard/ActivityStream.tsx `Timeline`.
- The unsaved bar looks like it breaks two house rules but is deliberate: it is the one frosted-glass surface left, and from 768px CSS outside @layer turns it into a pill centred on the viewport, overriding its md:left-16 lg:left-60 classes. Do not "fix" either.
- The iframe probe must not treat bare `.animate-pulse` as a skeleton: the unsaved-changes dot pulses, so an Edit page never reads as loaded.
- `rawkeys` hits on Role/Application/licence pages are permission or api names (`secret.manage`), which are data, not missing translations.
- Pages that draw their own hero (RoleIdentityHero …) produce no `header` line; check their buttons by screenshot.

In the code: .claude/skills/carmen-blue-ui-design/ (SKILL.md, bars.md, verify.md); src/index.css `.unsaved-bar`; tailwind.config.js `container.screens.2xl` = 1400px; locale key localStorage `lang`, sidebar `sidebar-collapsed`.
