# Migration Plan - RBAC System Implementation

**Version:** v1.0.0
**Last Updated:** 2025-11-03
**Status:** Implementation Roadmap

---

## 📋 Executive Summary

This document provides a comprehensive step-by-step plan to migrate CleanMateX from its current 3-role system to a full RBAC (Role-Based Access Control) system with granular permissions.

**Timeline:** 10 weeks
**Risk Level:** Medium
**Backward Compatibility:** Maintained during transition

---

## 🎯 Migration Goals

1. **Zero Downtime** - No service interruption
2. **Data Integrity** - No data loss during migration
3. **Backward Compatibility** - Support both systems temporarily
4. **Gradual Rollout** - Phase-by-phase implementation
5. **Rollback Ready** - Can revert if issues arise
6. **Complete Testing** - Validate every phase

---

## 📊 Current vs Target State

### Current State
- ✅ 3 fixed user roles (admin, operator, viewer)
- ✅ Role stored in `org_users_mst.role` column
- ✅ Basic RLS with `is_admin()` and `is_operator()` functions
- ⚠️ Workflow roles defined but not implemented
- ❌ No granular permissions
- ❌ Hard-coded permission checks everywhere
- ❌ Single role per user

### Target State
- ✅ 5 built-in system roles + custom roles
- ✅ 118+ granular permissions
- ✅ Multi-role support per user
- ✅ Workflow roles stored and assigned
- ✅ Permission-based checks throughout
- ✅ Centralized permission management
- ✅ Complete audit trail

---

## 🗓️ 10-Week Implementation Plan

### **Week 1: Preparation & Critical Fixes**

#### Phase 0: Pre-Migration
- [ ] **Backup all data** - Full database backup
- [ ] **Create rollback plan** - Document revert procedures
- [ ] **Review documentation** - Ensure team understands plan
- [ ] **Stakeholder approval** - Get sign-off to proceed

#### Phase 1: Fix Naming Inconsistencies
**Goal:** Standardize role names across codebase

**Tasks:**
1. Update `web-admin/config/navigation.ts`
   - Change `'staff'` → `'operator'`
   - Change `'driver'` → `'viewer'` or remove (workflow role)

2. Update `web-admin/lib/auth/role-context.tsx`
   - Fix ROLE_HIERARCHY to use correct names
   - Update type definitions

3. Search and replace all occurrences
   ```bash
   grep -r "staff" web-admin/
   grep -r "driver" web-admin/
   # Replace with correct role names
   ```

4. Update TypeScript types
   ```typescript
   // Ensure all use:
   type UserRole = 'admin' | 'operator' | 'viewer';
   ```

5. Test thoroughly
   - Navigation displays correctly
   - Role checks work properly
   - No TypeScript errors

**Deliverable:** ✅ All role names consistent with database

---

### **Week 2-3: Database Foundation**

#### Phase 2: Create RBAC Database Schema

**Migration File:** `supabase/migrations/0020_rbac_foundation.sql`

**Tasks:**

1. **Create Permissions Table**
```sql
CREATE TABLE sys_auth_permissions (
  id VARCHAR(100) PRIMARY KEY,
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description TEXT,
  category VARCHAR(50),
  is_system BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(resource, action)
);

CREATE INDEX idx_permissions_resource ON sys_auth_permissions(resource);
CREATE INDEX idx_permissions_category ON sys_auth_permissions(category);
```

2. **Create Roles Table**
```sql
CREATE TABLE sys_auth_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  tenant_org_id UUID REFERENCES org_tenants_mst(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  updated_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true
);

CREATE INDEX idx_roles_tenant ON sys_auth_roles(tenant_org_id)
  WHERE tenant_org_id IS NOT NULL;
CREATE INDEX idx_roles_system ON sys_auth_roles(is_system)
  WHERE is_system = true;
```

