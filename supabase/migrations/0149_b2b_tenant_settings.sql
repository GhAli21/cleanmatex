-- 0149_b2b_tenant_settings.sql
-- B2B tenant settings: credit limit mode, dunning levels
-- Plan: full_b2b_feature_implementation_a4bb16a5.plan.md
-- Feature flag: b2b_contracts
-- Do NOT apply without user confirmation

BEGIN;

-- Ensure B2B category exists in sys_stng_categories_cd
INSERT INTO sys_stng_categories_cd (
  stng_category_code, stng_category_name, stng_category_name2,
  stng_category_desc, stng_category_desc2, stng_category_order,
  stng_category_icon, created_by, is_active
) VALUES (
  'B2B', 'B2B', 'B2B',
  'B2B credit and dunning settings', 'إعدادات الائتمان والتذكير B2B',
  50, 'building-2', 'system_admin', true
)
ON CONFLICT (stng_category_code) DO UPDATE SET
  stng_category_name = EXCLUDED.stng_category_name,
  stng_category_name2 = EXCLUDED.stng_category_name2,
  updated_at = CURRENT_TIMESTAMP;

-- B2B Credit Limit Mode: warn | block
-- warn = show modal + admin override; block = prevent submit
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
  'B2B_CREDIT_LIMIT_MODE', 'B2B', 'TENANT', 'TEXT',
  '"block"'::jsonb, '["warn","block"]'::jsonb,
  true, false, false, false, true, 'TENANT_OVERRIDE',
  '["b2b_contracts"]'::jsonb,
  'B2B Credit Limit Mode', 'وضع حد الائتمان B2B',
  'When B2B customer exceeds credit: warn (allow override) or block (prevent order)', 'عند تجاوز حد الائتمان: تحذير أو منع',
  'select', 'B2B', 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0149', 1, true
)
ON CONFLICT (setting_code) DO UPDATE SET
  stng_default_value_jsonb = EXCLUDED.stng_default_value_jsonb,
  setting_name = EXCLUDED.setting_name,
  setting_name2 = EXCLUDED.setting_name2,
  stng_depends_on_flags = EXCLUDED.stng_depends_on_flags,
  updated_at = CURRENT_TIMESTAMP;

-- B2B Dunning Levels: [{ days: 7, action: 'email' }, { days: 14, action: 'sms' }, { days: 30, action: 'hold_orders' }]
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
  'B2B_DUNNING_LEVELS', 'B2B', 'TENANT', 'JSONB',
  '[{"days":7,"action":"email"},{"days":14,"action":"sms"},{"days":30,"action":"hold_orders"}]'::jsonb, NULL,
  true, false, false, false, true, 'TENANT_OVERRIDE',
  '["b2b_contracts"]'::jsonb,
  'B2B Dunning Levels', 'مستويات التذكير B2B',
  'Overdue statement actions: days overdue → action (email, sms, hold_orders)', 'إجراءات كشوف الحساب المتأخرة',
  'json', 'B2B', 2, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0149', 1, true
)
ON CONFLICT (setting_code) DO UPDATE SET
  stng_default_value_jsonb = EXCLUDED.stng_default_value_jsonb,
  setting_name = EXCLUDED.setting_name,
  setting_name2 = EXCLUDED.setting_name2,
  stng_depends_on_flags = EXCLUDED.stng_depends_on_flags,
  updated_at = CURRENT_TIMESTAMP;

COMMIT;
