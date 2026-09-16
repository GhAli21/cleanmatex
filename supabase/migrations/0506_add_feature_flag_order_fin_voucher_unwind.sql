-- =============================================================================
-- 0506_add_feature_flag_order_fin_voucher_unwind.sql
-- Add Feature Flag — order_fin_voucher_unwind
-- =============================================================================
-- Purpose     : Gates B13 operational unwind on voucher reverse. When ON,
--               ORDER_PAYMENT reversal lines drive B10 VOID/REVERSE (and a
--               compensating drawer OUT for cash-family legs). When OFF,
--               reverse stays document-only (pre-B13 paperwork behaviour).
-- Governance  : beta
-- Data Type   : boolean
-- Plan Binding: independent
--
-- Created     : 2026-09-17
-- Created by  : system_admin
-- Migration   : 0506_add_feature_flag_order_fin_voucher_unwind.sql
--
-- Components:
--   [X] Flag Definition (hq_ff_feature_flags_mst)
--   [ ] Plan Mappings (sys_ff_pln_flag_mappings_dtl) — N/A (independent)
--
-- SAFETY: data-only INSERT/UPSERT. Default FALSE — applying this migration
--         changes NO tenant's behaviour until HQ enables the flag.
--
-- Note: previously drafted as 0500; 0500–0505 were already taken
--       (0500_wf_preparing_in_stage_sequence through 0505_fin_jobs_outbox).
-- ================================================================

-- ================================================================
-- SECTION 1: VALIDATION (UPSERT-SAFE)
-- ================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM hq_ff_feature_flags_mst
    WHERE flag_key = 'order_fin_voucher_unwind'
  ) THEN
    RAISE NOTICE 'ℹ️  Flag already exists: order_fin_voucher_unwind — this migration will UPDATE it in place';
  END IF;

  RAISE NOTICE '✅ Prerequisites validated for: order_fin_voucher_unwind';
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
  'order_fin_voucher_unwind',
  'Voucher Reversal Operational Unwind',
  'فك آثار عكس السند',
  'When reversing a posted voucher, also unwind ORDER_PAYMENT legs (B10 VOID/REVERSE and a compensating cash-drawer OUT for cash). When OFF, voucher reverse stays document-only.',
  'عند عكس سند مرحّل يُفك أيضاً بنود دفع الطلب (إلغاء/عكس B10 وحركة صرف نقدي تعويضية للنقد). عند الإيقاف يبقى عكس السند مستندياً فقط.',
  'beta', false, false, false,
  NULL, '[]'::jsonb, 'boolean', 'false'::jsonb,
  'independent', '[]'::jsonb,
  true, false,
  'Billing Features', 14,
  CURRENT_TIMESTAMP, 'system_admin', 'Migration: 0506_add_feature_flag_order_fin_voucher_unwind.sql', 1, true
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
  updated_info               = 'Migration: 0506_add_feature_flag_order_fin_voucher_unwind.sql';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM hq_ff_feature_flags_mst WHERE flag_key = 'order_fin_voucher_unwind'
  ) THEN
    RAISE EXCEPTION 'Failed to insert feature flag: order_fin_voucher_unwind';
  END IF;
  RAISE NOTICE '✅ Flag definition verified: order_fin_voucher_unwind';
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
    SELECT 1 FROM hq_ff_feature_flags_mst WHERE flag_key = 'order_fin_voucher_unwind'
  ) INTO v_flag_exists;

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION COMPLETED: order_fin_voucher_unwind';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '  Flag Definition : %', CASE WHEN v_flag_exists THEN 'YES' ELSE 'MISSING ❌' END;
  RAISE NOTICE '  Default         : FALSE — no tenant behaviour change until HQ enables';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next Steps:';
  RAISE NOTICE '  1. User applies this migration locally and remotely';
  RAISE NOTICE '  2. FLAG_CATALOG already contains this key (synced in the same change)';
  RAISE NOTICE '  3. Enable per tenant from HQ after Preview QA of B13';
  RAISE NOTICE '════════════════════════════════════════════════════════';

  IF NOT v_flag_exists THEN
    RAISE EXCEPTION 'Migration failed: flag definition missing';
  END IF;
END $$;

-- ================================================================
-- SECTION 5: ROLLBACK (manual reference only — do NOT execute)
-- ================================================================

/*
DELETE FROM hq_ff_feature_flags_mst WHERE flag_key = 'order_fin_voucher_unwind';
SELECT COUNT(*) FROM hq_ff_feature_flags_mst WHERE flag_key = 'order_fin_voucher_unwind'; -- Expected: 0
*/

-- ================================================================
-- END OF MIGRATION
-- ================================================================
