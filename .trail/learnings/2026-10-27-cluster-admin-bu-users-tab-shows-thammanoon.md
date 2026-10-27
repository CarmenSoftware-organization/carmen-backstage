---
title: "Cluster-admin BU Users tab shows user names as plain text, because /users/:id/edit bounces cluster admins to /cluster-admin"
author: Thammanoon
date: 2026-10-27
branch: fix/cluster-admin-bu-user-name-no-link
cost: { minutes: 5, tokens: 199380 }
id: l-69e2165d
scope: repo
status: active
src: agent
touches:
  - src/pages/clusterAdmin/BusinessUnitForm.tsx
  - src/pages/businessUnitEdit/BusinessUnitUsersCard.tsx
---

## Decided
BusinessUnitUsersCard takes `linkToUser` (default true). The cluster-admin BU Edit page (src/pages/clusterAdmin/BusinessUnitForm.tsx) passes `linkToUser={false}`, so names render as plain text there. The platform BusinessUnitEdit keeps its link to `/users/:id/edit`. This was the user's choice.

## Tried and ruled out
- Linking to /cluster-admin/:clusterId/users: ClusterUsers does not read ?search= or highlight a row, so the click would land on the full member list with nothing pointing at the clicked user.
- A new cluster-admin user detail route: too big for a bug fix, and nobody has checked yet what user data the backend lets a cluster admin read.

## Watch out
The symptom looks like a crash but is a redirect. PrivateRoute.tsx (~L75) sends a user with no backstage authority but with cluster-admin scope to /cluster-admin using `replace`. It does not render Forbidden. Any platform route linked from inside the cluster-admin shell fails the same way, so check shared cards for hard-coded platform links.
