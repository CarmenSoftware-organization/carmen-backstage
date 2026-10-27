---
title: "Branding uploads shrink in the browser by default: logo ≤500px wide, avatar circle-cropped to ≤250px square"
author: Thammanoon
date: 2026-10-27
branch: fix/cluster-bu-edit-polish
cost: { minutes: 7, tokens: 66968 }
id: l-85e3c49e
scope: repo
status: active
src: agent
touches:
  - src/pages/clusterAdmin/businessUnitForm/ClusterBuDocument.tsx
  - src/pages/clusterAdmin/BusinessUnitForm.tsx
  - src/pages/clusterAdmin/businessUnitForm/ConfigurationReadout.tsx
  - src/utils/resizeImage.ts
  - src/components/AvatarCropDialog.tsx
  - src/components/BrandingImageUpload.tsx
---

## Decided
- Defaults live in src/components/BrandingImageUpload.tsx so every call site (cluster-admin BU, platform BU BrandingCard, ClusterEdit BrandingSection, ClusterPlate compact) gets them: shape="rect" → resizeImageToMaxWidth (src/utils/resizeImage.ts) to maxWidth=500 keeping aspect ratio; shape="square" → AvatarCropDialog (src/components/AvatarCropDialog.tsx) then ≤250px. Opt out with maxWidth={0} / avatarSize={0}.
- maxSizeMB is checked against the file AFTER resize/crop, so large photos that shrink are accepted.
- Avatar output is a square, not a transparent circle: every avatar render is rounded-full object-cover, and a square lets JPEG stay JPEG.
- Crop dialog is hand-written (pointer events + native range) — repo rule forbids new deps without asking.

## Watch out
- jsx-a11y rejects pointer/keyboard handlers + tabIndex on a div with role="img"; the crop viewport is a <button> for that reason.
- After adding i18n keys the vite-checker overlay may show stale TKey errors while `tsc --noEmit` passes — restart dev server before trusting it.
- If resize/decode fails the original file is uploaded (devLog only); backend still validates type/size.
