-- =====================================================
-- Add Catalog Preferences to navigation tree
-- Route: /dashboard/catalog/preferences
-- Roles: super_admin, tenant_admin; Permission: config:preferences_manage
-- Date: 2026-03-12
-- =====================================================

BEGIN;

INSERT INTO public.sys_components_cd (
  comp_code,
  parent_comp_code,
  label,
  label2,
  description,
  description2,
  comp_path,
  comp_icon,
  comp_level,
  display_order,
  is_leaf,
  is_navigable,
  is_active,
  is_system,
  is_for_tenant_use,
  roles,
  main_permission_code,
  rec_status
) VALUES (
  'catalog_preferences',
  'catalog',
  'Service Preferences',
  'تفضيلات الخدمة',
  'Manage service preferences catalog and bundles',
  'إدارة كتالوج تفضيلات الخدمة والحزم',
  '/dashboard/catalog/preferences',
  'Settings',
  1,
  3,
  true,
  true,
  true,
  true,
  true,
  '["super_admin", "tenant_admin"]'::jsonb,
  'config:preferences_manage',
  1
) ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  label2 = EXCLUDED.label2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  display_order = EXCLUDED.display_order,
  roles = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  updated_at = CURRENT_TIMESTAMP;

-- Link catalog_preferences to catalog parent
UPDATE sys_components_cd c
SET parent_comp_id = p.comp_id
FROM sys_components_cd p
WHERE c.comp_code = 'catalog_preferences'
  AND c.parent_comp_code = 'catalog'
  AND p.comp_code = 'catalog';

-- Ensure parent Catalog node is not leaf (has children)
UPDATE sys_components_cd
SET is_leaf = false,
    updated_at = CURRENT_TIMESTAMP
WHERE comp_code = 'catalog';

COMMIT;