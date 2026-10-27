---
title: "BU People roster states seat consequence in the Edit/Remove dialogs, not a per-row Shared badge"
author: Thammanoon
date: 2026-10-27
branch: feature/bu-people-quiet-roster
cost: { minutes: 7, tokens: 210641 }
id: l-1f6f3da0
scope: repo
status: active
src: agent
touches:
  - src/i18n/en.ts
  - src/i18n/th.ts
  - src/pages/businessUnitEdit/BusinessUnitUsersCard.test.tsx
  - src/pages/businessUnitEdit/BusinessUnitUsersCard.tsx
---

## Decided
- BusinessUnitUsersCard (shared by cluster-admin BU People tab and platform BusinessUnitEdit Users tab) no longer badges every row "Shared". In real BUs ~all members are shared (10/11 on Blueledgers FIFO), so the badge was noise and the one member who *does* free a seat had no marker.
- The seat effect (frees_seat) is shown at decision time instead: Edit dialog when status is switched to Inactive, and the Remove confirmation. frees_seat undefined or row already inactive → say nothing (unknown / no effect).
- This deliberately reverses the earlier test "คนที่ปิดแล้วไม่คืนที่นั่งต้องบอกให้เห็น" which required the row badge; the test now asserts the dialog text.

## Watch out
- If someone needs a whole-roster view of who holds a seat alone, add a filter or mark the *minority* state — don't bring back a badge on the majority.
- ClusterEdit.test.tsx "Add User dialog respects the cluster-wide license cap" (3 tests) was already red on main on 2026-10-27, unrelated to this change; verify.yml will fail until fixed.
