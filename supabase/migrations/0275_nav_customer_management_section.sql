-- ==================================================================
-- Migration: 0275_nav_customer_management_section.sql
-- Purpose:   Convert 'customers' nav entry from a flat leaf into an
--            expandable section, rename to 'Customer Management',
--            seed customer permissions, and map them to roles.
-- Project:   cleanmatex (source of truth for shared DB migrations)
-- Notes:
--   - Permissions already exist from 0035; inserts use ON CONFLICT DO NOTHING.
--   - Role-permission mapping uses NOT EXISTS to be idempotent.
--   - admin / branch_admin rows are silently skipped if those roles
--     do not yet exist in sys_auth_roles.
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

-- ============================================================
-- 0. PERMISSIONS — seed customer permissions
--    (safe to re-run; 0035 already seeded these)
-- ============================================================

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  ('customers:create',  'Create Customers',     'إنشاء العملاء',    'crud',    'Create customers',            'إنشاء سجلات العملاء',        'Customers', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('customers:read',    'View Customers',        'عرض العملاء',      'crud',    'View customers',              'عرض بيانات العملاء',          'Customers', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('customers:update',  'Edit Customers',        'تعديل العملاء',    'crud',    'Edit customer details',       'تعديل بيانات العملاء',        'Customers', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('customers:delete',  'Delete Customers',      'حذف العملاء',      'crud',    'Delete customers',            'حذف سجلات العملاء',           'Customers', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('customers:export',  'Export Customers',      'تصدير العملاء',    'export',  'Export customer data',        'تصدير بيانات العملاء',        'Customers', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('customers:merge',   'Merge Customers',       'دمج العملاء',      'actions', 'Merge duplicate customers',   'دمج سجلات العملاء المكررة',   'Customers', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('customers:upgrade', 'Upgrade Customer',      'ترقية العميل',     'actions', 'Upgrade customer profile',    'ترقية ملف العميل',            'Customers', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('customers:loyalty', 'Manage Loyalty',        'إدارة الولاء',     'actions', 'Manage loyalty points',       'إدارة نقاط الولاء',           'Customers', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('customers:tags',    'Manage Tags',           'إدارة العلامات',   'actions', 'Add/edit customer tags',      'إضافة وتعديل علامات العميل',  'Customers', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'),
  ('customers:history', 'View Customer History', 'عرض سجل العميل',   'crud',    'View order history',          'عرض سجل الطلبات للعميل',      'Customers', true, true, 1, CURRENT_TIMESTAMP, 'system_admin')
ON CONFLICT (code) DO NOTHING;

-- ============================================================
-- 1. ROLE PERMISSIONS
--
--    Permission matrix per role:
--      super_admin  → all customer permissions
--      tenant_admin → all customer permissions
--      admin        → all customer permissions
--      branch_manager → create read update merge upgrade tags history
--      operator     → create read update upgrade tags history
--      viewer       → read history
--
--    Uses NOT EXISTS for idempotency.
--    CROSS JOIN silently produces no rows when role does not exist.
-- ============================================================

-- super_admin / tenant_admin / admin: full access
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT
  r.code, p.code,
  true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'admin')
  AND p.code IN (
    'customers:create', 'customers:read',   'customers:update',  'customers:delete',
    'customers:export', 'customers:merge',  'customers:upgrade',
    'customers:loyalty','customers:tags',   'customers:history'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- branch_manager: operational + management (no delete / export / loyalty)
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT
  r.code, p.code,
  true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code = 'branch_manager'
  AND p.code IN (
    'customers:create', 'customers:read',  'customers:update',
    'customers:merge',  'customers:upgrade','customers:tags', 'customers:history'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- operator: operational (no delete / export / merge / loyalty)
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT
  r.code, p.code,
  true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code = 'operator'
  AND p.code IN (
    'customers:create', 'customers:read', 'customers:update',
    'customers:upgrade','customers:tags', 'customers:history'
  )
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- viewer: read-only
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT
  r.code, p.code,
  true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code = 'viewer'
  AND p.code IN ('customers:read', 'customers:history')
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- ============================================================
-- 2. NAVIGATION: Update 'customers' parent to section node
-- ============================================================

INSERT INTO public.sys_components_cd (
  comp_code,
  label, label2,
  description, description2,
  comp_path, comp_icon,
  comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES (
  'customers',
  'Customer Management', 'إدارة العملاء',
  'Customer management section', 'قسم إدارة العملاء',
  '/dashboard/customers', 'Users',
  0, 4,
  false, true, true, true, true,
  '["super_admin", "tenant_admin", "admin", "branch_manager", "operator", "viewer"]'::jsonb,
  'customers:read', 1
) ON CONFLICT (comp_code) DO UPDATE SET
  label                = EXCLUDED.label,
  label2               = EXCLUDED.label2,
  description          = EXCLUDED.description,
  description2         = EXCLUDED.description2,
  comp_path            = EXCLUDED.comp_path,
  comp_icon            = EXCLUDED.comp_icon,
  comp_level           = EXCLUDED.comp_level,
  display_order        = EXCLUDED.display_order,
  is_leaf              = false,
  is_navigable         = EXCLUDED.is_navigable,
  is_active            = EXCLUDED.is_active,
  is_for_tenant_use    = EXCLUDED.is_for_tenant_use,
  roles                = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  updated_at           = CURRENT_TIMESTAMP;

-- ============================================================
-- 3. NAVIGATION: Insert child — All Customers
-- ============================================================

INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_code,
  label, label2,
  description, description2,
  comp_path, comp_icon,
  comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, rec_status
) VALUES (
  'customers_list', 'customers',
  'All Customers', 'جميع العملاء',
  'List of all customers', 'قائمة جميع العملاء',
  '/dashboard/customers', 'Users',
  1, 0,
  true, true, true, true, true,
  '["super_admin", "tenant_admin", "admin", "branch_manager", "operator", "viewer"]'::jsonb,
  'customers:read', 1
) ON CONFLICT (comp_code) DO UPDATE SET
  parent_comp_code     = EXCLUDED.parent_comp_code,
  label                = EXCLUDED.label,
  label2               = EXCLUDED.label2,
  description          = EXCLUDED.description,
  description2         = EXCLUDED.description2,
  comp_path            = EXCLUDED.comp_path,
  comp_icon            = EXCLUDED.comp_icon,
  comp_level           = EXCLUDED.comp_level,
  display_order        = EXCLUDED.display_order,
  is_leaf              = EXCLUDED.is_leaf,
  is_navigable         = EXCLUDED.is_navigable,
  is_active            = EXCLUDED.is_active,
  is_for_tenant_use    = EXCLUDED.is_for_tenant_use,
  roles                = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  updated_at           = CURRENT_TIMESTAMP;

-- ============================================================
-- 4. Resolve parent_comp_id for all customers children
-- ============================================================

UPDATE sys_components_cd c
SET parent_comp_id = p.comp_id
FROM sys_components_cd p
WHERE c.parent_comp_code = 'customers'
  AND p.comp_code = 'customers'
  AND (c.parent_comp_id IS NULL OR c.parent_comp_id <> p.comp_id);

-- ============================================================
-- 5. Ensure customers root is flagged as a node (has children)
-- ============================================================

UPDATE sys_components_cd
SET is_leaf = false
WHERE comp_code = 'customers';

COMMIT;
