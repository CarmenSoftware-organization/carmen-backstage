---
title: "Logo slot is 4:1 when empty; a filled logo keeps the slot height and takes its width from the image, capped at 4:1"
author: Thammanoon
date: 2026-11-02
branch: main
cost: { minutes: 16, tokens: 117162 }
id: l-635078e2
scope: repo
status: active
src: agent
touches:
  - src/components/BrandingImageUpload.tsx
  - src/pages/ClusterEdit.tsx
  - src/pages/clusterEdit/ClusterPlate.tsx
---

## Decided
- User choice (2026-11-02): empty logo placeholder is 4:1 in both repos — backstage BrandingImageUpload h-20 w-80 (compact h-12 w-48), carmen-frontend bu-section.tsx + company-profile-identity.tsx h-16 w-64.
- With an image the frame is h-fixed w-auto with max-w = the 4:1 width; the <img> is in-flow h-full w-auto max-w-full object-contain (not absolute inset-0, which can't size its parent).
- Same footprint rule applies to the matching skeletons (ClusterEdit plate skeleton, IdentityCardSkeleton).

## Watch out
- A w-auto frame collapses to 0 width until the image decodes — keep min-w equal to the height (min-w-20 / min-w-12 / min-w-16).
- 4:1 doesn't fit beside the upload button or the cluster name at 390px: rows are flex-wrap, and ClusterPlate's marks row stacks (flex-col sm:flex-row). Keep that if the slot grows.
- Backstage still resizes logos to ≤500px wide (DEFAULT_LOGO_MAX_WIDTH); a 320×80 slot at 2x DPR wants 640px. Not changed — raise it if logos look soft.
