---
title: "Card's overflow-hidden clips absolutely-positioned picker dropdowns; pass overflow-visible on the Card"
author: Thammanoon
date: 2026-11-02
branch: feature/customer-bu-lazy-picker
cost: { minutes: 20, tokens: 278475 }
id: l-a248441d
scope: repo
status: active
src: agent
touches:
  - src/components/BusinessUnitPicker.tsx
  - src/hooks/useBusinessUnitSearch.ts
  - src/i18n/en.ts
  - src/i18n/th.ts
  - src/pages/customerEdit/CustomerBusinessUnitsCard.tsx
  - src/components/ui/card.tsx
---

## Decided
`src/components/ui/card.tsx` bakes `overflow-hidden` into every Card. The hand-rolled pickers (`BusinessUnitPicker`, `CustomerPicker`, `UserPicker`) render their dropdown as an `absolute` div, not a portal, so when the picker sits near the bottom of a Card the list is cut off at the card edge. CustomerBusinessUnitsCard fixes it with `<Card className="overflow-visible">` (cn/tailwind-merge overrides it); ui/ primitives stay untouched per rule 2.

## Watch out
- Any Card hosting one of these pickers needs the same override. LicenseIntakeDetail's BU picker card was not checked (PR #427).
- Lazy load in `useBusinessUnitSearch` (pages of 20) cannot be exercised against the local backend, which has only ~12 BUs: temporarily drop PAGE_SIZE to 5 to see page 2/3 load, then revert.
- BU options carry `customer` only for backstage-wide callers (key absent ≠ unlinked), so "linked to another customer" rows may not appear as disabled for narrower callers.
