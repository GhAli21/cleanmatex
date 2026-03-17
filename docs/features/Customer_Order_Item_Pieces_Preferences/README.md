---
version: v1.0.0
last_updated: 2026-03-16
author: CleanMateX Team
---

# Customer/Order/Item/Pieces Preferences — Unified Feature

## Overview

The **Customer/Order/Item/Pieces Preferences** feature extends the Order Service Preferences system with a unified data model. A single catalog (`sys_service_preference_cd`) and one order preferences table (`org_order_preferences_dtl`) support:

- **Service preferences** (starch, perfume, delicate, etc.) at ORDER, ITEM, or PIECE level
- **Conditions** (stains, damage, special care) at piece level
- **Colors** at piece level (with JSONB storage)
- **Notes** at piece level

This replaces the legacy tables `org_order_item_service_prefs` and `org_order_item_pc_prefs`.

## Architecture

```mermaid
flowchart TB
    subgraph catalog [System Catalog]
        sys_cd[sys_service_preference_cd]
    end

    subgraph tenant [Tenant Config]
        org_cf[org_service_preference_cf]
    end

    subgraph orders [Order Data]
        ord_mst[org_orders_mst]
        ord_itm[org_order_items_dtl]
        ord_pc[org_order_item_pieces_dtl]
        ord_pref[org_order_preferences_dtl]
    end

    sys_cd -->|preference_code| org_cf
    org_cf -->|preference_id optional| ord_pref
    ord_pref -->|preference_code no FK| ord_pref
    ord_mst --> ord_itm
    ord_itm --> ord_pc
    ord_pref --> ord_mst
    ord_pref --> ord_itm
    ord_pref --> ord_pc
```

## preference_sys_kind Values

| Value            | Purpose                                      | Level   |
|------------------|----------------------------------------------|---------|
| `service_prefs`  | Processing options (starch, perfume, delicate)| ITEM, PIECE |
| `condition_stain`| Stain conditions (coffee, wine, oil, etc.)   | PIECE   |
| `condition_damag`| Damage indicators (hole, tear, zipper, etc.) | PIECE   |
| `color`          | Color codes (solid, pattern)                  | PIECE   |
| `note`           | Free-form notes                              | PIECE   |

## UI Structure

### New Order — Preferences Section

- **Quick Apply** tab: Care Packages, Repeat Last Order, Smart Suggestions
- **Service Preferences** tab: Per-item or per-piece service prefs (starch, perfume, delicate, etc.)
- **Item details table**: Packing preferences only (service prefs moved to the tab)

### Customer/Order/Item/Pieces Panel

- Bottom-left panel for applying conditions (stains, damage, special) to the selected piece
- Click item/piece in order summary to select; then apply conditions from the panel

## Feature Flag

- **`item_conditions_colors_enabled`** (default: true) — Enables conditions and colors in the unified catalog and UI

## Related Documentation

- [Order Service Preferences — Technical Data Model](../Order_Service_Preferences/technical_docs/tech_data_model.md)
- [Order Service Preferences — Developer Guide](../Order_Service_Preferences/developer_guide.md)
- [Unified Migrations 0165–0169](../../dev/preferences-unified-migrations-0165-0169.md)
