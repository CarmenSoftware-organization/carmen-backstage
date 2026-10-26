# Cluster Seat Management — Design

Date: 2026-10-26 · Repos: `carmen-backstage` (FE), `carmen-turborepo-backend` (gateway + micro-cluster)

## Intent

Cluster `e7ee5703-…` shows **9 users against 8 licensed seats** on Cluster Edit → Users. Today
nobody can tell from backstage whether that cluster is *really* over quota, who is using a seat,
or how to give one back without side effects. When a cluster is truly over (`used > cap`) and
`license.enforcement_enabled` is on, the gateway's `evaluateSeat` makes **every BU in the
cluster read-only** in carmen-frontend (`SEAT_LIMIT_EXCEEDED`). carmen-frontend already shows a
banner and a "seat" dialog telling the customer to contact an admin — the fix has to exist on
the admin side, and it currently does not.

Two root problems found during recon:

1. **Backstage counts the wrong thing.** `ClusterEdit.tsx:524` uses
   `users.clusterUsers.length` (cluster membership, `tb_cluster_user`). The backend's seat rule
   (`clusterHeadsSubquery`, `micro-cluster/src/cluster/common/seat.helper.ts:261`) counts
   **distinct users with an active link to an active BU of the cluster, whose account is active**
   (`tb_user_tb_business_unit` × `tb_business_unit` × `tb_user`, all `is_active` and not deleted).
   The correct number already arrives as `users_count` and is stored in `clusterMeta`, unused.
   Consequence: deactivating a cluster member in the Users tab today **does not free a seat**.
2. **There is no tool to give a seat back.** Freeing a seat means deactivating every active BU
   link the person has in the cluster, one `PATCH api-system/user/business-units/:id` at a time,
   from a screen that does not show those links. (Correction 2026-10-26: an earlier draft claimed
   re-activation skipped the seat check. It does not — `userBusinessUnitCreate` and
   `userBusinessUnitUpdate` call `assertSeatAvailable` since 2026-08-18, `business-unit.service.ts`
   ~1588 and ~1809, covering false→true, user reassignment and cross-cluster moves.)

## Goals

1. **One seat number everywhere.** Backstage admin (Cluster Edit → Users, `/clusters/:id/edit?tab=users`)
   and cluster admin (`/cluster-admin/:id/users`) both show `used / cap` from the backend's
   definition (`users_count` / `total_max_license_users`), never a client-side count.
2. **Per-member seat status.** Each member row shows whether that person holds a seat in this
   cluster, and which BUs of this cluster they are linked to (active / inactive).
3. **Release seat** — one action per member that deactivates **all** of that user's active BU
   links **in this cluster**, in one transaction. The user's account (`tb_user.is_active`),
   their cluster membership row (`tb_cluster_user`), and their links in other clusters are
   untouched. Reversible. Behind `<ConfirmDialog>`.
4. **Restore seat** — re-activates the BU links that release turned off, in one transaction,
   under `assertSeatAvailable` (cluster row `FOR UPDATE`). Refused with a clear message when the
   pool is full; honours `license.enforcement_enabled` shadow mode exactly as invitations do.
5. **Keep the existing seat check intact.** BU-link create/update already run
   `assertSeatAvailable`; this work must not weaken it, and the generic PATCH that re-activates a
   link must also clear the release marker (see below).
6. **Over-quota is obvious.** When `used > cap`, both pages show a banner: "9/8 seats used —
   release 1 seat to unlock writes in carmen-frontend", plus a way to filter to seat holders.
7. **Who may do it:** exactly who may read the member list today —
   `ClusterAdminAuthzService.isClusterAdmin(actor, clusterId)`: backstage super admins and the
   cluster's own admins (`tb_cluster_user.role='admin'`, active). Same rule as
   `getUserClusterById` and `userBusinessUnitUpdate`.

## Non-goals

