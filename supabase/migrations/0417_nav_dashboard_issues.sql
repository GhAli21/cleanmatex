-- ==================================================================
-- 0417_nav_dashboard_issues.sql
-- Dual-write: sidebar /dashboard/issues (see web-admin/config/navigation.ts)
-- DO NOT APPLY automatically — review then run via normal DB process.
-- ==================================================================

BEGIN;

INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_code,
  label, label2,
  description, description2,
  comp_path, comp_icon,
  comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, metadata, rec_status
) VALUES (
  'orders_issues', 'orders',
  'Issues', 'المشكلات',
  'Order issues queue across the tenant',
  'قائمة مشكلات الطلبات على مستوى المستأجر',
  '/dashboard/issues', 'AlertTriangle',
  1, 101,
  true, true, true, true, true,
  '["super_admin","tenant_admin","admin","operator","viewer"]'::jsonb,
  NULL,
  '{"feature":"order_issues"}'::jsonb,
  1
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
  is_system            = EXCLUDED.is_system,
  is_for_tenant_use    = EXCLUDED.is_for_tenant_use,
  roles                = EXCLUDED.roles,
  main_permission_code = EXCLUDED.main_permission_code,
  metadata             = EXCLUDED.metadata,
  rec_status           = EXCLUDED.rec_status,
  updated_at           = CURRENT_TIMESTAMP;

UPDATE public.sys_components_cd c
SET parent_comp_id = p.comp_id
FROM public.sys_components_cd p
WHERE c.comp_code = 'orders_issues'
  AND p.comp_code = 'orders'
  AND (c.parent_comp_id IS NULL OR c.parent_comp_id <> p.comp_id);

UPDATE public.sys_components_cd
SET is_leaf = false,
    updated_at = CURRENT_TIMESTAMP
WHERE comp_code = 'orders';

COMMIT;
