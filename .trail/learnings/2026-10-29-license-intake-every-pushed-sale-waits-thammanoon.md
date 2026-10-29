---
title: "License intake: every pushed sale waits in a pending queue for a human to bind it to a BU"
author: Thammanoon
date: 2026-10-29
branch: docs/license-intake-customer-design
cost: { minutes: 1, tokens: 0 }
id: l-bd3e3c24
scope: repo
status: active
src: agent
touches:
  - docs/superpowers/specs/2026-10-29-license-intake-customer-design.md
---

## Decided
- Owner choice (2026-10-29): sales pushed by the external license master never auto-bind to a BU, even when the AR number maps to exactly one BU. A person with the new `subscription.approve` confirms each one. Reason: a new hotel under an existing AR can arrive before its BU exists, and auto-binding would put the seats on the wrong BU without anyone noticing.
- Seats stay a cluster-wide pool. The per-BU cap floated in the 2026-10-29 meeting was explicitly rejected.
- The payer is a Customer (AR number) linked from the BU: one AR per BU, many BUs per AR (KC Koh Chang). It is not a per-licence field.
- Spec: docs/superpowers/specs/2026-10-29-license-intake-customer-design.md.

## Tried and ruled out
- Identifying the BU by AR number alone: one AR can own several BUs, so AR identifies the payer and a human picks the BU.

## Watch out
- Subscription state is derived only by `deriveSubscriptionState` in packages/prisma-shared-schema-backstage. Any rule about start dates belongs there, never re-implemented per app. Interface licences check start_date separately in gateway license.service.ts.
- Holders of the `subscription.*` wildcard also get `subscription.approve`. If approvers must differ from editors, assign it per role when seeding.
