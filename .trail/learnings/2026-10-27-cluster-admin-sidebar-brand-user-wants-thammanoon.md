---
title: "Cluster-admin sidebar brand: user wants the cluster logo (with name) instead of the avatar; /me/admin-clusters has no logo, and MinIO images break under Chrome…"
author: Thammanoon
date: 2026-10-27
branch: main
cost: { minutes: 1, tokens: 0 }
id: l-c8f1f0d3
scope: repo
status: active
src: agent
touches:
  - src/types/index.ts
---

## Decided
- User choice (2026-10-27): the expanded sidebar shows the cluster LOGO followed by the name. The logo is 36px tall, natural width capped near 96px, object-contain. Collapsed, or with no logo, it falls back to BrandMark (avatar, then initials).
- The ClusterSwitcher chip and the switcher dialog rows keep the avatar. A wide logo at 24px is unreadable.

## Tried and ruled out
- Logo cropped into the existing 36px square BrandMark: the logo is landscape (upload is capped at 500px wide, a sample is 94x62), so object-cover cuts it off.
- Logo-only lockup with no name, like ProductLogo: rejected because not every cluster logo contains its name.

## Watch out
- ClusterAdminLayout builds `brand` from adminScope.clusters, which is GET /api-system/me/admin-clusters. That endpoint returns `avatar` only, with no `logo` (AdminCluster in src/types/index.ts). The logo needs either a backend field (deploy the backend first) or an extra GET /clusters/:id in the layout, which the layout's comment deliberately avoids.
- In the Chrome used for verification, presigned MinIO URLs (http://dev.blueledgers.com:3990/…) are internally 307-upgraded to https and fail with ERR_SSL_PROTOCOL_ERROR. curl to the same URL returns the PNG. BrandMark then silently shows initials, and the Branding card's plain <img> shows a broken image. "Shows initials" therefore does NOT mean "no image uploaded": check the network panel first. A logo on the same host will break the same way, and the real fix is https on MinIO or https presigned URLs (infra/backend).
