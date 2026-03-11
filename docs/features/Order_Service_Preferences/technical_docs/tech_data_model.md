---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Service Preferences — Data Model

## System Catalogs

- **sys_service_preference_cd** — Service prefs (STARCH_LIGHT, PERFUME, DELICATE, etc.)
- **sys_packing_preference_cd** — Packing prefs (HANG, FOLD, BOX, etc.)

## Tenant Config

- **org_service_preference_cf** — Enable/disable, custom prices per tenant
- **org_packing_preference_cf** — Enable/disable packing prefs per tenant
- **org_preference_bundles_cf** — Care packages (Growth+)

## Order Tables

- **org_order_items_dtl** — Added: packing_pref_code, packing_pref_is_override, packing_pref_source, service_pref_charge
- **org_order_item_pieces_dtl** — Added: packing_pref_code, service_pref_charge
- **org_order_item_service_prefs** — Item-level service prefs
- **org_order_item_pc_prefs** — Piece-level service prefs (≤30 chars)

## Customer

- **org_customer_service_prefs** — Standing preferences
- **org_customer_pref_changelog** — Audit trail

## Product

- **org_product_data_mst** — Added: default_packing_pref
