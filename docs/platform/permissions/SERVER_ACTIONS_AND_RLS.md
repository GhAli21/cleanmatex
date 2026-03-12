---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Server Actions and RLS

Permission checks in server actions, database RLS, and resource-scoped permissions.

## Server Actions

| File | Permission | Context |
|------|------------|---------|
| `web-admin/app/actions/payments/payment-crud-actions.ts` | payments:cancel, payments:refund | cancelPaymentAction, refundPaymentAction — uses hasPermissionServer |
| `web-admin/lib/db/orders.ts` | pricing:override | Price override in order creation — uses hasPermissionServer |

## Server-Side Permission Check

- **hasPermissionServer:** `web-admin/lib/services/permission-service-server.ts` — calls `has_permission` RPC
- Used before executing sensitive operations (cancel payment, refund, price override)

## RLS (Row Level Security)

- **cmx_can(p_perm, p_resource_type, p_resource_id):** `supabase/migrations/0036_rbac_rls_functions.sql` — Fast permission check for RLS policies
- **has_permission(p_permission):** Wraps cmx_can for tenant-wide check
- **get_user_permissions:** Returns permissions from `cmx_effective_permissions`
- Effective permissions are built from `org_auth_user_roles` → `sys_auth_role_default_permissions`

## Resource-Scoped Permissions

For branch/store/POS scoped access:

- **RequireResourcePermission** — `web-admin/src/features/auth/ui/RequireResourcePermission.tsx`
- **useHasResourcePermission** — `web-admin/lib/hooks/use-has-resource-permission.ts`
- **checkResourcePermission** — `web-admin/lib/services/permission-service-client.ts` — calls `has_resource_permission` RPC

## Wildcard

- `*:*` in user permissions grants all (super admin)
- `${resource}:*` grants all actions on resource

## See Also

- [PERMISSIONS_REFERENCE](PERMISSIONS_REFERENCE.md)
- [docs/features/RBAC/implementation_guide.md](../../features/RBAC/implementation_guide.md)
