---
title: "Dashboard counts rail is called Fleet, and on phones it stays below the activity stream"
author: Thammanoon
date: 2026-11-23
branch: main
cost: { minutes: 7, tokens: 57820 }
id: l-3d06ed84
scope: repo
status: active
src: agent
touches:
  - src/i18n/en.ts
  - PRODUCT.md
  - src/pages/dashboard/CountsRail.tsx
  - src/index.css
  - DESIGN.md
---

## Decided
2026-11-24, user decision after the /dashboard critique:
- The counts rail heading is "Fleet" in English, the product's own word (PRODUCT.md, other pages). Thai stays "ภาพรวม".
- On narrow screens (below lg) the rail stays after the activity stream. The attention band already sits on top, so phone users see what needs acting on first. The domain counts are reference.
Audit 2026-11-24 (not fixed yet): the status tokens are tuned as chip/fill colours. Used as text colour they fail WCAG 4.5:1 in one theme each. There is no text-grade status token, so pages fall back to the fill token as text.

Measured text contrast (on ground / on card):
- destructive: light 4.55 / 4.8 OK; **dark 2.96 / 2.73 FAIL** (302 uses of `text-destructive`, incl. every form field error)
- warning: **light 3.08 / 3.24 FAIL** (~80 uses); dark 9.0 OK
- success: light 4.49 / 4.73 (borderline); dark 5.9 OK
- info: 5.0+ both themes OK
- white on `bg-primary/90` in dark: 4.07 (7 identity heroes/avatars hardcode `text-white`)

## Tried and ruled out
- Keeping "Estate": no other page or doc uses that word.
- Moving the rail above the stream on phones: pushes the activity list down ~300px to show 6 reference numbers.
- A horizontal-scroll count strip on phones: new design work for a low-value gain.
- Darkening the fill until it works as text: the same token is the chip fill, and its fill/foreground pair is already tuned (see the "dark ink on fills" learning).
- Fixing page by page with `text-foreground`: works for one tile (Dashboard did that), but ~380 call sites need a token, not 380 judgement calls.

## Watch out
Don't re-raise the "rail is last on a phone" critique finding. It was weighed and kept on purpose. The i18n keys still say `estate*` (not renamed, to avoid churn).

In the code: src/i18n/en.ts pages.dashboard.estate / estateLoadFailed / loadingEstate; src/pages/dashboard/CountsRail.tsx; PR #487.
- The likely fix is separate text-ink tokens per status (like the code-ink tokens), added in both theme blocks, then a migration. Re-measure against both ground and card.
- `grep` for `text-warning`/`text-success` hits icons too (~27 of 111). Icons need only 3:1, which light amber on plain card passes (3.08) but not on an amber tint (2.77).
- In zsh, `--include=*.tsx` held in an unquoted variable is not word-split: grep silently returns 0. Run greps under bash or quote each flag.

In the code: src/index.css (--destructive/--warning/--success both blocks); DESIGN.md "Don't use --warning or --success as text colours"; audit report .impeccable/audit/2026-11-23T17-53-01Z__src.md.
