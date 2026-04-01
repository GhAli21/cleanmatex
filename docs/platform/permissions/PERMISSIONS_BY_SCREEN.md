---
version: v2.0.0
last_updated: 2026-03-26
author: CleanMateX Team
---

# Permissions by Screen

This document is now contract-aligned.

## Source Of Truth

Frontend route and action access is defined in:

- `web-admin/lib/auth/access-contracts.ts`
- `web-admin/src/features/access/page-access-registry.ts`
- `web-admin/src/features/*/access/*.ts`

The complete UI inventory lives in:

- [all_contract-aligned_UI_Permissions.md](./all_contract-aligned_UI_Permissions.md)

Page-linked backend permissions are documented separately in:

- [PERMISSIONS_BY_API.md](./PERMISSIONS_BY_API.md)

## What This Covers

- Active `web-admin/app/dashboard/**/page.tsx` routes
- Page-level UI access gates
- Action-level UI access gates
- Feature-flag gates
- Workflow-role and tenant-role gates
- Intentionally open pages with no explicit UI permission requirement

## Contract Notes

- A page can intentionally have no explicit UI permission gate. That is valid and must still be represented by a contract.
- Backend authorization remains the final authority.
- Navigation metadata is not the primary source of truth once a route has an explicit contract.
- Linked APIs may be declared on the page contract through `apiDependencies`, but their required permissions still come from backend route or server-action enforcement.

## Representative Explicit UI Gates

| Route | Page Gate | Action Gates | Notes |
|---|---|---|---|
| `/dashboard/b2b/contracts` | `b2b_contracts:view` + feature flag `b2b_contracts` | `Create contract` → `b2b_contracts:create` | Contract-first page and action gate |
| `/dashboard/catalog/preferences` | any of `orders:service_prefs_view`, `orders:read`, `config:preferences_manage` | manage preferences actions → `config:preferences_manage` | Page gate allows viewers; actions stay admin-only |
| `/dashboard/catalog/customer-categories` | `config:preferences_manage` | manage categories → `config:preferences_manage` | Page and actions aligned |
| `/dashboard/billing/payments` | no explicit page permission | `Cancel payment` → `payments:cancel`, `Refund payment` → `payments:refund` | Open page, gated row actions |
| `/dashboard/settings/workflow-roles` | `settings:workflow_roles:view` | none | Explicit page gate |
| `/dashboard/settings/roles` | wildcard/settings/role-prefix/tenant-role contract | none | Page gate is declarative in the contract |
| `/dashboard/settings/permissions` | wildcard/settings/permission-prefix/tenant-role contract | none | Page gate is declarative in the contract |
| `/dashboard/orders/new` | no explicit page permission | `Use price override controls` → `pricing:override` | Action-only gate |
| `/dashboard/reports/*` | feature flag `advanced_analytics` | none | Feature-flag page gate |
| `/dashboard/erp-lite/*` | route-specific `erp_lite_*:view` + ERP-Lite feature flags | none | Finance routes are contract-backed; some pages are live runtime screens and remaining placeholders stay explicitly marked in the contract |

## Related Docs

- [all_contract-aligned_UI_Permissions.md](./all_contract-aligned_UI_Permissions.md)
- [PERMISSIONS_REFERENCE.md](./PERMISSIONS_REFERENCE.md)
- [PERMISSIONS_BY_MODULE.md](./PERMISSIONS_BY_MODULE.md)
- [PERMISSIONS_BY_API.md](./PERMISSIONS_BY_API.md)
- [NAVIGATION_PERMISSIONS.md](./NAVIGATION_PERMISSIONS.md)
