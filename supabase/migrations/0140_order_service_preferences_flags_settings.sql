-- ==================================================================
-- Migration: 0140_order_service_preferences_flags_settings.sql
-- Purpose: Feature flags and tenant settings for Order Service Preferences
-- Created: 2026-03-12
-- Do NOT apply - user runs migrations manually
-- Dependencies: 0139_order_service_preferences_schema.sql
-- ==================================================================

BEGIN;

-- ==================================================================
-- SECTION 1: Feature Flags (hq_ff_feature_flags_mst)
-- ==================================================================

INSERT INTO public.hq_ff_feature_flags_mst (
  flag_key, flag_name, flag_name2, flag_description, flag_description2,
  governance_category, is_billable, is_kill_switch, is_sensitive,
  allowed_values, min_value, max_value, json_schema, data_type, default_value,
  validation_rules, plan_binding_type, enabled_plan_codes,
  allows_tenant_override, override_requires_approval,
  ui_group, ui_display_order, ui_icon, ui_color,
  is_active, created_by, created_info
) VALUES
  ('service_preferences_enabled', 'Service Preferences Enabled', 'تفضيلات الخدمة مفعل', 'Enable service preferences (starch, perfume, delicate, etc.)', 'تفعيل تفضيلات الخدمة', 'tenant_feature', false, false, false, NULL, NULL, NULL, NULL, 'boolean', to_jsonb(false), '[]'::jsonb, 'plan_bound', '["STARTER","GROWTH","PRO","ENTERPRISE"]'::jsonb, true, false, 'Service Preferences', 1, NULL, NULL, true, 'system_seed', 'Migration 0140'),
  ('packing_preferences_enabled', 'Packing Preferences Enabled', 'تفضيلات التغليف مفعل', 'Enable packing preferences (hang, fold, box)', 'تفعيل تفضيلات التغليف', 'tenant_feature', false, false, false, NULL, NULL, NULL, NULL, 'boolean', to_jsonb(false), '[]'::jsonb, 'plan_bound', '["STARTER","GROWTH","PRO","ENTERPRISE"]'::jsonb, true, false, 'Service Preferences', 2, NULL, NULL, true, 'system_seed', 'Migration 0140'),
  ('per_piece_packing', 'Per-Piece Packing', 'تغليف لكل قطعة', 'Allow packing preference per piece (Enterprise)', 'تفضيل تغليف لكل قطعة', 'tenant_feature', false, false, false, NULL, NULL, NULL, NULL, 'boolean', to_jsonb(false), '[]'::jsonb, 'plan_bound', '["ENTERPRISE"]'::jsonb, true, false, 'Service Preferences', 3, NULL, NULL, true, 'system_seed', 'Migration 0140'),
  ('per_piece_service_prefs', 'Per-Piece Service Prefs', 'تفضيلات خدمة لكل قطعة', 'Allow service preferences per piece (Enterprise)', 'تفضيلات خدمة لكل قطعة', 'tenant_feature', false, false, false, NULL, NULL, NULL, NULL, 'boolean', to_jsonb(false), '[]'::jsonb, 'plan_bound', '["ENTERPRISE"]'::jsonb, true, false, 'Service Preferences', 4, NULL, NULL, true, 'system_seed', 'Migration 0140'),
  ('customer_standing_prefs', 'Customer Standing Prefs', 'تفضيلات العميل الدائمة', 'Allow customer standing preferences', 'تفضيلات العميل الدائمة', 'tenant_feature', false, false, false, NULL, NULL, NULL, NULL, 'boolean', to_jsonb(false), '[]'::jsonb, 'plan_bound', '["STARTER","GROWTH","PRO","ENTERPRISE"]'::jsonb, true, false, 'Service Preferences', 5, NULL, NULL, true, 'system_seed', 'Migration 0140'),
  ('bundles_enabled', 'Preference Bundles Enabled', 'باقات التفضيلات مفعل', 'Enable Care Package bundles (Growth+)', 'تفعيل باقات العناية', 'tenant_feature', false, false, false, NULL, NULL, NULL, NULL, 'boolean', to_jsonb(false), '[]'::jsonb, 'plan_bound', '["GROWTH","PRO","ENTERPRISE"]'::jsonb, true, false, 'Service Preferences', 6, NULL, NULL, true, 'system_seed', 'Migration 0140'),
  ('smart_suggestions', 'Smart Suggestions', 'اقتراحات ذكية', 'Suggest preferences from history', 'اقتراحات من السجل', 'tenant_feature', false, false, false, NULL, NULL, NULL, NULL, 'boolean', to_jsonb(false), '[]'::jsonb, 'plan_bound', '["GROWTH","PRO","ENTERPRISE"]'::jsonb, true, false, 'Service Preferences', 7, NULL, NULL, true, 'system_seed', 'Migration 0140'),
  ('sla_adjustment', 'SLA Adjustment', 'تعديل SLA', 'Adjust ready-by based on preference turnaround', 'تعديل وقت الجاهزية حسب التفضيلات', 'tenant_feature', false, false, false, NULL, NULL, NULL, NULL, 'boolean', to_jsonb(false), '[]'::jsonb, 'plan_bound', '["STARTER","GROWTH","PRO","ENTERPRISE"]'::jsonb, true, false, 'Service Preferences', 8, NULL, NULL, true, 'system_seed', 'Migration 0140'),
  ('repeat_last_order', 'Repeat Last Order', 'تكرار آخر طلب', 'Repeat preferences from last order', 'تكرار تفضيلات آخر طلب', 'tenant_feature', false, false, false, NULL, NULL, NULL, NULL, 'boolean', to_jsonb(false), '[]'::jsonb, 'plan_bound', '["STARTER","GROWTH","PRO","ENTERPRISE"]'::jsonb, true, false, 'Service Preferences', 9, NULL, NULL, true, 'system_seed', 'Migration 0140'),
  ('processing_confirmation', 'Processing Confirmation', 'تأكيد المعالجة', 'Require processing confirmation per pref (Enterprise)', 'تأكيد المعالجة لكل تفضيل', 'tenant_feature', false, false, false, NULL, NULL, NULL, NULL, 'boolean', to_jsonb(false), '[]'::jsonb, 'plan_bound', '["ENTERPRISE"]'::jsonb, true, false, 'Service Preferences', 10, NULL, NULL, true, 'system_seed', 'Migration 0140'),
  ('max_service_prefs_per_item', 'Max Service Prefs Per Item', 'الحد الأقصى للتفضيلات لكل صنف', 'Max service preferences per order item (-1=unlimited)', 'الحد الأقصى للتفضيلات لكل صنف', 'tenant_limit', false, false, false, NULL, -1, 100, NULL, 'integer', to_jsonb(10), '[]'::jsonb, 'plan_bound', '[]'::jsonb, true, false, 'Service Preferences', 11, NULL, NULL, true, 'system_seed', 'Migration 0140'),
  ('max_service_prefs_per_piece', 'Max Service Prefs Per Piece', 'الحد الأقصى للتفضيلات لكل قطعة', 'Max service preferences per piece (Enterprise)', 'الحد الأقصى للتفضيلات لكل قطعة', 'tenant_limit', false, false, false, NULL, -1, 100, NULL, 'integer', to_jsonb(5), '[]'::jsonb, 'plan_bound', '[]'::jsonb, true, false, 'Service Preferences', 12, NULL, NULL, true, 'system_seed', 'Migration 0140'),
  ('max_bundles', 'Max Bundles', 'الحد الأقصى للباقات', 'Max preference bundles per tenant', 'الحد الأقصى للباقات', 'tenant_limit', false, false, false, NULL, 0, 100, NULL, 'integer', to_jsonb(5), '[]'::jsonb, 'plan_bound', '[]'::jsonb, true, false, 'Service Preferences', 13, NULL, NULL, true, 'system_seed', 'Migration 0140')