3. **Create Role-Permission Mapping**
```sql
CREATE TABLE sys_auth_role_permissions (
  role_id UUID NOT NULL,
  permission_id VARCHAR(100) NOT NULL,
  granted_by VARCHAR(120),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id),
  FOREIGN KEY (role_id) REFERENCES sys_auth_roles(id) ON DELETE CASCADE,
  FOREIGN KEY (permission_id) REFERENCES sys_auth_permissions(id) ON DELETE CASCADE
);
```

4. **Create User Role Assignments**
```sql
CREATE TABLE org_auth_user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  role_id UUID NOT NULL REFERENCES sys_auth_roles(id) ON DELETE CASCADE,
  is_primary BOOLEAN DEFAULT false,
  assigned_by VARCHAR(120),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_id, tenant_org_id, role_id)
);
```

5. **Create Workflow Roles Table**
```sql
CREATE TABLE org_auth_user_workflow_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  workflow_role VARCHAR(50) NOT NULL CHECK (workflow_role IN (
    'ROLE_RECEPTION', 'ROLE_PREPARATION', 'ROLE_PROCESSING',
    'ROLE_QA', 'ROLE_DELIVERY', 'ROLE_ADMIN'
  )),
  assigned_by VARCHAR(120),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,
  UNIQUE(user_id, tenant_org_id, workflow_role)
);
```

6. **Enable RLS on New Tables**
```sql
ALTER TABLE sys_auth_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_auth_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE sys_auth_role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_auth_user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_auth_user_workflow_roles ENABLE ROW LEVEL SECURITY;
```

7. **Create RLS Policies**
```sql
-- Everyone can read permissions (needed for UI)
CREATE POLICY read_permissions ON sys_auth_permissions
  FOR SELECT USING (true);

-- Everyone can read system roles
CREATE POLICY read_system_roles ON sys_auth_roles
  FOR SELECT USING (is_system = true OR tenant_org_id = current_tenant_id());

-- Admins can manage tenant roles
CREATE POLICY manage_tenant_roles ON sys_auth_roles
  FOR ALL USING (is_admin() AND (tenant_org_id = current_tenant_id() OR tenant_org_id IS NULL));
```

**Deliverable:** ✅ All RBAC tables created with RLS

---

### **Week 3: Seed Data & Functions**

#### Phase 3: Seed Permissions and Roles

**Migration File:** `supabase/migrations/0021_rbac_seed_data.sql`

**Tasks:**

1. **Seed All 118 Permissions**
```sql
-- Orders permissions (16)
INSERT INTO sys_auth_permissions (id, resource, action, description, category) VALUES
('orders:create', 'orders', 'create', 'Create new orders', 'crud'),
('orders:read', 'orders', 'read', 'View orders', 'crud'),
-- ... (all 118 permissions)
```

2. **Create System Roles**
```sql
INSERT INTO sys_auth_roles (id, code, name, description, is_system, tenant_org_id) VALUES
(gen_random_uuid(), 'super_admin', 'Super Administrator', 'Platform administrator', true, NULL),
(gen_random_uuid(), 'tenant_admin', 'Tenant Administrator', 'Tenant owner', true, NULL),
(gen_random_uuid(), 'branch_manager', 'Branch Manager', 'Branch supervisor', true, NULL),
(gen_random_uuid(), 'operator', 'Operator', 'Standard worker', true, NULL),
(gen_random_uuid(), 'viewer', 'Viewer', 'Read-only access', true, NULL);
```

3. **Assign Permissions to Roles**
```sql
-- tenant_admin gets most permissions
INSERT INTO sys_auth_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM sys_auth_roles r
CROSS JOIN sys_auth_permissions p
WHERE r.code = 'tenant_admin'
  AND p.id NOT LIKE 'audit:%'  -- Exclude audit permissions
  AND p.id NOT LIKE 'logs:%';  -- Exclude log permissions

-- operator gets operational permissions
INSERT INTO sys_auth_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM sys_auth_roles r
CROSS JOIN sys_auth_permissions p
WHERE r.code = 'operator'
  AND (
    p.id IN ('orders:create', 'orders:read', 'orders:update', 'orders:transition',
             'customers:create', 'customers:read', 'customers:update')
  );

-- viewer gets all read permissions
INSERT INTO sys_auth_role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM sys_auth_roles r
CROSS JOIN sys_auth_permissions p
WHERE r.code = 'viewer'
  AND p.action = 'read';
```

