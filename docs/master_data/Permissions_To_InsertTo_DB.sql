-- =====================================================
-- Permission: pricing:override
-- Description: Allow operators to override prices in new order page
-- Date: 2026-01-XX
-- =====================================================

-- Insert permission into sys_auth_permissions
INSERT INTO sys_auth_permissions (
  code, 
  name, 
  name2, 
  category, 
  description,
  description2,
  category_main,
  is_active, 
  is_enabled, 
  rec_status, 
  created_at,
  created_by
) VALUES (
  'pricing:override',
  'Override Price',
  'تجاوز السعر',
  'actions',
  'Override price in new order page',
  'تجاوز السعر في صفحة الطلب الجديد',
  'Pricing',
  true,
  true,
  1,
  CURRENT_TIMESTAMP,
  'system_admin'
)
ON CONFLICT (code) DO NOTHING;

-- Assign permission to super_admin role
INSERT INTO sys_auth_role_default_permissions (
  role_code,
  permission_code,
  is_enabled,
  is_active,
  rec_status,
  created_at,
  created_by
) VALUES (
  'super_admin',
  'pricing:override',
  true,
  true,
  1,
  CURRENT_TIMESTAMP,
  'system_admin'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- Assign permission to tenant_admin role
INSERT INTO sys_auth_role_default_permissions (
  role_code,
  permission_code,
  is_enabled,
  is_active,
  rec_status,
  created_at,
  created_by
) VALUES (
  'tenant_admin',
  'pricing:override',
  true,
  true,
  1,
  CURRENT_TIMESTAMP,
  'system_admin'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- Assign permission to operator role
INSERT INTO sys_auth_role_default_permissions (
  role_code,
  permission_code,
  is_enabled,
  is_active,
  rec_status,
  created_at,
  created_by
) VALUES (
  'operator',
  'pricing:override',
  true,
  true,
  1,
  CURRENT_TIMESTAMP,
  'system_admin'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- =====================================================
-- Permission: payments:cancel
-- Description: Cancel a payment
-- Roles: super_admin, tenant_admin, operator
-- Date: 2026-01-30
-- =====================================================

-- Insert permission into sys_auth_permissions
INSERT INTO sys_auth_permissions (
  code,
  name,
  name2,
  category,
  description,
  description2,
  category_main,
  is_active,
  is_enabled,
  rec_status,
  created_at,
  created_by
) VALUES (
  'payments:cancel',
  'Cancel Payment',
  'إلغاء الدفع',
  'actions',
  'Allows user to cancel a payment and reverse invoice/order balances',
  'يسمح للمستخدم بإلغاء الدفعة وعكس أرصدة الفواتير/الطلبات',
  'Payments',
  true,
  true,
  1,
  CURRENT_TIMESTAMP,
  'system_admin'
)
ON CONFLICT (code) DO NOTHING;

-- Assign permission to super_admin role
INSERT INTO sys_auth_role_default_permissions (
  role_code,
  permission_code,
  is_enabled,
  is_active,
  rec_status,
  created_at,
  created_by
) VALUES (
  'super_admin',
  'payments:cancel',
  true,
  true,
  1,
  CURRENT_TIMESTAMP,
  'system_admin'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- Assign permission to tenant_admin role
INSERT INTO sys_auth_role_default_permissions (
  role_code,
  permission_code,
  is_enabled,
  is_active,
  rec_status,
  created_at,
  created_by
) VALUES (
  'tenant_admin',
  'payments:cancel',
  true,
  true,
  1,
  CURRENT_TIMESTAMP,
  'system_admin'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- Assign permission to operator role
INSERT INTO sys_auth_role_default_permissions (
  role_code,
  permission_code,
  is_enabled,
  is_active,
  rec_status,
  created_at,
  created_by
) VALUES (
  'operator',
  'payments:cancel',
  true,
  true,
  1,
  CURRENT_TIMESTAMP,
  'system_admin'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- =====================================================
-- Permission: users:read
-- Description: View users / team members
-- Roles: super_admin, tenant_admin
-- Date: 2026-02-13
-- =====================================================

-- Insert permission into sys_auth_permissions
INSERT INTO sys_auth_permissions (
  code,
  name,
  name2,
  category,
  description,
  description2,
  category_main,
  is_active,
  is_enabled,
  rec_status,
  created_at,
  created_by
) VALUES (
  'users:read',
  'View Users',
  'عرض المستخدمين',
  'crud',
  'View users and team members',
  'عرض المستخدمين وأعضاء الفريق',
  'Users',
  true,
  true,
  1,
  CURRENT_TIMESTAMP,
  'system_admin'
)
ON CONFLICT (code) DO NOTHING;

-- Assign permission to super_admin role
INSERT INTO sys_auth_role_default_permissions (
  role_code,
  permission_code,
  is_enabled,
  is_active,
  rec_status,
  created_at,
  created_by
) VALUES (
  'super_admin',
  'users:read',
  true,
  true,
  1,
  CURRENT_TIMESTAMP,
  'system_admin'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- Assign permission to tenant_admin role
INSERT INTO sys_auth_role_default_permissions (
  role_code,
  permission_code,
  is_enabled,
  is_active,
  rec_status,
  created_at,
  created_by
) VALUES (
  'tenant_admin',
  'users:read',
  true,
  true,
  1,
  CURRENT_TIMESTAMP,
  'system_admin'
)
ON CONFLICT (role_code, permission_code) DO NOTHING;

-- =====================================================
-- Service Preferences Feature Permissions
-- Description: View/edit order service prefs, manage config, customer prefs
-- Roles: super_admin, tenant_admin, operator (for orders)
-- Date: 2026-03-12
-- =====================================================

INSERT INTO sys_auth_permissions (code, name, name2, category, description, description2, category_main, is_active, is_enabled, rec_status, created_at, created_by)
VALUES
  ('orders:service_prefs_view', 'View Service Preferences', 'عرض تفضيلات الخدمة', 'orders', 'View service and packing preferences on orders', 'عرض تفضيلات الخدمة والتغليف على الطلبات', 'Orders', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('orders:service_prefs_edit', 'Edit Service Preferences', 'تعديل تفضيلات الخدمة', 'orders', 'Add/remove service and packing preferences on orders', 'إضافة/إزالة تفضيلات الخدمة والتغليف على الطلبات', 'Orders', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('config:preferences_manage', 'Manage Preferences Catalog', 'إدارة كتالوج التفضيلات', 'config', 'Manage service preferences catalog and bundles', 'إدارة كتالوج تفضيلات الخدمة والحزم', 'Config', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('customers:preferences_manage', 'Manage Customer Preferences', 'إدارة تفضيلات العميل', 'customers', 'Manage customer standing preferences', 'إدارة تفضيلات العميل الدائمة', 'Customers', true, true, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO NOTHING;

INSERT INTO sys_auth_role_default_permissions (role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by)
SELECT r, p, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM (VALUES ('super_admin'), ('tenant_admin'), ('operator')) AS roles(r)
CROSS JOIN (VALUES ('orders:service_prefs_view'), ('orders:service_prefs_edit')) AS perms(p)
ON CONFLICT (role_code, permission_code) DO NOTHING;

INSERT INTO sys_auth_role_default_permissions (role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by)
SELECT r, p, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM (VALUES ('super_admin'), ('tenant_admin')) AS roles(r)
CROSS JOIN (VALUES ('config:preferences_manage'), ('customers:preferences_manage')) AS perms(p)
ON CONFLICT (role_code, permission_code) DO NOTHING;

commit;