ON CONFLICT (flag_key) DO UPDATE SET
  flag_name = EXCLUDED.flag_name,
  flag_name2 = EXCLUDED.flag_name2,
  flag_description = EXCLUDED.flag_description,
  flag_description2 = EXCLUDED.flag_description2,
  enabled_plan_codes = EXCLUDED.enabled_plan_codes,
  ui_display_order = EXCLUDED.ui_display_order,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_seed',
  updated_info = 'Migration 0140 order service preferences';

-- ==================================================================
-- SECTION 2: Plan Flag Mappings (sys_ff_pln_flag_mappings_dtl)
-- ==================================================================

INSERT INTO public.sys_ff_pln_flag_mappings_dtl (plan_code, flag_key, plan_specific_value, is_enabled, notes, created_by, created_info)
VALUES
  ('FREE_TRIAL', 'service_preferences_enabled', to_jsonb(3), true, 'max 3 prefs per item', 'system_seed', 'Migration 0140'),
  ('STARTER', 'service_preferences_enabled', to_jsonb(6), true, 'max 6 prefs per item', 'system_seed', 'Migration 0140'),
  ('GROWTH', 'service_preferences_enabled', to_jsonb(10), true, 'max 10 prefs per item', 'system_seed', 'Migration 0140'),
  ('PRO', 'service_preferences_enabled', to_jsonb(10), true, 'max 10 prefs per item', 'system_seed', 'Migration 0140'),
  ('ENTERPRISE', 'service_preferences_enabled', to_jsonb(-1), true, 'unlimited', 'system_seed', 'Migration 0140'),
  ('FREE_TRIAL', 'packing_preferences_enabled', NULL, true, NULL, 'system_seed', 'Migration 0140'),
  ('STARTER', 'packing_preferences_enabled', NULL, true, NULL, 'system_seed', 'Migration 0140'),
  ('GROWTH', 'packing_preferences_enabled', NULL, true, NULL, 'system_seed', 'Migration 0140'),
  ('PRO', 'packing_preferences_enabled', NULL, true, NULL, 'system_seed', 'Migration 0140'),
  ('ENTERPRISE', 'packing_preferences_enabled', NULL, true, NULL, 'system_seed', 'Migration 0140'),
  ('ENTERPRISE', 'per_piece_packing', NULL, true, NULL, 'system_seed', 'Migration 0140'),
  ('ENTERPRISE', 'per_piece_service_prefs', NULL, true, NULL, 'system_seed', 'Migration 0140'),
  ('STARTER', 'customer_standing_prefs', NULL, true, NULL, 'system_seed', 'Migration 0140'),
  ('GROWTH', 'customer_standing_prefs', NULL, true, NULL, 'system_seed', 'Migration 0140'),
  ('PRO', 'customer_standing_prefs', NULL, true, NULL, 'system_seed', 'Migration 0140'),
  ('ENTERPRISE', 'customer_standing_prefs', NULL, true, NULL, 'system_seed', 'Migration 0140'),
  ('GROWTH', 'bundles_enabled', to_jsonb(5), true, 'max 5 bundles', 'system_seed', 'Migration 0140'),
  ('PRO', 'bundles_enabled', to_jsonb(5), true, 'max 5 bundles', 'system_seed', 'Migration 0140'),
  ('ENTERPRISE', 'bundles_enabled', to_jsonb(-1), true, 'unlimited', 'system_seed', 'Migration 0140'),
  ('STARTER', 'repeat_last_order', NULL, true, NULL, 'system_seed', 'Migration 0140'),
  ('GROWTH', 'repeat_last_order', NULL, true, NULL, 'system_seed', 'Migration 0140'),
  ('PRO', 'repeat_last_order', NULL, true, NULL, 'system_seed', 'Migration 0140'),
  ('ENTERPRISE', 'repeat_last_order', NULL, true, NULL, 'system_seed', 'Migration 0140'),
  ('STARTER', 'sla_adjustment', NULL, true, NULL, 'system_seed', 'Migration 0140'),
  ('GROWTH', 'sla_adjustment', NULL, true, NULL, 'system_seed', 'Migration 0140'),
  ('PRO', 'sla_adjustment', NULL, true, NULL, 'system_seed', 'Migration 0140'),
  ('ENTERPRISE', 'sla_adjustment', NULL, true, NULL, 'system_seed', 'Migration 0140')
