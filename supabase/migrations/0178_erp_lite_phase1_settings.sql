-- ==================================================================
-- Migration: 0178_erp_lite_phase1_settings.sql
-- Purpose: Seed ERP-Lite Phase 1 settings category and tenant setting catalog
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Phase: ERP-Lite Phase 1 - Platform Enablement
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

INSERT INTO public.sys_stng_categories_cd (
  stng_category_code,
  stng_category_name,
  stng_category_name2,
  stng_category_desc,
  stng_category_desc2,
  stng_category_order,
  stng_category_icon,
  created_by,
  is_active
) VALUES (
  'ERP_LITE',
  'Finance & Accounting',
  'المالية والمحاسبة',
  'ERP-Lite tenant settings for finance and accounting enablement',
  'إعدادات المستأجر الخاصة بـ ERP-Lite للمالية والمحاسبة',
  55,
  'landmark',
  'system_admin',
  true
)
ON CONFLICT (stng_category_code) DO UPDATE SET
  stng_category_name = EXCLUDED.stng_category_name,
  stng_category_name2 = EXCLUDED.stng_category_name2,
  stng_category_desc = EXCLUDED.stng_category_desc,
  stng_category_desc2 = EXCLUDED.stng_category_desc2,
  stng_category_order = EXCLUDED.stng_category_order,
  stng_category_icon = EXCLUDED.stng_category_icon,
  updated_at = CURRENT_TIMESTAMP;

-- Phase 1 intentionally excludes tenant-owned auto-post settings.
INSERT INTO public.sys_tenant_settings_cd (
  setting_code,
  stng_category_code,
  stng_scope,
  stng_data_type,
  stng_default_value_jsonb,
  stng_validation_jsonb,
  stng_is_overridable,
  stng_is_sensitive,
  stng_requires_restart,
  stng_is_required,
  stng_allows_null,
  stng_required_min_layer,
  stng_depends_on_flags,
  setting_name,
  setting_name2,
  setting_desc,
  setting_desc2,
  stng_ui_component,
  stng_ui_group,
  stng_display_order,
  created_at,
  created_by,
  created_info,
  rec_status,
  is_active
) VALUES
  (
    'ERP_LITE_ENABLED',
    'ERP_LITE',
    'TENANT',
    'BOOLEAN',
    'true'::jsonb,
    NULL,
    true,
    false,
    false,
    false,
    true,
    'TENANT_OVERRIDE',
    '["erp_lite_enabled"]'::jsonb,
    'ERP-Lite Enabled',
    'تفعيل ERP-Lite',
    'Tenant self-serve disable for ERP-Lite when the tenant plan includes the module',
    'تعطيل ذاتي للمستأجر لـ ERP-Lite عندما تتضمن الخطة الوحدة',
    'toggle',
    'ERP_LITE',
    0,
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration 0178 ERP-Lite Phase 1',
    1,
    true
  ),
  (
    'ERP_LITE_FISCAL_YEAR_START',
    'ERP_LITE',
    'TENANT',
    'INTEGER',
    '1'::jsonb,
    '{"min":1,"max":12}'::jsonb,
    true,
    false,
    false,
    false,
    true,
    'TENANT_OVERRIDE',
    '["erp_lite_enabled"]'::jsonb,
    'Fiscal Year Start Month',
    'شهر بداية السنة المالية',
    'Month 1-12 when the tenant fiscal year starts',
    'الشهر من 1 إلى 12 الذي تبدأ فيه السنة المالية للمستأجر',
    'number-input',
    'ERP_LITE',
    1,
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration 0178 ERP-Lite Phase 1',
    1,
    true
  ),
  (
    'ERP_LITE_FIRST_PERIOD_START',
    'ERP_LITE',
    'TENANT',
    'TEXT',
    'null'::jsonb,
    '{"regex":"^\\d{4}-\\d{2}-\\d{2}$"}'::jsonb,
    true,
    false,
    false,
    false,
    true,
    'TENANT_OVERRIDE',
    '["erp_lite_enabled"]'::jsonb,
    'First Period Start Date',
    'تاريخ بداية الفترة الأولى',
    'Initial accounting period start date in YYYY-MM-DD format',
    'تاريخ بداية الفترة المحاسبية الأولى بصيغة YYYY-MM-DD',
    'date-input',
    'ERP_LITE',
    2,
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration 0178 ERP-Lite Phase 1',
    1,
    true
  ),
  (
    'ERP_LITE_PERIOD_CLOSE_ENABLED',
    'ERP_LITE',
    'TENANT',
    'BOOLEAN',
    'false'::jsonb,
    NULL,
    true,
    false,
    false,
    false,
    true,
    'TENANT_OVERRIDE',
    '["erp_lite_enabled","erp_lite_gl_enabled"]'::jsonb,
    'Allow Period Close',
    'السماح بإغلاق الفترة',
    'Allow tenants to use accounting period close controls once GL is enabled',
    'السماح للمستأجر باستخدام ضوابط إغلاق الفترة المحاسبية عند تفعيل دفتر الأستاذ',
    'toggle',
    'ERP_LITE',
    3,
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration 0178 ERP-Lite Phase 1',
    1,
    true
  )
