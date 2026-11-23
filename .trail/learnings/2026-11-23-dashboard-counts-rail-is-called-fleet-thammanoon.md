---
title: "Dashboard counts rail is called Fleet, and on phones it stays below the activity stream"
author: Thammanoon
date: 2026-11-23
branch: main
cost: { minutes: 5, tokens: 14023 }
id: l-3d06ed84
scope: repo
status: active
src: agent
touches:
  - src/i18n/en.ts
  - PRODUCT.md
  - src/pages/dashboard/CountsRail.tsx
---

## Decided
2026-11-24, user decision after the /dashboard critique:
- The counts rail heading is "Fleet" in English, the product's own word (PRODUCT.md, other pages). Thai stays "ภาพรวม".
- On narrow screens (below lg) the rail stays after the activity stream. The attention band already sits on top, so phone users see what needs acting on first. The domain counts are reference.

## Tried and ruled out
- Keeping "Estate": no other page or doc uses that word.
- Moving the rail above the stream on phones: pushes the activity list down ~300px to show 6 reference numbers.
- A horizontal-scroll count strip on phones: new design work for a low-value gain.

## Watch out
Don't re-raise the "rail is last on a phone" critique finding. It was weighed and kept on purpose. The i18n keys still say `estate*` (not renamed, to avoid churn).

In the code: src/i18n/en.ts pages.dashboard.estate / estateLoadFailed / loadingEstate; src/pages/dashboard/CountsRail.tsx; PR #487.
