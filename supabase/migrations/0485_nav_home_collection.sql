-- ==================================================================
-- 0485_nav_home_collection.sql
-- Dual-write: sidebar /dashboard/home-collection (web-admin/config/navigation.ts)
-- DO NOT APPLY automatically — review then run via normal DB process.
-- ==================================================================

BEGIN;

-- ─── 1. Role default permissions (nav + floor commands; NOT EXISTS — idempotent)
INSERT INTO public.sys_auth_role_default_permissions (
  role_code, permission_code, is_enabled, is_active, rec_status, created_at, created_by
)
SELECT r.code, p.code, true, true, 1, CURRENT_TIMESTAMP, 'system_admin'
FROM public.sys_auth_roles r
CROSS JOIN public.sys_auth_permissions p
WHERE r.code IN ('super_admin', 'tenant_admin', 'admin', 'operator')
  AND p.code IN ('orders:read', 'orders:transition')
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_auth_role_default_permissions e
    WHERE e.role_code = r.code AND e.permission_code = p.code
  );

-- ─── 2. sys_components_cd — Home Collection floor
INSERT INTO public.sys_components_cd (
  comp_code, parent_comp_code,
  label, label2,
  description, description2,
  comp_path, comp_icon,
  comp_level, display_order,
  is_leaf, is_navigable, is_active, is_system, is_for_tenant_use,
  roles, main_permission_code, metadata, rec_status
) VALUES (
  'orders_home_collection', 'orders',
  'Home Collection', 'استلام من المنزل',
  'Orders awaiting inbound collection from the customer',
  'طلبات في انتظار الاستلام من منزل العميل',
  '/dashboard/home-collection', 'Home',
  1, 25,
  true, true, true, true, true,
  '["super_admin","tenant_admin","admin","operator"]'::jsonb,
  'orders:read',
  '{"feature":"home_collection"}'::jsonb,
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
WHERE c.comp_code = 'orders_home_collection'
  AND p.comp_code = 'orders'
  AND (c.parent_comp_id IS NULL OR c.parent_comp_id <> p.comp_id);

UPDATE public.sys_components_cd
SET is_leaf = false,
    updated_at = CURRENT_TIMESTAMP
WHERE comp_code = 'orders';

COMMIT;
