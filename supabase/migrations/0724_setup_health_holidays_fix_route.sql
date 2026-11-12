-- =============================================================================
-- Migration: 0724_setup_health_holidays_fix_route.sql
-- Purpose:   Gives Setup Health check CAL_HOLIDAYS_ESTIMATED its HQ Fix link.
--            0716 left hq_fix_route NULL because the HQ public-holidays screen
--            did not exist. It now does: Products & Items Config code table
--            'public-holidays' (sys_public_holidays_cf), where HQ corrects a
--            date and clears is_estimated ("mark confirmed").
--            The route has no {tenantId}: holidays are per country and shared
--            by every organization, not copied per organization.
-- Affected:  sys_setup_health_check_cd (row CAL_HOLIDAYS_ESTIMATED, data only;
--            no schema change, so no COMMENT ON change).
-- Related:   0709 (registry), 0716 (the check). Both must be applied first.
--
-- Rollback (forward-only, manual):
--   UPDATE sys_setup_health_check_cd SET hq_fix_route = NULL
--    WHERE check_code = 'CAL_HOLIDAYS_ESTIMATED';
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- Data-only update of one registry row; the audit columns record who changed it.
UPDATE public.sys_setup_health_check_cd
   SET hq_fix_route = '/products-items-config/public-holidays',
       updated_at   = NOW(),
       updated_by   = 'system_admin',
       updated_info = '0724 setup health holidays fix route'
 WHERE check_code = 'CAL_HOLIDAYS_ESTIMATED';

-- Fails the migration if 0716 was not applied, instead of updating zero rows.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.sys_setup_health_check_cd
     WHERE check_code = 'CAL_HOLIDAYS_ESTIMATED'
       AND hq_fix_route = '/products-items-config/public-holidays'
  ) THEN
    RAISE EXCEPTION '0724: CAL_HOLIDAYS_ESTIMATED row missing; apply 0716 first';
  END IF;
END $$;

COMMIT;
