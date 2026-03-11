-- Add SERVICE_PREF_PROCESSING_CONFIRMATION tenant setting
-- Requires processing confirmation per piece (Enterprise)
-- Do NOT apply without user confirmation

BEGIN;

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
  'SERVICE_PREF_PROCESSING_CONFIRMATION', 'SERVICE_PREF', 'TENANT', 'BOOLEAN', 'false'::jsonb, NULL,
  true, false, false, false, true, 'TENANT_OVERRIDE', NULL,
  'Processing Confirmation', 'تأكيد المعالجة',
  'Require processing confirmation per piece (Enterprise)', 'يتطلب تأكيد المعالجة لكل قطعة',
  'toggle', 'Service Preferences', 9, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0144', 1, true
)
ON CONFLICT (setting_code) DO UPDATE SET
  stng_default_value_jsonb = EXCLUDED.stng_default_value_jsonb,
  setting_name = EXCLUDED.setting_name,
  setting_name2 = EXCLUDED.setting_name2,
  stng_display_order = EXCLUDED.stng_display_order,
  updated_at = CURRENT_TIMESTAMP;

COMMIT;
