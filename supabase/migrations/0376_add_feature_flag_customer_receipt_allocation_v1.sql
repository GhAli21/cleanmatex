-- ================================================================
-- Migration: Add Feature Flag — customer_receipt_allocation_v1
-- ================================================================
-- Purpose     : Gate customer receipt allocation preview, post, and
--               standalone account receipt operations (v1 release)
-- Governance  : tenant_feature
-- Data Type   : boolean
-- Plan Binding: plan_bound (GROWTH, PRO, ENTERPRISE enabled)
--
-- Created     : 2026-06-18
-- Created by  : system_admin
-- Migration   : 0376_add_feature_flag_customer_receipt_allocation_v1.sql
--
-- Components:
--   [X] Flag Definition    (hq_ff_feature_flags_mst)
--   [X] Plan Mappings      (sys_ff_pln_flag_mappings_dtl — 5 plans)
-- ================================================================

-- ================================================================
-- SECTION 1: VALIDATION (IDEMPOTENT)
-- ================================================================

DO $$
BEGIN
  -- Guard: skip if flag already exists
  IF EXISTS (
    SELECT 1 FROM hq_ff_feature_flags_mst
    WHERE flag_key = 'customer_receipt_allocation_v1'
  ) THEN
    RAISE NOTICE '⚠️  Flag already exists: customer_receipt_allocation_v1 — migration will skip';
    RETURN;
  END IF;

  -- Verify required plan codes exist
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

  RAISE NOTICE '✅ Prerequisites validated for: customer_receipt_allocation_v1';
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

  -- Validation columns (all NULL for boolean flag)
  allowed_values,
  min_value,
  max_value,
  json_schema,
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
  is_active,
  created_at,
  created_by,
  created_info,
  rec_status
) VALUES (
  -- Identity
  'customer_receipt_allocation_v1',
  'Customer Receipt Allocation',
  'تخصيص إيصال العميل',
  'Gates customer receipt allocation preview, post, and standalone account receipt operations. When enabled, tenants can use auto/manual allocation flows, preview allocation against open balances (AR, B2B, POC orders), confirm/post allocations, and post standalone account receipts.',
  'يتحكم في عمليات معاينة تخصيص إيصال العميل والترحيل وعمليات إيصال الحساب المستقلة. عند التفعيل، يمكن للمستأجرين استخدام تدفقات التخصيص التلقائي/اليدوي، معاينة التخصيص مقابل الأرصدة المفتوحة، تأكيد/ترحيل التخصيصات، وترحيل إيصالات الحساب المستقلة.',

  -- Governance
  'tenant_feature',
  false,   -- is_billable: not directly billed, gated by plan
  false,   -- is_kill_switch: HQ does not need global kill
  false,   -- is_sensitive: visible in tenant UI

  -- Validation (NULL — simple boolean flag)
  NULL,    -- allowed_values
  NULL,    -- min_value
  NULL,    -- max_value
  NULL,    -- json_schema
  '[]'::jsonb, -- validation_rules

  -- Data
  'boolean',
  'true'::jsonb,

  -- Plan integration
  'plan_bound',
  '["FREE_TRIAL","STARTER","GROWTH","PRO","ENTERPRISE"]'::jsonb,

  -- Override control
  true,    -- allows_tenant_override: HQ can grant to specific tenants
  false,   -- override_requires_approval: override is self-service

  -- UI
  'Finance',
  10,

  -- Audit
  true,
  CURRENT_TIMESTAMP,
  'system_admin',
  'Migration: 0376_add_feature_flag_customer_receipt_allocation_v1.sql',
  1
)
ON CONFLICT (flag_key) DO NOTHING; -- idempotent

-- Verify flag insertion
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM hq_ff_feature_flags_mst
    WHERE flag_key = 'customer_receipt_allocation_v1'
  ) THEN
    RAISE EXCEPTION 'Failed to insert feature flag: customer_receipt_allocation_v1';
  END IF;
  RAISE NOTICE '✅ Flag definition verified: customer_receipt_allocation_v1';
END $$;

