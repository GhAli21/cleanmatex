-- ==================================================================
-- Migration: 0168_item_conditions_colors_feature_flag.sql
-- Purpose: Add feature flag item_conditions_colors_enabled for
--          Customer/Order/Item/Pieces Preferences (conditions, colors)
-- Part of: Customer/Order/Item/Pieces Preferences - Unified Plan
-- Do NOT apply - user runs migrations manually
-- ==================================================================

BEGIN;

-- ==================================================================
-- SECTION 1: Feature Flag (hq_ff_feature_flags_mst)
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
  ('item_conditions_colors_enabled', 'Item Conditions & Colors', 'حالات القطعة والألوان', 'Enable conditions (stains, damage) and colors at order/item/piece level', 'تفعيل الحالات والألوان على مستوى الطلب/الصنف/القطعة', 'tenant_feature', false, false, false, NULL, NULL, NULL, NULL, 'boolean', to_jsonb(true), '[]'::jsonb, 'plan_bound', '["STARTER","GROWTH","PRO","ENTERPRISE"]'::jsonb, true, false, 'Service Preferences', 14, NULL, NULL, true, 'system_seed', 'Migration 0168')
ON CONFLICT (flag_key) DO UPDATE SET
  flag_name = EXCLUDED.flag_name,
  flag_name2 = EXCLUDED.flag_name2,
  flag_description = EXCLUDED.flag_description,
  flag_description2 = EXCLUDED.flag_description2,
  default_value = EXCLUDED.default_value,
  enabled_plan_codes = EXCLUDED.enabled_plan_codes,
  ui_display_order = EXCLUDED.ui_display_order,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_seed',
  updated_info = 'Migration 0168 item conditions colors';

-- ==================================================================
-- SECTION 2: Plan Flag Mappings (sys_ff_pln_flag_mappings_dtl)
-- ==================================================================

INSERT INTO public.sys_ff_pln_flag_mappings_dtl (plan_code, flag_key, plan_specific_value, is_enabled, notes, created_by, created_info)
VALUES
  ('FREE_TRIAL', 'item_conditions_colors_enabled', NULL, true, NULL, 'system_seed', 'Migration 0168'),
  ('STARTER', 'item_conditions_colors_enabled', NULL, true, NULL, 'system_seed', 'Migration 0168'),
  ('GROWTH', 'item_conditions_colors_enabled', NULL, true, NULL, 'system_seed', 'Migration 0168'),
  ('PRO', 'item_conditions_colors_enabled', NULL, true, NULL, 'system_seed', 'Migration 0168'),
  ('ENTERPRISE', 'item_conditions_colors_enabled', NULL, true, NULL, 'system_seed', 'Migration 0168')
ON CONFLICT (plan_code, flag_key) DO NOTHING;

COMMIT;
