---
title: BU addresses on DEV often live entirely in address_line1; read mode hides that the structured fields are empty
author: Thammanoon
date: 2026-10-27
branch: main
cost: { minutes: 1, tokens: 20343 }
id: l-108479f3
scope: repo
status: active
src: agent
---

## Decided
- Cluster-admin BU Hotel/Company tabs (ClusterBuDocument.tsx) are two-column contact cards from lg: Contact|Location and Billing details|Billing address. The Copy-from-hotel button sits on the address group's header because the address is the only thing it changes.
- AddressBlock.tsx renders its own inputs on a 6-column grid with text-xs muted labels. It no longer uses AddrField, which stays as it is for the platform BusinessUnitEdit page.
- InlineField `trailing` (tel:/mailto: links) wraps the read button only when it is passed, so every other InlineField row keeps the same DOM and existing tests stay valid.

## Watch out
- On DEV, the BU 7e5b89e7… (Blueledgers AVG) has its whole address in hotel_/company_address_line1, and sub_district, district, province and country are empty. formatAddress prints it as a complete-looking address, so the gaps are invisible in read mode. They only show when the editor is opened. The user decided not to add a "not split into fields" hint for now.
- "Open in Maps" builds a Google Maps search URL from lat,lon when both are set, and otherwise from the joined address lines. Stuffed line1 data still produces a usable query.
