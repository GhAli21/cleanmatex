# Implementation Guide for Developers - RBAC System

**Version:** v1.0.0
**Last Updated:** 2025-11-03
**Audience:** Developers
**Status:** Implementation Guide

---

## 📋 Overview

This guide provides step-by-step instructions for developers implementing the RBAC system in CleanMateX. It covers backend, frontend, database, and testing aspects.

---

## General Rules

** Naming Rules: **

- All Database tables or objects related to this module should add _auth_ such as sys_auth_permissions, org_auth_user_roles

---

## 🎯 Prerequisites

Before starting implementation:

- [ ] Read [RBAC Architecture](./rbac_architecture.md)
- [ ] Review [Migration Plan](./migration_plan.md)
- [ ] Understand [Permission Matrix](./permission_matrix.md)
- [ ] Have local development environment ready
- [ ] Database backed up

---

## 🗄️ Part 1: Database Implementation

### Step 1.1: Create Permission System Tables

**File:** `supabase/migrations/0020_rbac_foundation.sql`

```sql
-- 1. Permissions Table
CREATE TABLE sys_auth_permissions (
  id VARCHAR(100) PRIMARY KEY,
  resource VARCHAR(50) NOT NULL,
  action VARCHAR(50) NOT NULL,
  description TEXT,
  category VARCHAR(50) CHECK (category IN ('crud', 'action', 'export', 'management', 'config')),
  is_system BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(resource, action)
);

-- Indexes
CREATE INDEX idx_permissions_resource ON sys_auth_permissions(resource);
CREATE INDEX idx_permissions_category ON sys_auth_permissions(category);
CREATE INDEX idx_permissions_action ON sys_auth_permissions(action);

-- Comments
COMMENT ON TABLE sys_auth_permissions IS 'Defines all available permissions in the system';
COMMENT ON COLUMN sys_auth_permissions.id IS 'Permission identifier in format resource:action';

-- RLS
ALTER TABLE sys_auth_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY read_permissions ON sys_auth_permissions FOR SELECT USING (true);
```

### Step 1.2: Create Roles Table

```sql
-- 2. Roles Table
CREATE TABLE sys_auth_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  tenant_org_id UUID REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  is_active BOOLEAN DEFAULT true,

  -- Constraints
  CHECK (
    (is_system = true AND tenant_org_id IS NULL) OR
    (is_system = false AND tenant_org_id IS NOT NULL)
  )
);

-- Indexes
CREATE INDEX idx_roles_tenant ON sys_auth_roles(tenant_org_id) WHERE tenant_org_id IS NOT NULL;
CREATE INDEX idx_roles_system ON sys_auth_roles(is_system) WHERE is_system = true;
CREATE INDEX idx_roles_code ON sys_auth_roles(code);
CREATE INDEX idx_roles_active ON sys_auth_roles(is_active) WHERE is_active = true;

-- RLS
ALTER TABLE sys_auth_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY read_system_roles ON sys_auth_roles
  FOR SELECT USING (is_system = true OR tenant_org_id = current_tenant_id());
CREATE POLICY manage_tenant_roles ON sys_auth_roles
  FOR ALL USING (is_admin() AND (tenant_org_id = current_tenant_id() OR is_system = true));
```

### Step 1.3: Create Role-Permission Mapping

```sql
-- 3. Role-Permission Mapping
CREATE TABLE sys_auth_role_permissions (
  role_id UUID NOT NULL REFERENCES sys_auth_roles(id) ON DELETE CASCADE,
  permission_id VARCHAR(100) NOT NULL REFERENCES sys_auth_permissions(id) ON DELETE CASCADE,
  granted_by VARCHAR(120),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (role_id, permission_id)
);

-- Indexes
CREATE INDEX idx_role_permissions_role ON sys_auth_role_permissions(role_id);
CREATE INDEX idx_role_permissions_perm ON sys_auth_role_permissions(permission_id);

-- RLS
ALTER TABLE sys_auth_role_permissions ENABLE ROW LEVEL SECURITY;
CREATE POLICY read_role_permissions ON sys_auth_role_permissions FOR SELECT USING (true);
```

