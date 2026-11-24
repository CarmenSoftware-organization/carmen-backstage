---
title: "Dashboard activity rows are capped as a whole row, and 'updated' is the quiet default verb"
author: Thammanoon
date: 2026-11-24
branch: fix/dashboard-stream-row-tidy
cost: { minutes: 1, tokens: 2905 }
id: l-e06c9530
scope: repo
status: active
src: agent
touches:
  - src/pages/dashboard/ActivityStream.tsx
---

## Decided
Supersedes the 2026-11-23 "Dashboard fills the shell width" learning on one point: the page still has no max-w (layout rule 1), but the cap that keeps a wide log line together is now on the **whole activity row** (name + meta + chevron), not only the name column. Capping just the name left the row full-width, so the run row's chevron (ml-auto) and the hover band sat ~590px from the content at 1568px. The name still maxes at 32rem, as before.
"updated" is the verb on nearly every row (created only means "never edited since" — the verb is derived by comparing created/updated timestamps), so it is drawn as the quiet default: neutral grey dot, no visible word, screen-reader-only text. created/published keep colour and label and now stand out. The verb column keeps its fixed width so actor names stay aligned.

## Tried and ruled out
Putting the screen-reader-only verb inside the meta line: sr-only is position:absolute, and inside the run row's truncated line its static position lies past the line end, escapes the clip and widened the document to 706px at a 390px screen. It has to be a direct child of the flex row.

## Watch out
If the meta column width or the row gaps change, recompute the row cap and the run list's cap (row cap minus the list's indent).

In the code: src/pages/dashboard/ActivityStream.tsx — `rowCap` = `@2xl:max-w-[54.25rem]` (32rem name + 16rem meta w-64 + 6.25rem icon/chevron/gaps/padding), run list `@2xl:max-w-[51.375rem]` (cap − 2.875rem indent), `VERB.updated.quiet` with dot `bg-muted-foreground/40`, `quietVerb`.
