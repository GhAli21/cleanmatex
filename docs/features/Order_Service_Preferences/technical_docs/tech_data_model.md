---
version: v1.2.1
last_updated: 2026-05-11
author: CleanMateX Team
---

# Service Preferences — Data Model

**Canonical runtime architecture:** [preferences-architecture-reference.md](../../dev/preferences-architecture-reference.md). This page is a **compact table glossary** (catalogs + key columns); it does not describe `prefs_level` / owner / source semantics or UI wiring in full.

## System Catalogs

- **sys_service_preference_cd** — Unified catalog: service prefs (STARCH_LIGHT, PERFUME, DELICATE), conditions (stains, damage), colors
  - Extended columns (Migration 0165): `preference_sys_kind`, `is_color_prefs`, `color_hex`, `is_note_prefs`, `is_used_by_system`, `is_allow_to_show_for_user`, `system_type_code`, `is_show_in_quick_bar`, `is_show_in_all_stages`
  - `preference_sys_kind`: `service_prefs` | `condition_stain` | `condition_damag` | `color` | `note`
- **sys_packing_preference_cd** — Packing prefs (HANG, FOLD, BOX, etc.)

## Tenant Config

- **org_service_preference_cf** — Enable/disable, custom prices, `extra_turnaround_minutes` per tenant
  - Extended (0165): `preference_sys_kind`, `is_show_in_quick_bar`, `is_show_in_all_stages`
  - **`extra_price`**: surfaced in UI as surcharge next to preference names (**New Order §8.3** in architecture reference).

- **org_packing_preference_cf** — Enable/disable packing prefs per tenant; **`extra_price`** packing surcharge (merged as **`default_extra_price`** on **`PackingPreference`** in catalog API). Same **§8.3** UI parity as service prefs (dropdown, chips, cart summary).
- **org_preference_bundles_cf** — Care packages (Growth+)

## Order Tables

- **org_order_preferences_dtl** — **Authoritative** ORDER/ITEM/PIECE preference rows (Migration **0166**; replaces `org_order_item_service_prefs` and `org_order_item_pc_prefs`). See canonical reference for `prefs_level`, `prefs_owner_type`, `prefs_source`, and **`packing_prefs`**. Rows may set **`preference_id`** to **`org_service_preference_cf.id`** (service + color) or **`org_packing_preference_cf.id`** (packing) when the write path knows the tenant catalog row (**multi-color** ⇒ multiple **`preference_sys_kind = 'color'`** rows).
- **org_order_items_dtl** — Line-level **operational** fields (e.g. `packing_pref_code`, `service_pref_charge`); may **denormalize** packing/charges for workflow — not a second preference model.
- **org_order_item_pieces_dtl** — Piece **operational** fields; **color** JSONB (Migration 0167) may exist for legacy/quick display — **catalog color choices** are still stored on **`org_order_preferences_dtl`** (`preference_sys_kind = 'color'`).

## Customer

- **org_customer_service_prefs** — Standing preferences (FK to org_service_preference_cf.id after 0166)
- **org_customer_pref_changelog** — Audit trail

## Product

- **org_product_data_mst** — default_packing_pref
