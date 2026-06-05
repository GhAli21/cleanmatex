-- Migration 0343: Tenant Settings and Branch Settings dedicated pages
-- Adds navigation entries and permissions for:
--   /dashboard/settings/tenant  (Tenant Settings)
--   /dashboard/settings/branches (Branch Settings)

BEGIN;

-- ─── 0. Permissions ──────────────────────────────────────────────────────────

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2,
  category_main, is_active, is_enabled, rec_status, created_at, created_by
) VALUES
  (
    'settings:tenant_manage',
    'Manage Tenant Settings',
    'إدارة إعدادات المستأجر',
    'settings',
    'View and edit tenant-level settings including pricing modes',
    'عرض وتعديل إعدادات المستأجر بما في ذلك أوضاع التسعير',
    'Settings', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
  ),
  (
    'settings:branch_manage',
    'Manage Branch Settings',
    'إدارة إعدادات الفروع',
    'settings',
    'View and edit branch-level settings including pricing mode overrides',
    'عرض وتعديل إعدادات الفروع بما في ذلك تجاوزات أوضاع التسعير',
    'Settings', true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
  )
ON CONFLICT (code) DO NOTHING;

-- ─── 1. Role default permissions ─────────────────────────────────────────────

-- admin, super_admin, tenant_admin get both permissions
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'admin', 'branch_manager')
  AND p.code IN ('settings:tenant_manage', 'settings:branch_manage')
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- ─── 2. sys_components_cd — Tenant Settings page ─────────────────────────────

INSERT INTO public.sys_components_cd (
  comp_code,          parent_comp_code,
  label,              label2,
  description,        description2,
  comp_path,          comp_icon,
  comp_level,         display_order,
  is_leaf,            is_navigable,   is_active,  is_system,  is_for_tenant_use,
  roles,              main_permission_code,       rec_status
) VALUES (
  'settings_tenant',  'config_settings',
  'Tenant Settings',  'إعدادات عامة-المؤسسة',
  'Configure organization-wide settings and pricing modes',
  'تكوين الإعدادات على مستوى المنظومة وأوضاع التسعير',
  '/dashboard/settings/tenant', 'Building2',
  1, 15,
  true, true, true, true, true,
  '["admin", "super_admin", "tenant_admin"]'::jsonb, 'settings:tenant_manage', 1
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

-- ─── 3. sys_components_cd — Branch Settings page ─────────────────────────────

INSERT INTO public.sys_components_cd (
  comp_code,            parent_comp_code,
  label,                label2,
  description,          description2,
  comp_path,            comp_icon,
  comp_level,           display_order,
  is_leaf,              is_navigable,   is_active,  is_system,  is_for_tenant_use,
  roles,                main_permission_code,       rec_status
) VALUES (
  'settings_branches',  'config_settings',
  'Branch Settings',    'إعدادات الفروع',
  'Configure per-branch settings and pricing mode overrides',
  'تكوين إعدادات الفروع وتجاوزات أوضاع التسعير',
  '/dashboard/settings/branches', 'GitBranch',
  1, 16,
  true, true, true, true, true,
  '["admin", "super_admin", "tenant_admin"]'::jsonb, 'settings:branch_manage', 1
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

-- ─── 4. Resolve parent_comp_id ───────────────────────────────────────────────

UPDATE sys_components_cd c
SET parent_comp_id = p.comp_id
FROM sys_components_cd p
WHERE c.parent_comp_code = 'config_settings'
  AND p.comp_code = 'config_settings'
  AND c.comp_code IN ('settings_tenant', 'settings_branches')
  AND (c.parent_comp_id IS NULL OR c.parent_comp_id <> p.comp_id);

-- ─── 5. Ensure parent remains a node (has children) ──────────────────────────

UPDATE sys_components_cd SET is_leaf = false WHERE comp_code = 'config_settings';

COMMIT;
