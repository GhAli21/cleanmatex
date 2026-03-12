---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Permissions by Screen

Required permissions per dashboard screen/route.

**Source:** RequirePermission, RequireAnyPermission, useHasPermission in `web-admin/app/dashboard/**` and `web-admin/src/features/**`

## Format

| Route | Required Permission(s) | Component/Hook | Notes |
|-------|------------------------|----------------|-------|
| `path` | `permission:action` | RequirePermission | — |

## Screens with Explicit Permission Checks

| Route | Required Permission(s) | Component/Hook | Notes |
|-------|------------------------|----------------|-------|
| `/dashboard/catalog/preferences` | `orders:service_prefs_view` OR `orders:read` OR `config:preferences_manage` | RequireAnyPermission | Page-level |
| `/dashboard/catalog/preferences` | `config:preferences_manage` | RequireAnyPermission | Edit columns, Add bundle, Edit/Delete bundle buttons |
| `/dashboard/billing/payments` | `payments:cancel`, `payments:refund` | RequirePermission | Cancel/Refund buttons per row |
| `/dashboard/billing/payments/[id]` | `payments:cancel` | RequirePermission | Cancel button |
| `/dashboard/settings/workflow-roles` | `settings:workflow_roles:view` | RequirePermission | Page-level |
| `/dashboard/settings/roles` | `roles:create`, `roles:update`, `roles:delete` | RequirePermission | (page disabled) |
| New order modal | `pricing:override` | useHasPermission | Price override field visibility |

## Screens with Navigation Permission (main_permission_code)

Screens are also gated by `sys_components_cd.main_permission_code`. See [NAVIGATION_PERMISSIONS](NAVIGATION_PERMISSIONS.md).

| Route | main_permission_code | Roles |
|-------|----------------------|-------|
| `/dashboard` | (none) | admin, operator |
| `/dashboard/orders` | orders:read | admin, operator |
| `/dashboard/orders/new` | orders:create | admin, operator |
| `/dashboard/preparation` | orders:read | admin, operator |
| `/dashboard/processing` | orders:read | admin, operator |
| `/dashboard/assembly` | orders:read | admin, operator |
| `/dashboard/qa` | orders:read | admin, operator |
| `/dashboard/ready` | orders:read | admin, operator |
| `/dashboard/packing` | orders:read | admin, operator |
| `/dashboard/delivery` | orders:read | — |
| `/dashboard/drivers` | drivers:read | admin |
| `/dashboard/customers` | customers:read | admin, operator |
| `/dashboard/catalog/*` | catalog:read | admin |
| `/dashboard/catalog/preferences` | config:preferences_manage | super_admin, tenant_admin |
| `/dashboard/billing/*` | billing:read | admin, operator |
| `/dashboard/orders/*` | orders:read | admin, operator |
| `/dashboard/inventory/*` | inventory:read | admin, operator |
| `/dashboard/settings/*` | settings:read | admin |
| `/dashboard/settings/finance` | settings:read | admin, super_admin, tenant_admin |

## See Also

- [PERMISSIONS_REFERENCE](PERMISSIONS_REFERENCE.md)
- [PERMISSIONS_BY_MODULE](PERMISSIONS_BY_MODULE.md)
- [PERMISSIONS_BY_API](PERMISSIONS_BY_API.md)
- [NAVIGATION_PERMISSIONS](NAVIGATION_PERMISSIONS.md)
