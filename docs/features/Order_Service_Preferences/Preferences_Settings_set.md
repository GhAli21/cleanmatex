Services Preferences Settings:
Here are the set of new settings:
- CATEGORY CODE: SERVICE_PREF
- PROFILE VALUES:
Profile 1:
    - Profile Code:GENERAL_MAIN_PROFILE
    - Value:same default value of the setting cd
    - Reason:To be inherited to the remaining profiles

- The settings data set:
(
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

(setting_code, stng_category_code, stng_scope, stng_data_type,
  stng_default_value_jsonb, stng_validation_jsonb,
  stng_is_overridable, stng_is_sensitive, stng_requires_restart,
  stng_is_required, stng_allows_null, stng_required_min_layer,
  stng_depends_on_flags,
  setting_name, setting_name2, setting_desc, setting_desc2,
  stng_ui_component, stng_ui_group, stng_display_order,
  created_at, created_by, created_info, rec_status, is_active
) 
VALUES
  ('SERVICE_PREF_DEFAULT_PACKING', 'SERVICE_PREF', 'TENANT', 'TEXT', '"FOLD"'::jsonb, '{"enum":["HANG","FOLD","BOX","FOLD_TISSUE","GARMENT_BAG","VACUUM_SEAL","ROLL"]}'::jsonb, true, false, false, false, true, 'TENANT_OVERRIDE', NULL, 'Default Packing', 'التغليف الافتراضي', 'Default packing preference for new items', 'تفضيل التغليف الافتراضي', 'select', 'Service Preferences', 1, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0140', 1, true),
  ('SERVICE_PREF_SHOW_PRICE_ON_COUNTER', 'SERVICE_PREF', 'TENANT', 'BOOLEAN', 'true'::jsonb, NULL, true, false, false, false, true, 'TENANT_OVERRIDE', NULL, 'Show Price on Counter', 'عرض السعر على المنضدة', 'Show preference price on counter UI', 'عرض سعر التفضيل على المنضدة', 'toggle', 'Service Preferences', 2, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0140', 1, true),
  ('SERVICE_PREF_AUTO_APPLY_CUSTOMER_PREFS', 'SERVICE_PREF', 'TENANT', 'BOOLEAN', 'true'::jsonb, NULL, true, false, false, false, true, 'TENANT_OVERRIDE', NULL, 'Auto Apply Customer Prefs', 'تطبيق تفضيلات العميل تلقائياً', 'Auto-apply customer standing preferences', 'تطبيق تفضيلات العميل الدائمة تلقائياً', 'toggle', 'Service Preferences', 3, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0140', 1, true),
  ('SERVICE_PREF_ALLOW_NOTES', 'SERVICE_PREF', 'TENANT', 'BOOLEAN', 'true'::jsonb, NULL, true, false, false, false, true, 'TENANT_OVERRIDE', NULL, 'Allow Notes', 'السماح بالملاحظات', 'Allow notes on preferences', 'السماح بالملاحظات على التفضيلات', 'toggle', 'Service Preferences', 4, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0140', 1, true),
  ('SERVICE_PREF_ENFORCE_COMPATIBILITY', 'SERVICE_PREF', 'TENANT', 'BOOLEAN', 'false'::jsonb, NULL, true, false, false, false, true, 'TENANT_OVERRIDE', NULL, 'Enforce Compatibility', 'فرض التوافق', 'Block incompatible prefs (true) or warn only (false)', 'منع التفضيلات غير المتوافقة أو التحذير فقط', 'toggle', 'Service Preferences', 5, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0140', 1, true),
  ('SERVICE_PREF_REQUIRE_CONFIRMATION', 'SERVICE_PREF', 'TENANT', 'BOOLEAN', 'false'::jsonb, NULL, true, false, false, false, true, 'TENANT_OVERRIDE', NULL, 'Require Confirmation', 'يتطلب التأكيد', 'Require confirmation for incompatible prefs', 'يتطلب التأكيد للتفضيلات غير المتوافقة', 'toggle', 'Service Preferences', 6, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0140', 1, true),
  ('SERVICE_PREF_PACKING_PER_PIECE_ENABLED', 'SERVICE_PREF', 'TENANT', 'BOOLEAN', 'true'::jsonb, NULL, true, false, false, false, true, 'TENANT_OVERRIDE', NULL, 'Packing Per Piece', 'تغليف لكل قطعة', 'Allow packing preference per piece', 'السماح بتفضيل التغليف لكل قطعة', 'toggle', 'Service Preferences', 7, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0140', 1, true),
  ('SERVICE_PREF_BUNDLES_SHOW_SAVINGS', 'SERVICE_PREF', 'TENANT', 'BOOLEAN', 'true'::jsonb, NULL, true, false, false, false, true, 'TENANT_OVERRIDE', NULL, 'Show Bundle Savings', 'عرض توفير الباقات', 'Show savings when applying bundles', 'عرض التوفير عند تطبيق الباقات', 'toggle', 'Service Preferences', 8, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0140', 1, true)
  