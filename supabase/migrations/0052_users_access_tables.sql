-- ==================================================================
-- 0052_users_access_tables.sql
-- Purpose: Create Users & Access code tables
-- Author: CleanMateX Development Team
-- Created: 2025-01-22
-- PRD: PRD-SAAS-MNG-0006 - Core Data & Code Management
-- ==================================================================
-- This migration creates code tables for users and access:
-- 1. sys_user_role_cd - User role codes (simplified reference table)
-- 2. sys_permission_cd - Permission codes (simplified reference table)
-- Note: Full RBAC system exists in sys_auth_roles and sys_auth_permissions.
--       These code tables provide simplified references for UI and reporting.
-- ==================================================================

BEGIN;

-- ==================================================================
-- TABLE: sys_user_role_cd
-- Purpose: User role codes (simplified reference)
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_user_role_cd (
  code VARCHAR(50) PRIMARY KEY,

  -- Display
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),                              -- Arabic
  description TEXT,
  description2 TEXT,                               -- Arabic

  -- UI
  display_order INTEGER DEFAULT 0,
  icon VARCHAR(100),
  color VARCHAR(60),                               -- Hex color for UI

  -- Role Configuration
  role_level VARCHAR(20),                           -- 'platform', 'tenant', 'branch', 'operator'
  access_level VARCHAR(20),                          -- 'full', 'admin', 'manager', 'operator', 'viewer'
  is_platform_role BOOLEAN DEFAULT false,          -- Platform-level role?
  is_tenant_role BOOLEAN DEFAULT true,             -- Tenant-level role?

  -- RBAC Reference
  rbac_role_code VARCHAR(50),                      -- Links to sys_auth_roles.code

  -- Behavior
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT true,                  -- System roles cannot be deleted
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB,
  /*
    Example:
    {
      "default_permissions": ["orders:read", "orders:create"],
      "can_create_users": false,
      "can_manage_settings": false,
      "dashboard_access": "full"
    }
  */

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,
  rec_status SMALLINT DEFAULT 1
);

-- Indexes
CREATE INDEX idx_user_role_active
  ON sys_user_role_cd(is_active, display_order);

CREATE INDEX idx_user_role_level
  ON sys_user_role_cd(role_level, is_active);

CREATE INDEX idx_user_role_rbac
  ON sys_user_role_cd(rbac_role_code) WHERE rbac_role_code IS NOT NULL;

-- Comments
COMMENT ON TABLE sys_user_role_cd IS
  'User role codes (OWNER, ADMIN, MANAGER, OPERATOR, VIEWER)';

COMMENT ON COLUMN sys_user_role_cd.code IS
  'Unique role code (e.g., OWNER, ADMIN, MANAGER, OPERATOR, VIEWER)';

COMMENT ON COLUMN sys_user_role_cd.rbac_role_code IS
  'Reference to sys_auth_roles.code for full RBAC integration';

-- ==================================================================
-- TABLE: sys_permission_cd
-- Purpose: Permission codes (simplified reference)
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_permission_cd (
  code VARCHAR(50) PRIMARY KEY,

  -- Display
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),                              -- Arabic
  description TEXT,
  description2 TEXT,                               -- Arabic

  -- UI
  display_order INTEGER DEFAULT 0,
  icon VARCHAR(100),
  color VARCHAR(60),                               -- Hex color for UI

  -- Permission Configuration
  permission_category VARCHAR(50),                   -- 'orders', 'customers', 'inventory', 'reports', 'settings', 'users'
  permission_type VARCHAR(20),                      -- 'read', 'create', 'update', 'delete', 'manage', 'export'
  resource_name VARCHAR(50),                        -- Resource name (orders, customers, etc.)

  -- RBAC Reference
  rbac_permission_code VARCHAR(100),                -- Links to sys_auth_permissions.code (format: resource:action)

  -- Behavior
  is_default BOOLEAN DEFAULT false,
  is_system BOOLEAN DEFAULT true,                  -- System permissions cannot be deleted
  is_active BOOLEAN DEFAULT true,

  -- Metadata
  metadata JSONB,
  /*
    Example:
    {
      "requires_approval": false,
      "audit_logged": true,
      "sensitive": false
    }
  */

  -- Audit
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by UUID,
  updated_at TIMESTAMP,
  updated_by UUID,
  rec_status SMALLINT DEFAULT 1
);