4. **Create Permission Functions**
```sql
-- Get all user permissions
CREATE OR REPLACE FUNCTION get_user_permissions()
RETURNS TABLE(permission_id VARCHAR) AS $$
  SELECT DISTINCT rp.permission_id
  FROM org_auth_user_roles ur
  JOIN sys_auth_role_permissions rp ON ur.role_id = rp.role_id
  WHERE ur.user_id = auth.uid()
    AND ur.tenant_org_id = current_tenant_id()
    AND ur.is_active = true;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Check specific permission
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

-- Check any permission from array
CREATE OR REPLACE FUNCTION has_any_permission(p_permissions VARCHAR[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM org_auth_user_roles ur
    JOIN sys_auth_role_permissions rp ON ur.role_id = rp.role_id
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_org_id = current_tenant_id()
      AND ur.is_active = true
      AND rp.permission_id = ANY(p_permissions)
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Get user workflow roles
CREATE OR REPLACE FUNCTION get_user_workflow_roles()
RETURNS TABLE(workflow_role VARCHAR) AS $$
  SELECT workflow_role
  FROM org_auth_user_workflow_roles
  WHERE user_id = auth.uid()
    AND tenant_org_id = current_tenant_id()
    AND is_active = true;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
```

**Deliverable:** ✅ All permissions, roles, and functions ready

---

### **Week 4: Data Migration**

#### Phase 4: Migrate Existing Users to RBAC

**Migration Script:** `scripts/migrate-users-to-rbac.ts`

**Tasks:**

1. **Create Migration Script**
```typescript
// scripts/migrate-users-to-rbac.ts
async function migrateUsersToRBAC() {
  // Get all existing users with their current roles
  const { data: users } = await supabase
    .from('org_users_mst')
    .select('id, user_id, tenant_org_id, role');

  // Map old roles to new role IDs
  const roleMapping = {
    admin: await getRoleId('tenant_admin'),
    operator: await getRoleId('operator'),
    viewer: await getRoleId('viewer'),
  };

  // Create user role assignments
  for (const user of users) {
    const newRoleId = roleMapping[user.role];

    await supabase.from('org_user_roles').insert({
      user_id: user.user_id,
      tenant_org_id: user.tenant_org_id,
      role_id: newRoleId,
      is_primary: true,
      assigned_by: 'migration_script',
    });
  }

  console.log(`Migrated ${users.length} users to RBAC`);
}
```

2. **Run Migration in Stages**
   - Test with 10 users first
   - Validate data integrity
   - Run for all users
   - Verify no data loss

3. **Keep Old Column Temporarily**
   - Don't drop `org_users_mst.role` yet
   - Use for rollback if needed
   - Will remove in Phase 6

**Deliverable:** ✅ All users have RBAC role assignments

---

### **Week 5-6: Backend Services**

#### Phase 5: Build Permission Service Layer

**Tasks:**

