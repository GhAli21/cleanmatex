-- =====================================================
-- Add Catalog Customer Categories to navigation tree
-- Route: /dashboard/catalog/customer-categories
-- Table: org_customer_category_cf CRUD
-- Roles: super_admin, tenant_admin
-- Date: 2026-03-15
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
  'catalog_customer_categories',
  'catalog',
  'Customer Categories',
  'فئات العملاء',
  'Manage tenant customer categories (org_customer_category_cf)',
  'إدارة فئات العملاء للمستأجر (org_customer_category_cf)',
  '/dashboard/catalog/customer-categories',
  'Users',
  1,
  4,
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

-- Link catalog_customer_categories to catalog parent
UPDATE sys_components_cd c
SET parent_comp_id = p.comp_id
FROM sys_components_cd p
WHERE c.comp_code = 'catalog_customer_categories'
  AND c.parent_comp_code = 'catalog'
  AND p.comp_code = 'catalog';

-- Ensure parent Catalog node is not leaf (has children)
UPDATE sys_components_cd
SET is_leaf = false,
    updated_at = CURRENT_TIMESTAMP
WHERE comp_code = 'catalog';

COMMIT;