ON CONFLICT (plan_code, flag_key) DO UPDATE SET
  plan_specific_value = EXCLUDED.plan_specific_value,
  is_enabled = EXCLUDED.is_enabled,
  notes = EXCLUDED.notes;

-- ==================================================================
-- SECTION 3: Tenant Settings (sys_tenant_settings_cd)
-- ==================================================================

INSERT INTO sys_tenant_settings_cd (
  setting_code, stng_category_code, stng_scope, stng_data_type,
  stng_default_value_jsonb, stng_validation_jsonb,
  stng_is_overridable, stng_is_sensitive, stng_requires_restart,
  stng_is_required, stng_allows_null, stng_required_min_layer,
  stng_depends_on_flags,
  setting_name, setting_name2, setting_desc, setting_desc2,
  stng_ui_component, stng_ui_group, stng_display_order,
  created_at, created_by, created_info, rec_status, is_active
) VALUES
  ('SERVICE_PREF_DEFAULT_PACKING', 'SERVICE_PREF', 'TENANT', 'TEXT', '"FOLD"'::jsonb, '{"enum":["HANG","FOLD","BOX","FOLD_TISSUE","GARMENT_BAG","VACUUM_SEAL","ROLL"]}'::jsonb, true, false, false, false, true, 'TENANT_OVERRIDE', NULL, 'Default Packing', 'التغليف الافتراضي', 'Default packing preference for new items', 'تفضيل التغليف الافتراضي', 'select', 'Service Preferences', 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0140', 1, true),
  ('SERVICE_PREF_SHOW_PRICE_ON_COUNTER', 'SERVICE_PREF', 'TENANT', 'BOOLEAN', 'true'::jsonb, NULL, true, false, false, false, true, 'TENANT_OVERRIDE', NULL, 'Show Price on Counter', 'عرض السعر على المنضدة', 'Show preference price on counter UI', 'عرض سعر التفضيل على المنضدة', 'toggle', 'Service Preferences', 2, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0140', 1, true),
  ('SERVICE_PREF_AUTO_APPLY_CUSTOMER_PREFS', 'SERVICE_PREF', 'TENANT', 'BOOLEAN', 'true'::jsonb, NULL, true, false, false, false, true, 'TENANT_OVERRIDE', NULL, 'Auto Apply Customer Prefs', 'تطبيق تفضيلات العميل تلقائياً', 'Auto-apply customer standing preferences', 'تطبيق تفضيلات العميل الدائمة تلقائياً', 'toggle', 'Service Preferences', 3, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0140', 1, true),
  ('SERVICE_PREF_ALLOW_NOTES', 'SERVICE_PREF', 'TENANT', 'BOOLEAN', 'true'::jsonb, NULL, true, false, false, false, true, 'TENANT_OVERRIDE', NULL, 'Allow Notes', 'السماح بالملاحظات', 'Allow notes on preferences', 'السماح بالملاحظات على التفضيلات', 'toggle', 'Service Preferences', 4, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0140', 1, true),
  ('SERVICE_PREF_ENFORCE_COMPATIBILITY', 'SERVICE_PREF', 'TENANT', 'BOOLEAN', 'false'::jsonb, NULL, true, false, false, false, true, 'TENANT_OVERRIDE', NULL, 'Enforce Compatibility', 'فرض التوافق', 'Block incompatible prefs (true) or warn only (false)', 'منع التفضيلات غير المتوافقة أو التحذير فقط', 'toggle', 'Service Preferences', 5, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0140', 1, true),
  ('SERVICE_PREF_REQUIRE_CONFIRMATION', 'SERVICE_PREF', 'TENANT', 'BOOLEAN', 'false'::jsonb, NULL, true, false, false, false, true, 'TENANT_OVERRIDE', NULL, 'Require Confirmation', 'يتطلب التأكيد', 'Require confirmation for incompatible prefs', 'يتطلب التأكيد للتفضيلات غير المتوافقة', 'toggle', 'Service Preferences', 6, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0140', 1, true),
  ('SERVICE_PREF_PACKING_PER_PIECE_ENABLED', 'SERVICE_PREF', 'TENANT', 'BOOLEAN', 'false'::jsonb, NULL, true, false, false, false, true, 'TENANT_OVERRIDE', NULL, 'Packing Per Piece', 'تغليف لكل قطعة', 'Allow packing preference per piece', 'السماح بتفضيل التغليف لكل قطعة', 'toggle', 'Service Preferences', 7, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0140', 1, true),
  ('SERVICE_PREF_BUNDLES_SHOW_SAVINGS', 'SERVICE_PREF', 'TENANT', 'BOOLEAN', 'true'::jsonb, NULL, true, false, false, false, true, 'TENANT_OVERRIDE', NULL, 'Show Bundle Savings', 'عرض توفير الباقات', 'Show savings when applying bundles', 'عرض التوفير عند تطبيق الباقات', 'toggle', 'Service Preferences', 8, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0140', 1, true)
ON CONFLICT (setting_code) DO UPDATE SET
  stng_category_code = EXCLUDED.stng_category_code,
  stng_default_value_jsonb = EXCLUDED.stng_default_value_jsonb,
  setting_name = EXCLUDED.setting_name,
  setting_name2 = EXCLUDED.setting_name2,
  stng_display_order = EXCLUDED.stng_display_order,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_admin';

COMMIT;
