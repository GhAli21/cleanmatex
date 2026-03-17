---
version: v1.1.0
last_updated: 2026-03-16
author: CleanMateX Team
---

# Service Preferences — Data Model

## System Catalogs

- **sys_service_preference_cd** — Unified catalog: service prefs (STARCH_LIGHT, PERFUME, DELICATE), conditions (stains, damage), colors
  - Extended columns (Migration 0165): `preference_sys_kind`, `is_color_prefs`, `color_hex`, `is_note_prefs`, `is_used_by_system`, `is_allow_to_show_for_user`, `system_type_code`, `is_show_in_quick_bar`, `is_show_in_all_stages`
  - `preference_sys_kind`: `service_prefs` | `condition_stain` | `condition_damag` | `color` | `note`
- **sys_packing_preference_cd** — Packing prefs (HANG, FOLD, BOX, etc.)

## Tenant Config

- **org_service_preference_cf** — Enable/disable, custom prices, `extra_turnaround_minutes` per tenant
  - Extended (0165): `preference_sys_kind`, `is_show_in_quick_bar`, `is_show_in_all_stages`
- **org_packing_preference_cf** — Enable/disable packing prefs per tenant
- **org_preference_bundles_cf** — Care packages (Growth+)

## Order Tables

- **org_order_items_dtl** — packing_pref_code, packing_pref_is_override, packing_pref_source, service_pref_charge
- **org_order_item_pieces_dtl** — packing_pref_code, service_pref_charge; **color** (JSONB, Migration 0167)
- **org_order_preferences_dtl** — **Unified** ORDER/ITEM/PIECE preferences (Migration 0166)
  - Replaces `org_order_item_service_prefs` and `org_order_item_pc_prefs`
  - Columns: prefs_level, order_item_id, order_item_piece_id, preference_id, preference_code, preference_sys_kind, prefs_owner_type, prefs_source, extra_price, processing_confirmed, etc.

## Customer

- **org_customer_service_prefs** — Standing preferences (FK to org_service_preference_cf.id after 0166)
- **org_customer_pref_changelog** — Audit trail

## Product

- **org_product_data_mst** — default_packing_pref
