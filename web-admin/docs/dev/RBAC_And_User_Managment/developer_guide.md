# RBAC & User Management — Developer Guide

## Architecture Overview

```
cleanmatex/web-admin (port 3000)
    ↓  HTTP + Bearer JWT
platform-api (port 3002, NestJS)  ←  single backend authority for RBAC
    ↓
Supabase (port 54321)             ←  actual DB + Auth storage
```

**Rule:** RBAC screens in `web-admin` NEVER call Supabase directly. All user/role/permission data comes from `platform-api`.

---

## Environment Setup

Add to `web-admin/.env.local`:
```env
NEXT_PUBLIC_PLATFORM_API_URL=http://localhost:3002/api/hq/v1
```

---

## Core: `rbacFetch` Utility

**File:** `lib/api/rbac-client.ts`

```typescript
import { rbacFetch, RbacApiError } from '@/lib/api/rbac-client'

// Basic GET
const roles = await rbacFetch<TenantRole[]>('/tenant-api/roles', accessToken)

// POST with body
const role = await rbacFetch<TenantRole>('/tenant-api/roles', accessToken, {
  method: 'POST',
  body: { code: 'manager', name: 'Manager' }
})

// GET with query params (undefined values are skipped automatically)
const users = await rbacFetch<UserListResponse>(`/tenants/${tenantId}/users`, accessToken, {
  queryParams: { page: 1, limit: 20, search: 'john', role: undefined }
})
```

**Error handling:**
```typescript
try {
  await rbacFetch(...)
} catch (err) {
  if (err instanceof RbacApiError) {
    console.error(`HTTP ${err.status}: ${err.message}`)
    // err.status === 0 means network/CORS error (backend not running)
    // err.status === 401 means token expired
    // err.status === 403 means insufficient permissions
  }
}
```

---

## Auth Token Pattern

All RBAC API functions require a JWT Bearer token. Get it from `useAuth()`:

```typescript
import { useAuth } from '@/lib/auth/auth-context'

function MyComponent() {
  const { currentTenant, session } = useAuth()
  const accessToken = session?.access_token ?? ''

  // Guard before making API calls:
  useEffect(() => {
    if (!currentTenant?.tenant_id || !accessToken) return
    loadData()
  }, [accessToken, currentTenant?.tenant_id])
}
```

**`AuthSession` shape** (`types/auth.ts`):
```typescript
interface AuthSession {
  access_token: string | null   // ← use this
  refresh_token: string | null
  expires_at: number | null
}
```

---

## Critical: Role Identifier Change

**Old code used `role_id` (UUID)** — this no longer exists in the API.
**New code uses `role.code` (string)** — e.g. `'tenant_admin'`, `'operator'`, `'viewer'`.

```typescript
// ✅ Correct
await deleteCustomRole(role.code, accessToken)
await assignPermissionsToRole(role.code, permissionCodes, accessToken)

// ❌ Wrong — role_id no longer exists
await deleteCustomRole(role.role_id, accessToken)
```

---

## API Reference

### Roles (`lib/api/roles.ts`)

| Function | Endpoint | Description |
|----------|----------|-------------|
| `getAllRoles(token)` | `GET /tenant-api/roles` | All roles (system + custom) |
| `getRoleByCode(code, token)` | `GET /tenant-api/roles/:code` | Single role with permissions list |
| `getRolePermissions(code, token)` | ↑ (extracts codes) | `string[]` of permission codes |
| `createCustomRole(dto, token)` | `POST /tenant-api/roles` | Create new role |
| `updateCustomRole(code, dto, token)` | `PATCH /tenant-api/roles/:code` | Update custom role |
| `deleteCustomRole(code, token)` | `DELETE /tenant-api/roles/:code` | Delete (fails if users assigned) |
| `assignPermissionsToRole(code, codes[], token)` | `POST /tenant-api/roles/:code/permissions` | Replace role permissions |

**Key type:**
```typescript
interface TenantRole {
  code: string         // PRIMARY IDENTIFIER (string, e.g. 'tenant_admin')
  name: string
  name2?: string       // Arabic
  is_system: boolean   // Cannot edit/delete system roles
  permission_count?: number
  user_count?: number
  permissions?: { code: string; name: string; category: string }[]
}
```

### Permissions (`lib/api/permissions.ts`)

| Function | Endpoint | Description |
|----------|----------|-------------|
| `getAllPermissions(token)` | `GET /tenant-api/permissions/by-category` | Returns `{ permissions, grouped }` |
| `getPermissionsByCategory(token)` | ↑ | Returns `{ [category]: TenantPermission[] }` |
| `getAllPermissionsList(token)` | `GET /tenant-api/permissions` | Flat array |
| `createPermission(dto, token)` | `POST /tenant-api/permissions` | Create custom permission |
| `updatePermission(code, dto, token)` | `PATCH /tenant-api/permissions/:code` | Update |
| `deletePermission(code, token)` | `DELETE /tenant-api/permissions/:code` | Delete |
| `isValidPermissionCode(code)` | (client-only) | Validates `resource:action` format |

