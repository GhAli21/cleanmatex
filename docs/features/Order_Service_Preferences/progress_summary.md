---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Order Service Preferences — Progress Summary

## Completed Work

| Date | Item | Details |
|------|------|---------|
| 2026-03-12 | Migration 0139 | Schema, sys catalogs, org config, org_order_item_pc_prefs, functions, RLS |
| 2026-03-12 | Migration 0140 | Feature flags, plan mappings, tenant settings |
| 2026-03-12 | Migration 0141 | Navigation catalog preferences |
| 2026-03-12 | Migration 0142 | get_last_order_preferences, suggest_preferences_from_history |
| 2026-03-12 | Migration 0144 | SERVICE_PREF_PROCESSING_CONFIRMATION tenant setting |
| 2026-03-12 | Constants & types | service-preferences.ts, service-preferences-schemas.ts |
| 2026-03-12 | PreferenceCatalogService | getServicePreferences, getPackingPreferences, getPreferenceBundles, bundle CRUD |
| 2026-03-12 | OrderItemPreferenceService | Item-level CRUD, service_pref_charge recalc |
| 2026-03-12 | OrderPiecePreferenceService | Piece-level CRUD, confirmPiecePrefs |
| 2026-03-12 | PreferenceResolutionService | resolveItemPreferences, getLastOrderPreferences, suggestPreferencesFromHistory |
| 2026-03-12 | API routes | Catalog, order item/piece prefs, packing-pref, customer prefs, preference-bundles |
| 2026-03-12 | Order creation | servicePrefs, packingPrefCode, service_pref_charge in CreateOrderParams |
| 2026-03-12 | New order UI | ServicePreferenceSelector, PackingPreferenceSelector, CarePackageBundles, RepeatLastOrderPanel |
| 2026-03-12 | Edit order UI | Same selectors in edit flow |
| 2026-03-12 | Per-piece UI | Packing and service prefs per piece (Enterprise) |
| 2026-03-12 | Receipt placeholders | {{preferences_summary}}, {{service_pref_charge}}, {{eco_score}} |
| 2026-03-12 | Ready-by | OrderService.estimateReadyBy includes extra_turnaround_minutes |
| 2026-03-12 | Assembly | ProcessingPieceRow prefs display, override badge, Confirm button |
| 2026-03-12 | Admin catalog | /dashboard/catalog/preferences, Care Packages CRUD |
| 2026-03-12 | Permissions | orders:service_prefs_view, orders:service_prefs_edit, config:preferences_manage, customers:preferences_manage |
| 2026-03-12 | i18n | newOrder.preferences.*, catalog.preferences.*, processing.modal.* |
| 2026-03-12 | Unit tests | order-item-helpers (servicePrefCharge), service-preferences-schemas |

## Outstanding Items

| Item | Priority | Notes |
|------|----------|-------|
| Smart suggestions panel | Low | Growth+; UI exists, may need refinement |
| Customer prefs tab in customer detail | Medium | API exists; UI tab to be added |
| E2E tests for preference flows | Low | Manual testing done; automated E2E optional |

## Progress Metrics

- **Database:** 100% (migrations created)
- **Backend services:** 100%
- **API routes:** 100%
- **New order UI:** 100%
- **Edit order UI:** 100%
- **Per-piece UI:** 100%
- **Receipt/ready-by:** 100%
- **Assembly:** 100%
- **Admin catalog:** 100%
- **Documentation:** 95%
