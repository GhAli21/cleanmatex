# Perfect RBAC System Design - CleanMateX

**Version:** v2.0.0  
**Last Updated:** 2025-01-XX  
**Status:** Design Plan - Incorporating Scoped Permissions

---

## Executive Summary

This plan designs a comprehensive RBAC system that transforms CleanMateX from a basic 3-role system to an enterprise-grade permission-based access control system with **scoped permissions** (branch/store/POS/route/device), **effective permissions caching**, and **multi-role support** for both user roles and workflow roles.

**Key Improvements:**

- Granular resource.action permissions (118+ permissions)
- **Resource-scoped permissions** (branch, store, POS, route, device)
- **Effective permissions table** for O(1) RLS checks
- Flexible role system (system + custom roles)
- **Multi-role support** per user (multiple roles simultaneously)
- **Multi-workflow-role support** (users can have multiple workflow roles)
- Per-user permission overrides (allow/deny)
- High-performance caching strategy
- Complete audit trail
- Zero-downtime migration path

---

## Architecture Design

### 1. Permission System

**Format:** `resource.action` (dot notation)

**Examples:**

- `orders.read` - View orders
- `orders.create` - Create orders
- `orders.update` - Edit orders
- `orders.delete` - Delete orders
- `orders.cancel` - Cancel orders
- `customers.export` - Export customer data
- `settings.manage` - Manage settings
- `workflow.transition` - Perform workflow transitions
- `*.*` - Super admin (all permissions)

**Permission Categories:**

- **CRUD:** `resource.{create|read|update|delete}`
- **Actions:** `resource.action` (cancel, void, approve, etc.)
- **Export:** `resource.export`
- **Management:** `resource.manage`

### 2. Role System

**System Roles (Built-in):**

1. `super_admin` - Platform administrator (`*.*` permissions, all tenants)
2. `tenant_admin` - Tenant owner (all permissions within tenant)
3. `branch_manager` - Branch supervisor (branch-scoped permissions)
4. `operator` - Standard worker (operational permissions)
5. `viewer` - Read-only (all `.read` permissions)

**Custom Roles:**

- Tenants can create custom roles
- Flexible permission combinations
- Stored with `tenant_org_id`

**Workflow Roles (Separate System, Multi-Role Support):**

- `ROLE_RECEPTION` - Order intake & delivery
- `ROLE_PREPARATION` - Item tagging & prep
- `ROLE_PROCESSING` - Wash, dry, iron
- `ROLE_QA` - Quality inspection
- `ROLE_DELIVERY` - Delivery operations
- `ROLE_ADMIN` - Full workflow access

**Note:** Users can have **multiple workflow roles** simultaneously (e.g., a user can be both RECEPTION and QA). The `org_auth_user_workflow_roles` table supports this via the UNIQUE constraint on (user_id, tenant_org_id, workflow_role).

### 3. Database Schema

**Master Layer (Platform-wide):**

1. **`sys_auth_permissions`** - Permission definitions

   - `permission_id` UUID PRIMARY KEY
   - `code` TEXT UNIQUE NOT NULL (e.g., 'orders.read', 'orders.create')
   - `name` TEXT (bilingual: name/name2)
   - `category` TEXT
   - `is_active` BOOLEAN DEFAULT true
   - `created_at` TIMESTAMPTZ DEFAULT NOW()

2. **`sys_auth_roles`** - Role definitions

   - `role_id` UUID PRIMARY KEY
   - `code` TEXT UNIQUE NOT NULL (e.g., 'admin', 'operator', 'viewer')
   - `name` TEXT (bilingual: name/name2)
   - `is_system` BOOLEAN DEFAULT false
   - `created_at` TIMESTAMPTZ DEFAULT NOW()

3. **`sys_auth_role_default_permissions`** - Role default permissions
   - `role_id` UUID REFERENCES sys_auth_roles(role_id)
   - `permission_id` UUID REFERENCES sys_auth_permissions(permission_id)
   - PRIMARY KEY (role_id, permission_id)

**Tenant-Level Assignment:**

