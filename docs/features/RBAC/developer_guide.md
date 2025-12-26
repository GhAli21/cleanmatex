# RBAC Developer Guide

**Version:** v1.0.0  
**Last Updated:** 2025-01-XX  
**Status:** Complete ✅

---

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Database Schema](#database-schema)
4. [Backend Integration](#backend-integration)
5. [Frontend Integration](#frontend-integration)
6. [Permission Format](#permission-format)
7. [Workflow Roles](#workflow-roles)
8. [Best Practices](#best-practices)
9. [Troubleshooting](#troubleshooting)

---

## Overview

The CleanMateX RBAC (Role-Based Access Control) system provides granular, permission-based access control with multi-tenant support, resource scoping, and high-performance permission checks.

### Key Features

- **Granular Permissions:** 118+ permissions using `resource:action` format
- **Multi-Role Support:** Users can have multiple roles simultaneously
- **Resource Scoping:** Permissions can be scoped to branches, stores, POS, routes, or devices
- **Effective Permissions Cache:** Precomputed permissions for O(1) RLS checks
- **Workflow Roles:** Separate system for operational workflow access
- **Multi-Tenant:** Strict tenant isolation with RLS enforcement

---

## Architecture

### Permission Flow

```
User → Roles → Default Permissions → Effective Permissions → RLS Check
         ↓
    Direct Permissions (overrides)
         ↓
    Resource-Scoped Permissions
```

### Core Components

1. **Database Layer:** PostgreSQL tables with RLS policies
2. **RLS Functions:** Fast permission checks (`cmx_can()`)
3. **Backend Services:** TypeScript services for permission checks
4. **Frontend Hooks:** React hooks for UI-level checks
5. **API Middleware:** Route protection middleware

---

## Database Schema

### Core Tables

#### `sys_auth_permissions`

Master permission definitions (platform-wide).

```sql
CREATE TABLE sys_auth_permissions (
  permission_id UUID PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,  -- e.g., 'orders:create'
  name TEXT,
  name2 TEXT,                 -- Arabic name
  category TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `sys_auth_roles`

Role definitions (system + custom).

```sql
CREATE TABLE sys_auth_roles (
  role_id UUID PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,  -- e.g., 'tenant_admin'
  name TEXT,
  name2 TEXT,                  -- Arabic name
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

#### `org_auth_user_roles`

User role assignments (supports multiple roles per user).

```sql
CREATE TABLE org_auth_user_roles (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL,
  tenant_org_id UUID NOT NULL,
  role_id UUID NOT NULL REFERENCES sys_auth_roles(role_id),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID,
  UNIQUE(user_id, tenant_org_id, role_id)
);
```

#### `cmx_effective_permissions`

Precomputed permissions cache for fast RLS checks.

```sql
CREATE TABLE cmx_effective_permissions (
  user_id UUID NOT NULL,
  tenant_org_id UUID NOT NULL,
  permission_code TEXT NOT NULL,
  resource_type TEXT,          -- 'branch', 'store', 'pos', 'route', 'device'
  resource_id UUID,            -- Specific resource ID
  allow BOOLEAN NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, tenant_org_id, permission_code, resource_type, resource_id)
);
```

### RLS Functions

#### `cmx_can(permission, resource_type, resource_id)`

Fast permission check for RLS (O(1) lookup).

```sql
SELECT cmx_can('orders:create', NULL, NULL);  -- Tenant-wide check
SELECT cmx_can('orders:read', 'branch', 'branch-uuid');  -- Branch-scoped
```

#### `cmx_rebuild_user_permissions(user_id, tenant_id)`

Rebuilds effective permissions for a user (called automatically on changes).

```sql
SELECT cmx_rebuild_user_permissions('user-uuid', 'tenant-uuid');
```

#### `get_user_permissions()`

Returns all permissions for current user.

```sql
SELECT * FROM get_user_permissions();
```

#### `has_permission(permission)`

Check if current user has a specific permission.

```sql
SELECT has_permission('orders:create');
```

---

## Backend Integration

### Permission Service

**File:** `web-admin/lib/services/permission-service.ts`

#### Client-Side Checks

```typescript
import {
  hasPermission,
  hasAnyPermission,
  hasAllPermissions,
} from "@/lib/services/permission-service";

// Single permission check
const canCreate = await hasPermission("orders", "create");

// Any permission check
const canManage = await hasAnyPermission(["orders:create", "orders:update"]);

// All permissions check
const canFullAccess = await hasAllPermissions([
  "orders:create",
  "orders:read",
  "orders:update",
  "orders:delete",
]);
```

#### Server-Side Checks

```typescript
import {
  hasPermissionServer,
  hasAnyPermissionServer,
} from "@/lib/services/permission-service";

// In API routes or server actions
const canCreate = await hasPermissionServer("orders", "create");
if (!canCreate) {
  return NextResponse.json({ error: "Unauthorized" }, { status: 403 });
}
```

#### Resource-Scoped Checks

```typescript
import { hasResourcePermissionServer } from "@/lib/services/permission-service";

// Check branch-scoped permission
const canReadBranch = await hasResourcePermissionServer(
  "orders",
  "read",
  "branch",
  branchId
);
```

### Role Service

**File:** `web-admin/lib/services/role-service.ts`

#### Get All Roles

```typescript
import { getAllRoles } from "@/lib/services/role-service";

const roles = await getAllRoles();
// Returns: Array of Role objects
```

#### Create Custom Role

```typescript
import { createCustomRole } from "@/lib/services/role-service";

const role = await createCustomRole({
  code: "cashier",
  name: "Cashier",
  name2: "أمين الصندوق",
  description: "Handles cash transactions",
});
```

#### Assign Role to User

```typescript
import { assignRoleToUser } from "@/lib/services/role-service";

await assignRoleToUser({
  user_id: "user-uuid",
  tenant_org_id: "tenant-uuid",
  role_id: "role-uuid",
});
```

#### Assign Workflow Role

```typescript
import { assignWorkflowRoleToUser } from "@/lib/services/role-service";

await assignWorkflowRoleToUser({
  user_id: "user-uuid",
  tenant_org_id: "tenant-uuid",
  workflow_role: "ROLE_RECEPTION",
});
```

### API Middleware

**File:** `web-admin/lib/middleware/require-permission.ts`

#### Protect API Routes

```typescript
import { requirePermission } from "@/lib/middleware/require-permission";

export async function POST(request: Request) {
  // Check permission before processing
  await requirePermission("orders", "create");

  // Your route logic here
  return NextResponse.json({ success: true });
}
```

#### Multiple Permissions

```typescript
import {
  requireAnyPermission,
  requireAllPermissions,
} from "@/lib/middleware/require-permission";

// Any permission
await requireAnyPermission(["orders:create", "orders:update"]);

// All permissions
await requireAllPermissions(["orders:read", "orders:create"]);
```

#### Resource-Scoped Protection

```typescript
import { requirePermission } from "@/lib/middleware/require-permission";

// Extract resource from request
const { branchId } = await request.json();

await requirePermission("orders", "create", {
  resourceType: "branch",
  resourceId: branchId,
});
```

---

## Frontend Integration

### React Hooks

**File:** `web-admin/lib/hooks/usePermissions.ts`

#### Basic Usage

```typescript
import { useHasPermission, usePermissions } from "@/lib/hooks/usePermissions";

function MyComponent() {
  const canCreate = useHasPermission("orders", "create");
  const permissions = usePermissions();

  return (
    <div>
      {canCreate && <CreateButton />}
      <p>You have {permissions.length} permissions</p>
    </div>
  );
}
```

#### Multiple Permission Checks

```typescript
import {
  useHasAnyPermission,
  useHasAllPermissions,
} from "@/lib/hooks/usePermissions";

function MyComponent() {
  const canManage = useHasAnyPermission(["orders:create", "orders:update"]);
  const canFullAccess = useHasAllPermissions([
    "orders:create",
    "orders:read",
    "orders:update",
    "orders:delete",
  ]);

  return (
    <div>
      {canManage && <ManageButton />}
      {canFullAccess && <AdminPanel />}
    </div>
  );
}
```

#### Workflow Roles

```typescript
import {
  useWorkflowRoles,
  useHasWorkflowRole,
} from "@/lib/hooks/usePermissions";

function WorkflowComponent() {
  const workflowRoles = useWorkflowRoles();
  const isReception = useHasWorkflowRole("ROLE_RECEPTION");

  return (
    <div>
      {isReception && <ReceptionPanel />}
      <p>Your workflow roles: {workflowRoles.join(", ")}</p>
    </div>
  );
}
```

### Permission Components

**File:** `web-admin/components/auth/RequirePermission.tsx`

#### Conditional Rendering

```typescript
import {
  RequirePermission,
  RequireAnyPermission,
} from "@/components/auth/RequirePermission";

function MyPage() {
  return (
    <div>
      <RequirePermission resource="orders" action="create">
        <CreateOrderButton />
      </RequirePermission>

      <RequireAnyPermission permissions={["orders:create", "orders:update"]}>
        <EditButton />
      </RequireAnyPermission>
    </div>
  );
}
```

#### Custom Render Function

```typescript
import { PermissionGate } from "@/components/auth/RequirePermission";

function MyComponent() {
  return (
    <PermissionGate
      resource="orders"
      action="delete"
      fallback={<p>You don't have permission to delete</p>}
    >
      {(hasPermission) => (
        <button disabled={!hasPermission}>Delete Order</button>
      )}
    </PermissionGate>
  );
}
```

#### Workflow Role Components

```typescript
import {
  RequireWorkflowRole,
  RequireAnyWorkflowRole,
} from "@/components/auth/RequirePermission";

function WorkflowPage() {
  return (
    <div>
      <RequireWorkflowRole role="ROLE_RECEPTION">
        <ReceptionPanel />
      </RequireWorkflowRole>

      <RequireAnyWorkflowRole roles={["ROLE_PROCESSING", "ROLE_QA"]}>
        <ProcessingPanel />
      </RequireAnyWorkflowRole>
    </div>
  );
}
```

---

## Permission Format

### Standard Format

```
resource:action
```

**Examples:**

- `orders:create` - Create orders
- `orders:read` - View orders
- `orders:update` - Edit orders
- `orders:delete` - Delete orders
- `customers:export` - Export customer data
- `settings:manage` - Manage settings

### Wildcards

- `*:*` - All permissions (super admin)
- `orders:*` - All order permissions
- `*:read` - Read permission for all resources

### Resources

Available resources:

- `orders` - Order management
- `customers` - Customer management
- `inventory` - Inventory management
- `reports` - Reports and analytics
- `settings` - System settings
- `users` - User management
- `roles` - Role management
- `workflow` - Workflow operations

### Actions

Common actions:

- `create` - Create new records
- `read` - View records
- `update` - Edit records
- `delete` - Delete records
- `export` - Export data
- `manage` - Full management access
- `assign_roles` - Assign roles to users
- `transition` - Workflow transitions

---

## Workflow Roles

Workflow roles control access to specific operational workflow steps, separate from permission-based roles.

### Available Workflow Roles

- `ROLE_RECEPTION` - Order intake & delivery
- `ROLE_PREPARATION` - Item tagging & prep
- `ROLE_PROCESSING` - Wash, dry, iron
- `ROLE_QA` - Quality inspection
- `ROLE_DELIVERY` - Delivery operations
- `ROLE_ADMIN` - Full workflow access

### Multi-Role Support

Users can have multiple workflow roles simultaneously:

```typescript
// User can be both RECEPTION and QA
await assignWorkflowRoleToUser({
  user_id: "user-uuid",
  tenant_org_id: "tenant-uuid",
  workflow_role: "ROLE_RECEPTION",
});

await assignWorkflowRoleToUser({
  user_id: "user-uuid",
  tenant_org_id: "tenant-uuid",
  workflow_role: "ROLE_QA",
});
```

### Checking Workflow Roles

```typescript
// Frontend
const isReception = useHasWorkflowRole("ROLE_RECEPTION");
const hasAnyWorkflowRole = useHasAnyWorkflowRole(["ROLE_RECEPTION", "ROLE_QA"]);

// Backend
const workflowRoles = await getUserWorkflowRoles();
const hasRole = await hasWorkflowRole("ROLE_RECEPTION");
```

---

## Best Practices

### 1. Always Use Permission Checks

❌ **Don't:**

```typescript
if (userRole === "admin") {
  // do something
}
```

✅ **Do:**

```typescript
const canDelete = useHasPermission("orders", "delete");
if (canDelete) {
  // do something
}
```

### 2. Use Resource Scoping When Needed

❌ **Don't:**

```typescript
// Check tenant-wide permission for branch-specific action
const canRead = await hasPermission("orders", "read");
```

✅ **Do:**

```typescript
// Check branch-scoped permission
const canRead = await hasResourcePermission(
  "orders",
  "read",
  "branch",
  branchId
);
```

### 3. Protect API Routes

❌ **Don't:**

```typescript
export async function POST(request: Request) {
  // No permission check
  const data = await request.json();
  // Process data...
}
```

✅ **Do:**

```typescript
export async function POST(request: Request) {
  await requirePermission("orders", "create");
  const data = await request.json();
  // Process data...
}
```

### 4. Use Effective Permissions for RLS

The `cmx_effective_permissions` table is automatically maintained. Use `cmx_can()` for RLS checks:

```sql
-- In RLS policy
CREATE POLICY orders_select_policy ON org_orders_mst
  FOR SELECT
  USING (
    cmx_can('orders:read', 'branch', branch_id)
  );
```

### 5. Rebuild Permissions After Changes

Permissions are automatically rebuilt via triggers. If you need to manually rebuild:

```typescript
import { rebuildUserPermissions } from "@/lib/services/permission-service";

await rebuildUserPermissions(userId, tenantId);
```

---

## Troubleshooting

### Permission Check Returns False

1. **Check user has role assigned:**

```sql
SELECT * FROM org_auth_user_roles
WHERE user_id = 'user-uuid' AND tenant_org_id = 'tenant-uuid';
```

2. **Check role has permission:**

```sql
SELECT sp.code
FROM sys_auth_role_default_permissions srdp
JOIN sys_auth_permissions sp ON sp.permission_id = srdp.permission_id
WHERE srdp.role_id = 'role-uuid';
```

3. **Check effective permissions:**

```sql
SELECT * FROM cmx_effective_permissions
WHERE user_id = 'user-uuid' AND tenant_org_id = 'tenant-uuid';
```

4. **Rebuild permissions:**

```sql
SELECT cmx_rebuild_user_permissions('user-uuid', 'tenant-uuid');
```

### RLS Policy Not Working

1. **Verify RLS is enabled:**

```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE tablename = 'org_orders_mst';
```

2. **Check policy exists:**

```sql
SELECT * FROM pg_policies WHERE tablename = 'org_orders_mst';
```

3. **Test permission function:**

```sql
SELECT cmx_can('orders:read', NULL, NULL);
```

### Performance Issues

1. **Check indexes:**

```sql
SELECT * FROM pg_indexes WHERE tablename = 'cmx_effective_permissions';
```

2. **Verify effective permissions are being used:**

```sql
EXPLAIN ANALYZE
SELECT * FROM cmx_effective_permissions
WHERE user_id = 'user-uuid' AND permission_code = 'orders:read';
```

3. **Monitor permission rebuilds:**

```sql
-- Check trigger execution
SELECT * FROM pg_stat_user_tables WHERE relname = 'org_auth_user_roles';
```

---

## Additional Resources

- **Quick Reference:** `docs/features/RBAC/QUICK_REFERENCE.md`
- **Implementation Status:** `docs/features/RBAC/IMPLEMENTATION_STATUS.md`
- **Design Plan:** `docs/features/RBAC/PERFECT_RBAC_DESIGN_PLAN.md`
- **API Specifications:** `docs/features/RBAC/technical_docs/api_specifications.md`

---

**Version:** v1.0.0 | **Last Updated:** 2025-01-XX
