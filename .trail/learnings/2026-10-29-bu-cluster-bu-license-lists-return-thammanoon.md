---
title: "BU/cluster/BU-license lists return 400 when a non-backstage-wide caller filters, sorts or searches on customer_id / customer / tb_customer"
author: Thammanoon
date: 2026-10-29
branch: feature/customer-ar
cost: { minutes: 1, tokens: 11917 }
id: l-6fac8578
scope: repo
status: active
src: agent
touches:
  - src/components/CustomerPicker.tsx
  - src/hooks/useCustomerSearch.ts
  - src/i18n/en.ts
  - src/i18n/th.ts
  - src/pages/BusinessUnitEdit.tsx
  - src/pages/businessUnitEdit/BusinessUnitCustomerCard.tsx
  - src/pages/businessUnitEdit/BusinessUnitDocument.tsx
  - src/types/index.ts
  - src/App.tsx
  - src/pages/CustomerEdit.tsx
---

## Decided
Backend micro-cluster `QueryParams.referencesDeniedKey()` (libs/paginate.query.ts) with `CUSTOMER_QUERY_DENIED_KEYS` (cluster/customer/customer-query-keys.ts) rejects with 400 `BACKSTAGE_CUSTOMER_QUERY_KEY_DENIED` when a caller without readableClusterScope().all references those keys in filter/sort/searchfields or anywhere in advance.where. Applied in listBusinessUnit, userBusinessUnitFindAll, listCluster, and both BU-license lists. Reject rather than strip, so a probe cannot tell a no-op from a match (AR linkage is accounting-internal).

## Watch out
Adding a "Customer" column, sort or filter to any BU / cluster / licence list in the FE that cluster admins also see (src/pages/clusterAdmin/*) will 400 for them. Gate it on backstage-wide access, or load customer data via /api-system/backstage/customers instead.
Customer link/unlink also require cluster.update on the BU's cluster (spec Part 2), not only customer.manage.