4. **`org_auth_user_roles`** - User role assignments (multi-role support)
   - `id` UUID PRIMARY KEY
   - `user_id` UUID NOT NULL
   - `tenant_org_id` UUID NOT NULL
   - `role_id` UUID REFERENCES sys_auth_roles(role_id)
   - `is_active` BOOLEAN DEFAULT true
   - UNIQUE (user_id, tenant_org_id, role_id)

**Resource-Based Assignment (Branch, Store, POS, Route, Device):**

5. **`org_auth_user_resource_roles`** - User roles on specific resources
   - `id` UUID PRIMARY KEY
   - `user_id` UUID NOT NULL
   - `tenant_org_id` UUID NOT NULL
   - `resource_type` TEXT NOT NULL ('branch', 'store', 'pos', 'route', 'device')
   - `resource_id` UUID NOT NULL
   - `role_id` UUID REFERENCES sys_auth_roles(role_id)
   - `is_active` BOOLEAN DEFAULT true
   - UNIQUE (user_id, tenant_org_id, resource_type, resource_id, role_id)

**Per-User Overrides:**

6. **`org_auth_user_permissions`** - Global user permission overrides

   - `id` UUID PRIMARY KEY
   - `user_id` UUID NOT NULL
   - `tenant_org_id` UUID NOT NULL
   - `permission_id` UUID REFERENCES sys_auth_permissions(permission_id)
   - `allow` BOOLEAN NOT NULL DEFAULT true (false = explicit deny)
   - `created_at` TIMESTAMPTZ DEFAULT NOW()
   - UNIQUE (user_id, tenant_org_id, permission_id)

7. **`org_auth_user_resource_permissions`** - Resource-scoped permission overrides
   - `id` UUID PRIMARY KEY
   - `user_id` UUID NOT NULL
   - `tenant_org_id` UUID NOT NULL
   - `resource_type` TEXT NOT NULL
   - `resource_id` UUID NOT NULL
   - `permission_id` UUID REFERENCES sys_auth_permissions(permission_id)
   - `allow` BOOLEAN NOT NULL DEFAULT true (false = explicit deny)
   - `created_at` TIMESTAMPTZ DEFAULT NOW()
   - UNIQUE (user_id, tenant_org_id, resource_type, resource_id, permission_id)

**Workflow Roles (Multi-Role Support):**

8. **`org_auth_user_workflow_roles`** - Workflow role assignments (multi-role)
   - `id` UUID PRIMARY KEY
   - `user_id` UUID NOT NULL
   - `tenant_org_id` UUID NOT NULL
   - `workflow_role` TEXT NOT NULL CHECK (workflow_role IN (
     'ROLE_RECEPTION', 'ROLE_PREPARATION', 'ROLE_PROCESSING',
     'ROLE_QA', 'ROLE_DELIVERY', 'ROLE_ADMIN'
     ))
   - `is_active` BOOLEAN DEFAULT true
   - `created_at` TIMESTAMPTZ DEFAULT NOW()
   - UNIQUE (user_id, tenant_org_id, workflow_role)
   - **Note:** Users can have multiple workflow roles (e.g., both RECEPTION and QA)

**Effective Permissions (Precomputed for Performance):**

9. **`cmx_effective_permissions`** - Precomputed effective permissions
   - `user_id` UUID NOT NULL
   - `tenant_org_id` UUID NOT NULL
   - `permission_code` TEXT NOT NULL
   - `resource_type` TEXT NULLABLE (NULL = tenant-wide)
   - `resource_id` UUID NULLABLE (NULL = tenant-wide)
   - `allow` BOOLEAN NOT NULL
   - `created_at` TIMESTAMPTZ DEFAULT NOW()
   - PRIMARY KEY (user_id, tenant_org_id, permission_code,
     COALESCE(resource_type, ''),
     COALESCE(resource_id, '00000000-0000-0000-0000-000000000000'))
   - **Indexes:** (user_id, tenant_org_id, permission_code), (tenant_org_id, permission_code)

**Key Design Decisions:**

