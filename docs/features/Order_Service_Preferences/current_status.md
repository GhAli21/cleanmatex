---
version: v1.0.0
last_updated: 2026-03-12
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
| Admin catalog | Done | Preferences page, Care Packages CRUD |
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

- Smart suggestions panel: UI scaffold may need refinement.
- Customer prefs tab: API ready; customer detail tab UI pending.
- E2E tests: Not automated; manual QA recommended.
