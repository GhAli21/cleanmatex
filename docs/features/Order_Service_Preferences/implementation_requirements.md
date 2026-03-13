---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Service Preferences — Implementation Requirements

## Permissions

- `orders:service_prefs_view` — View service/packing prefs on orders
- `orders:service_prefs_edit` — Add/remove prefs on orders
- `config:preferences_manage` — Manage preferences catalog
- `customers:preferences_manage` — Manage customer standing prefs

## Navigation Tree

- Preferences catalog screen (admin config)
- Customer detail → Preferences tab

## Tenant Settings (SERVICE_PREF category)

- `SERVICE_PREF_DEFAULT_PACKING`
- `SERVICE_PREF_SHOW_PRICE_ON_COUNTER`
- `SERVICE_PREF_AUTO_APPLY_CUSTOMER_PREFS`
- `SERVICE_PREF_ALLOW_NOTES`
- `SERVICE_PREF_ENFORCE_COMPATIBILITY`
- `SERVICE_PREF_REQUIRE_CONFIRMATION`
- `SERVICE_PREF_PACKING_PER_PIECE_ENABLED`
- `SERVICE_PREF_BUNDLES_SHOW_SAVINGS`

## Feature Flags

- `service_preferences_enabled`
- `packing_preferences_enabled`
- `per_piece_packing`, `per_piece_service_prefs` (Enterprise)
- `customer_standing_prefs`, `bundles_enabled`, `smart_suggestions`
- `sla_adjustment`, `repeat_last_order`, `processing_confirmation`

## Plan Flags Resolution

Plan-bound flags (`bundles_enabled`, `repeat_last_order`, `smart_suggestions`) are resolved via `hq_ff_get_effective_value` RPC:

- **Service:** `web-admin/lib/services/plan-flags.service.ts` — `getPlanFlags`, `checkPlanFlag`
- **API:** `GET /api/v1/plan-flags` — returns flags for current tenant
- **Hook:** `web-admin/src/features/orders/hooks/use-plan-flags.ts` — `usePlanFlags` for new order UI
- **Docs:** [PLAN_FLAGS_IMPLEMENTATION](../../platform/feature_flags/PLAN_FLAGS_IMPLEMENTATION.md)

## i18n Keys

- `newOrder.preferences.servicePrefs`
- `newOrder.preferences.packingPref`
- `newOrder.preferences.none`
- `newOrder.itemsGrid.preferences`

## API Routes

- `GET /api/v1/catalog/service-preferences`
- `GET /api/v1/catalog/service-preferences/admin` — Admin edit view (config:preferences_manage)
- `PUT /api/v1/catalog/service-preferences/[code]` — Upsert tenant override
- `DELETE /api/v1/catalog/service-preferences/[code]` — Reset to system default
- `GET /api/v1/catalog/packing-preferences`
- `GET /api/v1/catalog/packing-preferences/admin`
- `PUT /api/v1/catalog/packing-preferences/[code]`
- `DELETE /api/v1/catalog/packing-preferences/[code]`
- `GET /api/v1/catalog/preference-bundles`
- `GET/POST/DELETE /api/v1/orders/[id]/items/[itemId]/service-prefs`
- `PATCH /api/v1/orders/[id]/items/[itemId]/packing-pref`
- `GET/POST/DELETE /api/v1/orders/[id]/items/[itemId]/pieces/[pieceId]/service-prefs` (Enterprise)
- `GET/POST/DELETE /api/v1/customers/[id]/service-prefs`

## Migrations

- `0139_order_service_preferences_schema.sql` — Schema, catalogs, tenant config, org_order_item_pc_prefs, functions, RLS
- `0140_order_service_preferences_flags_settings.sql` — Feature flags, plan mappings, tenant settings

## Constants & Types

- `lib/constants/service-preferences.ts`
- `lib/types/service-preferences.ts`
- `lib/validations/service-preferences-schemas.ts`
