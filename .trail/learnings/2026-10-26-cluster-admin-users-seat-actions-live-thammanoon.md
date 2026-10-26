---
title: "Cluster-admin Users: seat actions live in the row menu, their dialogs at table level; SeatMeter's own note is wrong on this page"
author: Thammanoon
date: 2026-10-26
branch: feature/cluster-users-seat-ledger
cost: { minutes: 7, tokens: 232481 }
id: l-37189ed7
scope: repo
status: active
src: agent
touches:
  - src/components/clusterSeat/SeatCell.tsx
  - src/i18n/en.ts
  - src/i18n/th.ts
  - src/pages/clusterAdmin/ClusterUsers.tsx
  - src/pages/clusterAdmin/MembersTable.tsx
  - src/pages/clusterAdmin/businessUnitForm/SeatMeter.tsx
---

## Decided
- Release/Restore seat moved from buttons in the Seat cell to the row's ⋯ menu (MembersTable.tsx). Menu items cost the pinned actions column no width at 390px; the old comment's width concern was about buttons, not menu items.
- The two seat ConfirmDialogs are rendered once at table level (seatConfirm state), using useSeatActions directly. SeatActions.tsx (buttons + dialogs) is still used by the platform-side clusterEdit/sections/UsersSection.tsx.
- SeatCell `quiet` and SeatMeter `note` are opt-in props; the platform page and the BU plate keep the old rendering.

## Watch out
- SeatMeter's built-in over-cap line says "deactivate users who belong to no other BU" — correct on the BU page, wrong on the Users page where the fix is releasing seats. ClusterUsers passes `note` (seatsBeyondLicensed*) when over cap; reuse SeatMeter elsewhere with that in mind.
- A ConfirmDialog placed inside DropdownMenuContent unmounts when the menu closes — keep it outside the menu.
- ClusterEdit.test.tsx has 3 failing "Add User dialog respects the cluster-wide license cap" tests on main as of 2026-10-26 (before this change).