### Step 1.4: Create User Role Assignments

```sql
-- 4. User Role Assignments
CREATE TABLE org_user_roles (
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

-- Indexes
CREATE INDEX idx_user_roles_user ON org_user_roles(user_id, tenant_org_id) WHERE is_active = true;
CREATE INDEX idx_user_roles_role ON org_user_roles(role_id) WHERE is_active = true;
CREATE INDEX idx_user_roles_primary ON org_user_roles(user_id, tenant_org_id)
  WHERE is_primary = true AND is_active = true;
CREATE INDEX idx_user_roles_expires ON org_user_roles(expires_at)
  WHERE expires_at IS NOT NULL AND is_active = true;

-- RLS
ALTER TABLE org_user_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_view_own_roles ON org_user_roles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY admins_manage_roles ON org_user_roles
  FOR ALL USING (is_admin() AND tenant_org_id = current_tenant_id());
```

### Step 1.5: Create Workflow Role Assignments

```sql
-- 5. Workflow Role Assignments
CREATE TABLE org_user_workflow_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_org_id UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  workflow_role VARCHAR(50) NOT NULL CHECK (workflow_role IN (
    'ROLE_RECEPTION',
    'ROLE_PREPARATION',
    'ROLE_PROCESSING',
    'ROLE_QA',
    'ROLE_DELIVERY',
    'ROLE_ADMIN'
  )),
  assigned_by VARCHAR(120),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  is_active BOOLEAN DEFAULT true,

  UNIQUE(user_id, tenant_org_id, workflow_role)
);

-- Indexes
CREATE INDEX idx_workflow_roles_user ON org_user_workflow_roles(user_id, tenant_org_id)
  WHERE is_active = true;
CREATE INDEX idx_workflow_roles_role ON org_user_workflow_roles(workflow_role)
  WHERE is_active = true;

-- RLS
ALTER TABLE org_user_workflow_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY users_view_own_workflow_roles ON org_user_workflow_roles
  FOR SELECT USING (user_id = auth.uid());
CREATE POLICY admins_manage_workflow_roles ON org_user_workflow_roles
  FOR ALL USING (is_admin() AND tenant_org_id = current_tenant_id());
```

### Step 1.6: Create Permission Functions

```sql
-- Get all user permissions
CREATE OR REPLACE FUNCTION get_user_permissions()
RETURNS TABLE(permission_id VARCHAR) AS $$
  SELECT DISTINCT rp.permission_id
  FROM org_user_roles ur
  JOIN sys_auth_role_permissions rp ON ur.role_id = rp.role_id
  WHERE ur.user_id = auth.uid()
    AND ur.tenant_org_id = current_tenant_id()
    AND ur.is_active = true
    AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP);
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Check if user has specific permission
CREATE OR REPLACE FUNCTION has_permission(p_permission VARCHAR)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM org_user_roles ur
    JOIN sys_auth_role_permissions rp ON ur.role_id = rp.role_id
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_org_id = current_tenant_id()
      AND ur.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP)
      AND rp.permission_id = p_permission
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Check if user has any permission from array
CREATE OR REPLACE FUNCTION has_any_permission(p_permissions VARCHAR[])
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM org_user_roles ur
    JOIN sys_auth_role_permissions rp ON ur.role_id = rp.role_id
    WHERE ur.user_id = auth.uid()
      AND ur.tenant_org_id = current_tenant_id()
      AND ur.is_active = true
      AND (ur.expires_at IS NULL OR ur.expires_at > CURRENT_TIMESTAMP)
      AND rp.permission_id = ANY(p_permissions)
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Get user workflow roles
CREATE OR REPLACE FUNCTION get_user_workflow_roles()
RETURNS TABLE(workflow_role VARCHAR) AS $$
  SELECT workflow_role
  FROM org_user_workflow_roles
  WHERE user_id = auth.uid()
    AND tenant_org_id = current_tenant_id()
    AND is_active = true;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Check if user has workflow role
CREATE OR REPLACE FUNCTION has_workflow_role(p_workflow_role VARCHAR)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM org_user_workflow_roles
    WHERE user_id = auth.uid()
      AND tenant_org_id = current_tenant_id()
      AND workflow_role = p_workflow_role
      AND is_active = true
  ) OR EXISTS (
    SELECT 1
    FROM org_user_workflow_roles
    WHERE user_id = auth.uid()
      AND tenant_org_id = current_tenant_id()
      AND workflow_role = 'ROLE_ADMIN'
      AND is_active = true
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
```