- All auth-related tables use `_auth_` prefix (naming convention)
- Permission codes use dot notation: `resource.action` (e.g., 'orders.read', 'orders.create')
- System roles have `is_system = true` (no tenant_org_id needed)
- Custom roles can be created per tenant
- **Multi-role support:** Users can have multiple roles via `org_auth_user_roles` (no primary/secondary distinction needed)
- **Multi-workflow-role support:** Users can have multiple workflow roles (e.g., RECEPTION + QA)
- Resource-based permissions support branch, store, POS, route, device scoping
- Per-user overrides allow explicit allow/deny at global and resource level
- **Effective permissions table precomputed for O(1) RLS checks** (rebuild on change, not on read)

### 4. RLS Functions

**Core Permission Rebuild Function:**

```sql
-- Rebuild effective permissions for a user (called on changes)
CREATE FUNCTION cmx_rebuild_user_permissions(
  p_user_id UUID,
  p_tenant_id UUID
)
RETURNS VOID

-- Order of evaluation (broad → specific, last wins):
-- 1. Tenant-level roles → permissions
-- 2. Resource-level roles → permissions
-- 3. Global user overrides
-- 4. Resource-scoped overrides (most specific, wins)
```

**Fast Permission Check Function (O(1) lookup):**

```sql
-- Fast permission check for RLS (reads from effective_permissions)
CREATE FUNCTION cmx_can(
  p_perm TEXT,
  p_resource_type TEXT DEFAULT NULL,
  p_resource_id UUID DEFAULT NULL
)
RETURNS BOOLEAN
-- Uses indexed lookup on cmx_effective_permissions table
```

**Helper Functions:**

```sql
-- Get all permissions for current user
CREATE FUNCTION get_user_permissions()
RETURNS TABLE(permission_code TEXT)

-- Check if user has specific permission (tenant-wide)
CREATE FUNCTION has_permission(p_permission TEXT)
RETURNS BOOLEAN

-- Check resource-scoped permission
CREATE FUNCTION has_resource_permission(
  p_permission TEXT,
  p_resource_type TEXT,
  p_resource_id UUID
)
RETURNS BOOLEAN

-- Get user roles
CREATE FUNCTION get_user_roles()
RETURNS TABLE(role_id UUID, role_code TEXT)

-- Get workflow roles (returns array for multi-role support)
CREATE FUNCTION get_user_workflow_roles()
RETURNS TABLE(workflow_role TEXT)
```

**Automatic Rebuild Triggers:**

- Trigger on `org_auth_user_roles` changes → rebuild permissions
- Trigger on `org_auth_user_resource_roles` changes → rebuild permissions
- Trigger on `org_auth_user_permissions` changes → rebuild permissions
- Trigger on `org_auth_user_resource_permissions` changes → rebuild permissions
- Trigger on `sys_auth_role_default_permissions` changes → rebuild for all users with that role

**RLS Policy Examples:**

```sql
-- Example: Orders table with branch/store scoping
CREATE POLICY "orders_read" ON org_orders_mst
FOR SELECT
USING (
  cmx_can('orders.read', 'branch', branch_id)
  OR cmx_can('orders.read', 'store', store_id)
  OR cmx_can('orders.read', 'tenant', tenant_org_id)
);
```

**Key Performance Features:**

- **Rebuild on change, not on read** - Permissions computed when roles/permissions change
- **O(1) RLS checks** - Single indexed lookup in effective_permissions table
- **No heavy joins in RLS** - All permission checks use precomputed table

### 5. Frontend Integration

**Hooks:**

- `usePermissions()` - Get all user permissions
- `useHasPermission(resource, action)` - Check single permission (supports resource scoping)
- `useHasResourcePermission(resource, action, resourceType, resourceId)` - Check resource-scoped permission
- `useHasAnyPermission(permissions[])` - Check any permission
- `useHasAllPermissions(permissions[])` - Check all permissions
- `useWorkflowRoles()` - Get workflow roles (supports multi-role)
- `useHasWorkflowRole(workflowRole)` - Check single workflow role
- `useHasAnyWorkflowRole(workflowRoles[])` - Check multiple workflow roles

**Components:**

- `<RequirePermission resource action>` - Conditional rendering (supports resource scoping)
- `<RequireResourcePermission resource action resourceType resourceId>` - Resource-scoped check
- `<RequireAnyPermission permissions[]>` - Show if has any
- `<RequireAllPermissions permissions[]>` - Show if has all
- `<RequireWorkflowRole workflowRole>` - Workflow role check
- `<PermissionGate fallback>` - With fallback UI

