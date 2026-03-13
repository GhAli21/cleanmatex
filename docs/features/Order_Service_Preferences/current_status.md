---
version: v1.2.0
last_updated: 2026-03-13
author: CleanMateX Team
---

# Order Service Preferences — Current Status

## Implementation State

**Overall:** Production-ready. Core feature is implemented end-to-end.

| Area | Status | Notes |
|------|--------|------|
| Database schema | Done | Migrations 0139, 0140, 0141, 0142, 0144 |
| Services | Done | PreferenceCatalog, OrderItem, OrderPiece, PreferenceResolution |
| API | Done | Catalog, order item/piece, customer, bundles |
| New order | Done | Selectors, bundles, repeat last |
| Edit order | Done | Same selectors |
| Per-piece | Done | Enterprise-gated |
| Receipt | Done | Placeholders integrated |
| Ready-by | Done | SLA adjustment from prefs |
| Assembly | Done | Prefs display, override badge, confirmation |
| Admin catalog | Done | Preferences page, Care Packages CRUD, tenant config edit (service/packing) |
| Permissions | Done | RBAC in place |
| i18n | Done | EN/AR keys |
| Unit tests | Done | order-item-helpers, service-preferences-schemas |

## Blockers

None.

## Dependencies

- **Supabase:** Migrations must be applied by user (do not run db reset).
- **Feature flags:** Resolved via plan mappings; ensure tenant has correct plan.
- **Tenant settings:** SERVICE_PREF_* settings must exist in sys_tenant_settings_cd.

## Known Limitations

None. All previously outstanding items have been completed.
