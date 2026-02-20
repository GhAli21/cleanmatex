# User Roles Guide - CleanMateX

**Version:** v1.0.0
**Last Updated:** 2025-11-03
**Author:** CleanMateX Development Team
**Status:** Current System Documentation

---

## 📋 Overview

User roles in CleanMateX control **what features and pages** a user can access in the application. They are part of the **authentication and authorization** system, separate from workflow roles which control process operations.

**Current Implementation:** ✅ Fully operational with database storage, RLS enforcement, and UI integration.

---

## 🎯 Purpose

User roles provide **application-level access control**:

- ✅ **Page Access** - Control which dashboard pages users can view
- ✅ **Feature Access** - Enable/disable specific features
- ✅ **Data Scope** - Control what data users can see
- ✅ **Administrative Functions** - Manage users, settings, configurations

**Not for:** Workflow step control (use Workflow Roles instead)

---

## 👥 The Three User Roles

### 1. Admin (`'admin'`)

**Level:** Highest (Level 3)
**Database Value:** `'admin'`
**Purpose:** Full system access and tenant management

#### Capabilities

**✅ Can Access:**
- All dashboard pages
- User management
- Tenant settings
- Billing and subscriptions
- All reports and analytics
- System configuration
- Integration settings
- All CRUD operations

**✅ Can Perform:**
- Create, update, delete users
- Assign roles to users
- Modify tenant settings
- Configure workflows
- Access all data in tenant
- Export all reports
- Manage payment methods
- Configure integrations

**❌ Cannot:**
- Access other tenants (unless super admin in future)
- Bypass RLS policies (unless using service role)

#### Typical Users
- Business owner
- Manager
- System administrator
- IT administrator

#### Code Example
```typescript
// Check if user is admin
const { isAdmin } = useRole();

if (isAdmin) {
  // Admin-only features
}

// Protect component
<RequireRole roles="admin">
  <DeleteUserButton />
</RequireRole>

// Protect page
export default withRole(UsersPage, { requiredRole: 'admin' });
```

---

### 2. Operator (`'operator'`)

**Level:** Middle (Level 2)
**Database Value:** `'operator'`
**Purpose:** Standard worker who performs daily operations

#### Capabilities

**✅ Can Access:**
- Dashboard (view)
- Orders (create, view, update)
- Customers (create, view, limited update)
- Order workflow screens
- Basic reports

**✅ Can Perform:**
- Create new orders
- Update order details
- Add/edit customers
- Process workflow steps (if has workflow role)
- View assigned reports
- Update own profile

**❌ Cannot:**
- Delete orders
- Manage users
- Change tenant settings
- Access billing
- Export data
- Configure system
- Assign roles

#### Typical Users
- Counter staff
- Reception staff
- Processing staff
- Delivery staff

#### Code Example
```typescript
// Check if user is operator or higher
const canEdit = useHasRole(['admin', 'operator']);

if (canEdit) {
  // Show edit button
}

// Protect page
export default withRole(OrdersPage, {
  requiredRole: ['admin', 'operator']
});
```

---

### 3. Viewer (`'viewer'`)

**Level:** Lowest (Level 1)
**Database Value:** `'viewer'`
**Purpose:** Read-only access for monitoring and reporting

#### Capabilities

**✅ Can Access:**
- Dashboard (view only)
- Orders (view only)
- Customers (view only)
- Reports (view only)

**✅ Can Perform:**
- View all data in tenant
- Search and filter
- View reports
- Update own profile

**❌ Cannot:**
- Create anything
- Update anything (except own profile)
- Delete anything
- Export data
- Access settings
- Manage users
- Process orders

#### Typical Users
- Accountant (view-only)
- Auditor
- Reports viewer
- Temporary access users

#### Code Example
```typescript
// Check if user is viewer
const { role } = useRole();
const isViewer = role === 'viewer';

if (isViewer) {
  // Show read-only UI
}

// Hide edit button from viewers
<RequireRole roles={['admin', 'operator']}>
  <EditButton />
</RequireRole>
```

---

## 🗄️ Database Implementation

### Table Structure

**Table:** `org_users_mst`
**Migration:** `supabase/migrations/0003_auth_tables.sql`

