-- =============================================================================
-- 0729_nav_menu_gates_follow_contracts.sql
-- Purpose:   Make the menu gate (sys_components_cd.main_permission_code, ONE code
--            per row) match each page's access contract, so a user never sees a
--            menu link the page refuses, nor misses one the page allows.
--            Mirrors web-admin/config/navigation.ts (dual-write).
-- Choices (role defaults checked on 2026-11-12):
--   orders_delivery      orders:read          -> drivers:read
--       Page needs drivers:read AND orders:read. Every role holding drivers:read
--       also holds orders:read, so drivers:read alone gives the same audience.
--   catalog_preferences  config:preferences_manage -> orders:read
--       Page accepts any of orders:service_prefs_view, orders:read,
--       config:preferences_manage; orders:read is the widest of the three.
--   settings_roles       settings:read        -> roles:update
--   settings_permissions settings:read        -> roles:update
--       Pages admit roles:* holders or the admin organization role; roles:update
--       is held by exactly admin, super_admin, tenant_admin.
--   settings_payments    settings:read        -> payment_config:view (page code)
--   delivery (top level, already inactive) -> soft deleted; the Orders ›
--       Delivery row is the single menu entry for /dashboard/delivery.
-- Idempotent: plain UPDATEs keyed by comp_code.
-- Rollback (manual): set the previous codes above back; restore delivery
--   rec_status = 1.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- Menu gate + its jsonb mirror; require_all_permissions stays false (one code).
UPDATE public.sys_components_cd AS c
SET main_permission_code = v.code,
    permissions          = jsonb_build_array(v.code),
    updated_at           = NOW(),
    updated_by           = 'system',
    updated_info         = '0729 menu gate follows page contract'
FROM (VALUES
  ('orders_delivery',      'drivers:read'),
  ('catalog_preferences',  'orders:read'),
  ('settings_roles',       'roles:update'),
  ('settings_permissions', 'roles:update'),
  ('settings_payments',    'payment_config:view')
) AS v(comp_code, code)
WHERE c.comp_code = v.comp_code;

-- Duplicate top-level Delivery row: soft delete (already hidden by is_active).
UPDATE public.sys_components_cd
SET is_active    = FALSE,
    rec_status   = 0,
    updated_at   = NOW(),
    updated_by   = 'system',
    updated_info = '0729 duplicate of orders_delivery removed'
WHERE comp_code = 'delivery';

COMMIT;
