-- ==================================================================
-- Migration: 0173_pref_kind_fk_and_saas_stop.sql
-- Purpose:
--   1. Add FK org_order_preferences_dtl.preference_sys_kind
--      → sys_preference_kind_cd(kind_code)
--   2. Add is_stopped_by_saas BOOLEAN to org_preference_kind_cf
--      When true, tenants cannot see/use this kind in new orders.
-- Do NOT apply — user reviews and applies manually.
-- ==================================================================

BEGIN;

-- ==================================================================
-- SECTION 1: Backfill org_order_preferences_dtl.preference_sys_kind
--   Ensure no NULLs or unknown codes before adding FK.
-- ==================================================================

UPDATE org_order_preferences_dtl
SET preference_sys_kind = COALESCE(
      (SELECT ssp.preference_sys_kind
         FROM sys_service_preference_cd ssp
        WHERE ssp.code = org_order_preferences_dtl.preference_code
        LIMIT 1),
      'condition_special'
    )
WHERE preference_sys_kind IS NULL
   OR preference_sys_kind NOT IN (
      'service_prefs','packing_prefs','condition_stain','condition_damag',
      'condition_special','condition_pattern','condition_material','color','note'
   );

-- ==================================================================
-- SECTION 2: FK org_order_preferences_dtl.preference_sys_kind
--            → sys_preference_kind_cd(kind_code)
-- Note: References sys_preference_kind_cd (global catalog), not
--       org_preference_kind_cf, because the column stores the
--       canonical kind code value.
-- ==================================================================

ALTER TABLE org_order_preferences_dtl
  ADD CONSTRAINT fk_ord_pref_dtl_kind
    FOREIGN KEY (preference_sys_kind)
    REFERENCES sys_preference_kind_cd(kind_code)
    ON UPDATE CASCADE;

-- ==================================================================
-- SECTION 3: Add is_stopped_by_saas to org_preference_kind_cf
--   When true: SaaS operator has disabled this kind for the tenant.
--   The tenant cannot see or use it in new orders.
-- ==================================================================

ALTER TABLE org_preference_kind_cf
  ADD COLUMN IF NOT EXISTS is_stopped_by_saas BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN org_preference_kind_cf.is_stopped_by_saas IS
  'When true, SaaS operator has stopped this preference kind for the tenant. Tenant users cannot see or use it in new orders.';

COMMIT;
