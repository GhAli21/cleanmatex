# RBAC Architecture Design - CleanMateX

**Version:** v1.0.0
**Last Updated:** 2025-11-03
**Status:** Proposed Design

---

## General Rules

** Naming Rules: **

- All Database tables or objects related to this module should add _auth_ such as sys_auth_permissions, org_auth_user_roles

---

## 📋 Executive Summary

This document proposes a comprehensive Role-Based Access Control (RBAC) architecture for CleanMateX that provides granular permissions, flexible roles, multi-role support, and complete audit trails while maintaining multi-tenant security.

**Key Benefits:**
- ✅ Granular action-level permissions (`orders:create`, `customers:delete`)
- ✅ Flexible custom roles per tenant
- ✅ Multi-role support for users
- ✅ Separate workflow role system
- ✅ High performance with caching
- ✅ Complete audit trail

---

## 🎯 Design Goals

1. **Granularity** - Permission at resource:action level
2. **Flexibility** - Create custom roles per tenant
3. **Maintainability** - Centralized permission management
4. **Performance** - Fast permission checks (<10ms)
5. **Security** - Defense in depth with RLS
6. **Scalability** - Support thousands of users/roles
7. **Usability** - Easy for admins to understand
8. **Backward Compatibility** - Migrate smoothly from current system

---

## 🔑 Permission System

### Permission Format

**Convention:** `resource:action` or `resource:action:scope`

**Examples:**
```
orders:create       - Can create orders
orders:read         - Can view orders
orders:update       - Can edit orders
orders:delete       - Can delete orders
customers:export    - Can export customer data
settings:update     - Can modify settings
reports:view_financial - Can see financial reports
```

### Permission Categories

| Category | Pattern | Examples |
|----------|---------|----------|
| **CRUD** | `resource:{create\|read\|update\|delete}` | `customers:create`, `products:delete` |
| **Actions** | `resource:action` | `orders:cancel`, `invoices:void` |
| **Export** | `resource:export` | `customers:export`, `reports:export` |
| **Management** | `resource:manage` | `users:manage`, `settings:manage` |

---

## 👥 Role System

### Built-in System Roles

**1. super_admin** - Platform Administrator
- Permissions: `*:*` (all permissions, all tenants)
- Can manage tenants and system configuration

**2. tenant_admin** - Tenant Owner
- All permissions within their tenant
- Can manage users, roles, and settings

**3. branch_manager** - Branch Supervisor
- Branch-scoped permissions only
- Can manage branch operations

**4. operator** - Standard Worker
- Operational permissions (create/edit orders, customers)
- No administrative access

**5. viewer** - Read-Only
- All `:read` permissions
- No write capabilities

### Custom Roles
- Tenants can create custom roles
- Flexible permission combinations
- Stored with `tenant_org_id`

---

## 🗄️ Database Schema

### 1. Permissions Table

```sql
CREATE TABLE sys_auth_permissions (
  id VARCHAR(100) PRIMARY KEY,      -- 'orders:create'
  resource VARCHAR(50) NOT NULL,    -- 'orders'
  action VARCHAR(50) NOT NULL,      -- 'create'
  description TEXT,
  category VARCHAR(50),             -- 'crud', 'management'
  is_system BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(resource, action)
);
```

### 2. Roles Table

```sql
CREATE TABLE sys_auth_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,  -- 'tenant_admin'
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,   -- Built-in vs custom
  tenant_org_id UUID,                -- NULL for system roles
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id)
);
```

### 3. Role-Permission Mapping

```sql
CREATE TABLE sys_auth_role_permissions (
  role_id UUID NOT NULL,
  permission_id VARCHAR(100) NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES sys_auth_roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES sys_auth_permissions(id) ON DELETE CASCADE
);
```

### 4. User Role Assignments

```sql
CREATE TABLE org_auth_user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_org_id UUID NOT NULL,
  role_id UUID NOT NULL,
  is_primary BOOLEAN DEFAULT false,  -- Primary role
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,              -- Optional expiry
  is_active BOOLEAN DEFAULT true,
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  FOREIGN KEY (role_id) REFERENCES sys_auth_roles(id) ON DELETE CASCADE,
  UNIQUE(user_id, tenant_org_id, role_id)
);
```

### 5. Workflow Roles

```sql
CREATE TABLE org_auth_user_workflow_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tenant_org_id UUID NOT NULL,
  workflow_role VARCHAR(50) NOT NULL CHECK (workflow_role IN (
    'ROLE_RECEPTION', 'ROLE_PREPARATION', 'ROLE_PROCESSING',
    'ROLE_QA', 'ROLE_DELIVERY', 'ROLE_ADMIN'
  )),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE,
  FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  UNIQUE(user_id, tenant_org_id, workflow_role)
);
```

