-- =============================================================================
-- 0512_add_feature_flag_order_fin_pref_charge_recalc.sql
-- Add Feature Flag — order_fin_pref_charge_recalc
-- =============================================================================
-- Purpose     : Gates the opt-in historical preference-charge recalc job that
--               voids leftover ITEM/PIECE PREFERENCE charges and rewrites the
--               order financial snapshot. Default FALSE — no tenant changes
--               until HQ enables the flag for a pilot tenant.
-- Governance  : experimental
-- Data Type   : boolean
-- Plan Binding: independent
--
-- Created     : 2026-09-19
-- Created by  : system_admin
-- Migration   : 0512_add_feature_flag_order_fin_pref_charge_recalc.sql
--
-- Components:
--   [X] Flag Definition (hq_ff_feature_flags_mst)
--   [ ] Plan Mappings (sys_ff_pln_flag_mappings_dtl) — N/A (independent)
--
-- SAFETY: data-only INSERT/UPSERT. Default FALSE. Do not apply from the agent.
-- ================================================================

-- ================================================================
-- SECTION 1: VALIDATION (UPSERT-SAFE)
-- ================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM hq_ff_feature_flags_mst
    WHERE flag_key = 'order_fin_pref_charge_recalc'
  ) THEN
    RAISE NOTICE 'ℹ️  Flag already exists: order_fin_pref_charge_recalc — this migration will UPDATE it in place';
  END IF;

  RAISE NOTICE '✅ Prerequisites validated for: order_fin_pref_charge_recalc';
END $$;

-- ================================================================
-- SECTION 2: FLAG DEFINITION
-- ================================================================

INSERT INTO hq_ff_feature_flags_mst (
  flag_key, flag_name, flag_name2, flag_description, flag_description2,
  governance_category, is_billable, is_kill_switch, is_sensitive,
  allowed_values, validation_rules, data_type, default_value,
  plan_binding_type, enabled_plan_codes,
  allows_tenant_override, override_requires_approval,
  ui_group, ui_display_order,
  created_at, created_by, created_info, rec_status, is_active
) VALUES (
  'order_fin_pref_charge_recalc',
  'Historical Preference Charge Recalc',
  'إعادة حساب رسوم التفضيل التاريخية',
  'When ON, owners may preview and confirm a tenant-scoped job that voids leftover ITEM/PIECE PREFERENCE charges and rewrites order totals. When OFF the job is a hard no-op. Never changes total_paid_amount and never auto-refunds.',
  'عند التفعيل يمكن للمالك معاينة وتأكيد مهمة على مستوى المستأجر تُلغي رسوم تفضيل الصنف/القطعة المتبقية وتعيد كتابة إجماليات الطلب. عند الإيقاف تكون المهمة بدون أثر. لا تغيّر المبلغ المدفوع ولا ترد تلقائياً.',
  'experimental', false, false, false,
  NULL, '[]'::jsonb, 'boolean', 'false'::jsonb,
  'independent', '[]'::jsonb,
  true, false,
  'Billing Features', 15,
  CURRENT_TIMESTAMP, 'system_admin', 'Migration: 0512_add_feature_flag_order_fin_pref_charge_recalc.sql', 1, true
)
ON CONFLICT (flag_key) DO UPDATE SET
  flag_name                  = EXCLUDED.flag_name,
  flag_name2                 = EXCLUDED.flag_name2,
  flag_description           = EXCLUDED.flag_description,
  flag_description2          = EXCLUDED.flag_description2,
  governance_category        = EXCLUDED.governance_category,
  is_billable                = EXCLUDED.is_billable,
  is_kill_switch             = EXCLUDED.is_kill_switch,
  is_sensitive               = EXCLUDED.is_sensitive,
  allowed_values             = EXCLUDED.allowed_values,
  validation_rules           = EXCLUDED.validation_rules,
  data_type                  = EXCLUDED.data_type,
  default_value              = EXCLUDED.default_value,
  plan_binding_type          = EXCLUDED.plan_binding_type,
  enabled_plan_codes         = EXCLUDED.enabled_plan_codes,
  allows_tenant_override     = EXCLUDED.allows_tenant_override,
  override_requires_approval = EXCLUDED.override_requires_approval,
  ui_group                   = EXCLUDED.ui_group,
  ui_display_order           = EXCLUDED.ui_display_order,
  updated_at                 = CURRENT_TIMESTAMP,
  updated_by                 = 'system_admin',
  updated_info               = 'Migration: 0512_add_feature_flag_order_fin_pref_charge_recalc.sql';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM hq_ff_feature_flags_mst WHERE flag_key = 'order_fin_pref_charge_recalc'
  ) THEN
    RAISE EXCEPTION 'Failed to insert feature flag: order_fin_pref_charge_recalc';
  END IF;
  RAISE NOTICE '✅ Flag definition verified: order_fin_pref_charge_recalc';
END $$;

-- ================================================================
-- SECTION 3: PLAN MAPPINGS
-- ================================================================

-- No plan mappings — independent.

-- ================================================================
-- SECTION 4: VERIFICATION SUMMARY
-- ================================================================

DO $$
DECLARE
  v_flag_exists BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM hq_ff_feature_flags_mst WHERE flag_key = 'order_fin_pref_charge_recalc'
  ) INTO v_flag_exists;

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION COMPLETED: order_fin_pref_charge_recalc';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '  Flag Definition : %', CASE WHEN v_flag_exists THEN 'YES' ELSE 'MISSING ❌' END;
  RAISE NOTICE '  Default         : FALSE — no tenant behaviour change until HQ enables';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next Steps:';
  RAISE NOTICE '  1. User applies this migration locally and remotely';
  RAISE NOTICE '  2. FLAG_CATALOG already contains this key (synced in the same change)';
  RAISE NOTICE '  3. Enable per tenant from HQ after Preview QA of the runbook';
  RAISE NOTICE '════════════════════════════════════════════════════════';

  IF NOT v_flag_exists THEN
    RAISE EXCEPTION 'Migration failed: flag definition missing';
  END IF;
END $$;

-- ================================================================
-- SECTION 5: ROLLBACK (manual reference only — do NOT execute)
-- ================================================================

/*
DELETE FROM hq_ff_feature_flags_mst WHERE flag_key = 'order_fin_pref_charge_recalc';
SELECT COUNT(*) FROM hq_ff_feature_flags_mst WHERE flag_key = 'order_fin_pref_charge_recalc'; -- Expected: 0
*/

-- ================================================================
-- END OF MIGRATION
-- ================================================================
