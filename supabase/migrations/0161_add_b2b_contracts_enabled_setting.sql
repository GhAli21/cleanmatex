-- ================================================================
-- Migration: 0161 - Add B2B_CONTRACTS_ENABLED setting
-- ================================================================
-- Purpose: Tenant self-serve disable for B2B feature.
-- When plan enables b2b_contracts, tenant can override to false
-- via this setting. Resolution: FEATURE_FLAG allows -> TENANT_OVERRIDE disables.
-- Dependencies: 0149 (B2B category), 0160 (FEATURE_FLAG layer)
-- ================================================================


INSERT INTO sys_tenant_settings_cd (
  setting_code, stng_category_code, stng_scope, stng_data_type,
  stng_default_value_jsonb, stng_validation_jsonb,
  stng_is_overridable, stng_is_sensitive, stng_requires_restart,
  stng_is_required, stng_allows_null, stng_required_min_layer,
  stng_depends_on_flags,
  setting_name, setting_name2, setting_desc, setting_desc2,
  stng_ui_component, stng_ui_group, stng_display_order,
  created_at, created_by, created_info, rec_status, is_active
) VALUES (
  'B2B_CONTRACTS_ENABLED', 'B2B', 'TENANT', 'BOOLEAN',
  'true'::jsonb, NULL,
  true, false, false, false, true, 'TENANT_OVERRIDE',
  '["b2b_contracts"]'::jsonb,
  'B2B Contracts Enabled', 'تفعيل عقود B2B',
  'Enable or disable B2B contracts for this tenant. Plan must have b2b_contracts flag; tenant can disable.', 'تفعيل أو تعطيل عقود B2B لهذا المستأجر',
  'toggle', 'B2B', 0, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0161', 1, true
)
ON CONFLICT (setting_code) DO UPDATE SET
  stng_default_value_jsonb = EXCLUDED.stng_default_value_jsonb,
  setting_name = EXCLUDED.setting_name,
  setting_name2 = EXCLUDED.setting_name2,
  setting_desc = EXCLUDED.setting_desc,
  setting_desc2 = EXCLUDED.setting_desc2,
  stng_depends_on_flags = EXCLUDED.stng_depends_on_flags,
  stng_is_overridable = EXCLUDED.stng_is_overridable,
  updated_at = CURRENT_TIMESTAMP;

COMMIT;
