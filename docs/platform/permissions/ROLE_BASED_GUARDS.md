---
version: v1.0.0
last_updated: 2026-03-12
author: CleanMateX Team
---

# Role-Based Guards

Role-based access control (withRole) vs permission-based (RequirePermission).

**Source:** `web-admin/lib/auth/with-role.tsx`

## withRole HOC

Wraps pages that require specific **roles** (not granular permissions). Redirects to dashboard if user doesn't have required role.

### Supported Roles

| Role | Description |
|------|-------------|
| admin | Tenant admin (legacy) |
| super_admin | Platform super administrator |
| tenant_admin | Tenant administrator |
| operator | Standard operator |
| viewer | Read-only |

### Usage

```tsx
// Single role
const AdminPage = withRole(MyAdminPage, { requiredRole: 'admin' })

// Multiple roles
const StaffPage = withRole(MyPage, { requiredRole: ['admin', 'operator'] })
```

### Options

- `requiredRole` — UserRole or UserRole[]
- `redirectTo` — Default `/dashboard`
- `fallbackComponent` — Optional fallback component

### Data Source

Fetches role from `org_users_mst` for current user and tenant.

## Role vs Permission

| Approach | Use Case | Example |
|----------|----------|---------|
| **Role-based** (withRole) | Coarse page access | "Only admins can access settings" |
| **Permission-based** (RequirePermission) | Granular feature access | "Only users with payments:cancel can see Cancel button" |

Prefer permission-based for fine-grained control; use role-based for broad page guards.

## Layout Guards

Settings layout (`web-admin/app/dashboard/settings/layout.tsx`) does not use withRole; it relies on parent layout and navigation filtering. Individual settings pages may use role or permission checks.

## See Also

- [PERMISSIONS_REFERENCE](PERMISSIONS_REFERENCE.md)
- [PERMISSIONS_BY_SCREEN](PERMISSIONS_BY_SCREEN.md)
- [docs/features/RBAC/user_roles_guide.md](../../features/RBAC/user_roles_guide.md)