### Step 1.7: Run Migration

```bash
# Apply migration
supabase db push

# Or for local
supabase db reset
```

---

## 🌱 Part 2: Seed Data

### Step 2.1: Seed Permissions

**File:** `supabase/migrations/0021_rbac_seed_permissions.sql`

```sql
-- Insert all permissions (see permission_matrix.md for complete list)
INSERT INTO sys_auth_permissions (id, resource, action, description, category) VALUES
-- Orders (16 permissions)
('orders:create', 'orders', 'create', 'Create new orders', 'crud'),
('orders:read', 'orders', 'read', 'View orders', 'crud'),
('orders:update', 'orders', 'update', 'Edit orders', 'crud'),
('orders:delete', 'orders', 'delete', 'Delete orders', 'crud'),
('orders:cancel', 'orders', 'cancel', 'Cancel orders', 'action'),
-- ... (add all 118 permissions - see permission_matrix.md)

-- Customers (10 permissions)
('customers:create', 'customers', 'create', 'Create customers', 'crud'),
('customers:read', 'customers', 'read', 'View customers', 'crud'),
-- ... continue for all resources

ON CONFLICT (id) DO NOTHING;
```

### Step 2.2: Seed System Roles

```sql
-- Insert system roles
INSERT INTO sys_auth_roles (code, name, description, is_system, tenant_org_id) VALUES
('super_admin', 'Super Administrator', 'Platform administrator with full access', true, NULL),
('tenant_admin', 'Tenant Administrator', 'Tenant owner with full tenant access', true, NULL),
('branch_manager', 'Branch Manager', 'Branch supervisor with branch-scoped access', true, NULL),
('operator', 'Operator', 'Standard worker with operational permissions', true, NULL),
('viewer', 'Viewer', 'Read-only access to data', true, NULL)
ON CONFLICT (code) DO NOTHING;
```

### Step 2.3: Assign Permissions to Roles

```sql
-- tenant_admin gets most permissions (except super admin ones)
INSERT INTO sys_auth_role_permissions (role_id, permission_id, granted_by)
SELECT r.id, p.id, 'system_seed'
FROM sys_auth_roles r
CROSS JOIN sys_auth_permissions p
WHERE r.code = 'tenant_admin'
  AND p.id NOT LIKE 'system:%'
ON CONFLICT DO NOTHING;

-- operator gets operational permissions
INSERT INTO sys_auth_role_permissions (role_id, permission_id, granted_by)
SELECT r.id, p.id, 'system_seed'
FROM sys_auth_roles r
CROSS JOIN sys_auth_permissions p
WHERE r.code = 'operator'
  AND p.id IN (
    'orders:create', 'orders:read', 'orders:update', 'orders:transition',
    'customers:create', 'customers:read', 'customers:update',
    'invoices:read', 'products:read', 'pricing:read'
  )
ON CONFLICT DO NOTHING;

-- viewer gets all read permissions
INSERT INTO sys_auth_role_permissions (role_id, permission_id, granted_by)
SELECT r.id, p.id, 'system_seed'
FROM sys_auth_roles r
CROSS JOIN sys_auth_permissions p
WHERE r.code = 'viewer'
  AND p.action = 'read'
ON CONFLICT DO NOTHING;
```

---

## 🔧 Part 3: Backend Services

### Step 3.1: Permission Service

**File:** `web-admin/lib/services/permission.service.ts`

