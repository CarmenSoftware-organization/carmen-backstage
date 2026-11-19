---
title: "OCR credits are counted per page: a monthly quota from the subscription plus top-ups that never expire"
author: Thammanoon
date: 2026-11-19
branch: docs/ocr-page-credit-design
cost: { minutes: 1, tokens: 1960 }
id: l-5efd7872
scope: repo
status: active
src: agent
touches:
  - docs/superpowers/specs/2026-11-19-ocr-page-credit-license-design.md
  - src/services/subscriptionService.ts
---

## Decided
- Owner choice (2026-11-19): 1 credit = 1 scanned page, the same rate for all three OCR features (GRN↔PO match, AP invoice, payment reconcile). The point is that customers can predict usage.
- Two pools. The monthly quota comes from the subscription; unused quota is lost at month end (calendar month, Asia/Bangkok). Top-up licences (`OCR-YYMM-####`) never expire and **sum**, unlike STQ, where a new licence replaces the old one. Debits take from monthly first.
- Overlapping active subscriptions give the **MAX** quota, never the sum. Overlap usually means a renewal.
- The ledger lives in micro-cluster beside the licences (backstage DB). Callers use reserve → commit/release.

## Tried and ruled out
- Token-based metering: unpredictable for customers.
- Top-ups only, with no expiry (option 1): the owner picked it first, then switched to monthly quota plus top-ups.
- Dated FIFO lots (option 2).
- A ledger in each tenant DB: it would drift from the licences, and backstage would have to fan out across tenants.
- External metering (Lago/Stripe).

## Watch out
- Ask AI is link-only: it returns `url_template` links to external chat sites and makes no server-side model call. Credits can only be burned by a server-side OCR gateway.
- A subscription has exactly one BU, so the per-BU quota sits on `tb_subscription`, not on `tb_subscription_bu`. `tb_subscription_bu` has no editor.
- A BU whose subscription has lapsed cannot scan even with top-up left. Licence enforcement blocks the write routes, and `reserve` deliberately does not duplicate that check.

In the code:
- Spec: docs/superpowers/specs/2026-11-19-ocr-page-credit-license-design.md
- One BU per subscription: src/services/subscriptionService.ts:60