---

## 🔒 RLS Functions

```sql
-- Get all permissions for current user
CREATE OR REPLACE FUNCTION get_user_permissions()
RETURNS TABLE(permission_id VARCHAR) AS $$
  SELECT DISTINCT rp.permission_id
  FROM org_user_roles ur
  JOIN sys_auth_role_permissions rp ON ur.role_id = rp.role_id
  WHERE ur.user_id = auth.uid()
    AND ur.tenant_org_id = current_tenant_id()
    AND ur.is_active = true;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Check if user has specific permission
CREATE OR REPLACE FUNCTION has_permission(p_permission VARCHAR)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM org_auth_user_roles ur
    JOIN sys_auth_role_permissions rp ON ur.role_id = rp.role_id
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_org_id = current_tenant_id()
      AND ur.is_active = true
      AND rp.permission_id = p_permission
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
```

---

## 💻 Frontend Integration

### Hooks

```typescript
// usePermissions - Get all user permissions
export function usePermissions() {
  const { currentTenant } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    fetchUserPermissions(currentTenant?.tenant_id).then(setPermissions);
  }, [currentTenant]);

  return { permissions };
}

// useHasPermission - Check single permission
export function useHasPermission(resource: string, action: string) {
  const { permissions } = usePermissions();
  const permission = `${resource}:${action}`;
  return permissions.includes(permission) || permissions.includes('*:*');
}
```

### Components

```typescript
// RequirePermission
export function RequirePermission({
  resource,
  action,
  children,
  fallback = null
}: Props) {
  const hasPermission = useHasPermission(resource, action);
  return hasPermission ? <>{children}</> : <>{fallback}</>;
}

// Usage
<RequirePermission resource="orders" action="delete">
  <DeleteButton />
</RequirePermission>
```

---

## ⚡ Caching Strategy

### Multi-Level Cache

```
1. JWT Claims (Session-level)
   - Primary role + permission count
   - TTL: Session lifetime

2. Redis Cache (Application-level)
   - Full permission list per user
   - TTL: 15 minutes

3. Memory Cache (Request-level)
   - Permission check results
   - TTL: Request duration

4. Database (Source of Truth)
   - All permission data
```

### Cache Invalidation

```typescript
async function invalidateUserPermissions(userId: string, tenantId: string) {
  // Clear Redis cache
  await redis.del(`permissions:${userId}:${tenantId}`);

  // Clear memory cache
  memoryCache.delete(`permissions:${userId}:${tenantId}`);

  // Force JWT refresh
  await refreshUserSession(userId);
}
```

---

## 🔄 Migration Strategy

### Phase 1: Parallel Systems
- Keep `org_users_mst.role` column
- Add new RBAC tables
- Support both old and new checks

### Phase 2: Data Migration
- Convert existing roles to RBAC
- `admin` → `tenant_admin` role
- `operator` → `operator` role
- `viewer` → `viewer` role

### Phase 3: Complete Transition
- Update all permission checks
- Remove old role column
- Full RBAC enforcement

---

## 📊 Complete Permission List

See [permission_matrix.md](./permission_matrix.md) for full details.

**Core Permission Categories:**
- **Orders:** create, read, update, delete, cancel, split, export
- **Customers:** create, read, update, delete, export, merge
- **Users:** create, read, update, delete, assign_roles
- **Settings:** read, update, manage_integrations
- **Reports:** view_financial, view_operational, export
- **Workflow:** preparation, processing, qa, delivery

---

## 🔐 Security Considerations

1. **Defense in Depth** - RLS + Application + UI checks
2. **Least Privilege** - Default to minimal permissions
3. **Audit Trail** - Log all permission changes
4. **Session Security** - Refresh on permission change
5. **Input Validation** - Validate permission strings
6. **Rate Limiting** - Prevent permission check abuse

---

## 📈 Performance Targets

- **Permission Check:** < 10ms (cached)
- **Permission Load:** < 100ms (first load)
- **Role Assignment:** < 200ms
- **Cache Hit Rate:** > 95%

---

## 📚 Related Documents

- [Current State Analysis](./current_state_analysis.md)
- [Permission Matrix](./permission_matrix.md)
- [Database Schema](./technical_docs/database_schema.md)
- [Migration Plan](./migration_plan.md)
- [Implementation Guide](./implementation_guide.md)

---

**Status:** ✅ Design Complete - Ready for Review