**Permission code format:** `resource:action` — must match `/^[a-z_]+:[a-z_]+$/`
```
orders:read        ✅
customers:create   ✅
Orders:Read        ❌ (uppercase)
orders.read        ❌ (wrong separator)
```

### Users (`lib/api/users.ts`)

| Function | Endpoint | Description |
|----------|----------|-------------|
| `fetchUsers(tenantId, filters, page, limit, token)` | `GET /tenants/:id/users` | Paginated list |
| `fetchUser(tenantId, userId, token)` | `GET /tenants/:id/users/:uid` | Single user |
| `createUser(tenantId, dto, token)` | `POST /tenants/:id/users` | Returns `UserActionResult` |
| `updateUser(tenantId, userId, dto, token)` | `PATCH /tenants/:id/users/:uid` | Returns `UserActionResult` |
| `deleteUser(tenantId, userId, token)` | `DELETE /tenants/:id/users/:uid` | Returns `UserActionResult` |
| `activateUser(tenantId, userId, token)` | `POST .../activate` | Returns `UserActionResult` |
| `deactivateUser(tenantId, userId, token)` | `POST .../deactivate` | Returns `UserActionResult` |
| `getUserRoles(tenantId, userId, token)` | `GET .../roles` | `UserRoleAssignment[]` |
| `assignRolesToUser(tenantId, userId, codes, token)` | `POST .../roles` | Assign roles |
| `removeRoleFromUser(tenantId, userId, code, token)` | `DELETE .../roles/:code` | Remove role |
| `getEffectivePermissions(tenantId, userId, token)` | `GET .../effective-permissions` | Computed permissions |
| `fetchUserStats(tenantId, token)` | (client-computed) | Stats from user list |

**Note:** `createUser` in platform-api handles dual creation: Supabase Auth user + `org_users_mst` record, with rollback on failure. Never call Supabase admin APIs from web-admin.

---

## Adding a New RBAC-Protected Page

1. Create the page file, add `'use client'` directive
2. Protect with `withAdminRole()` HOC or inline access check:
   ```typescript
   import { withAdminRole } from '@/lib/auth/with-role'
   // wrap default export
   export default withAdminRole(MyPage)
   ```
3. Get token:
   ```typescript
   const { currentTenant, session } = useAuth()
   const accessToken = session?.access_token ?? ''
   ```
4. Guard API calls:
   ```typescript
   useEffect(() => {
     if (!currentTenant?.tenant_id || !accessToken) return
     loadData()
   }, [accessToken])
   ```
5. Add to `config/navigation.ts` under the appropriate section with `roles: ['admin']`
6. If it's under Settings, add a tab to `app/dashboard/settings/layout.tsx`

---

## Navigation Configuration

**Sidebar:** `config/navigation.ts` → `NAVIGATION_SECTIONS` array
**Settings tabs:** `app/dashboard/settings/layout.tsx` → `tabs` array

Adding a Permissions-like sub-item:
```typescript
// config/navigation.ts
{
  key: 'settings_my_feature',
  label: 'My Feature',
  path: '/dashboard/settings/my-feature',
  roles: ['admin'],
}
```

```typescript
// app/dashboard/settings/layout.tsx
{
  id: 'my-feature',
  label: t('myFeature', { defaultValue: 'My Feature' }),
  icon: <SomeIcon className="h-5 w-5" />,
  href: '/dashboard/settings/my-feature'
}
```

---

## Common Pitfalls

| Pitfall | Correct Pattern |
|---------|----------------|
| Using `role.role_id` | Use `role.code` |
| Calling `getAllRoles()` without token | `getAllRoles(accessToken)` |
| Importing from `@supabase/supabase-js` in RBAC screens | Use `rbacFetch` instead |
| Using `alert()` for errors | Use `setError()` state + error banner |
| Using `confirm()` for deletion | Use inline confirmation modal with state |
| Calling `/api/roles` or `/api/permissions` Next.js routes | Call `platform-api` directly via `rbacFetch` |
| Not guarding API calls when token is empty | `if (!accessToken) return` |

---

## File Map

```
lib/
  api/
    rbac-client.ts          # Core: rbacFetch + RbacApiError
    roles.ts                # Roles API (TenantRole, code-based)
    permissions.ts          # Permissions API (TenantPermission, resource:action)
    users.ts                # Users API (TenantUser, UserActionResult)

app/dashboard/
  users/
    page.tsx                # Users list (platform-api)
    [userId]/page.tsx       # User detail + role assignment (NEW)
    components/
      user-modal.tsx        # Create/edit user form (platform-api)
      user-table.tsx        # Users table + "View Details" link
      user-filters-bar.tsx  # Filters with dynamic role dropdown
      user-stats-cards.tsx  # Stats display (presentational)
  settings/
    roles/page.tsx          # Roles management (platform-api)
    permissions/page.tsx    # Permissions management (NEW, platform-api)
    layout.tsx              # Settings tabs (now includes Permissions)

components/
  permissions/
    PermissionAssignmentModal.tsx  # Role→permission assignment modal

config/
  navigation.ts             # Sidebar nav (includes Permissions sub-item)
```
