---
title: "BU Edit Licenses summary strip computes client-side from data the page already loads; storage state is reported up by BuStorageQuotaCard, not refetched"
author: Thammanoon
date: 2026-11-03
branch: feature/bu-licenses-summary-strip
cost: { minutes: 4, tokens: 45554 }
id: l-b648c9f0
scope: repo
status: active
src: agent
touches:
  - src/pages/businessUnitEdit/LicenseSummaryStrip.tsx
  - agent-os/standards/pages/summary-band.md
---

## Decided
- `src/pages/businessUnitEdit/LicenseSummaryStrip.tsx` (3 cells: User seats · Interfaces · Storage quota) is rolled up on the client. This does not violate `agent-os/standards/pages/summary-band.md`: that rule bans client-side `perpage:-1` rollups of a whole registry; here every input is one BU's bounded data the tab already fetched (seat ledger, interface ledger, storage view).
- Storage numbers come from `BuStorageQuotaCard`'s own fetch via `onStateChange({ view, loading })`, wired to a useState setter in BusinessUnitEdit. No second GET, and Measure now / reclaim re-measure update the strip. The prop must be stable (pass the setter directly), or the effect fires on every render.
- Cells are `<button>` + scrollIntoView, not `#hash` links: the URL carries `?tab=`, and a hash entry makes browser Back need two presses. Targets are `LICENSE_SECTION_IDS`, wrapped around each slot in BusinessUnitDocument (with `scroll-mt-32` for the sticky header + TabStrip; wrapped only when the slot exists, so an empty div doesn't eat a gap).
- Tone thresholds match the cards below: seats `seat_days`, interfaces `interface_days` on backend `in_force` (never derived from dates), storage 80% warning / 100% or `blocking` destructive. Without `storage_quota.read` the strip drops to 2 columns.

## Watch out
- On a short BU page, clicking a lower cell scrolls only to max scroll (the card won't reach the top). That is not a bug; check `scrollY === scrollHeight - innerHeight` before chasing it.
- The User Licenses card header still repeats the seat count + cluster pool line shown in the strip. `BusinessUnitLicensesCard.test.tsx` asserts those strings, so trimming the card means updating that test too.
