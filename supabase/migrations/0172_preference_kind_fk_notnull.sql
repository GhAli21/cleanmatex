-- ==================================================================
-- Migration: 0172_preference_kind_fk_notnull.sql
-- Purpose: Add FK from sys_service_preference_cd.preference_sys_kind
--          to sys_preference_kind_cd, enforce NOT NULL on both tables,
--          add seed_tenant_pref_kinds() helper for new tenants.
-- Do NOT apply — user reviews and applies manually.
-- ==================================================================

BEGIN;

-- ==================================================================
-- SECTION 1: Safe backfill — ensure no NULL or unknown kind codes
--            exist before adding NOT NULL / FK constraints.
-- ==================================================================

UPDATE sys_service_preference_cd
SET preference_sys_kind = 'condition_special'
WHERE preference_sys_kind IS NULL
   OR preference_sys_kind NOT IN (
      'service_prefs','packing_prefs','condition_stain','condition_damag',
      'condition_special','condition_pattern','condition_material','color','note'
   );

UPDATE org_service_preference_cf cf
SET preference_sys_kind = COALESCE(
      (SELECT cd.preference_sys_kind
         FROM sys_service_preference_cd cd
        WHERE cd.code = cf.preference_code),
      'condition_special'
    )
WHERE cf.preference_sys_kind IS NULL;

-- ==================================================================
-- SECTION 2: Enforce NOT NULL
-- ==================================================================

ALTER TABLE sys_service_preference_cd
  ALTER COLUMN preference_sys_kind SET NOT NULL;

ALTER TABLE org_service_preference_cf
  ALTER COLUMN preference_sys_kind SET NOT NULL;

-- ==================================================================
-- SECTION 3: FK from sys_service_preference_cd → sys_preference_kind_cd
-- ==================================================================

ALTER TABLE sys_service_preference_cd
  ADD CONSTRAINT fk_sys_svc_pref_kind
    FOREIGN KEY (preference_sys_kind)
    REFERENCES sys_preference_kind_cd(kind_code)
    ON UPDATE CASCADE;

-- ==================================================================
-- SECTION 4: seed_tenant_pref_kinds(UUID) — call for new tenants
-- ==================================================================

CREATE OR REPLACE FUNCTION seed_tenant_pref_kinds(p_tenant_id UUID)
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  INSERT INTO org_preference_kind_cf (
    tenant_org_id, kind_code,
    is_show_in_quick_bar, is_show_for_customer,
    rec_order, is_active, created_by
  )
  SELECT
    p_tenant_id,
    s.kind_code,
    s.is_show_in_quick_bar,
    s.is_show_for_customer,
    s.rec_order,
    true,
    'system_seed'
  FROM sys_preference_kind_cd s
  WHERE s.is_active = true
  ON CONFLICT (tenant_org_id, kind_code) DO NOTHING;
END;
$$;

COMMENT ON FUNCTION seed_tenant_pref_kinds(UUID) IS
  'Call during new tenant provisioning to populate org_preference_kind_cf from sys catalog.';

COMMIT;
