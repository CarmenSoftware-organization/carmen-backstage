---
title: "Feature catalog rows wrap names and keys instead of truncating them, and the module cards stay narrow on purpose"
author: Thammanoon
date: 2026-11-24
branch: fix/license-features-truncation
cost: { minutes: 1, tokens: 1521 }
id: l-3d314d7c
scope: repo
status: active
src: agent
touches:
  - src/pages/licenseFeatures/ModuleShelf.tsx
  - src/pages/licenseCatalog/FeatureCatalogPanel.tsx
---

## Decided
In the license feature catalog, each feature's name and key wrap onto more lines rather than being cut off. A key prefers to break after a dot or an underscore. The description still truncates, with a title to read it in full. Module cards keep their ~32rem minimum, so they come out about 490px wide at 1366 and 1920, and the state buttons plus BU count take about 250px of that.

## Tried and ruled out
- Wider cards (a bigger grid minimum): at 1366 the grid drops to a single 1031px column and the state buttons end up far from the name, which breaks the "value stays next to its label" rule.
- Leaving `truncate` on: at 1366 and 1920 it hid the end of 82 of 112 keys. A key is an identifier admins have to read in full.

## Watch out
- `[overflow-wrap:anywhere]` alone breaks a key mid-word. The word-break opportunity inserted after `.`/`_` is what makes it break at word boundaries; keep both.

In the code: src/pages/licenseFeatures/ModuleShelf.tsx (row label/key/description), src/pages/licenseCatalog/FeatureCatalogPanel.tsx (grid `minmax(min(100%,32rem),1fr)`, search `sm:max-w-sm`).
