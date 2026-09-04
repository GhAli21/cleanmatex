-- ============================================================================
-- Migration: 0491_nav_drivers_remove_driver_app_gate.sql
-- Purpose: Delivery Feature Completion, Phase 3 (nav gate fix).
--   The 'drivers' / 'drivers_list' / 'drivers_routes' sys_components_cd rows
--   currently gate on feature_flag=['driver_app']. That flag is reserved for
--   the future, separate driver mobile app (not built yet) -- it does not
--   belong on this staff dispatcher CRUD/route-planning UI, which only needs
--   the already-seeded 'drivers:read' permission. Matches the corresponding
--   web-admin/config/navigation.ts edit (dual-write, CRITICAL RULE #10).
--
--   Also fixes a pre-existing drift found while reviewing these rows: DB
--   roles=['admin'] only, while navigation.ts declares
--   ['admin','super_admin','tenant_admin','operator'] for the same items.
--   Corrected here so the two stay in sync per the /navigation skill rule.
-- ============================================================================
-- Do not apply automatically. Operator reviews and applies.

BEGIN;

UPDATE public.sys_components_cd
SET
  feature_flag = NULL,
  roles = '["admin", "super_admin", "tenant_admin", "operator"]'::jsonb,
  updated_at = CURRENT_TIMESTAMP,
  is_active=TRUE,
  rec_status=1
WHERE comp_code IN ('drivers', 'drivers_list', 'drivers_routes');

COMMIT;
