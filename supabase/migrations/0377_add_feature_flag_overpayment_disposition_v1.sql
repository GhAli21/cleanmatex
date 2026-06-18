-- ================================================================
-- Migration: Add Feature Flag — overpayment_disposition_v1
-- ================================================================
-- Purpose     : Gates disposition UI on order submit/collect when overpayment amount exists
-- Governance  : tenant_feature
-- Data Type   : boolean
-- Plan Binding: plan_bound
--
-- Created     : 2026-06-18
-- Created by  : system_admin
-- Migration   : 0377_add_feature_flag_overpayment_disposition_v1.sql
-- 
-- Components:
--   [X] Flag Definition (hq_ff_feature_flags_mst)
--   [X] Plan Mappings (sys_ff_pln_flag_mappings_dtl)
-- ================================================================

-- ================================================================
-- SECTION 1: VALIDATION (IDEMPOTENT)
-- ================================================================

DO $$
BEGIN
  -- Guard: skip if flag already exists
  IF EXISTS (
    SELECT 1 FROM hq_ff_feature_flags_mst
    WHERE flag_key = 'overpayment_disposition_v1'
  ) THEN
    RAISE NOTICE '⚠️  Flag already exists: overpayment_disposition_v1 — migration will skip';
    RETURN;
  END IF;

  -- Validate plan codes exist
  IF NOT EXISTS (SELECT 1 FROM sys_pln_subscription_plans_mst WHERE plan_code = 'FREE_TRIAL') THEN
    RAISE EXCEPTION 'Plan code FREE_TRIAL not found in sys_pln_subscription_plans_mst';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM sys_pln_subscription_plans_mst WHERE plan_code = 'STARTER') THEN
    RAISE EXCEPTION 'Plan code STARTER not found in sys_pln_subscription_plans_mst';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM sys_pln_subscription_plans_mst WHERE plan_code = 'GROWTH') THEN
    RAISE EXCEPTION 'Plan code GROWTH not found in sys_pln_subscription_plans_mst';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM sys_pln_subscription_plans_mst WHERE plan_code = 'PRO') THEN
    RAISE EXCEPTION 'Plan code PRO not found in sys_pln_subscription_plans_mst';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM sys_pln_subscription_plans_mst WHERE plan_code = 'ENTERPRISE') THEN
    RAISE EXCEPTION 'Plan code ENTERPRISE not found in sys_pln_subscription_plans_mst';
  END IF;

  RAISE NOTICE '✅ Prerequisites validated for: overpayment_disposition_v1';
END $$;

-- ================================================================
-- SECTION 2: FLAG DEFINITION
-- ================================================================

INSERT INTO hq_ff_feature_flags_mst (
  -- Identity
  flag_key,
  flag_name,
  flag_name2,
  flag_description,
  flag_description2,

  -- Governance
  governance_category,
  is_billable,
  is_kill_switch,
  is_sensitive,

  -- Validation
  allowed_values,
  validation_rules,

  -- Data
  data_type,
  default_value,

  -- Plan integration
  plan_binding_type,
  enabled_plan_codes,

  -- Override control
  allows_tenant_override,
  override_requires_approval,

  -- UI
  ui_group,
  ui_display_order,

  -- Audit
  created_at,
  created_by,
  created_info,
  rec_status,
  is_active
) VALUES (
  -- Identity
  'overpayment_disposition_v1',
  'Overpayment Disposition',
  'التصرف في الدفع الزائد',
  'Gates disposition UI on order submit/collect when overpayment amount exists',
  'يتحكم في واجهة التصرف في الدفع الزائد عند تقديم الطلب أو تحصيله في حال وجود مبلغ زائد',

  -- Governance
  'tenant_feature',
  false,
  false,
  false,

  -- Validation
  NULL,
  NULL,

  -- Data
  'boolean',
  'true'::jsonb,

  -- Plan integration
  'plan_bound',
  '["FREE_TRIAL","STARTER","GROWTH","PRO","ENTERPRISE"]'::jsonb,

  -- Override control
  true,
  false,

  -- UI
  'Order Processing',
  0,

  -- Audit
  CURRENT_TIMESTAMP,
  'system_admin',
  'Migration: 0377_add_feature_flag_overpayment_disposition_v1.sql',
  1,
  true
)
ON CONFLICT (flag_key) DO NOTHING; -- idempotent