-- Indexes
CREATE INDEX idx_permission_active
  ON sys_permission_cd(is_active, display_order);

CREATE INDEX idx_permission_category
  ON sys_permission_cd(permission_category, is_active);

CREATE INDEX idx_permission_type
  ON sys_permission_cd(permission_type, is_active);

CREATE INDEX idx_permission_rbac
  ON sys_permission_cd(rbac_permission_code) WHERE rbac_permission_code IS NOT NULL;

-- Comments
COMMENT ON TABLE sys_permission_cd IS
  'Permission codes (VIEW_ORDERS, CREATE_ORDERS, EDIT_ORDERS, etc.)';

COMMENT ON COLUMN sys_permission_cd.code IS
  'Unique permission code (e.g., VIEW_ORDERS, CREATE_ORDERS, EDIT_ORDERS)';

COMMENT ON COLUMN sys_permission_cd.rbac_permission_code IS
  'Reference to sys_auth_permissions.code for full RBAC integration (format: resource:action)';

-- ==================================================================
-- SEED DATA: sys_user_role_cd
-- ==================================================================

INSERT INTO sys_user_role_cd (
  code,
  name,
  name2,
  description,
  description2,
  display_order,
  icon,
  color,
  role_level,
  access_level,
  is_platform_role,
  is_tenant_role,
  rbac_role_code,
  is_default,
  is_system,
  is_active,
  metadata
) VALUES
  (
    'owner',
    'Owner',
    'المالك',
    'Tenant owner with full access',
    'مالك المستأجر مع وصول كامل',
    1,
    'crown',
    '#F59E0B',
    'tenant',
    'full',
    false,
    true,
    'owner',
    false,
    true,
    true,
    '{"default_permissions": ["*:*"], "can_create_users": true, "can_manage_settings": true, "dashboard_access": "full"}'::jsonb
  ),
  (
    'tenant_admin',
    'Administrator',
    'المسؤول',
    'Administrator with management access',
    'مسؤول مع وصول إداري',
    2,
    'shield',
    '#3B82F6',
    'tenant',
    'tenant_admin',
    false,
    true,
    'tenant_admin',
    false,
    true,
    true,
    '{"default_permissions": ["orders:*", "customers:*", "reports:*"], "can_create_users": true, "can_manage_settings": true, "dashboard_access": "full"}'::jsonb
  ),
  (
    'branch_manager',
    'Manager',
    'المدير',
    'Manager with operational management access',
    'مدير مع وصول إداري تشغيلي',
    3,
    'briefcase',
    '#8B5CF6',
    'branch',
    'manager',
    false,
    true,
    'branch_manager',
    false,
    true,
    true,
    '{"default_permissions": ["orders:*", "customers:read", "customers:create", "reports:read"], "can_create_users": false, "can_manage_settings": false, "dashboard_access": "full"}'::jsonb
  ),
  (
    'operator',
    'Operator',
    'المشغل',
    'Operator with day-to-day operational access',
    'مشغل مع وصول تشغيلي يومي',
    4,
    'user',
    '#10B981',
    'operator',
    'operator',
    false,
    true,
    'operator',
    true,
    true,
    true,
    '{"default_permissions": ["orders:read", "orders:create", "orders:update", "customers:read"], "can_create_users": false, "can_manage_settings": false, "dashboard_access": "limited"}'::jsonb
  ),
  (
    'viewer',
    'Viewer',
    'عارض',
    'Viewer with read-only access',
    'عارض مع وصول للقراءة فقط',
    5,
    'eye',
    '#6B7280',
    'operator',
    'viewer',
    false,
    true,
    'viewer',
    false,
    true,
    true,
    '{"default_permissions": ["orders:read", "customers:read", "reports:read"], "can_create_users": false, "can_manage_settings": false, "dashboard_access": "read_only"}'::jsonb
  ),
  (
    'super_admin',
    'Super Administrator',
    'المسؤول الفائق',
    'Platform super administrator',
    'مسؤول المنصة الفائق',
    0,
    'shield-check',
    '#EF4444',
    'platform',
    'full',
    true,
    false,
    'super_admin',
    false,
    true,
    true,
    '{"default_permissions": ["*:*"], "can_create_users": true, "can_manage_settings": true, "dashboard_access": "full"}'::jsonb
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  role_level = EXCLUDED.role_level,
  access_level = EXCLUDED.access_level,
  rbac_role_code = EXCLUDED.rbac_role_code,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

-- ==================================================================
-- SEED DATA: sys_permission_cd
-- ==================================================================

INSERT INTO sys_permission_cd (
  code,
  name,
  name2,
  description,
  description2,
  display_order,
  icon,
  color,
  permission_category,
  permission_type,
  resource_name,
  rbac_permission_code,
  is_system,
  is_active,
  metadata
) VALUES
  -- Orders Permissions
  (
    'VIEW_ORDERS',
    'View Orders',
    'عرض الطلبات',
    'View orders',
    'عرض الطلبات',
    1,
    'eye',
    '#3B82F6',
    'orders',
    'read',
    'orders',
    'orders:read',
    true,
    true,
    '{"requires_approval": false, "audit_logged": false, "sensitive": false}'::jsonb
  ),
  (
    'CREATE_ORDERS',
    'Create Orders',
    'إنشاء الطلبات',
    'Create new orders',
    'إنشاء طلبات جديدة',
    2,
    'plus',
    '#10B981',
    'orders',
    'create',
    'orders',
    'orders:create',
    true,
    true,
    '{"requires_approval": false, "audit_logged": true, "sensitive": false}'::jsonb
  ),
  (
    'EDIT_ORDERS',
    'Edit Orders',
    'تعديل الطلبات',
    'Edit existing orders',
    'تعديل الطلبات الموجودة',
    3,
    'edit',
    '#F59E0B',
    'orders',
    'update',
    'orders',
    'orders:update',
    true,
    true,
    '{"requires_approval": false, "audit_logged": true, "sensitive": false}'::jsonb
  ),
  (
    'DELETE_ORDERS',
    'Delete Orders',
    'حذف الطلبات',
    'Delete orders',
    'حذف الطلبات',
    4,
    'trash',
    '#EF4444',
    'orders',
    'delete',
    'orders',
    'orders:delete',
    true,
    true,
    '{"requires_approval": true, "audit_logged": true, "sensitive": true}'::jsonb
  ),
  (
    'MANAGE_ORDERS',
    'Manage Orders',
    'إدارة الطلبات',
    'Full order management access',
    'وصول كامل لإدارة الطلبات',
    5,
    'settings',
    '#8B5CF6',
    'orders',
    'manage',
    'orders',
    'orders:*',
    true,
    true,
    '{"requires_approval": false, "audit_logged": true, "sensitive": false}'::jsonb
  ),
  -- Customers Permissions
  (
    'VIEW_CUSTOMERS',
    'View Customers',
    'عرض العملاء',
    'View customer information',
    'عرض معلومات العملاء',
    10,
    'users',
    '#3B82F6',
    'customers',
    'read',
    'customers',
    'customers:read',
    true,
    true,
    '{"requires_approval": false, "audit_logged": false, "sensitive": true}'::jsonb
  ),
  (
    'CREATE_CUSTOMERS',
    'Create Customers',
    'إنشاء العملاء',
    'Create new customers',
    'إنشاء عملاء جدد',
    11,
    'user-plus',
    '#10B981',
    'customers',
    'create',
    'customers',
    'customers:create',
    true,
    true,
    '{"requires_approval": false, "audit_logged": true, "sensitive": false}'::jsonb
  ),
  (
    'EDIT_CUSTOMERS',
    'Edit Customers',
    'تعديل العملاء',
    'Edit customer information',
    'تعديل معلومات العملاء',
    12,
    'user-edit',
    '#F59E0B',
    'customers',
    'update',
    'customers',
    'customers:update',
    true,
    true,
    '{"requires_approval": false, "audit_logged": true, "sensitive": true}'::jsonb
  ),
  (
    'MANAGE_CUSTOMERS',
    'Manage Customers',
    'إدارة العملاء',
    'Full customer management access',
    'وصول كامل لإدارة العملاء',
    13,
    'users-cog',
    '#8B5CF6',
    'customers',
    'manage',
    'customers',
    'customers:*',
    true,
    true,
    '{"requires_approval": false, "audit_logged": true, "sensitive": false}'::jsonb
  ),
  -- Reports Permissions
  (
    'VIEW_REPORTS',
    'View Reports',
    'عرض التقارير',
    'View reports and analytics',
    'عرض التقارير والتحليلات',
    20,
    'bar-chart',
    '#3B82F6',
    'reports',
    'read',
    'reports',
    'reports:read',
    true,
    true,
    '{"requires_approval": false, "audit_logged": false, "sensitive": false}'::jsonb
  ),
  (
    'EXPORT_REPORTS',
    'Export Reports',
    'تصدير التقارير',
    'Export reports',
    'تصدير التقارير',
    21,
    'download',
    '#10B981',
    'reports',
    'export',
    'reports',
    'reports:export',
    true,
    true,
    '{"requires_approval": false, "audit_logged": true, "sensitive": false}'::jsonb
  ),
  -- Settings Permissions
  (
    'MANAGE_SETTINGS',
    'Manage Settings',
    'إدارة الإعدادات',
    'Manage system settings',
    'إدارة إعدادات النظام',
    30,
    'settings',
    '#8B5CF6',
    'settings',
    'manage',
    'settings',
    'settings:*',
    true,
    true,
    '{"requires_approval": false, "audit_logged": true, "sensitive": true}'::jsonb
  ),
  -- Users Permissions
  (
    'VIEW_USERS',
    'View Users',
    'عرض المستخدمين',
    'View user list',
    'عرض قائمة المستخدمين',
    40,
    'users',
    '#3B82F6',
    'users',
    'read',
    'users',
    'users:read',
    true,
    true,
    '{"requires_approval": false, "audit_logged": false, "sensitive": true}'::jsonb
  ),
  (
    'CREATE_USERS',
    'Create Users',
    'إنشاء المستخدمين',
    'Create new users',
    'إنشاء مستخدمين جدد',
    41,
    'user-plus',
    '#10B981',
    'users',
    'create',
    'users',
    'users:create',
    true,
    true,
    '{"requires_approval": false, "audit_logged": true, "sensitive": true}'::jsonb
  ),
  (
    'MANAGE_USERS',
    'Manage Users',
    'إدارة المستخدمين',
    'Full user management access',
    'وصول كامل لإدارة المستخدمين',
    42,
    'users-cog',
    '#8B5CF6',
    'users',
    'manage',
    'users',
    'users:*',
    true,
    true,
    '{"requires_approval": false, "audit_logged": true, "sensitive": true}'::jsonb
  )
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  display_order = EXCLUDED.display_order,
  icon = EXCLUDED.icon,
  color = EXCLUDED.color,
  permission_category = EXCLUDED.permission_category,
  permission_type = EXCLUDED.permission_type,
  resource_name = EXCLUDED.resource_name,
  rbac_permission_code = EXCLUDED.rbac_permission_code,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

-- ==================================================================
-- REGISTER TABLES IN REGISTRY
-- ==================================================================

INSERT INTO sys_code_tables_registry (
  table_name,
  display_name,
  display_name2,
  description,
  description2,
  category,
  display_order,
  is_editable,
  is_extensible,
  supports_tenant_override,
  requires_unique_name,
  metadata
) VALUES
  (
    'sys_user_role_cd',
    'User Roles',
    'أدوار المستخدمين',
    'User role codes',
    'رموز أدوار المستخدمين',
    'Users & Access',
    1,
    true,
    true,
    false,
    true,
    '{"icon": "users", "color": "#3B82F6", "help_text": "Manage user role codes"}'::jsonb
  ),
  (
    'sys_permission_cd',
    'Permissions',
    'الأذونات',
    'Permission codes',
    'رموز الأذونات',
    'Users & Access',
    2,
    true,
    true,
    false,
    true,
    '{"icon": "shield", "color": "#8B5CF6", "help_text": "Manage permission codes"}'::jsonb
  )
ON CONFLICT (table_name) DO UPDATE SET
  display_name = EXCLUDED.display_name,
  display_name2 = EXCLUDED.display_name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  category = EXCLUDED.category,
  display_order = EXCLUDED.display_order,
  metadata = EXCLUDED.metadata,
  updated_at = CURRENT_TIMESTAMP;

COMMIT;

