---
version: v1.1.0
last_updated: 2026-03-16
author: CleanMateX Team
---

# Order Service Preferences — Developer Guide

## Unified Table: org_order_preferences_dtl (Migration 0166+)

Item-level and piece-level service prefs, conditions, and colors are stored in **org_order_preferences_dtl** with `prefs_level` IN ('ORDER','ITEM','PIECE'). The legacy tables `org_order_item_service_prefs` and `org_order_item_pc_prefs` are dropped.

- **OrderItemPreferenceService** and **OrderPiecePreferenceService** use `org_order_preferences_dtl`.
- **preference_sys_kind**: `service_prefs` | `condition_stain` | `condition_damag` | `color` | `note`
- **extra_turnaround_minutes** for ready-by calculation: stored in `org_service_preference_cf`, not in order prefs.

## Code Structure

```
web-admin/
├── lib/
│   ├── constants/
│   │   └── service-preferences.ts          # SERVICE_PREFERENCE_CODES, PACKING_PREFERENCE_CODES, PREFERENCE_SOURCES
│   ├── types/
│   │   └── service-preferences.ts         # ServicePreference, PackingPreference, OrderItemServicePref
│   ├── validations/
│   │   └── service-preferences-schemas.ts # Zod schemas for API inputs
│   ├── services/
│   │   ├── preference-catalog.service.ts   # Catalog fetch, bundle CRUD
│   │   ├── order-item-preference.service.ts # Item-level prefs → org_order_preferences_dtl
│   │   ├── order-piece-preference.service.ts # Piece-level prefs → org_order_preferences_dtl
│   │   └── preference-resolution.service.ts # resolve_item_preferences, get_last_order, suggest
│   └── utils/
│       └── order-item-helpers.ts          # calculateItemTotal (includes servicePrefCharge)
├── app/
│   └── api/v1/
│       ├── catalog/
│       │   ├── service-preferences/
│       │   │   ├── admin/           # GET admin (tenant overrides for edit)
│       │   │   └── [code]/         # PUT, DELETE (upsert/reset)
│       │   ├── packing-preferences/
│       │   │   ├── admin/
│       │   │   └── [code]/
│       │   └── preference-bundles/
│       ├── orders/[id]/items/[itemId]/
│       │   ├── service-prefs/
│       │   ├── packing-pref/
│       │   ├── apply-bundle/[bundleCode]/
│       │   └── pieces/[pieceId]/service-prefs/
│       ├── customers/[id]/service-prefs/
│       └── preferences/
│           ├── resolve/
│           ├── last-order/
│           └── suggest/
└── src/features/
    ├── orders/
    │   └── ui/
    │       ├── preferences/
    │       │   ├── PreferencesTabsSection.tsx   # Quick Apply | Service Preferences tabs
    │       │   ├── ServicePreferenceSelector.tsx
    │       │   ├── PackingPreferenceSelector.tsx
    │       │   ├── CarePackageBundles.tsx
    │       │   ├── RepeatLastOrderPanel.tsx
    │       │   └── SmartSuggestionsPanel.tsx
    │       ├── order-details-section.tsx        # Packing in table; service prefs in tab
    │       └── ...
    └── workflow/
        └── ui/
            ├── processing-piece-row.tsx
            └── processing-item-row.tsx
```

## Services

### PreferenceCatalogService

- **getServicePreferences(supabase, tenantId, branchId?):** Fetches sys_service_preference_cd + org_service_preference_cf overrides.
- **getServicePreferenceCfForAdmin(supabase, tenantId):** Raw sys + cf for admin edit view.
- **getPackingPreferenceCfForAdmin(supabase, tenantId):** Same for packing.
- **upsertServicePreferenceCf(...), upsertPackingPreferenceCf(...):** Tenant override CRUD.
- **deleteServicePreferenceCf(...), deletePackingPreferenceCf(...):** Reset to system default.
- **getPackingPreferences(supabase, tenantId):** Fetches sys_packing_preference_cd + org_packing_preference_cf.
- **getPreferenceBundles(supabase, tenantId, includeInactive?):** Care packages for tenant.
- **createPreferenceBundle, updatePreferenceBundle, deletePreferenceBundle:** Admin CRUD for bundles.

### OrderItemPreferenceService

- **getItemServicePrefs(supabase, tenantId, orderItemId):** List item prefs from `org_order_preferences_dtl` (prefs_level='ITEM').
- **addItemServicePref(...):** Add pref, recalc service_pref_charge on item.
- **removeItemServicePref(...):** Remove pref, recalc.
- **updatePackingPref(...):** Set packing_pref_code on item.

### OrderPiecePreferenceService

- **getPieceServicePrefs(supabase, tenantId, pieceId):** List piece prefs from `org_order_preferences_dtl` (prefs_level='PIECE').
- **addPieceServicePref(...):** Add piece pref, recalc piece and item service_pref_charge.
- **removePieceServicePref(...):** Remove, recalc.
- **confirmPiecePrefs(...):** Set processing_confirmed, confirmed_by, confirmed_at (Enterprise).

### PreferenceResolutionService

- **resolveItemPreferences(supabase, tenantId, customerId, productCode?, serviceCategoryCode?):** Calls DB `resolve_item_preferences`.
- **getLastOrderPreferences(supabase, tenantId, customerId):** For Repeat Last Order.
- **suggestPreferencesFromHistory(...):** Calls DB `suggest_preferences_from_history`.

## API Flow

1. **New order:** UI fetches catalog (service-preferences, packing-preferences, preference-bundles). When `SERVICE_PREF_AUTO_APPLY_CUSTOMER_PREFS` is true and customer is selected, adding an item calls `/api/v1/preferences/resolve` and auto-applies customer standing prefs. User selects service prefs in the **Preferences** section (Service Preferences tab); packing prefs remain in the item details table. Reducer stores in `OrderItem.servicePrefs`, `packingPrefCode`. On submit, OrderService.createOrder includes prefs; inserts into **org_order_preferences_dtl**; sets service_pref_charge.

2. **Edit order:** Same catalog + order item prefs. PATCH/POST/DELETE to item/piece service-prefs; packing-pref PATCH.

3. **Assembly:** ProcessingPieceRow displays prefs from piece; Confirm button calls POST .../service-prefs/confirm when processingConfirmationEnabled.

## Migration Notes (0165–0169)

- See [preferences-unified-migrations-0165-0169.md](../../dev/preferences-unified-migrations-0165-0169.md) for migration order and rollback.
- After applying migrations, run `npx prisma generate` in web-admin.

## Key Functions

- **calculateItemTotal(item):** `item.totalPrice + (item.servicePrefCharge ?? 0)`.
- **calculateOrderTotal(items):** Sum of calculateItemTotal per item.
- **Receipt placeholders:** `replaceTemplatePlaceholders` uses `formatPreferencesSummary`, `calculateServicePrefCharge`, `calculateEcoScore`.

## Troubleshooting

- **Prefs not showing:** Check feature flags (service_preferences_enabled, packing_preferences_enabled) and plan mappings.
- **service_pref_charge wrong:** Ensure add/remove pref triggers recalc (OrderItemPreferenceService.recalcItemServicePrefCharge, OrderPiecePreferenceService.recalcPieceServicePrefCharge).
- **RLS errors:** All org_* tables filter by tenant_org_id; ensure JWT has correct tenant context.
