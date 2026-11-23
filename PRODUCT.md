# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

- **Primary: Carmen Software's internal team** (support, implementation, operations). They run the customer fleet day to day: they onboard a hotel group, set up its business units and tenant databases, issue and track licences, fix report templates, and roll changes out across every tenant.
- **Secondary: cluster admins** on the customer side. These are users with `tb_cluster_user.role = 'admin'`, working under `/cluster-admin/:id`. They see only their own cluster: its users, BUs and licences.

## Product Purpose

Carmen Blue Backstage is the back-office control plane for the Carmen inventory platform. In one console it manages:

- clusters (customer groups) and their business units, each backed by its own tenant DB schema;
- licences, subscriptions, contracts and customer (AR) records;
- report templates, dialog layouts and form groups;
- applications (`x-app-id`), platform RBAC and super admins;
- fleet-wide operations: tenant migrations, seeds, DB-object rollout across every BU, cron jobs, broadcasts and news.

Success means the internal team can see the true state of every tenant and change it safely, without opening a database client or asking a developer.

## Positioning

It is the one place where Carmen's multi-tenant fleet is administered end to end. The registry of clusters, BUs, licences and DB objects is the source of truth that the customer-facing inventory app reads. This is an operational tool for the vendor itself, not a generic admin template.

## Operating Context

- The app is a static SPA with two backends: `/api` and `/api-system`. There are three deploy targets: DEV, a GCS bucket, and Vercel production.
- Many actions touch live customer tenant databases: apply or drop DB objects, migrations, seeds, hard delete.
- Work is often one operator driving a whole fleet, BU by BU, with per-BU progress and per-BU failure.
- Access is permission-gated (`hasPermission`, `requireSuperAdmin`). A denied route renders Forbidden in place.

## Capabilities and Constraints

- **Bilingual TH/EN.** Every string goes through i18n (`src/i18n/en.ts`, `src/i18n/th.ts`). Layouts must hold the longer Thai labels.
- **Light and dark parity.** Every surface and token must work in both themes.
- **Mobile-capable at 390px.** Admins really do open it on a phone. The `md` breakpoint is where the sidebar appears.
- **Destructive operations on real customer data.** They must be confirmed (`ConfirmDialog`, never `window.confirm`). Status must always show the true state: no optimistic "done" for work that ran per BU and may have partly failed.
- **Terminology:** cluster, business unit (BU), tenant, licence/subscription, AR number, report template, DB object, `doc_version` (optimistic locking, 409 on conflict).

## Brand Commitments

- Product name: **Carmen Blue Backstage**. The customer-facing main app stays "Carmen Platform".
- Logo assets live in `public/`: `carmen-logo.svg`, `logo_light.svg`, `logo_dark.svg`, `logo_mark_light.svg`, `logo_mark_dark.svg`.

## Evidence on Hand

- Release history: `src/data/changelog.json`. The displayed version comes from there.
- There are no user research, testimonials or usage metrics in the repo. Future work must not invent them.

## Product Principles

1. **Truth over reassurance.** Show what each tenant actually is, including partial failure and stale data. Never hide it behind a summary that looks green.
2. **Safe by construction.** The more an action can break customer data, the more deliberate the path to it: dry run, confirm, then apply.
3. **Fleet-first, then drill down.** An operator sees the whole fleet's state at a glance, then goes down to one cluster, BU or object.
4. **Equal in every condition.** Thai or English, light or dark, desktop or a 390px phone: none is a second-class version.

## Accessibility & Inclusion

- **Target: WCAG 2.2 AA** on every surface, in both themes and both languages.
- Text contrast at least 4.5:1 (3:1 for large text and UI component boundaries), checked in light **and** dark.
- Every action is reachable and operable by keyboard alone, with a visible focus indicator; focus is never trapped or lost when dialogs and sheets open and close.
- Status is never carried by colour alone: partial failure, per-BU errors and licence state also need text or an icon.
- Controls and live regions carry accessible names in both TH and EN; target size at least 24×24 CSS px, including at 390px.