```typescript
import { createServerSupabaseClient } from '@/lib/supabase/server';

export class PermissionService {
  private static cache = new Map<string, Set<string>>();
  private static CACHE_TTL = 15 * 60 * 1000; // 15 minutes

  /**
   * Get all permissions for a user in a tenant
   */
  static async getUserPermissions(
    userId: string,
    tenantId: string
  ): Promise<string[]> {
    const cacheKey = `${userId}:${tenantId}`;

    // Check cache
    if (this.cache.has(cacheKey)) {
      return Array.from(this.cache.get(cacheKey)!);
    }

    // Fetch from database
    const supabase = await createServerSupabaseClient();
    const { data, error } = await supabase.rpc('get_user_permissions');

    if (error) {
      console.error('Error fetching permissions:', error);
      return [];
    }

    const permissions = new Set<string>(data?.map((p: any) => p.permission_id) || []);

    // Cache it
    this.cache.set(cacheKey, permissions);
    setTimeout(() => this.cache.delete(cacheKey), this.CACHE_TTL);

    return Array.from(permissions);
  }

  /**
   * Check if user has a specific permission
   */
  static async hasPermission(
    userId: string,
    tenantId: string,
    resource: string,
    action: string
  ): Promise<boolean> {
    const permission = `${resource}:${action}`;
    const permissions = await this.getUserPermissions(userId, tenantId);

    // Check for exact permission or wildcard
    return permissions.includes(permission) ||
           permissions.includes('*:*') ||
           permissions.includes(`${resource}:*`);
  }

  /**
   * Check if user has any of the specified permissions
   */
  static async hasAnyPermission(
    userId: string,
    tenantId: string,
    requiredPermissions: string[]
  ): Promise<boolean> {
    const permissions = await this.getUserPermissions(userId, tenantId);
    const permissionSet = new Set(permissions);

    return requiredPermissions.some(p =>
      permissionSet.has(p) || permissionSet.has('*:*')
    );
  }

  /**
   * Invalidate cache for a user
   */
  static invalidateCache(userId: string, tenantId: string): void {
    const cacheKey = `${userId}:${tenantId}`;
    this.cache.delete(cacheKey);
  }

  /**
   * Clear all caches
   */
  static clearAllCaches(): void {
    this.cache.clear();
  }
}
```

### Step 3.2: Permission Middleware

**File:** `web-admin/lib/middleware/permission.middleware.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { PermissionService } from '@/lib/services/permission.service';

export function requirePermission(resource: string, action: string) {
  return async (req: NextRequest): Promise<NextResponse | null> => {
    const supabase = await createServerSupabaseClient();

    // Get current user
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get tenant from request or session
    const tenantId = req.headers.get('x-tenant-id') || user.user_metadata?.tenant_id;

    if (!tenantId) {
      return NextResponse.json(
        { error: 'No tenant context' },
        { status: 400 }
      );
    }

    // Check permission
    const hasAccess = await PermissionService.hasPermission(
      user.id,
      tenantId,
      resource,
      action
    );

    if (!hasAccess) {
      return NextResponse.json(
        { error: `Permission denied: ${resource}:${action}` },
        { status: 403 }
      );
    }

    // Permission granted, continue
    return null;
  };
}

// Usage helper
export async function checkPermission(
  req: NextRequest,
  resource: string,
  action: string
): Promise<NextResponse | null> {
  const middleware = requirePermission(resource, action);
  return middleware(req);
}
```

---

## ⚛️ Part 4: Frontend Implementation

### Step 4.1: Update Auth Context

**File:** `web-admin/lib/auth/auth-context.tsx`

```typescript
interface AuthState {
  user: AuthUser | null;
  session: AuthSession | null;
  currentTenant: UserTenant | null;
  availableTenants: UserTenant[];
  permissions: string[];  // NEW
  workflowRoles: string[];  // NEW
  isLoading: boolean;
  isAuthenticated: boolean;
}

// Add to AuthProvider
const [permissions, setPermissions] = useState<string[]>([]);
const [workflowRoles, setWorkflowRoles] = useState<string[]>([]);

// Fetch permissions when tenant changes
useEffect(() => {
  if (user && currentTenant) {
    fetchUserPermissions();
    fetchWorkflowRoles();
  }
}, [user, currentTenant]);

async function fetchUserPermissions() {
  const { data } = await supabase.rpc('get_user_permissions');
  setPermissions(data?.map((p: any) => p.permission_id) || []);
}

async function fetchWorkflowRoles() {
  const { data } = await supabase.rpc('get_user_workflow_roles');
  setWorkflowRoles(data?.map((r: any) => r.workflow_role) || []);
}
```

