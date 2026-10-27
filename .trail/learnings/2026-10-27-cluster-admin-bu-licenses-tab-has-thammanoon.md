---
title: "Cluster-admin BU Licenses tab has one sub-tab per BU license type: Seats | Features | Interface under ?license="
author: Thammanoon
date: 2026-10-27
branch: feature/cluster-bu-license-subtabs
cost: { minutes: 2, tokens: 25517 }
id: l-a88785e4
scope: repo
status: active
replaces: l-ce468440
src: agent
---

## Decided
- A BU holds 3 license types: seat licenses (`BusinessUnitLicense`, `tb_business_unit_license`), subscriptions (`Subscription`, which carries feature `groups`), and `InterfaceLicense`. The cluster-admin BU Edit Licenses tab gives each its own sub-tab, via `clusterAdmin/businessUnitForm/LicenseTypeTabs.tsx`. The user chose this.
- `ClusterLicense` (BU quota) belongs to the cluster, so it never gets a sub-tab here.
- The sub-tab id goes in `?license=` and the first tab (`seats`) is left out of the URL, so plain `?tab=licenses` deep links keep their meaning. `handleTabChange` in `clusterAdmin/BusinessUnitForm.tsx` drops `license` whenever the main tab leaves `licenses`.
- Seats are one pool for the whole cluster. `cluster_seat.cap` = the sum of in-force seat licenses of every active BU (`clusterSeatPools`, view `v_business_unit_seat`). `BuSeatLicensesCard` therefore breaks the pool down as this BU's contribution + "from other business units" (cap − own) + pool cap/used. The user asked for this so "0 seats" no longer reads as unusable. Own contribution is 0 when the saved BU is inactive, because the view excludes inactive BUs.
- The subscription rows live in `businessUnitEdit/SubscriptionRows.tsx` (`showGroups` is opt-in), shared with the platform `BusinessUnitLicensesCard`, which keeps seats and subscriptions combined.

## Tried and ruled out
- Two sub-tabs (User | Interface): "User Licenses" mixed seat licenses with subscriptions in one card.
- Separate top-level tabs: the strip would reach 8 triggers, and every `?tab=licenses` link would need a legacy mapping.

## Watch out
- "From other BUs" is derived on the client from two separate loads (the ledger and `cluster_seat`), so it is clamped at 0. If the view's date rule changes, `licenseStatus` in `utils/buLicense.ts` must change with it, or this number drifts.
