---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Order Service Preferences — Development Plan

## Roadmap

| Phase | Milestone | Status |
|-------|-----------|--------|
| 1 | Database migration 0139 (schema, catalogs, RLS) | Completed |
| 2 | Feature flags and tenant settings (0140) | Completed |
| 3 | Constants, types, Zod schemas | Completed |
| 4 | API routes and services | Completed |
| 5 | Order creation integration (servicePrefCharge) | Completed |
| 6 | New order UI (selectors, bundles, repeat last) | Completed |
| 7 | Edit order UI | Completed |
| 8 | Per-piece UI (Enterprise) | Completed |
| 9 | Receipt placeholders, ready-by integration | Completed |
| 10 | Assembly screen (processing confirmation, override badge) | Completed |
| 11 | Admin config (Preferences catalog, Care Packages CRUD) | Completed |
| 12 | Customer standing prefs API | Completed |
| 13 | Permissions, i18n, unit tests | Completed |
| 14 | Documentation (Part N) | In progress |

## Milestones

### Phase 1–4: Foundation
- Migration 0139: System catalogs, tenant config, order tables, customer prefs
- Migration 0140: Feature flags, plan mappings, tenant settings
- Constants: `SERVICE_PREFERENCE_CODES`, `PACKING_PREFERENCE_CODES`, `PREFERENCE_SOURCES`
- Services: PreferenceCatalogService, OrderItemPreferenceService, OrderPiecePreferenceService, PreferenceResolutionService

### Phase 5–8: Order Flow
- Order creation: `servicePrefs`, `packingPrefCode`, `service_pref_charge` on items and pieces
- New order: ServicePreferenceSelector, PackingPreferenceSelector, CarePackageBundles, RepeatLastOrderPanel
- Edit order: Same selectors in edit flow
- Per-piece: Packing and service prefs per piece (Enterprise-gated)

### Phase 9–12: Integration
- Receipt: `{{preferences_summary}}`, `{{service_pref_charge}}`, `{{eco_score}}`
- Ready-by: `calculate_ready_by_with_preferences` (extra_turnaround_minutes)
- Assembly: Processing confirmation, override badge
- Admin: Preferences catalog page, Care Packages CRUD

### Phase 13–14: Quality and Docs
- Permissions, i18n keys, unit tests
- Full feature documentation per Part N

## Future Enhancements

- Smart suggestions panel (Growth+)
- Seasonal preference templates (Phase D)
- Preference fulfillment ratings
- Contract-level defaults