**Context Updates:**

- Add `permissions: string[]` to AuthState
- Add `workflowRoles: string[]` to AuthState (multi-role support)
- Fetch permissions on tenant switch
- Support resource-scoped permission checks

### 6. Backend Integration

**API Middleware:**

- `requirePermission(resource, action)` decorator
- `requireResourcePermission(resource, action, resourceType, resourceId)` decorator
- `requireRole(role)` decorator
- `requireWorkflowRole(workflowRole)` decorator
- `requireAnyWorkflowRole(workflowRoles[])` decorator
- Permission checking service

**Server Actions:**

- Permission checks in Next.js server actions
- Resource-scoped permission checks
- RLS enforcement via database functions

### 7. Caching Strategy

**Multi-Level Cache:**

1. **JWT Claims** (Session-level)

   - Primary role code
   - Permission count (for UI display)
   - TTL: Session lifetime

2. **Redis Cache** (Application-level)

   - Full permission list per user:tenant
   - Key: `permissions:{userId}:{tenantId}`
   - TTL: 15 minutes

3. **Memory Cache** (Request-level)

   - Permission check results
   - TTL: Request duration

4. **Effective Permissions Table** (Database-level)
   - Precomputed permissions
   - O(1) lookup for RLS
   - Rebuilt on changes

**Cache Invalidation:**

- On role assignment change → rebuild effective_permissions
- On permission assignment change → rebuild effective_permissions
- On user role update → rebuild effective_permissions
- On resource role change → rebuild effective_permissions
- Force JWT refresh

---

## Implementation Plan

### Phase 1: Critical Fixes (Week 1)

**1.1 Fix Naming Inconsistencies**

- Update `web-admin/config/navigation.ts` (`staff` → `operator`)
- Update `web-admin/lib/auth/role-context.tsx` (fix ROLE_HIERARCHY)
- Search and replace all occurrences
- Update TypeScript types
- Test thoroughly

**1.2 Documentation Review**

- Review existing RBAC architecture docs
- Review scoped permissions design document
- Identify gaps in design
- Update design documents

### Phase 2: Database Foundation (Weeks 2-3)

**2.1 Create RBAC Tables**

- Migration: `0034_rbac_foundation.sql`
- Create master layer tables:
  - `sys_auth_permissions` (with UUID permission_id, code TEXT)
  - `sys_auth_roles` (with UUID role_id, code TEXT)
  - `sys_auth_role_default_permissions` (role-permission mapping)
- Create tenant assignment tables:
  - `org_auth_user_roles` (multi-role support)
  - `org_auth_user_resource_roles` (resource-scoped roles: branch/store/POS/route/device)
- Create override tables:
  - `org_auth_user_permissions` (global overrides)
  - `org_auth_user_resource_permissions` (resource-scoped overrides)
- Create workflow roles table:
  - `org_auth_user_workflow_roles` (multi-workflow-role support)
- Create effective permissions table:
  - `cmx_effective_permissions` (precomputed permissions for fast RLS)
- Add indexes for performance (especially on effective_permissions)

**2.2 Seed System Data**

- Migration: `0035_rbac_seed_system_data.sql`
- Seed 118+ system permissions (using dot notation: `resource.action`)
- Seed 5 system roles
- Map permissions to system roles
- Create default role-permission mappings

**2.3 Create RLS Functions**

- Migration: `0036_rbac_rls_functions.sql`
- Create core rebuild function: `cmx_rebuild_user_permissions()` (rebuilds effective_permissions)
- Create fast check function: `cmx_can()` (O(1) lookup from effective_permissions)
- Create helper functions: `get_user_permissions()`, `has_permission()`, `has_resource_permission()`, `get_user_roles()`, `get_user_workflow_roles()`
- Create automatic rebuild triggers on all assignment/override tables
- Add RLS policies for new tables
- Update existing RLS policies to use `cmx_can()` function

**2.4 Migration Functions**