1. **Create Permission Service**
```typescript
// web-admin/lib/services/permission.service.ts
export class PermissionService {
  private static cache = new Map<string, string[]>();

  static async getUserPermissions(
    userId: string,
    tenantId: string
  ): Promise<string[]> {
    const cacheKey = `${userId}:${tenantId}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey)!;
    }

    const { data } = await supabase.rpc('get_user_permissions');
    this.cache.set(cacheKey, data || []);

    return data || [];
  }

  static async hasPermission(
    userId: string,
    tenantId: string,
    permission: string
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId, tenantId);
    return permissions.includes(permission) || permissions.includes('*:*');
  }

  static invalidateCache(userId: string, tenantId: string) {
    this.cache.delete(`${userId}:${tenantId}`);
  }
}
```

2. **Create Permission Middleware**
```typescript
// web-admin/lib/middleware/permission.middleware.ts
export function requirePermission(resource: string, action: string) {
  return async (req: NextRequest) => {
    const user = await getUser(req);
    const permission = `${resource}:${action}`;

    const hasAccess = await PermissionService.hasPermission(
      user.id,
      user.tenant_id,
      permission
    );

    if (!hasAccess) {
      return NextResponse.json(
        { error: `Permission denied: ${permission}` },
        { status: 403 }
      );
    }

    return null; // Allow
  };
}
```

3. **Update Auth Context**
```typescript
// Add permissions to auth context
interface AuthState {
  user: AuthUser | null;
  currentTenant: UserTenant | null;
  permissions: string[];  // NEW
  workflowRoles: string[];  // NEW
  isLoading: boolean;
}
```

**Deliverable:** ✅ Permission service layer operational

---

### **Week 6-7: Frontend Integration**

#### Phase 6: Frontend Hooks & Components

**Tasks:**

1. **Create Permission Hooks**
```typescript
// web-admin/lib/hooks/usePermissions.ts
export function usePermissions() {
  const { currentTenant, user } = useAuth();
  const [permissions, setPermissions] = useState<string[]>([]);

  useEffect(() => {
    if (user && currentTenant) {
      PermissionService.getUserPermissions(user.id, currentTenant.tenant_id)
        .then(setPermissions);
    }
  }, [user, currentTenant]);

  return { permissions };
}

export function useHasPermission(resource: string, action: string) {
  const { permissions } = usePermissions();
  const permission = `${resource}:${action}`;
  return permissions.includes(permission) || permissions.includes('*:*');
}

export function useHasAnyPermission(requiredPermissions: string[]) {
  const { permissions } = usePermissions();
  return requiredPermissions.some(p => permissions.includes(p));
}
```

2. **Create Permission Components**
```typescript
// web-admin/components/auth/RequirePermission.tsx
export function RequirePermission({
  resource,
  action,
  children,
  fallback = null
}: RequirePermissionProps) {
  const hasPermission = useHasPermission(resource, action);
  return hasPermission ? <>{children}</> : <>{fallback}</>;
}
```

3. **Update Existing Components (Gradually)**
```typescript
// Before:
{isAdmin && <DeleteButton />}

// After:
<RequirePermission resource="orders" action="delete">
  <DeleteButton />
</RequirePermission>
```

**Deliverable:** ✅ Frontend permission system working

---

### **Week 7-8: API Updates & Role Management UI**

#### Phase 7: Update API Routes & Build UI

**Tasks:**

1. **Update All API Routes** (Use middleware)
```typescript
// Before:
export async function DELETE(req: NextRequest, { params }) {
  // No permission check!
  await deleteOrder(params.id);
}

