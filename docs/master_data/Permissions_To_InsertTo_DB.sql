-- =====================================================
-- Permission: pricing:override
-- Description: Allow operators to override prices in new order page
-- Date: 2025-01-XX
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

commit;
