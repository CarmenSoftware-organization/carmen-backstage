---
title: "Secondary text on the blue brand fill needs at least 90% opacity, because faded ink fails contrast in both themes"
author: Thammanoon
date: 2026-11-23
branch: main
cost: { minutes: 8, tokens: 195189 }
id: l-8ec70e7d
scope: repo
status: active
src: agent
touches:
  - src/pages/Login.tsx
  - src/index.css
---

## Decided
2026-11-23: on the Login brand panel (blue --primary fill), muted labels (eyebrow, "Backstage", system status, env tag) used text-primary-foreground at /45–/70. Measured in the browser that gave 2.2–3.8:1 in BOTH light (white ink) and dark (dark ink) themes, below WCAG AA 4.5:1. Raised all of them to /90. Hierarchy now comes from size, weight, uppercase and tracking, not from fading the ink.

## Tried and ruled out
/80: passes dark but light lands at ~4.4:1 (just under). /90 is the lowest step that passes both: light 5.09:1, dark 4.63:1. Full ink on dark --primary is only 5.23:1, so there is very little room for any alpha there.

## Watch out
- Swapping white to dark ink on a fill (earlier learning) is not enough: any /NN alpha on a -foreground token on a coloured fill must be re-measured, alpha-blended against the fill, in both themes.
- /login redirects when you are signed in. To look at it without signing out: copy token, refresh_token, user, loginResponse, adminScope from localStorage, remove them, open /login, then put them back.

In the code:
src/pages/Login.tsx brand <aside> (~L206–L227), text-primary-foreground/90. Tokens: src/index.css --primary / --primary-foreground (light L18–19, dark L72/L76).
