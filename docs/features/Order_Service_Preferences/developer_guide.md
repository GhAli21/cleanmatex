---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Order Service Preferences — Developer Guide

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
│   │   ├── order-item-preference.service.ts # Item-level prefs, service_pref_charge recalc
│   │   ├── order-piece-preference.service.ts # Piece-level prefs (Enterprise)
│   │   └── preference-resolution.service.ts # resolve_item_preferences, get_last_order, suggest
│   └── utils/
│       └── order-item-helpers.ts          # calculateItemTotal (includes servicePrefCharge)
├── app/
│   └── api/v1/
│       ├── catalog/
│       │   ├── service-preferences/
│       │   ├── packing-preferences/
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
    │       ├── ServicePreferenceSelector.tsx
    │       ├── PackingPreferenceSelector.tsx
    │       ├── order-details-section.tsx
    │       └── ...
    └── workflow/
        └── ui/
            ├── processing-piece-row.tsx
            └── processing-item-row.tsx
```

## Services

### PreferenceCatalogService

- **getServicePreferences(supabase, tenantId, branchId?):** Fetches sys_service_preference_cd + org_service_preference_cf overrides.
- **getPackingPreferences(supabase, tenantId):** Fetches sys_packing_preference_cd + org_packing_preference_cf.
- **getPreferenceBundles(supabase, tenantId, includeInactive?):** Care packages for tenant.
- **createPreferenceBundle, updatePreferenceBundle, deletePreferenceBundle:** Admin CRUD for bundles.

### OrderItemPreferenceService

- **getItemServicePrefs(supabase, tenantId, orderItemId):** List item prefs.
- **addItemServicePref(...):** Add pref, recalc service_pref_charge on item.
- **removeItemServicePref(...):** Remove pref, recalc.
- **updatePackingPref(...):** Set packing_pref_code on item.

### OrderPiecePreferenceService

- **getPieceServicePrefs(supabase, tenantId, pieceId):** List piece prefs.
- **addPieceServicePref(...):** Add piece pref, recalc piece and item service_pref_charge.
- **removePieceServicePref(...):** Remove, recalc.
- **confirmPiecePrefs(...):** Set processing_confirmed, confirmed_by, confirmed_at (Enterprise).

### PreferenceResolutionService

- **resolveItemPreferences(supabase, tenantId, customerId, productCode?, serviceCategoryCode?):** Calls DB `resolve_item_preferences`.
- **getLastOrderPreferences(supabase, tenantId, customerId):** For Repeat Last Order.
- **suggestPreferencesFromHistory(...):** Calls DB `suggest_preferences_from_history`.

## API Flow

1. **New order:** UI fetches catalog (service-preferences, packing-preferences, preference-bundles). User selects prefs; reducer stores in `OrderItem.servicePrefs`, `packingPrefCode`. On submit, OrderService.createOrder includes prefs; inserts into org_order_item_service_prefs, org_order_item_pc_prefs; sets service_pref_charge.

2. **Edit order:** Same catalog + order item prefs. PATCH/POST/DELETE to item/piece service-prefs; packing-pref PATCH.

3. **Assembly:** ProcessingPieceRow displays prefs from piece; Confirm button calls POST .../service-prefs/confirm when processingConfirmationEnabled.

## Key Functions

- **calculateItemTotal(item):** `item.totalPrice + (item.servicePrefCharge ?? 0)`.
- **calculateOrderTotal(items):** Sum of calculateItemTotal per item.
- **Receipt placeholders:** `replaceTemplatePlaceholders` uses `formatPreferencesSummary`, `calculateServicePrefCharge`, `calculateEcoScore`.

## Troubleshooting

- **Prefs not showing:** Check feature flags (service_preferences_enabled, packing_preferences_enabled) and plan mappings.
- **service_pref_charge wrong:** Ensure add/remove pref triggers recalc (OrderItemPreferenceService.recalcItemServicePrefCharge, OrderPiecePreferenceService.recalcPieceServicePrefCharge).
- **RLS errors:** All org_* tables filter by tenant_org_id; ensure JWT has correct tenant context.