-- ================================================================
-- SECTION 3: PLAN MAPPINGS
-- All plans → enabled (is_enabled = true, plan_specific_value = true)
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
  (
    gen_random_uuid(),
    'FREE_TRIAL',
    'customer_receipt_allocation_v1',
    'true'::jsonb,
    true,
    'Enabled by default',
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration: 0376_add_feature_flag_customer_receipt_allocation_v1.sql',
    1,
    true
  ),
  (
    gen_random_uuid(),
    'STARTER',
    'customer_receipt_allocation_v1',
    'true'::jsonb,
    true,
    'Enabled by default',
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration: 0376_add_feature_flag_customer_receipt_allocation_v1.sql',
    1,
    true
  ),
  (
    gen_random_uuid(),
    'GROWTH',
    'customer_receipt_allocation_v1',
    'true'::jsonb,
    true,
    'Enabled by default',
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration: 0376_add_feature_flag_customer_receipt_allocation_v1.sql',
    1,
    true
  ),
  (
    gen_random_uuid(),
    'PRO',
    'customer_receipt_allocation_v1',
    'true'::jsonb,
    true,
    'Enabled by default',
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration: 0376_add_feature_flag_customer_receipt_allocation_v1.sql',
    1,
    true
  ),
  (
    gen_random_uuid(),
    'ENTERPRISE',
    'customer_receipt_allocation_v1',
    'true'::jsonb,
    true,
    'Enabled by default',
    CURRENT_TIMESTAMP,
    'system_admin',
    'Migration: 0376_add_feature_flag_customer_receipt_allocation_v1.sql',
    1,
    true
  )
ON CONFLICT (plan_code, flag_key) DO NOTHING; -- idempotent

DO $$
DECLARE
  v_mapping_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_mapping_count
  FROM sys_ff_pln_flag_mappings_dtl
  WHERE flag_key = 'customer_receipt_allocation_v1';

  IF v_mapping_count = 0 THEN
    RAISE EXCEPTION 'Plan mappings not inserted for: customer_receipt_allocation_v1';
  END IF;
  RAISE NOTICE '✅ Plan mappings verified: % rows', v_mapping_count;
END $$;

-- ================================================================
-- SECTION 4: VERIFICATION SUMMARY
-- ================================================================

DO $$
DECLARE
  v_flag_exists   BOOLEAN;
  v_mapping_count INTEGER := 0;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM hq_ff_feature_flags_mst
    WHERE flag_key = 'customer_receipt_allocation_v1'
  ) INTO v_flag_exists;

  SELECT COUNT(*) INTO v_mapping_count
  FROM sys_ff_pln_flag_mappings_dtl
  WHERE flag_key = 'customer_receipt_allocation_v1';

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION COMPLETED: customer_receipt_allocation_v1';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '  Flag Definition : %', CASE WHEN v_flag_exists THEN 'YES' ELSE 'MISSING ❌' END;
  RAISE NOTICE '  Plan Mappings   : % / 5 plans', v_mapping_count;
  RAISE NOTICE '  Plans enabled   : ALL (FREE_TRIAL, STARTER, GROWTH, PRO, ENTERPRISE)';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next Steps:';
  RAISE NOTICE '  1. Apply:           supabase migration up';
  RAISE NOTICE '  2. Verify Studio:   http://localhost:54323';
  RAISE NOTICE '  3. Regen types:     npm run types:generate  (in platform-web)';
  RAISE NOTICE '  4. Test resolution: SELECT hq_ff_get_effective_value(''<tenant_org_id>'', ''customer_receipt_allocation_v1'')';
  RAISE NOTICE '  4.2. Test resolution 2: SELECT hq_ff_get_effective_value(''<tenant_org_id>'', ''customer_receipt_allocation_v1'')';
  RAISE NOTICE '════════════════════════════════════════════════════════';

  IF NOT v_flag_exists THEN
    RAISE EXCEPTION 'Migration failed: flag definition missing';
  END IF;
END $$;

-- ================================================================
-- SECTION 5: ROLLBACK (manual reference only — do NOT execute)
-- ================================================================

/*
-- Rollback instructions for customer_receipt_allocation_v1

-- 1. Remove plan mappings
DELETE FROM sys_ff_pln_flag_mappings_dtl
WHERE flag_key = 'customer_receipt_allocation_v1';

-- 2. Remove flag definition
DELETE FROM hq_ff_feature_flags_mst
WHERE flag_key = 'customer_receipt_allocation_v1';

-- Verify
SELECT COUNT(*) FROM hq_ff_feature_flags_mst
WHERE flag_key = 'customer_receipt_allocation_v1';
-- Expected: 0
*/

-- ================================================================
-- END OF MIGRATION
-- ================================================================
