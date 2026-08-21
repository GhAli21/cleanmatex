-- ============================================================================
-- 0455_workboard_permission_navigation.sql
-- Purpose: Register the tenant Workboard permission and Orders navigation item.
-- Why: Workboard is a read-only supervisor projection and must have a distinct
--      audited access boundary from the stage commands it links to.
-- Review manually, then apply through the normal migration process.
-- ============================================================================

BEGIN;

INSERT INTO public.sys_auth_permissions (
  code, name, name2, category, description, description2, category_main,
  is_active, is_enabled, rec_status, created_at, created_by
) VALUES (
  'workboard:read',
  'View Workboard',
  'عرض لوحة العمل',
  'workflow',
  'View the read-only operational Workboard and open owning workflow stages',
  'عرض لوحة العمل التشغيلية وفتح مراحل سير العمل المسؤولة',
  'Workflow',
  true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
)
ON CONFLICT (code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  category = EXCLUDED.category,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  category_main = EXCLUDED.category_main,
  is_active = true,
  is_enabled = true,
  rec_status = 1,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_admin';

INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'admin', 'branch_manager', 'supervisor')
  AND p.code = 'workboard:read'
  AND NOT EXISTS (
    SELECT 1
    FROM public.sys_auth_role_default_permissions existing
    WHERE existing.role_code = r.code
      AND existing.permission_code = p.code
  );

INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_code, label, label2, description, description2,
  comp_path, comp_icon, comp_level, display_order, is_leaf, is_navigable,
  is_active, is_system, is_for_tenant_use, roles, permissions,
  main_permission_code, require_all_permissions, rec_status, created_at, created_by
) VALUES (
  'orders_workboard',
  'orders',
  'Workboard',
  'لوحة العمل',
  'Supervisor view of configured in-flight work; opens owner stages only',
  'عرض إشرافي للأعمال الجارية المهيأة مع فتح المرحلة المسؤولة فقط',
  '/dashboard/workboard',
  'ClipboardList',
  1,
  1,
  true,
  true,
  true,
  true,
  true,
  '["super_admin", "tenant_admin", "admin", "branch_manager", "supervisor"]'::jsonb,
  '["workboard:read"]'::jsonb,
  'workboard:read',
  true,
  1,
  CURRENT_TIMESTAMP,
  'system_admin'
)
ON CONFLICT (comp_code) DO UPDATE SET
  parent_comp_code = EXCLUDED.parent_comp_code,
  label = EXCLUDED.label,
  label2 = EXCLUDED.label2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  comp_path = EXCLUDED.comp_path,
  comp_icon = EXCLUDED.comp_icon,
  comp_level = EXCLUDED.comp_level,
  display_order = EXCLUDED.display_order,
  is_leaf = EXCLUDED.is_leaf,
  is_navigable = EXCLUDED.is_navigable,
  is_active = EXCLUDED.is_active,
  is_system = EXCLUDED.is_system,
  is_for_tenant_use = EXCLUDED.is_for_tenant_use,
  roles = EXCLUDED.roles,
  permissions = EXCLUDED.permissions,
  main_permission_code = EXCLUDED.main_permission_code,
  require_all_permissions = EXCLUDED.require_all_permissions,
  rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_admin';

UPDATE public.sys_components_cd child
SET parent_comp_id = parent.comp_id,
    updated_at = CURRENT_TIMESTAMP,
    updated_by = 'system_admin'
FROM public.sys_components_cd parent
WHERE child.comp_code = 'orders_workboard'
  AND parent.comp_code = 'orders'
  AND child.parent_comp_id IS DISTINCT FROM parent.comp_id;

UPDATE public.sys_components_cd
SET is_leaf = false,
    updated_at = CURRENT_TIMESTAMP,
    updated_by = 'system_admin'
WHERE comp_code = 'orders';

COMMIT;
