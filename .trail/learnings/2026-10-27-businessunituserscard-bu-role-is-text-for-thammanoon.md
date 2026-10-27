---
title: "BusinessUnitUsersCard: BU Role is text for both values (Admin bold, User muted); role and status columns are left-aligned"
author: Thammanoon
date: 2026-10-27
branch: fix/bu-users-role-status-alignment
cost: { minutes: 3, tokens: 29360 }
id: l-0e496339
scope: repo
status: active
src: agent
---

## Decided
- BU Role cell is plain text for every value: Admin is `text-foreground font-medium` and User is `text-muted-foreground`. The user chose this to keep the quiet-roster emphasis while giving both values one shape and a shared left edge.
- BU Status header and cells are left-aligned like every other column. Inactive stays a Badge; Active stays muted text.

## Tried and ruled out
- Admin as an outline Badge with User as text (the previous design): the two values had different shapes, and the badge padding pushed "Admin" about 10px right of "User".
- Badges for both (User secondary, Admin outline): that brings back a chip on every row, the noise quiet roster removed.
- Keep the badge and cancel its padding: the least change, but the mixed shapes stay.

## Watch out
- The status header was `text-center` on SortableTableHead. The sort icon sits inside the button, so a centred header never lines up with centred cell text. Keep sortable columns left-aligned.
- The card is shared with the platform BusinessUnitEdit page, so both pages changed.