- No changes to carmen-frontend (it already has `seat-quota-banner.tsx` and the `"seat"` reason
  in `permission-denied-dialog.tsx`). Customers keep "contact your admin".
- No buying / adding seats from this screen (that lives in Licenses).
- No automatic choice of who loses a seat; a human picks.
- No change to `tb_user.is_active` (account-wide) — that is a different, cross-cluster action.
- No change to the enforcement switch or to `evaluateSeat`.

## Anti-goals (would be failure even if it "works")

- Releasing a seat in cluster A changes anything in cluster B.
- Any screen shows a seat number that disagrees with what the gateway enforces.
- Any path (UI or API) re-grants a seat without the seat check.
- A cluster admin can release/restore seats in a cluster they do not administer.
- Release leaves the user half-released (some links off, some on) after an error.

## Decisions made

- **User:** release = "disable inside this cluster only" (option ก), not account deactivation.
- **User:** management lives in backstage only (both backstage admin and cluster admin), not
  carmen-frontend.
- **User:** do all of it in this round (backend + backstage). The re-activation seat check the
  user approved turned out to exist already; restore reuses it.
- **Claude's call:** dedicated release/restore endpoints (one transaction each) instead of the
  FE looping `PATCH` per link — a partial failure on restore would otherwise bypass the
  "adding 1 head" accounting, and release must be all-or-nothing (anti-goal above).
- **Claude's call:** restore re-activates exactly the links that were active before release —
  the builder records which ones (e.g. a marker column or audit row); restoring "every inactive
  link" would re-enable links an admin turned off on purpose earlier.
- **Claude's call:** per-member seat data is added to the existing
  `GET /api-system/user/clusters/:clusterId` response (both pages already call it) rather than a
  new list endpoint. The holds-seat flag must be computed from `clusterHeadsSubquery()` (or the
  same predicate) — never re-derived by hand; there are already four copies of this rule
  (`seat.helper.ts`, `cluster.service.ts`, `license.service.ts`, `subscription.service.ts`) that
  must stay identical.
