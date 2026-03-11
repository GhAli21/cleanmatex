# Changelog

## [v1.1.0] - 2026-03-12

### Added

- **Processing screen**: Display service prefs and packing pref per piece in ProcessingPieceRow
- **OrderPieceService.getPiecesByOrder**: Enriches pieces with service_prefs from org_order_item_pc_prefs
- **Ready-by estimation**: SLA adjustment from service preferences (extra_turnaround_minutes)
- **Preferences catalog page**: /dashboard/catalog/preferences — read-only view of service and packing preferences
- **Piece-level service-prefs API**: GET/POST/DELETE `/api/v1/orders/:id/items/:itemId/pieces/:pieceId/service-prefs` (Enterprise)
- **OrderPiecePreferenceService**: CRUD for org_order_item_pc_prefs, recalc piece and item service_pref_charge
- **Migration 0142**: get_last_order_preferences, suggest_preferences_from_history DB functions
- **APIs**: GET /preferences/last-order, /preferences/suggest, /preferences/resolve; POST /orders/.../apply-bundle/[bundleCode]
- **PreferenceResolutionService**: resolveItemPreferences, getLastOrderPreferences, suggestPreferencesFromHistory
- **CarePackageBundles, RepeatLastOrderPanel, SmartSuggestionsPanel**: New order UI (Growth+/Starter+)
- **ItemPiece/OrderItemPiece**: packingPrefCode, servicePrefs, packing_pref_code, service_pref_charge
- **i18n**: processing.modal.packing, catalog.preferences.*

## [v1.0.0] - 2026-03-12

### Added

- Migration 0139: Schema, catalogs, tenant config, org_order_item_pc_prefs, functions, RLS
- Migration 0140: Feature flags, plan mappings, tenant settings
- Constants and types: service-preferences.ts, service-preferences-schemas.ts
- PreferenceCatalogService, OrderItemPreferenceService
- API routes: catalog, order item service-prefs, packing-pref, customer service-prefs
- Order creation integration: servicePrefs, packingPrefCode, service_pref_charge
- Order calculation: servicePrefCharge in subtotal
- ServicePreferenceSelector, PackingPreferenceSelector in new order and edit order
- Per-piece packing and service pref UI (Enterprise-gated, packingPerPieceEnabled)
- Receipt placeholders: {{preferences_summary}}, {{service_pref_charge}}, {{eco_score}}
- Permissions: orders:service_prefs_view, orders:service_prefs_edit, config:preferences_manage, customers:preferences_manage
- i18n keys for newOrder.preferences