ON CONFLICT (setting_code) DO UPDATE SET
  stng_category_code = EXCLUDED.stng_category_code,
  stng_scope = EXCLUDED.stng_scope,
  stng_data_type = EXCLUDED.stng_data_type,
  stng_default_value_jsonb = EXCLUDED.stng_default_value_jsonb,
  stng_validation_jsonb = EXCLUDED.stng_validation_jsonb,
  stng_is_overridable = EXCLUDED.stng_is_overridable,
  stng_depends_on_flags = EXCLUDED.stng_depends_on_flags,
  setting_name = EXCLUDED.setting_name,
  setting_name2 = EXCLUDED.setting_name2,
  setting_desc = EXCLUDED.setting_desc,
  setting_desc2 = EXCLUDED.setting_desc2,
  stng_ui_component = EXCLUDED.stng_ui_component,
  stng_ui_group = EXCLUDED.stng_ui_group,
  stng_display_order = EXCLUDED.stng_display_order,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_admin',
  updated_info = 'Migration 0178 ERP-Lite Phase 1';

-- ================================================================
-- GENERAL_MAIN_PROFILE values (mandatory for all settings)
-- Value mirrors each setting's default value for global fallback
-- ================================================================
INSERT INTO public.sys_stng_profile_values_dtl (
  id,
  stng_profile_code,
  stng_code,
  stng_value_jsonb,
  stng_override_reason,
  created_at,
  created_by,
  created_info,
  rec_status,
  is_active
) VALUES
  (
    gen_random_uuid(),
    'GENERAL_MAIN_PROFILE',
    'ERP_LITE_ENABLED',
    'true'::jsonb,
    'Global default value for all tenants',
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration 0178 ERP-Lite Phase 1',
    1,
    true
  ),
  (
    gen_random_uuid(),
    'GENERAL_MAIN_PROFILE',
    'ERP_LITE_FISCAL_YEAR_START',
    '1'::jsonb,
    'Global default value for all tenants',
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration 0178 ERP-Lite Phase 1',
    1,
    true
  ),
  (
    gen_random_uuid(),
    'GENERAL_MAIN_PROFILE',
    'ERP_LITE_FIRST_PERIOD_START',
    'null'::jsonb,
    'Global default value for all tenants',
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration 0178 ERP-Lite Phase 1',
    1,
    true
  ),
  (
    gen_random_uuid(),
    'GENERAL_MAIN_PROFILE',
    'ERP_LITE_PERIOD_CLOSE_ENABLED',
    'false'::jsonb,
    'Global default value for all tenants',
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration 0178 ERP-Lite Phase 1',
    1,
    true
  )
ON CONFLICT (stng_profile_code, stng_code) DO UPDATE SET
  stng_value_jsonb = EXCLUDED.stng_value_jsonb,
  stng_override_reason = EXCLUDED.stng_override_reason,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_admin';

COMMIT;