// After:
export async function DELETE(req: NextRequest, { params }) {
  const permCheck = await requirePermission('orders', 'delete')(req);
  if (permCheck) return permCheck;

  await deleteOrder(params.id);
}
```

2. **Build Role Management UI**
   - Page: `/dashboard/settings/roles`
   - List all roles
   - Create/edit custom roles
   - Assign permissions to roles

3. **Build User Role Assignment UI**
   - Page: `/dashboard/users`
   - Assign roles to users
   - Support multi-role assignment
   - Workflow role assignment

**Deliverable:** ✅ All APIs protected, management UI complete

---

### **Week 8-9: Testing & Validation**

#### Phase 8: Comprehensive Testing

**Tasks:**

1. **Unit Tests**
   - Test permission checking functions
   - Test permission service
   - Test hooks and components

2. **Integration Tests**
   - Test API permission middleware
   - Test role assignments
   - Test permission inheritance

3. **E2E Tests**
   - Test complete user flows
   - Test multi-role scenarios
   - Test workflow role enforcement

4. **Permission Matrix Validation**
   - Verify each role has correct permissions
   - Test all 118 permissions
   - Validate no permission leaks

5. **Performance Testing**
   - Permission check latency (target < 10ms)
   - Load testing with 1000+ users
   - Cache hit rate validation (target > 95%)

**Deliverable:** ✅ All tests passing

---

### **Week 9: Gradual Rollout**

#### Phase 9: Production Deployment

**Tasks:**

1. **Deploy to Staging**
   - Full deployment with all changes
   - Smoke testing
   - Performance monitoring

2. **Gradual Production Rollout**
   - Enable for 10% of users
   - Monitor for issues
   - Increase to 50%
   - Full rollout if stable

3. **Monitor Closely**
   - Error rates
   - Permission check performance
   - User feedback
   - API response times

**Deliverable:** ✅ RBAC live in production

---

### **Week 10: Cleanup & Finalization**

#### Phase 10: Remove Old System

**Tasks:**

1. **Remove Old Role Column** (Once stable)
```sql
-- After 2 weeks of stability
ALTER TABLE org_users_mst DROP COLUMN role;
```

2. **Remove Old Functions**
```sql
DROP FUNCTION is_admin();
DROP FUNCTION is_operator();
```

3. **Update Documentation**
   - Mark old system as deprecated
   - Update all guides
   - Archive old documentation

4. **Celebrate Success!** 🎉

**Deliverable:** ✅ Migration complete!

---

## 🔄 Rollback Procedures

### If Issues Arise

**Week 1-4:** Easy rollback (database changes only)
```sql
-- Drop new tables
DROP TABLE org_auth_user_workflow_roles CASCADE;
DROP TABLE org_auth_user_roles CASCADE;
DROP TABLE sys_auth_role_permissions CASCADE;
DROP TABLE sys_auth_roles CASCADE;
DROP TABLE sys_auth_permissions CASCADE;

-- Old system still intact
```

**Week 5-9:** Gradual rollback
- Revert code changes via git
- Keep RBAC tables (for retry)
- System falls back to old role column

**Week 10+:** Full system operational
- Rollback not recommended
- Fix forward instead

---

## ⚠️ Risks & Mitigations

| Risk | Impact | Probability | Mitigation |
|------|--------|-------------|------------|
| **Permission bugs break features** | High | Medium | Extensive testing, gradual rollout, quick rollback |
| **Performance degradation** | Medium | Low | Caching, optimization, monitoring |
| **User confusion** | Medium | Medium | Clear documentation, training, support |
| **Data migration errors** | High | Low | Multiple validation steps, backups |
| **Incomplete permission checks** | High | Medium | Systematic code review, automated testing |

---

## ✅ Success Criteria

- [ ] All 118 permissions defined and seeded
- [ ] All users migrated to RBAC
- [ ] All API routes protected by permissions
- [ ] All UI components use permission checks
- [ ] Role management UI operational
- [ ] Workflow roles implemented and assigned
- [ ] All tests passing (unit, integration, E2E)
- [ ] Performance targets met (< 10ms permission checks)
- [ ] Zero production incidents during rollout
- [ ] Old system cleanly removed

---

## 📊 Progress Tracking

```
Phase 0: Pre-Migration          [ ]
Phase 1: Fix Naming             [ ]
Phase 2: Database Schema        [ ]
Phase 3: Seed Data              [ ]
Phase 4: Data Migration         [ ]
Phase 5: Backend Services       [ ]
Phase 6: Frontend Integration   [ ]
Phase 7: API Updates & UI       [ ]
Phase 8: Testing                [ ]
Phase 9: Gradual Rollout        [ ]
Phase 10: Cleanup               [ ]

Overall Progress: 0/11 phases complete
```

---

## 📚 Related Documents

- [RBAC Architecture](./rbac_architecture.md) - System design
- [Permission Matrix](./permission_matrix.md) - All permissions
- [Database Schema](./technical_docs/database_schema.md) - Database details
- [Implementation Guide](./implementation_guide.md) - Technical details

---

**Status:** ✅ Migration Plan Complete - Ready for Execution
**Estimated Duration:** 10 weeks
**Team Size:** 1-2 developers
**Risk Assessment:** Medium (manageable with proper testing)
