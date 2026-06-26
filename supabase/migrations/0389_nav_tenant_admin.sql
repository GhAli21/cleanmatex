-- =============================================================================
-- 0389_nav_tenant_admin.sql
-- Purpose: Add Tenant Admin navigation section; move Subscription out of Settings.
-- Companion frontend: navigation.ts tenant_admin + tenant_admin_subscription;
--   deactivate settings_subscription child under config_settings.
-- =============================================================================

BEGIN;

-- Deactivate legacy Settings > Subscription nav entry
UPDATE public.sys_components_cd
SET
  is_active = false,
  is_navigable = false,
  rec_status = 0,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_admin'
WHERE comp_code = 'settings_subscription';

-- Top-level Tenant Admin section
INSERT INTO public.sys_components_cd (
  comp_code,
  label,
  label2,
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
  'tenant_admin',
  'Tenant Admin',
  'إدارة المستأجر',
  '/dashboard/tenant-admin/subscription',
  'Building2',
  0,
  9,
  false,
  true,
  true,
  true,
  true,
  '["admin", "super_admin", "tenant_admin"]'::jsonb,
  NULL,
  1
)
ON CONFLICT (comp_code) DO UPDATE SET
  label = EXCLUDED.label,
  label2 = EXCLUDED.label2,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  comp_level = EXCLUDED.comp_level,
  display_order = EXCLUDED.display_order,
  is_leaf = EXCLUDED.is_leaf,
  is_navigable = EXCLUDED.is_navigable,
  is_active = EXCLUDED.is_active,
  is_for_tenant_use = EXCLUDED.is_for_tenant_use,
  roles = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP;

-- Subscription child under Tenant Admin
INSERT INTO public.sys_components_cd (
  comp_code,
  parent_comp_code,
  label,
  label2,
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
  'tenant_admin_subscription',
  'tenant_admin',
  'Subscription',
  'الاشتراك',
  '/dashboard/tenant-admin/subscription',
  'CreditCard',
  1,
  1,
  true,
  true,
  true,
  true,
  true,
  '["admin", "super_admin", "tenant_admin", "viewer", "operator"]'::jsonb,
  NULL,
  1
)
ON CONFLICT (comp_code) DO UPDATE SET
  parent_comp_code = EXCLUDED.parent_comp_code,
  label = EXCLUDED.label,
  label2 = EXCLUDED.label2,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  comp_level = EXCLUDED.comp_level,
  display_order = EXCLUDED.display_order,
  is_leaf = EXCLUDED.is_leaf,
  is_navigable = EXCLUDED.is_navigable,
  is_active = EXCLUDED.is_active,
  is_for_tenant_use = EXCLUDED.is_for_tenant_use,
  roles = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP;

UPDATE public.sys_components_cd c
SET parent_comp_id = p.comp_id
FROM public.sys_components_cd p
WHERE c.comp_code = 'tenant_admin_subscription'
  AND p.comp_code = 'tenant_admin'
  AND c.parent_comp_id IS DISTINCT FROM p.comp_id;

COMMIT;
