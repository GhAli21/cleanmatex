---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Admin APIs

Navigation, roles, and permissions management APIs.

## Navigation API

| Method | Route | Purpose | Auth |
|--------|-------|---------|------|
| GET | /api/navigation | Get navigation tree for current user | JWT + tenant |
| GET | /api/navigation/components | List navigation components | Admin (super_admin or tenant_admin) |
| GET | /api/navigation/components/[id] | Get component by ID | Admin |
| PATCH | /api/navigation/components/[id] | Update component | Admin |
| POST | /api/navigation/components | Create component | Admin |

**Source:** `web-admin/app/api/navigation/route.ts`, `web-admin/app/api/navigation/components/route.ts`, `web-admin/app/api/navigation/components/[id]/route.ts`

- Uses `get_navigation_with_parents_jh` RPC with user permissions
- Filters by `main_permission_code` and `feature_flag`
- Admin check: `userRole === 'super_admin' || userRole === 'tenant_admin'`

## Roles API

| Method | Route | Purpose | Auth |
|--------|-------|---------|------|
| GET | /api/roles/[id] | Get role by ID | JWT + tenant |
| GET | /api/roles/[id]/permissions | Get permissions for role | JWT + tenant |

**Source:** `web-admin/app/api/roles/[id]/route.ts`, `web-admin/app/api/roles/[id]/permissions/route.ts`

- Requires admin role (super_admin, tenant_admin) for management
- Role data from `sys_auth_roles`, permissions from `sys_auth_role_default_permissions`

## Permissions API

| Method | Route | Purpose | Auth |
|--------|-------|---------|------|
| GET | /api/permissions | List all permissions | JWT + tenant |

**Source:** `web-admin/app/api/permissions/route.ts`

- Returns all permissions from `sys_auth_permissions`
- Used by roles/permissions management UI

## Required Access

- **Navigation management:** super_admin or tenant_admin (role check in navigation/components)
- **Roles/Permissions read:** Authenticated user with tenant access
- **Roles/Permissions write:** super_admin or tenant_admin (enforced by RLS and UI)

## See Also

- [PERMISSIONS_REFERENCE](PERMISSIONS_REFERENCE.md)
- [NAVIGATION_PERMISSIONS](NAVIGATION_PERMISSIONS.md)