- **User:** cap semantics follow the backend — a cluster with no seat licence (`total_max_license_users`
  `0`/`null`/absent) shows **"0 seats"**, never "unlimited". Today backstage treats it as
  unlimited (`ClusterEdit.tsx:532`); the backend says nothing means unlimited (`null` = 0,
  `assertSeatAvailable` doc). Expected effect: every cluster with users but no seat licence
  shows the over-quota banner right after deploy — that is the truth the backend already
  enforces, previously hidden. Applies to the two pages in Goal 1 and the Add-user
  `clusterAtLimit` check; other screens using the old "0 = uncapped" convention (e.g.
  `ClusterManagement`'s `CapacityMeter`) are listed by the builder and fixed in this round only
  if they show the cluster seat pool.

## Settled after builder review (Claude's calls unless noted)

- **Remembering released links:** a nullable `seat_released_at` (timestamptz) column on
  `tb_user_tb_business_unit`, set by release and cleared by restore; restore acts only on rows
  where it is set. Requires a Prisma migration — **pushing a backend branch that carries a
  migration applies it to DEV within ~2 minutes, before merge**; keep the migration additive and
  nullable so that is harmless. Any other write that re-activates a link clears the marker.
- **Restore when some links are no longer restorable** (link soft-deleted, BU inactive/deleted,
  account inactive): skip them, restore the rest in one transaction, and return
  `{ restored: [...], skipped: [{ id, reason }] }`. All skipped = success with nothing restored;
  the FE shows `toast.info`. Partial = `toast.warning`.
- **Seat-check input:** pass the user id to `assertSeatAvailable`; it already de-dupes and
  subtracts `already_in`, so a user who still holds a seat through another active link in this
  cluster costs 0 and passes.
- **Which BU-link writes are checked:** only transitions that leave the link *active* where it
  was not an active seat-granting link before — `is_active` false→true, `POST` with an active
  link, or a `business_unit_id` move into another cluster **when the resulting link is active**.
  Deactivations and edits that leave state unchanged are never checked. Existing callers that
  re-activate links will now be refused on a full cluster; that is the intended behaviour.
- **Shadow mode:** when `license.enforcement_enabled` is off, restore logs and allows (same as
  invitations and the PATCH check). The banner does not try to read the switch (cluster admins
  cannot read backstage config); its copy says writes are blocked "while licence enforcement is
  on".
- **Admins releasing their own seat:** allowed. Release never touches `tb_cluster_user`, so the
  admin keeps backstage access; they lose carmen-frontend access. The confirm dialog adds an
  explicit warning when the target is the acting user.
- **Filter to seat holders:** client-side — both pages fetch the full member list
  (`useClusterUsers`, `ClusterUsers.tsx`); no server filter param needed.
- **Permissions:** reuse the AppIdGuard key family of `user/clusters` /
  `userBusinessUnit.update`; the builder adds the new keys to the app-id allow-list and the
  permission catalog so `audit:api-system-permission` stays green.
- **Thai copy:** the builder drafts TH + EN; the user reviews in the PR.

## Constraints

- **Deploy order:** backend before frontend (FE reads the new per-member fields and calls the
  new endpoints). FE must degrade gracefully if fields are absent (fall back to today's view,
  no release button) — FE often reaches DEV before BE (billing-blocked Deploy Dev history).
- New endpoints need: `AppIdGuard('<key>')` + the app-id allow-list entry, the backstage
  permission catalog / `audit:api-system-permission` gate, swagger, and an audit-log record
  (actor, cluster, target user, links changed).
- Authorization for the new endpoints: backstage admin per `BusinessUnitScopeGuard`'s rule, or
  `ClusterAdminAuthzService.isClusterAdmin(actor, clusterId)`. Do **not** use
  `readableClusterScope()` (read scope; see `.trail/learnings/2026-10-26-staff-only-cluster-data-must-gate-thammanoon.md`).
- `seat.helper.ts` lock order: cluster row `FOR UPDATE` before counting (invitation path holds
  `FOR KEY SHARE` first — follow the comment at `user-invitation.service.ts:1014`).
- Error contract: reuse `SeatLimitError` (`code: 'SEAT_LIMIT_REACHED'`, `used`, `cap`, `adding`)
  so `TryCatch` maps it; FE shows `used/cap` from the body via `parseApiError`.
- FE conventions: `toast.*`, `<ConfirmDialog>`, `<Badge>` variants, i18n TH + EN for every
  string, mobile cards under `lg` (`meta.card`), 390px check, `<TabStrip>` untouched.
- `MembersTable.tsx` note: the cluster-users endpoint returns only active memberships. That is
  fine here — release/restore act on BU links, so the row never disappears.

## Left to the builder

- Exact endpoint paths/verbs and response field names.
- How "links switched off by release" is remembered for restore.
- Visual placement of the seat badge, BU-link list, banner and filter on each page (follow the
  existing table/card patterns on each page).
- Whether the backstage Cluster Edit "Add user" dialog's `clusterAtLimit` should switch to the
  backend count too (it should, for Goal 1 — confirm and apply).

## Verification (manual — no new automated tests per user preference; existing suites must pass)

- DEV cluster with `used == cap`: release one → numbers drop on both pages and on
  `GET /api-system/clusters/:id`; restore → back; restore when another user filled the seat →
  refused with `SEAT_LIMIT_REACHED`.
- `PATCH api-system/user/business-units/:id` `is_active:true` on a full cluster → refused.
- Cluster admin of cluster A calling release on cluster B → 403.
- carmen-frontend on an over-quota cluster with enforcement on: write blocked; after release,
  writes work again (allow for the gateway's 60 s seat cache).
- Backend audit gates (`bun run gates`) and FE `typecheck` + `lint` green.