- Migration: `0037_rbac_migration_functions.sql`
- Function to migrate existing `org_users_mst.role` to `org_auth_user_roles`
- Function to assign default permissions based on migrated roles
- Function to rebuild effective permissions for all existing users
- Data migration script to convert current 3-role system to RBAC
- Validation script to verify migration integrity

### Phase 3: Backend Services (Weeks 4-5)

**3.1 Permission Service**

- `lib/services/permission-service.ts`
- Permission checking logic (uses `cmx_can()` function)
- Resource-scoped permission checks
- Cache integration (Redis + memory cache)
- Permission rebuild trigger calls
- Error handling
- Support for tenant-wide and resource-scoped checks

**3.2 Role Service**

- `lib/services/role-service.ts`
- Role management (CRUD for system and custom roles)
- Permission assignment to roles
- User role assignment (tenant-level and resource-level)
- Multi-role support (users can have multiple roles)
- Workflow role assignment (multi-workflow-role support)
- Permission override management (global and resource-scoped)
- Automatic permission rebuild on changes

**3.3 API Middleware**

- `lib/middleware/permission-middleware.ts`
- Permission decorators (tenant-wide and resource-scoped)
- Role decorators
- Workflow role decorators (single and multi-role)
- Permission checking service integration

**3.4 Server Actions**

- Update existing server actions
- Add permission checks (tenant-wide and resource-scoped)
- Add workflow role checks
- Maintain backward compatibility

### Phase 4: Frontend Integration (Weeks 6-7)

**4.1 Auth Context Updates**

- Add permissions to AuthState
- Add workflow roles to AuthState (multi-role support)
- Fetch permissions on tenant switch
- Cache permissions in context
- Support resource-scoped permission checks

**4.2 Permission Hooks**

- `lib/hooks/usePermissions.ts` (get all permissions)
- `lib/hooks/useHasPermission.ts` (check single permission, supports resource scoping)
- `lib/hooks/useHasResourcePermission.ts` (check resource-scoped permission)
- `lib/hooks/useWorkflowRoles.ts` (get workflow roles, supports multi-role)
- `lib/hooks/useHasWorkflowRole.ts` (check single workflow role)
- `lib/hooks/useHasAnyWorkflowRole.ts` (check multiple workflow roles)

**4.3 Permission Components**

- `components/auth/RequirePermission.tsx` (supports resource-scoped checks)
- `components/auth/RequireResourcePermission.tsx` (for branch/store/POS scoping)
- `components/auth/RequireAnyPermission.tsx`
- `components/auth/RequireAllPermissions.tsx`
- `components/auth/RequireWorkflowRole.tsx` (for workflow role checks)
- `components/auth/PermissionGate.tsx` (with fallback UI)

**4.4 Update Existing Components**

- Replace hard-coded role checks with permission checks
- Add resource-scoped permission checks where needed (branch/store/POS)
- Update navigation to use permission checks
- Update page protection to use permission checks
- Add workflow role checks for workflow screens and transitions
- Support multi-role and multi-workflow-role scenarios

### Phase 5: Migration & Testing (Weeks 8-9)

**5.1 Data Migration**

- Migrate existing users to RBAC
- Assign default roles
- Rebuild effective permissions for all users
- Verify data integrity
- Test permission checks (tenant-wide and resource-scoped)

**5.2 Parallel System Support**

- Support both old (`org_users_mst.role`) and new RBAC checks
- Feature flag for RBAC (`ENABLE_RBAC`)
- Gradual rollout per tenant or feature
- Fallback to old role checks if RBAC disabled
- Migration validation to ensure both systems agree

**5.3 Comprehensive Testing**

- Unit tests for permission service
- Integration tests for API routes
- E2E tests for UI components
- Multi-tenant isolation tests
- Resource-scoped permission tests
- Multi-role and multi-workflow-role tests
- Performance tests (effective permissions lookup)
- Cache invalidation tests

### Phase 6: UI & Documentation (Week 10)

**6.1 Role Management UI**

- Role CRUD pages (system and custom roles)
- Permission assignment UI (assign permissions to roles)
- User role assignment UI:
  - Tenant-level role assignment (multi-role support)
  - Resource-level role assignment (branch/store/POS/route/device)
  - Permission override management (global and resource-scoped)
