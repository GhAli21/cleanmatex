-- Settings Required Value & Minimum Layer
-- Add columns to sys_tenant_settings_cd for required/nullability and preferred min layer.
-- Run from cleanmatex: supabase migration up
-- Then from cleanmatexsaas: scripts/dev/update-types.ps1

ALTER TABLE sys_tenant_settings_cd
  ADD COLUMN IF NOT EXISTS stng_is_required BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS stng_allows_null BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS stng_required_min_layer TEXT NULL;

COMMENT ON COLUMN sys_tenant_settings_cd.stng_is_required IS 'When true, the final resolved value must be non-null.';
COMMENT ON COLUMN sys_tenant_settings_cd.stng_allows_null IS 'When false with stng_is_required=true, null is not allowed as final value.';
COMMENT ON COLUMN sys_tenant_settings_cd.stng_required_min_layer IS 'Preferred minimum layer (intent); fallback to lower layers still allowed if they provide non-null value.';

ALTER TABLE sys_tenant_settings_cd
  ADD CONSTRAINT chk_stng_required_min_layer
  CHECK (
    stng_required_min_layer IS NULL
    OR stng_required_min_layer IN (
      'SYSTEM_DEFAULT',
      'SYSTEM_PROFILE',
      'PLAN_CONSTRAINT',
      'FEATURE_FLAG',
      'TENANT_OVERRIDE',
      'BRANCH_OVERRIDE',
      'USER_OVERRIDE'
    )
  );

-- Optional: prevent required + allows_null=true (contradictory)
ALTER TABLE sys_tenant_settings_cd
  ADD CONSTRAINT chk_stng_required_no_null
  CHECK (NOT stng_is_required OR stng_allows_null = FALSE);