```sql
CREATE TABLE IF NOT EXISTS org_users_mst (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_org_id     UUID NOT NULL REFERENCES org_tenants_mst(id) ON DELETE CASCADE,

  -- Role Definition
  display_name      VARCHAR(255),
  role              VARCHAR(50) NOT NULL DEFAULT 'viewer'
                    CHECK (role IN ('admin', 'operator', 'viewer')),
  is_active         BOOLEAN NOT NULL DEFAULT true,

  -- Activity Tracking
  last_login_at     TIMESTAMP,
  login_count       INTEGER DEFAULT 0,
  preferences       JSONB DEFAULT '{}',

  -- Audit Fields
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by        VARCHAR(120),
  created_info      TEXT,
  updated_at        TIMESTAMP,
  updated_by        VARCHAR(120),
  updated_info      TEXT,
  rec_status        SMALLINT DEFAULT 1,
  rec_notes         VARCHAR(200),

  -- One role per user per tenant
  UNIQUE(user_id, tenant_org_id)
);
```

### Indexes

```sql
-- Performance indexes
CREATE INDEX idx_org_users_tenant
  ON org_users_mst(tenant_org_id)
  WHERE is_active = true;

CREATE INDEX idx_org_users_user
  ON org_users_mst(user_id);

CREATE INDEX idx_org_users_role
  ON org_users_mst(tenant_org_id, role)
  WHERE is_active = true;

CREATE INDEX idx_org_users_last_login
  ON org_users_mst(last_login_at DESC);
```

### RLS Policies

```sql
-- Enable RLS
ALTER TABLE org_users_mst ENABLE ROW LEVEL SECURITY;

-- Users can view their own records
CREATE POLICY user_view_own_records ON org_users_mst
  FOR SELECT
  USING (user_id = auth.uid());

-- Admins can view all users in their tenant
CREATE POLICY admin_view_tenant_users ON org_users_mst
  FOR SELECT
  USING (
    tenant_org_id = current_tenant_id()
    AND is_admin()
  );

-- Admins can create users
CREATE POLICY admin_create_tenant_users ON org_users_mst
  FOR INSERT
  WITH CHECK (
    tenant_org_id = current_tenant_id()
    AND is_admin()
  );

-- Admins can update users
CREATE POLICY admin_update_tenant_users ON org_users_mst
  FOR UPDATE
  USING (
    tenant_org_id = current_tenant_id()
    AND is_admin()
  );
```

### Helper Functions

```sql
-- Check if current user is admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM org_users_mst
    WHERE user_id = auth.uid()
      AND tenant_org_id = current_tenant_id()
      AND role = 'admin'
      AND is_active = true
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Check if current user is at least operator
CREATE OR REPLACE FUNCTION is_operator()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM org_users_mst
    WHERE user_id = auth.uid()
      AND tenant_org_id = current_tenant_id()
      AND role IN ('admin', 'operator')
      AND is_active = true
  );
$$ LANGUAGE SQL STABLE SECURITY DEFINER;

-- Get current user's role
CREATE OR REPLACE FUNCTION current_user_role()
RETURNS VARCHAR AS $$
  SELECT role
  FROM org_users_mst
  WHERE user_id = auth.uid()
    AND tenant_org_id = current_tenant_id()
    AND is_active = true
  LIMIT 1;
$$ LANGUAGE SQL STABLE SECURITY DEFINER;
```

---

## 💻 Code Integration

### TypeScript Types

**Location:** `web-admin/types/auth.ts`

```typescript
// User role type
export type UserRole = 'admin' | 'operator' | 'viewer';

// User-tenant association
export interface UserTenant {
  tenant_id: string;
  tenant_name: string;
  tenant_slug: string;
  user_role: UserRole;  // The user's role in this tenant
  branch_id: string | null;
  branch_name: string | null;
  last_login_at: string | null;
}

// Auth user with role
export interface AuthUser {
  id: string;
  email: string;
  display_name?: string;
  role?: UserRole;
}
```

### Auth Context

**Location:** `web-admin/lib/auth/auth-context.tsx`

