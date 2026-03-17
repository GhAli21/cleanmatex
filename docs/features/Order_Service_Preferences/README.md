---
version: v1.1.0
last_updated: 2026-03-16
author: CleanMateX Team
---

# Order Service Preferences Feature

## Overview

Service Preferences allow customers and operators to specify processing and packing preferences for laundry orders. **Processing preferences** (starch, perfume, delicate handling) affect how items are washed and finished. **Packing preferences** (hang, fold, box) determine how items are packaged at assembly.

## Scope

- **Service preferences**: Starch level, perfume, delicate handling, separate wash, steam press, etc.
- **Packing preferences**: Hang on hanger, fold, box, garment bag, vacuum seal, etc.
- **Item-level and piece-level** (Enterprise) preferences
- **Customer standing preferences** for repeat customers
- **Care packages** (bundles) for Growth+ plans
- **Conditions and colors** (unified catalog, Migration 0165–0169)
- **Receipt placeholders**: `{{preferences_summary}}`, `{{service_pref_charge}}`, `{{eco_score}}`

## Navigation

- New Order → Order Details tab → **Preferences section** (Quick Apply | Service Preferences tabs)
- New Order → Item details table → Packing preferences column only

## Key Documentation

- [Customer/Order/Item/Pieces Preferences — Unified Feature](../Customer_Order_Item_Pieces_Preferences/README.md)
- [Implementation Plan Complete](IMPLEMENTATION_PLAN_COMPLETE.md)
- [Technical Data Model](technical_docs/tech_data_model.md)
- [API Specification](technical_docs/tech_api_spec.md)
- [Developer Guide](developer_guide.md)
- [User Guide](user_guide.md)
- [Order Service Preferences Lookup](Order_Service_Preferences_lookup.md)
- [Unified Migrations 0165–0169](../../dev/preferences-unified-migrations-0165-0169.md)
