---
title: "AI credits: one credit per scanned page, from a monthly subscription quota plus top-ups that never expire"
author: Thammanoon
date: 2026-11-19
branch: docs/ocr-page-credit-design
cost: { minutes: 1, tokens: 10013 }
id: l-83b2b9b1
scope: repo
status: active
replaces: l-5efd7872
src: agent
touches:
  - docs/superpowers/specs/2026-11-19-ai-credit-license-design.md
  - src/services/subscriptionService.ts
---

## Decided
- Owner choice (2026-11-19):
  - The unit is called **AI credit**. It was renamed from "OCR credit" so that later AI features can share the balance.
  - Every OCR feature (GRN↔PO, AP invoice, payment reconcile) costs 1 credit per page, so customers can predict usage.
- There are two pools:
  - a monthly quota from the subscription, lost at month end (Bangkok calendar month);
  - top-up licences (`AIC-`) that never expire and add up. This is unlike STQ, where the newest licence replaces the old one.
- Debits come from the monthly quota first. Overlapping active subscriptions give the MAX quota, never the sum.
- The ledger lives in micro-cluster, next to the licences. Callers use reserve → commit/release.

## Tried and ruled out
- Token metering: customers could not predict it.
- Top-ups only: the owner picked it first, then switched.
- Dated FIFO lots.
- A ledger per tenant DB: it would drift from the licences.
- External metering (Lago/Stripe).

## Watch out
- Ask AI is link-only and makes no server-side model call. Credits burn only once a server-side OCR gateway exists.
- A subscription has exactly one BU, so the quota sits on `tb_subscription`, not `tb_subscription_bu`.
- A BU with a lapsed subscription cannot scan even with top-up left. Licence enforcement blocks the write routes; `reserve` does not repeat that check.

In the code:
- Spec: docs/superpowers/specs/2026-11-19-ai-credit-license-design.md
- One BU per subscription: src/services/subscriptionService.ts:60