```typescript
interface AuthState {
  user: AuthUser | null;
  session: AuthSession | null;
  currentTenant: UserTenant | null;  // Contains user_role
  availableTenants: UserTenant[];
  isLoading: boolean;
  isAuthenticated: boolean;
}

// Access user's role
const { currentTenant } = useAuth();
const userRole = currentTenant?.user_role;  // 'admin' | 'operator' | 'viewer'
```

### Role Context

**Location:** `web-admin/lib/auth/role-context.tsx`

```typescript
interface RoleContextType {
  role: UserRole | null;
  isAdmin: boolean;
  isStaff: boolean;  // ⚠️ Should be isOperator
  isDriver: boolean;  // ⚠️ Not a user role
  hasRole: (role: UserRole | UserRole[]) => boolean;
  hasMinimumRole: (minimumRole: UserRole) => boolean;
  canAccessPath: (path: string, roles?: UserRole[]) => boolean;
}

// Usage
const { role, isAdmin, hasRole } = useRole();

if (isAdmin) {
  // Admin-only code
}

if (hasRole(['admin', 'operator'])) {
  // Multiple roles
}
```

---

## 🛡️ Protection Patterns

### 1. Component-Level Protection

**RequireRole Component:**
```typescript
import { RequireRole } from '@/components/auth/RequireRole';

// Single role
<RequireRole roles="admin">
  <DeleteButton />
</RequireRole>

// Multiple roles
<RequireRole roles={['admin', 'operator']}>
  <EditButton />
</RequireRole>

// With fallback
<RequireRole roles="admin" fallback={<NoAccessMessage />}>
  <AdminPanel />
</RequireRole>
```

### 2. Page-Level Protection

**withRole HOC:**
```typescript
import { withRole } from '@/lib/auth/with-role';

// Admin-only page
const UsersPage = () => {
  return <div>User Management</div>;
};

export default withRole(UsersPage, { requiredRole: 'admin' });

// Multiple roles
const OrdersPage = () => {
  return <div>Orders</div>;
};

export default withRole(OrdersPage, {
  requiredRole: ['admin', 'operator']
});
```

### 3. Route-Level Protection

**Proxy:**
```typescript
// web-admin/proxy.ts
const ADMIN_ROUTES = [
  '/dashboard/users',
  '/dashboard/settings/organization',
  '/dashboard/settings/billing',
];

if (ADMIN_ROUTES.some(route => pathname.startsWith(route))) {
  const { data: userRole } = await supabase
    .from('org_users_mst')
    .select('role')
    .eq('user_id', user.id)
    .eq('tenant_org_id', tenantId)
    .single();

  if (userRole?.role !== 'admin') {
    return NextResponse.redirect(
      new URL('/dashboard?error=insufficient_permissions', request.url)
    );
  }
}
```

### 4. Conditional Rendering

**In Components:**
```typescript
import { useRole, useHasRole } from '@/lib/auth/role-context';

function MyComponent() {
  const { isAdmin } = useRole();
  const canEdit = useHasRole(['admin', 'operator']);
  const canDelete = useHasRole('admin');

  return (
    <div>
      {canEdit && <EditButton />}
      {canDelete && <DeleteButton />}
      {isAdmin && <AdminPanel />}
    </div>
  );
}
```

---

## 📊 Role Hierarchy

### Hierarchy Levels

```
admin (Level 3) - Highest
  ↓ Inherits all operator permissions
operator (Level 2) - Middle
  ↓ Inherits all viewer permissions
viewer (Level 1) - Lowest
```

### Checking Minimum Role

```typescript
const { hasMinimumRole } = useRole();

// User must be at least operator (admin or operator)
if (hasMinimumRole('operator')) {
  // Can edit
}

// User must be at least viewer (anyone authenticated)
if (hasMinimumRole('viewer')) {
  // Can view
}
```

---

## 📱 Navigation Access

**Location:** `web-admin/config/navigation.ts`

### Navigation Configuration

