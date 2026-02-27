-- Settings Edit Policy
-- Add stng_edit_policy to sys_tenant_settings_cd to control per-setting edit behavior.
-- Run from cleanmatex: supabase migration up
-- Then from cleanmatexsaas: scripts/dev/update-types.ps1

ALTER TABLE sys_tenant_settings_cd
  ADD COLUMN IF NOT EXISTS stng_edit_policy TEXT NOT NULL DEFAULT 'FREELY_EDITABLE';

COMMENT ON COLUMN sys_tenant_settings_cd.stng_edit_policy IS 'Edit policy for this setting: FREELY_EDITABLE, EDITABLE_ONCE, SYSTEM_LOCKED.';

ALTER TABLE sys_tenant_settings_cd
  ADD CONSTRAINT chk_sys_stng_edit_policy
  CHECK (
    stng_edit_policy IN (
      'FREELY_EDITABLE',
      'EDITABLE_ONCE',
      'SYSTEM_LOCKED'
    )
  );

-- Mark foundational currency-related settings as editable only once.
UPDATE sys_tenant_settings_cd
SET stng_edit_policy = 'EDITABLE_ONCE'
WHERE setting_code IN (
  'TENANT_CURRENCY',
  'TENANT_DECIMAL_PLACES',
  'BRANCH_CURRENCY'
);

Commit;

