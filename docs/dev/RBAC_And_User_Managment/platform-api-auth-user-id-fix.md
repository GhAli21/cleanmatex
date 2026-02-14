# platform-api: Use auth user id for RBAC Operations

## Problem

RBAC tables (`org_auth_user_roles`, `org_auth_user_permissions`, `org_auth_user_resource_permissions`, `cmx_effective_permissions`) use `user_id` referencing **auth.users(id)**. The platform-api was passing `user.id` (org_users_mst.id) to repository methods, causing empty results when the URL received org_users_mst.id.

## Solution

Use `user.user_id` (auth.users.id) for all RBAC operations. The URL already accepts **both** org_users_mst.id and auth.users.id via `resolveUser()` — the fix is to pass the correct id to the repository.

## File to Edit

`F:\jhapp\cleanmatexsaas\platform-api\src\modules\tenant-users\tenant-users.service.ts`

## Changes

### 1. Add helper after `resolveUser` (around line 62)

```typescript
  /**
   * Resolve auth user id for RBAC operations.
   * RBAC tables use auth.users.id; org_users_mst.user_id holds it.
   */
  private getAuthUserIdForRbac(user: { id: string; user_id?: string | null }): string {
    return user.user_id ?? user.id;
  }
```

### 2. Replace `orgUserId` with `authUserId` for RBAC calls

| Method | Change |
|--------|--------|
| `getUserRoles` | `const authUserId = this.getAuthUserIdForRbac(user);` then pass `authUserId` to repository |
| `assignRoles` | Same |
| `removeRole` | Same |
| `getUserWorkflowRoles` | Same |
| `assignWorkflowRoles` | Same |
| `getUserPermissionOverrides` | Same |
| `setPermissionOverrides` | Same |
| `setResourcePermissionOverrides` | Same |
| `rebuildEffectivePermissions` | Same |
| `getEffectivePermissions` | Same |

### 3. Keep `orgUserId` (user.id) only for

- `update(tenantId, existingUser.id, ...)` — org_users_mst operations
- `remove` — softDelete/hardDelete on org_users_mst
- Any other org_users_mst-specific operations

## Summary

- **URL accepts:** org_users_mst.id OR auth.users.id (resolveUser handles both)
- **RBAC repository calls:** use auth user id (`user.user_id ?? user.id`)
- **org_users_mst operations:** use org user id (`user.id`)