-- Verify insertion
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM hq_ff_feature_flags_mst WHERE flag_key = 'overpayment_disposition_v1'
  ) THEN
    RAISE EXCEPTION 'Failed to insert feature flag: overpayment_disposition_v1';
  END IF;
  RAISE NOTICE '✅ Flag definition verified: overpayment_disposition_v1';
END $$;

-- ================================================================
-- SECTION 3: PLAN MAPPINGS
-- ================================================================

INSERT INTO sys_ff_pln_flag_mappings_dtl (
  id,
  plan_code,
  flag_key,
  plan_specific_value,
  is_enabled,
  notes,
  created_at,
  created_by,
  created_info,
  rec_status,
  is_active
) VALUES
  (gen_random_uuid(), 'FREE_TRIAL', 'overpayment_disposition_v1', 'true'::jsonb, true, 'Enabled By Default', CURRENT_TIMESTAMP, 'system_admin', 'Migration: 0377_add_feature_flag_overpayment_disposition_v1.sql', 1, true),
  (gen_random_uuid(), 'STARTER',    'overpayment_disposition_v1', 'true'::jsonb, true, 'Enabled By Default', CURRENT_TIMESTAMP, 'system_admin', 'Migration: 0377_add_feature_flag_overpayment_disposition_v1.sql', 1, true),
  (gen_random_uuid(), 'GROWTH',     'overpayment_disposition_v1', 'true'::jsonb, true, 'Enabled By Default', CURRENT_TIMESTAMP, 'system_admin', 'Migration: 0377_add_feature_flag_overpayment_disposition_v1.sql', 1, true),
  (gen_random_uuid(), 'PRO',        'overpayment_disposition_v1', 'true'::jsonb, true, 'Enabled By Default', CURRENT_TIMESTAMP, 'system_admin', 'Migration: 0377_add_feature_flag_overpayment_disposition_v1.sql', 1, true),
  (gen_random_uuid(), 'ENTERPRISE', 'overpayment_disposition_v1', 'true'::jsonb, true, 'Enabled By Default', CURRENT_TIMESTAMP, 'system_admin', 'Migration: 0377_add_feature_flag_overpayment_disposition_v1.sql', 1, true)
ON CONFLICT (plan_code, flag_key) DO NOTHING;

DO $$
DECLARE v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM sys_ff_pln_flag_mappings_dtl WHERE flag_key = 'overpayment_disposition_v1';
  RAISE NOTICE '✅ Plan mappings created: % rows', v_count;
END $$;

-- ================================================================
-- SECTION 4: VERIFICATION SUMMARY
-- ================================================================

DO $$
DECLARE
  v_flag_exists    BOOLEAN;
  v_mapping_count  INTEGER := 0;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM hq_ff_feature_flags_mst WHERE flag_key = 'overpayment_disposition_v1'
  ) INTO v_flag_exists;

  SELECT COUNT(*) INTO v_mapping_count
  FROM sys_ff_pln_flag_mappings_dtl
  WHERE flag_key = 'overpayment_disposition_v1';

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION COMPLETED: overpayment_disposition_v1';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '  Flag Definition : %', CASE WHEN v_flag_exists THEN 'YES' ELSE 'MISSING ❌' END;
  RAISE NOTICE '  Plan Mappings   : % rows', v_mapping_count;
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next Steps:';
  RAISE NOTICE '  1. User applies: supabase migration up';
  RAISE NOTICE '  2. Verify in Supabase Studio → http://localhost:54323';
  RAISE NOTICE '  3. No type regeneration needed — this migration only inserts data, not schema changes';
  RAISE NOTICE '  4. Test flag resolution via hq_ff_get_effective_value()';
  RAISE NOTICE '  4.2. Test All plans with flag resolution via hq_ff_get_plan_defaults()';
  RAISE NOTICE '════════════════════════════════════════════════════════';

  IF NOT v_flag_exists THEN
    RAISE EXCEPTION 'Migration failed: flag definition missing';
  END IF;
END $$;

-- ================================================================
-- SECTION 5: ROLLBACK REFERENCE
-- ================================================================
-- Rollback script is located at:
--   docs/Added_Feature_Flags_docs/Rollback_Scripts/0377_rollback_overpayment_disposition_v1.sql
-- ================================================================

-- ================================================================
-- END OF MIGRATION
-- ================================================================
