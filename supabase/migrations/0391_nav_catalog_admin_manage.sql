-- =============================================================================
-- 0391_nav_catalog_admin_manage.sql
-- Purpose: Catalog nav dual-write — main_permission_code catalog:read → admin:manage.
-- Companion frontend: web-admin/config/navigation.ts catalog section.
-- =============================================================================

BEGIN;

UPDATE public.sys_components_cd
SET
  main_permission_code = 'admin:manage',
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_admin'
WHERE comp_code IN (
  'catalog',
  'catalog_services',
  'catalog_pricing',
  'catalog_addons'
)
  AND main_permission_code = 'catalog:read';

COMMIT;
