# User Management & RBAC — Developer Guide

**Project:** cleanmatex (web-admin)
**Last updated:** 2026-04-03

---

## Architecture Overview

```
Browser (React)
    │
    ├── useAuth()  →  session.access_token, currentTenant.tenant_id
    │
    ├── Hooks (lib/hooks/)
    │       ├── useUserRoleAssignments(userId)
    │       ├── useUserPermissionOverrides(userId)
    │       ├── useEffectivePermissions(userId)
    │       ├── useTenantRoles()
    │       └── useTenantPermissions()
    │
    ├── API Client (lib/api/)
    │       ├── user-rbac.ts      ← new RBAC functions
    │       ├── users.ts          ← user CRUD
    │       ├── roles.ts          ← getAllRoles()
    │       └── permissions.ts    ← getAllPermissionsList()
    │
    └── rbacFetch(endpoint, accessToken, options)
            │
            └── platform-api  (http://localhost:3002/api/hq/v1)
                    │
                    └── Database (RLS enforced server-side)
```

---

## rbacFetch Pattern

All RBAC API calls use `rbacFetch` from `lib/api/rbac-client.ts`:

```typescript
import { rbacFetch } from '@/lib/api/rbac-client'

// Signature
rbacFetch(endpoint: string, accessToken: string, options?: RequestInit): Promise<T>

// endpoint always starts with '/'
// accessToken from: const { session } = useAuth(); session?.access_token
```

The function passes the JWT as `Authorization: Bearer <token>`. Platform-api validates the token and enforces tenant isolation.

---

## API Client — user-rbac.ts

Location: `web-admin/lib/api/user-rbac.ts`

All functions signature: `fn(userId, tenantId, accessToken, ...params)`

| Function | HTTP | Endpoint |
|----------|------|----------|
| `getUserRolesExtended` | GET | `/tenants/{tid}/users/{uid}/roles` |
| `assignRoles` | POST | `/tenants/{tid}/users/{uid}/roles` |
| `removeRole` | DELETE | `/tenants/{tid}/users/{uid}/roles/{roleCode}` |
| `getUserWorkflowRoles` | GET | `/tenants/{tid}/users/{uid}/workflow-roles` |
| `assignWorkflowRoles` | POST | `/tenants/{tid}/users/{uid}/workflow-roles` |
| `getPermissionOverrides` | GET | `/tenants/{tid}/users/{uid}/permissions` |
| `setPermissionOverrides` | POST | `/tenants/{tid}/users/{uid}/permissions` |
| `setResourcePermissionOverrides` | POST | `/tenants/{tid}/users/{uid}/permissions/resource` |
| `rebuildPermissions` | POST | `/tenants/{tid}/users/{uid}/rebuild-permissions` |
| `getEffectivePermissions` | GET | `/tenants/{tid}/users/{uid}/effective-permissions` |

---

## Hooks Reference

### useTenantRoles()
```typescript
// lib/hooks/use-tenant-roles.ts
const { roles, systemRoles, customRoles, loading, error, refetch } = useTenantRoles()
```
Wraps `getAllRoles(accessToken)` from `lib/api/roles.ts`. Splits roles into system vs custom.

### useTenantPermissions()
```typescript
// lib/hooks/use-tenant-permissions.ts
const { permissions, loading, error } = useTenantPermissions()
```
Wraps `getAllPermissionsList(accessToken)` from `lib/api/permissions.ts`.

### useUserRoleAssignments(userId)
```typescript
// lib/hooks/use-user-role-assignments.ts
const {
  tenantRoles,        // UserRole[]
  resourceRoles,      // UserResourceRole[]
  workflowRoles,      // UserWorkflowRole[]
  loading, error,
  assignRoles(roleCodes, resourceType?, resourceId?),
  removeRole(roleCode),
  assignWorkflowRoles(workflowRoles),
  removeWorkflowRole(roleCode),
  rebuildPermissions(),
  rebuilding,         // boolean — true while rebuild is in progress
  refetch()
} = useUserRoleAssignments(userId)
```

### useUserPermissionOverrides(userId)
```typescript
const {
  globalOverrides,    // UserPermissionOverride[]
  resourceOverrides,  // UserResourcePermissionOverride[]
  loading, error,
  saveGlobalOverrides(overrides),
  saveResourceOverrides(overrides),
  refetch()
} = useUserPermissionOverrides(userId)
```

### useEffectivePermissions(userId)
```typescript
const { permissions, loading, error } = useEffectivePermissions(userId)
// permissions: string[] — list of permission codes
```

---

## Component Tree

```
UserDetailScreen  (src/features/users/ui/user-detail-screen.tsx)
├── UserProfileTab    (user-profile-tab.tsx)
│       └── UserModal (existing, edit mode)
├── UserRolesTab      (rbac/user-roles-tab.tsx)
│       ├── AssignRolesDialog         (rbac/assign-roles-dialog.tsx)
│       ├── AssignWorkflowRolesDialog (rbac/assign-workflow-roles-dialog.tsx)
│       └── PermissionOverrideDialog  (rbac/permission-override-dialog.tsx)
└── UserActivityTab   (user-activity-tab.tsx)
        ├── Effective permissions (useEffectivePermissions)
        └── Audit log (Supabase client → sys_audit_log)
```

Page route: `app/dashboard/users/[userId]/page.tsx` — thin wrapper, just renders `<UserDetailScreen />`.

---

## Database Schema (read-only reference)

| Table | Purpose |
|-------|---------|
| `org_auth_user_roles` | Tenant-level role assignments |
| `org_auth_user_resource_roles` | Resource-scoped role assignments (separate table) |
| `org_auth_user_workflow_roles` | Workflow role assignments |
| `org_auth_user_permissions` | Global permission overrides |
| `org_auth_user_resource_permissions` | Resource-scoped permission overrides |
| `cmx_effective_permissions` | Computed effective permissions (materialized) |
| `sys_auth_roles` | Role definitions (name/name2 bilingual) |
| `sys_auth_permissions` | Permission definitions |
| `sys_auth_role_default_permissions` | Default permissions per role |

All `org_*` tables have RLS — platform-api uses service role key and enforces tenant isolation in app logic.

---

## i18n Keys

New keys added under:
- `messages/en.json` and `messages/ar.json`:
  - `users.detail.profileTab`, `rolesPermissionsTab`, `activityTab`, `displayName`, `firstName`, `lastName`, `never`
  - `users.rbac.*` — full RBAC namespace (assign, remove, rebuild, overrides, workflow roles, etc.)
  - `users.filters.workflowRole`, `allWorkflowRoles`, `deleteConfirm`

---

## Common Pitfalls

1. **Wrong hook dependency** — `useUserRoleAssignments` fetches both tenant + workflow roles; don't call `getUserWorkflowRoles` separately, it's included.
2. **Resource-scoped roles** — stored in `org_auth_user_resource_roles`, not as extra columns on `org_auth_user_roles`. The `assignRoles()` call with `resourceType + resourceId` POSTs to the same endpoint but platform-api routes to the separate table.
3. **Rebuild after changes** — After assigning/removing roles, call `rebuildPermissions()` or the effective permissions view may be stale.
4. **Audit log** — `user-activity-tab.tsx` queries `sys_audit_log` directly via Supabase anon client (not platform-api). Requires RLS to allow tenant-scoped read.