```typescript
export interface NavigationItem {
  path: string;
  label: string;
  icon: string;
  roles: UserRole[];  // Who can see this
  featureFlag?: string;
}

export const NAVIGATION_SECTIONS: NavigationSection[] = [
  {
    title: 'Main',
    items: [
      {
        path: '/dashboard',
        label: 'Dashboard',
        icon: 'LayoutDashboard',
        roles: ['admin', 'operator', 'viewer'],
      },
      {
        path: '/dashboard/orders',
        label: 'Orders',
        icon: 'ShoppingCart',
        roles: ['admin', 'operator', 'viewer'],
      },
    ],
  },
  {
    title: 'Management',
    items: [
      {
        path: '/dashboard/users',
        label: 'Users',
        icon: 'Users',
        roles: ['admin'],  // Admin only
      },
      {
        path: '/dashboard/settings',
        label: 'Settings',
        icon: 'Settings',
        roles: ['admin'],  // Admin only
      },
    ],
  },
];
```

### Filtering Navigation

```typescript
export function getNavigationForRole(
  role: UserRole,
  featureFlags: Record<string, boolean> = {}
): NavigationSection[] {
  return NAVIGATION_SECTIONS.map(section => ({
    ...section,
    items: section.items.filter(item => {
      // Check role permission
      if (!item.roles.includes(role)) {
        return false;
      }

      // Check feature flag if required
      if (item.featureFlag && !featureFlags[item.featureFlag]) {
        return false;
      }

      return true;
    }),
  })).filter(section => section.items.length > 0);
}
```

### Usage in Sidebar

```typescript
// web-admin/src/ui/navigation/cmx-sidebar.tsx
const { currentTenant } = useAuth();
const userRole = (currentTenant?.user_role?.toLowerCase() as UserRole) || 'viewer';
const navigation = getNavigationForRole(userRole, featureFlags);
```

---

## 🔑 Complete Access Matrix

| Resource/Feature | admin | operator | viewer |
|-----------------|-------|----------|--------|
| **Dashboard** | ✅ Full | ✅ Full | ✅ View |
| **Orders - Create** | ✅ | ✅ | ❌ |
| **Orders - View** | ✅ | ✅ | ✅ |
| **Orders - Update** | ✅ | ✅ | ❌ |
| **Orders - Delete** | ✅ | ❌ | ❌ |
| **Orders - Cancel** | ✅ | ✅ | ❌ |
| **Customers - Create** | ✅ | ✅ | ❌ |
| **Customers - View** | ✅ | ✅ | ✅ |
| **Customers - Update** | ✅ | ✅ Limited | ❌ |
| **Customers - Delete** | ✅ | ❌ | ❌ |
| **Customers - Export** | ✅ | ❌ | ❌ |
| **Drivers - Manage** | ✅ | ❌ | ❌ |
| **Catalog - View** | ✅ | ✅ | ✅ |
| **Catalog - Manage** | ✅ | ❌ | ❌ |
| **Pricing - View** | ✅ | ✅ | ✅ |
| **Pricing - Manage** | ✅ | ❌ | ❌ |
| **Reports - View** | ✅ | ✅ Limited | ✅ Limited |
| **Reports - Export** | ✅ | ❌ | ❌ |
| **Settings - View** | ✅ | ❌ | ❌ |
| **Settings - Update** | ✅ | ❌ | ❌ |
| **Users - View** | ✅ | ❌ | ❌ |
| **Users - Manage** | ✅ | ❌ | ❌ |
| **Users - Assign Roles** | ✅ | ❌ | ❌ |
| **Billing - View** | ✅ | ❌ | ❌ |
| **Billing - Manage** | ✅ | ❌ | ❌ |
| **Integrations - View** | ✅ | ❌ | ❌ |
| **Integrations - Configure** | ✅ | ❌ | ❌ |
| **Audit Logs - View** | ✅ | ❌ | ❌ |

---

## 🚀 Usage Examples

### Example 1: Protecting a Delete Button

```typescript
import { useRole } from '@/lib/auth/role-context';

function OrderActions({ orderId }) {
  const { isAdmin } = useRole();

  return (
    <div>
      <EditButton orderId={orderId} />

      {isAdmin && (
        <DeleteButton orderId={orderId} />
      )}
    </div>
  );
}
```

### Example 2: Role-Based Page Content

