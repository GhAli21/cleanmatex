# Permission Overrides — Why Empty & How to Trace/Test

## Why It's Empty

**Permission Overrides** are optional, per-user overrides on top of role-based permissions. They live in:

| Section | DB Table | Purpose |
|--------|---------|---------|
| Global Overrides | `org_auth_user_permissions` | Tenant-wide allow/deny overrides |
| Resource-Scoped Overrides | `org_auth_user_resource_permissions` | Allow/deny per resource (e.g. specific order, branch) |

Most users have no overrides — they rely on roles. The section is empty when there are no rows for this user in these tables.

---

## Data Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│ User Detail Page (page.tsx)                                              │
│   loadData() → getUserPermissionOverrides(tenantId, userId, token)       │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ lib/api/users.ts :: getUserPermissionOverrides()                          │
│   rbacFetch → GET /tenants/:tenantId/users/:userId/permissions            │
│   On error: returns { global_overrides: [], resource_overrides: [] }      │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│ platform-api (port 3002)                                                 │
│   Endpoint: GET /api/hq/v1/tenants/:tenantId/users/:userId/permissions  │
│   Reads: org_auth_user_permissions, org_auth_user_resource_permissions   │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## platform-api Implementation (cleanmatexsaas/platform-api)

**Location:** `F:\jhapp\cleanmatexsaas\platform-api`

**Full API path:** `GET /api/hq/v1/tenants/:tenantId/users/:userId/permissions`

| Layer | File | Method |
|-------|------|--------|
| Controller | `src/modules/tenant-users/tenant-users.controller.ts` | `@Get(':userId/permissions')` → `getUserPermissionOverrides()` |
| Service | `src/modules/tenant-users/tenant-users.service.ts` | `getUserPermissionOverrides(tenantId, userId)` |
| Repository | `src/modules/tenant-users/tenant-users.repository.ts` | `getUserPermissionOverrides()`, `getUserResourcePermissionOverrides()` |

**Repository queries:**
- `org_auth_user_permissions`: `SELECT permission_code, allow WHERE tenant_org_id = ? AND user_id = ?`
- `org_auth_user_resource_permissions`: `SELECT permission_code, allow, resource_type, resource_id WHERE ...`

**Note:** Both tables use `user_id` referencing `auth.users(id)`. The service passes `user.id` (org_users_mst.id) to the repository. If schema expects auth user id, verify platform-api uses `user.user_id` not `user.id`.

---

## How to Trace

### 1. Browser DevTools (Network tab)

1. Open user profile: `/dashboard/users/{userId}`
2. Open DevTools → Network
3. Find the request: `GET .../tenants/.../users/.../permissions`
4. Check:
   - **Status**: 200 vs 4xx/5xx
   - **Response body**: `{ global_overrides: [...], resource_overrides: [...] }`
   - **URL**: Should hit `NEXT_PUBLIC_PLATFORM_API_URL` (default `http://localhost:3002/api/hq/v1`)

### 2. Add Temporary Logging

In `web-admin/lib/api/users.ts`, add logging inside `getUserPermissionOverrides`:

```typescript
export async function getUserPermissionOverrides(
  tenantId: string,
  userId: string,
  accessToken: string = ''
): Promise<UserPermissionOverridesResponse> {
  try {
    const response = await rbacFetch<UserPermissionOverridesResponse>(
      `/tenants/${encodeURIComponent(tenantId)}/users/${encodeURIComponent(userId)}/permissions`,
      accessToken
    )
    console.log('[getUserPermissionOverrides]', { tenantId, userId, response })
    return response ?? { global_overrides: [], resource_overrides: [] }
  } catch (err) {
    console.error('[getUserPermissionOverrides] ERROR', err)  // ← Add this to see hidden errors
    return { global_overrides: [], resource_overrides: [] }
  }
}
```

The current code swallows errors and returns empty — this can hide API or auth issues.

### 3. Direct cURL

```powershell
# Get access token from browser (Application → Cookies → sb-...-auth-token, or from session)
$token = "YOUR_ACCESS_TOKEN"
$tenantId = "YOUR_TENANT_ID"
$userId = "fa1607b1-4d6d-49cd-acb6-af3006a713ed"

Invoke-RestMethod -Uri "http://localhost:3002/api/hq/v1/tenants/$tenantId/users/$userId/permissions" `
  -Headers @{ Authorization = "Bearer $token" } `
  -Method Get
```

Replace with your env URL if `NEXT_PUBLIC_PLATFORM_API_URL` is different.

### 4. Database Check (Local Supabase)

Run against local Supabase (port 54322) or use Supabase MCP:

```sql
-- Global overrides for Demo Admin
SELECT oup.*, sp.code, sp.name
FROM org_auth_user_permissions oup
JOIN sys_auth_permissions sp ON sp.code = oup.permission_code
WHERE oup.user_id = 'fa1607b1-4d6d-49cd-acb6-af3006a713ed'
  AND oup.tenant_org_id = (SELECT id FROM org_tenants_mst WHERE name ILIKE '%Demo%' LIMIT 1);

-- Resource-scoped overrides
SELECT ourp.*, sp.code, sp.name
FROM org_auth_user_resource_permissions ourp
JOIN sys_auth_permissions sp ON sp.code = ourp.permission_code
WHERE ourp.user_id = 'fa1607b1-4d6d-49cd-acb6-af3006a713ed'
  AND ourp.tenant_org_id = (SELECT id FROM org_tenants_mst WHERE name ILIKE '%Demo%' LIMIT 1);
```

If both return 0 rows, the UI is correct to show empty.

---

## How to Test (Insert Override)

### 1. Insert a Global Override (SQL)

```sql
-- Example: Grant orders:create for user in tenant
INSERT INTO org_auth_user_permissions (
  user_id, tenant_org_id, permission_code, allow, created_by
) VALUES (
  'fa1607b1-4d6d-49cd-acb6-af3006a713ed',  -- Demo Admin user_id
  (SELECT id FROM org_tenants_mst WHERE name ILIKE '%Demo Laundry%' LIMIT 1),
  'orders:create',   -- Must exist in sys_auth_permissions.code
  true,
  auth.uid()
);
```

Check available permission codes:

```sql
SELECT code, name FROM sys_auth_permissions WHERE is_active = true LIMIT 20;
```

### 2. Refresh the Page

Reload the user profile. If platform-api reads from these tables correctly, the new override should appear under Global Overrides.

### 3. Verify platform-api Is Running

```powershell
Invoke-RestMethod -Uri "http://localhost:3002/api/hq/v1/health" -Method Get
```

If this fails, the frontend will get network errors; `getUserPermissionOverrides` currently catches them and returns empty.

---

## Checklist

| Check | Action |
|-------|--------|
| platform-api running? | `curl http://localhost:3002/api/hq/v1/health` |
| API responds 200? | DevTools → Network → permissions request |
| DB has rows? | Run SQL above for `org_auth_user_permissions` |
| API errors hidden? | Add `console.error` in catch block |
| Tenant ID correct? | Compare `currentTenant.tenant_id` in page vs DB |

---

## Summary

- **Empty by design** when the user has no overrides in the DB.
- **Silent failures**: `getUserPermissionOverrides` returns empty on any error — add logging to debug.
- **platform-api** must be running on port 3002; RBAC endpoints are not proxied through Next.js.