- Workflow role assignment UI (multi-workflow-role support)
- Effective permissions viewer (debug tool to see computed permissions)

**6.2 Documentation**

- Developer guide (permission system, scoped permissions, effective permissions)
- User guide (role management, permission assignment, resource scoping)
- API documentation (permission endpoints, rebuild endpoints)
- Migration guide (from 3-role to RBAC, data migration steps)
- Testing scenarios (permission checks, resource scoping, multi-role, workflow roles)
- Performance guide (effective permissions, caching strategy)

**6.3 Final Migration**

- Remove old role column (optional)
- Full RBAC enforcement
- Performance optimization
- Monitoring setup

---

## Security Considerations

1. **Defense in Depth**

   - RLS policies (database layer) - using effective_permissions
   - Application checks (API layer)
   - UI checks (presentation layer)

2. **Least Privilege**

   - Default to minimal permissions
   - Explicit permission grants
   - Per-user overrides for fine-grained control
   - Regular permission audits

3. **Audit Trail**

   - Log all permission changes
   - Log role assignments
   - Log resource-scoped assignments
   - Track permission rebuilds

4. **Session Security**

   - Refresh JWT on permission change
   - Invalidate cache on changes
   - Rebuild effective_permissions on changes
   - Secure token storage

5. **Input Validation**

   - Validate permission strings
   - Sanitize role names
   - Validate resource types
   - Prevent SQL injection

6. **Rate Limiting**
   - Limit permission check requests
   - Limit rebuild requests
   - Prevent abuse
   - Monitor suspicious activity

---

## Performance Targets

- **Permission Check (RLS):** < 5ms (using effective_permissions table)
- **Permission Check (Cached):** < 10ms
- **Permission Load:** < 100ms (first load)
- **Permission Rebuild:** < 200ms per user
- **Role Assignment:** < 200ms
- **Cache Hit Rate:** > 95%
- **Database Query:** < 50ms (uncached)

---

## Migration Strategy

### Backward Compatibility

**Phase 1: Parallel Systems**

- Keep `org_users_mst.role` column
- Support both old and new checks
- Feature flag to enable RBAC (`ENABLE_RBAC`)
- Gradual rollout per tenant or feature

**Phase 2: Data Migration**

- Migrate existing roles to RBAC
- `admin` → `tenant_admin` role
- `operator` → `operator` role
- `viewer` → `viewer` role
- Rebuild effective permissions for all users

**Phase 3: Complete Transition**

- Update all permission checks
- Remove old role column (optional)
- Full RBAC enforcement

### Rollback Plan

- Keep old role column during transition
- Feature flag to disable RBAC
- Database migration rollback scripts
- Code version control

---

## Success Criteria

- ✅ All 118+ permissions defined and seeded
- ✅ System roles mapped to permissions
- ✅ Multi-role support working (user roles)
- ✅ Multi-workflow-role support working
- ✅ Resource-scoped permissions working (branch/store/POS/route/device)
- ✅ Effective permissions table implemented and optimized
- ✅ Permission rebuild triggers working
- ✅ O(1) RLS checks using effective_permissions
- ✅ Workflow roles stored and assigned
- ✅ Permission checks throughout codebase
- ✅ Performance targets met
- ✅ Zero security vulnerabilities
- ✅ Complete audit trail
- ✅ Backward compatibility maintained
- ✅ Documentation complete

---

## Key Enhancements from Scoped Permissions Design

1. **Resource-Based Permissions**

   - Support for branch, store, POS, route, device scoping
   - Generic `resource_type` and `resource_id` pattern
   - Future-proof for new resource types

2. **Effective Permissions Table**

   - Precomputed permissions for O(1) RLS checks
   - Rebuild on change, not on read
   - No heavy joins in RLS policies

3. **Per-User Overrides**

   - Global permission overrides
   - Resource-scoped permission overrides
   - Explicit allow/deny support

4. **Multi-Role Support**

   - Users can have multiple roles simultaneously
   - Users can have multiple workflow roles simultaneously
   - No primary/secondary distinction needed

5. **Performance Optimization**
   - Single indexed lookup for permission checks
   - Automatic rebuild triggers
   - Multi-level caching strategy

---

**Status:** Ready for Review and Approval