```typescript
import { useRole } from '@/lib/auth/role-context';

function DashboardPage() {
  const { role, isAdmin } = useRole();

  return (
    <div>
      <h1>Dashboard</h1>

      {/* Everyone sees this */}
      <OrdersSummary />

      {/* Only admin and operator see this */}
      {role !== 'viewer' && (
        <CreateOrderButton />
      )}

      {/* Only admin sees this */}
      {isAdmin && (
        <AdminAnalytics />
      )}
    </div>
  );
}
```

### Example 3: API Route Protection

```typescript
// app/api/v1/users/route.ts
import { createServerSupabaseClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabaseClient();

  // Get current user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check if admin
  const { data: userRole } = await supabase
    .from('org_users_mst')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (userRole?.role !== 'admin') {
    return NextResponse.json(
      { error: 'Forbidden: Admin access required' },
      { status: 403 }
    );
  }

  // Proceed with admin operation
  const { data: users } = await supabase
    .from('org_users_mst')
    .select('*');

  return NextResponse.json({ users });
}
```

---

## ⚠️ Common Issues

### Issue 1: Naming Inconsistency

**Problem:** Code uses `'staff'` but database has `'operator'`

**Files Affected:**
- `web-admin/config/navigation.ts`
- `web-admin/lib/auth/role-context.tsx`

**Fix Required:**
```typescript
// Change this:
type UserRole = 'admin' | 'staff' | 'driver';

// To this:
type UserRole = 'admin' | 'operator' | 'viewer';
```

### Issue 2: Role Hierarchy

**Problem:** Hard-coded hierarchy uses wrong names

**Fix Required:**
```typescript
// FROM:
const ROLE_HIERARCHY = {
  admin: 3,
  staff: 2,   // Wrong!
  driver: 1,  // Wrong!
}

// TO:
const ROLE_HIERARCHY = {
  admin: 3,
  operator: 2,  // Correct
  viewer: 1,    // Correct
}
```

---

## 🔄 Role Assignment

### How Roles Are Assigned

**During User Creation:**
```sql
INSERT INTO org_users_mst (
  user_id,
  tenant_org_id,
  display_name,
  role,
  is_active
) VALUES (
  'user-uuid',
  'tenant-uuid',
  'John Doe',
  'operator',  -- Assign role here
  true
);
```

**Updating Role:**
```sql
UPDATE org_users_mst
SET role = 'admin',
    updated_at = CURRENT_TIMESTAMP,
    updated_by = current_user_id()
WHERE user_id = 'user-uuid'
  AND tenant_org_id = 'tenant-uuid';
```

### Role Assignment Rules

1. **One Role Per Tenant** - User has exactly one role per tenant
2. **Multi-Tenant Users** - Same user can have different roles in different tenants
3. **Default Role** - New users default to `'viewer'`
4. **Admin Assignment** - Only admins can change roles
5. **No Self-Promotion** - Users cannot change their own role

---

## 🔐 Security Considerations

### Best Practices

1. **Always Check Role** - Never assume user has access
2. **Check on Backend** - Don't rely on frontend checks alone
3. **Use RLS Functions** - Leverage `is_admin()`, `is_operator()`
4. **Log Role Changes** - Audit all role assignments
5. **Validate Input** - Ensure role is one of the allowed values

### Anti-Patterns to Avoid

❌ **Checking role in only frontend**
```typescript
// Bad: Only checks in UI, not API
{isAdmin && <DeleteButton />}
```

❌ **Hard-coding role checks everywhere**
```typescript
// Bad: Repeated everywhere
if (user.role === 'admin') { ... }
if (user.role === 'admin') { ... }
if (user.role === 'admin') { ... }
```

✅ **Use centralized helpers**
```typescript
// Good: Centralized check
const { isAdmin } = useRole();
if (isAdmin) { ... }
```

---

## 📚 Related Documentation

- [Current State Analysis](./current_state_analysis.md) - Complete system analysis
- [Workflow Roles Guide](./workflow_roles_guide.md) - Workflow role system
- [RBAC Architecture](./rbac_architecture.md) - Proposed RBAC design
- [Migration Plan](./migration_plan.md) - Conversion to RBAC

---

## 🔄 Version History

| Version | Date | Changes |
|---------|------|---------|
| v1.0.0 | 2025-11-03 | Initial user roles guide created |

---

**Status:** ✅ Current System - Fully Documented
