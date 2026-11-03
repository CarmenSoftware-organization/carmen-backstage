---
title: "Branding images are also resized server-side in the gateway; backstage's browser resize is now a pre-shrink, not the only guard"
author: Thammanoon
date: 2026-11-02
branch: main
cost: { minutes: 17, tokens: 153595 }
id: l-09d6fc56
scope: repo
status: active
src: agent
touches:
  - src/components/BrandingImageUpload.tsx
---

## Decided
- 2026-11-02, owner's choice: resize BU/cluster logos (≤500px wide) and avatars (centre-crop ≤250px square) in carmen-turborepo-backend backend-gateway (`src/common/helpers/branding-image-resize.ts`, called in the 4 backstage_* upload controllers after validateImageUpload). Reason: carmen-frontend /profile uploads BU logos to the same endpoint and did no resize, so logos loaded slowly. PR #978.
- Only new uploads; existing stored logos were deliberately NOT backfilled.
- src/components/BrandingImageUpload.tsx keeps its browser resize/crop (same 500/250 rules); the server passes already-fitting files through untouched, so the two don't conflict.
## Watch out
- The server can only centre-crop avatars; backstage's crop dialog lets the user pick the area, so a non-square avatar from carmen-frontend loses its edges.
- sharp 0.34.x fails backend audit:dependencies (high advisories); use ≥0.35.5.
