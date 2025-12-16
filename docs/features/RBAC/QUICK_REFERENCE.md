# RBAC Quick Reference Guide

**Version:** v1.0.0  
**Last Updated:** 2025-01-XX

---

## 🎯 Core RBAC System Status: ✅ COMPLETE

The core RBAC system is fully implemented and ready for use. All database migrations, backend services, frontend hooks, and API middleware are complete.

---

## 📚 Usage Examples

### Frontend Components

#### 1. Check Permission in Component

```tsx
import { useHasPermission } from "@/lib/hooks/usePermissions";

function OrderActions() {
  const canCreate = useHasPermission("orders", "create");
  const canDelete = useHasPermission("orders", "delete");

  return (
    <div>
      {canCreate && <CreateOrderButton />}
      {canDelete && <DeleteOrderButton />}
    </div>
  );
}
```

#### 2. Conditional Rendering with Permission Components

```tsx
import { RequirePermission } from "@/components/auth/RequirePermission";

function OrderPage() {
  return (
    <div>
      <RequirePermission resource="orders" action="create">
        <CreateOrderButton />
      </RequirePermission>

      <RequirePermission
        resource="orders"
        action="delete"
        fallback={<p>No delete access</p>}
      >
        <DeleteOrderButton />
      </RequirePermission>
    </div>
  );
}
```

#### 3. Multiple Permission Checks

```tsx
import { RequireAnyPermission, RequireAllPermissions } from '@/components/auth/RequirePermission'

// User needs ANY of these permissions
<RequireAnyPermission permissions={['orders:create', 'orders:update']}>
  <EditOrderButton />
</RequireAnyPermission>

// User needs ALL of these permissions
<RequireAllPermissions permissions={['orders:read', 'orders:export']}>
  <ExportOrdersButton />
</RequireAllPermissions>
```

#### 4. Workflow Role Checks

```tsx
import { RequireWorkflowRole } from "@/components/auth/RequirePermission";

<RequireWorkflowRole workflowRole="ROLE_RECEPTION">
  <ReceptionScreen />
</RequireWorkflowRole>;
```

### API Routes

#### 1. Protect API Route with Single Permission

```typescript
import { requirePermission } from "@/lib/middleware/require-permission";

export async function POST(request: NextRequest) {
  // Check permission
  const authCheck = await requirePermission("orders:create")(request);
  if (authCheck instanceof NextResponse) {
    return authCheck; // Permission denied (403) or unauthorized (401)
  }

  const { tenantId, userId, userName } = authCheck;
  // ... rest of handler
}
```

#### 2. Protect with Multiple Permissions

```typescript
import {
  requireAnyPermission,
  requireAllPermissions,
} from "@/lib/middleware/require-permission";

// User needs ANY permission
const authCheck = await requireAnyPermission([
  "orders:create",
  "orders:update",
])(request);

// User needs ALL permissions
const authCheck = await requireAllPermissions(["orders:read", "orders:export"])(
  request
);
```

#### 3. Resource-Scoped Permissions

```typescript
import { requirePermission } from "@/lib/middleware/require-permission";

// Check permission for specific branch
const authCheck = await requirePermission("orders:create", {
  resourceType: "branch",
  resourceId: branchId,
})(request);
```

### Server Actions

```typescript
import { hasPermissionServer } from "@/lib/services/permission-service";

export async function createOrderAction(data: OrderData) {
  // Check permission
  const hasAccess = await hasPermissionServer("orders:create");
  if (!hasAccess) {
    throw new Error("Permission denied: orders:create");
  }

  // ... create order logic
}
```

---

## 🔑 Permission Codes Reference

### Orders

- `orders:create` - Create new orders
- `orders:read` - View orders
- `orders:update` - Edit orders
- `orders:delete` - Delete orders
- `orders:cancel` - Cancel orders
- `orders:transition` - Change order status
- `orders:export` - Export order data
- `orders:print` - Print receipts/labels
- `orders:refund` - Process refunds
- `orders:discount` - Apply discounts

### Customers

- `customers:create` - Create customers
- `customers:read` - View customers
- `customers:update` - Edit customers
- `customers:delete` - Delete customers
- `customers:export` - Export customer data

### Products

- `products:create` - Create products
- `products:read` - View catalog
- `products:update` - Edit products
- `products:delete` - Delete products

### Users & Roles

- `users:create` - Create users
- `users:read` - View users
- `users:update` - Edit users
- `users:delete` - Delete users
- `users:assign_roles` - Assign roles
- `roles:create` - Create custom roles
- `roles:update` - Edit roles
- `roles:delete` - Delete roles

### Settings

- `settings:read` - View settings
- `settings:update` - Update settings
- `settings:organization` - Org settings
- `settings:billing` - Billing settings

**Full list:** See `docs/features/RBAC/permission_matrix.md`

---

## 🎭 Workflow Roles

- `ROLE_RECEPTION` - Order intake & delivery
- `ROLE_PREPARATION` - Item tagging & prep
- `ROLE_PROCESSING` - Wash, dry, iron
- `ROLE_QA` - Quality inspection
- `ROLE_DELIVERY` - Delivery operations
- `ROLE_ADMIN` - Full workflow access

---

## 🔧 Database Functions

### Check Permissions

```sql
-- Check if user has permission
SELECT cmx_can('orders:create');

-- Get all user permissions
SELECT * FROM get_user_permissions();

-- Get user roles
SELECT * FROM get_user_roles();

-- Get workflow roles
SELECT * FROM get_user_workflow_roles();
```

### Rebuild Permissions

```sql
-- Rebuild effective permissions for a user
SELECT cmx_rebuild_user_permissions(user_id, tenant_id);
```

### Migration

```sql
-- Migrate existing users to RBAC
SELECT * FROM migrate_users_to_rbac();

-- Check migration status
SELECT * FROM check_rbac_migration_status();
```

---

## 📝 Migration from Old Role System

### Old Way (Role-based)

```tsx
// ❌ Old: Role-based check
<AdminOnly>
  <DeleteButton />
</AdminOnly>;

// ❌ Old: Hard-coded role check
if (userRole === "admin") {
  // do something
}
```

### New Way (Permission-based)

```tsx
// ✅ New: Permission-based check
<RequirePermission resource="orders" action="delete">
  <DeleteButton />
</RequirePermission>;

// ✅ New: Permission hook
const canDelete = useHasPermission("orders", "delete");
if (canDelete) {
  // do something
}
```

---

## 🚨 Important Notes

1. **Always use permission checks**, not role checks
2. **Permission format:** `resource:action` (colon separator)
3. **Wildcards:** `*:*` = super admin, `orders:*` = all order permissions
4. **Multi-role support:** Users can have multiple roles simultaneously
5. **Effective permissions:** Automatically rebuilt on role/permission changes
6. **RLS enforcement:** Database-level security via `cmx_can()` function

---

## 📖 Full Documentation

- **Implementation Status:** `docs/features/RBAC/IMPLEMENTATION_STATUS.md`
- **Design Plan:** `docs/features/RBAC/PERFECT_RBAC_DESIGN_PLAN.md`
- **Permission Matrix:** `docs/features/RBAC/permission_matrix.md`
- **Architecture:** `docs/features/RBAC/rbac_architecture.md`

---

**Status:** Core system complete ✅ | Ready for production use 🚀
