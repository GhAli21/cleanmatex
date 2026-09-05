-- ============================================================================
-- Migration: 0492_nav_drivers_routes_orders_read.sql
-- Purpose: Align the dispatcher Routes navigation item with its read contract.
--
-- Route planning displays order addresses and asks the order-scoped active-stop
-- API for ownership. Requiring orders:read prevents a drivers-only role from
-- entering a page that cannot safely reveal or validate that tenant data.
-- This is the database half of the navigation.ts dual-write.
--
-- Do not apply automatically. Operator reviews and applies this migration.
-- ============================================================================

BEGIN;

UPDATE public.sys_components_cd
SET
  main_permission_code = 'drivers:read',
  permissions = '["drivers:read", "orders:read"]'::jsonb,
  require_all_permissions = TRUE,
  updated_at = CURRENT_TIMESTAMP,
  updated_info = 'Route-planning order-read navigation contract',
  is_active = TRUE,
  rec_status = 1
WHERE comp_code = 'drivers_routes';

COMMIT;