### Step 4.2: Permission Hooks

**File:** `web-admin/lib/hooks/usePermissions.ts`

```typescript
import { useAuth } from '@/lib/auth/auth-context';

export function usePermissions() {
  const { permissions } = useAuth();
  return { permissions };
}

export function useHasPermission(resource: string, action: string): boolean {
  const { permissions } = useAuth();
  const permission = `${resource}:${action}`;

  return permissions.includes(permission) ||
         permissions.includes('*:*') ||
         permissions.includes(`${resource}:*`);
}

export function useHasAnyPermission(requiredPermissions: string[]): boolean {
  const { permissions } = useAuth();
  const permissionSet = new Set(permissions);

  return requiredPermissions.some(p =>
    permissionSet.has(p) || permissionSet.has('*:*')
  );
}

export function useHasAllPermissions(requiredPermissions: string[]): boolean {
  const { permissions } = useAuth();
  const permissionSet = new Set(permissions);

  return requiredPermissions.every(p =>
    permissionSet.has(p) || permissionSet.has('*:*')
  );
}

export function useWorkflowRoles() {
  const { workflowRoles } = useAuth();
  return { workflowRoles };
}

export function useHasWorkflowRole(role: string): boolean {
  const { workflowRoles } = useAuth();
  return workflowRoles.includes(role) || workflowRoles.includes('ROLE_ADMIN');
}
```

### Step 4.3: Permission Components

**File:** `web-admin/components/auth/RequirePermission.tsx`

```typescript
import { useHasPermission } from '@/lib/hooks/usePermissions';

interface RequirePermissionProps {
  resource: string;
  action: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequirePermission({
  resource,
  action,
  children,
  fallback = null
}: RequirePermissionProps) {
  const hasPermission = useHasPermission(resource, action);

  return hasPermission ? <>{children}</> : <>{fallback}</>;
}

// Multi-permission variant
interface RequireAnyPermissionProps {
  permissions: string[];  // Format: ['orders:create', 'orders:update']
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function RequireAnyPermission({
  permissions,
  children,
  fallback = null
}: RequireAnyPermissionProps) {
  const { permissions: userPermissions } = usePermissions();
  const permissionSet = new Set(userPermissions);

  const hasAny = permissions.some(p => permissionSet.has(p));

  return hasAny ? <>{children}</> : <>{fallback}</>;
}
```

---

## 🔌 Part 5: API Integration

### Step 5.1: Protect API Routes

**Example:** `web-admin/app/api/v1/orders/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { checkPermission } from '@/lib/middleware/permission.middleware';

export async function GET(req: NextRequest) {
  // Check permission
  const permCheck = await checkPermission(req, 'orders', 'read');
  if (permCheck) return permCheck;

  // Permission granted, proceed
  const orders = await fetchOrders();
  return NextResponse.json({ data: orders });
}

export async function POST(req: NextRequest) {
  // Check permission
  const permCheck = await checkPermission(req, 'orders', 'create');
  if (permCheck) return permCheck;

  // Permission granted, proceed
  const body = await req.json();
  const order = await createOrder(body);
  return NextResponse.json({ data: order });
}

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  // Check permission
  const permCheck = await checkPermission(req, 'orders', 'delete');
  if (permCheck) return permCheck;

  // Permission granted, proceed
  await deleteOrder(params.id);
  return NextResponse.json({ success: true });
}
```

---

## 📚 Related Documents

- [Testing Guide](./testing_guide.md) - How to test permissions
- [API Specifications](./technical_docs/api_specifications.md) - Complete API docs
- [Frontend Integration](./technical_docs/frontend_integration.md) - Frontend details
- [Security Considerations](./technical_docs/security_considerations.md) - Security best practices

---

**Status:** ✅ Implementation Guide Complete
