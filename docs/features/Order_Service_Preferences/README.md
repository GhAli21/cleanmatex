---
version: v1.0.0
last_updated: 2026-03-12
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
- **Receipt placeholders**: `{{preferences_summary}}`, `{{service_pref_charge}}`, `{{eco_score}}`

## Navigation

- New Order → Order Details tab → Preferences column per item
- Edit Order → Same preferences UI
- Admin Config → Preferences catalog (when implemented)
- Customer detail → Preferences tab (when implemented)

## Key Documentation

- [Implementation Plan Complete](../Order_Service_Preferences/IMPLEMENTATION_PLAN_COMPLETE.md)
- [Technical Data Model](technical_docs/tech_data_model.md)
- [API Specification](technical_docs/tech_api_spec.md)
