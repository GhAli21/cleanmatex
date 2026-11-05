-- ================================================================
-- Migration: Add Feature Flag — human_codes_scan_labels
-- ================================================================
-- Purpose     : Gate scanning of printed human-friendly codes on labels
--               (orders/items) via camera/scanner to look up the record
-- Governance  : tenant_feature
-- Data Type   : boolean
-- Plan Binding: plan_bound
--
-- Created     : 2026-10-31
-- Created by  : system_admin
-- Migration   : 0684_add_feature_flag_human_codes_scan_labels.sql
--
-- Components:
--   [X] Flag Definition (hq_ff_feature_flags_mst)
--   [X] Plan Mappings (sys_ff_pln_flag_mappings_dtl)
-- ================================================================

-- ================================================================
-- SECTION 1: VALIDATION (UPSERT-SAFE)
-- ================================================================

DO $$
BEGIN
  -- Informational only: flag may already exist — Section 2 UPSERTs, it does not skip.
  IF EXISTS (
    SELECT 1 FROM hq_ff_feature_flags_mst
    WHERE flag_key = 'human_codes_scan_labels'
  ) THEN
    RAISE NOTICE 'Flag already exists: human_codes_scan_labels — this migration will UPDATE it in place';
  END IF;

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

  RAISE NOTICE 'Prerequisites validated for: human_codes_scan_labels';
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
  'human_codes_scan_labels',
  'Scan Human-Friendly Code Labels',
  'مسح ملصقات الرموز سهلة القراءة',
  'Allows staff to scan a printed human-friendly code label (order/item) via camera or scanner to look up the record',
  'يسمح للموظفين بمسح ملصق يحمل رمزًا سهل القراءة (طلب/قطعة) عبر الكاميرا أو الماسح للوصول إلى السجل',

  -- Governance
  'tenant_feature',
  false,
  false,
  false,

  -- Validation
  NULL,
  '[]'::jsonb,

  -- Data
  'boolean',
  'false'::jsonb,

  -- Plan integration
  'plan_bound',
  '["FREE_TRIAL","STARTER","GROWTH","PRO","ENTERPRISE"]'::jsonb,

  -- Override control
  true,
  false,

  -- UI
  'Order Processing',
  20,

  -- Audit
  CURRENT_TIMESTAMP,
  'system_admin',
  'Migration: 0684_add_feature_flag_human_codes_scan_labels.sql',
  1,
  true
)
ON CONFLICT (flag_key) DO UPDATE SET
  -- Content columns are refreshed on every run (upsert). created_at/created_by/created_info,
  -- rec_status, and is_active are intentionally NOT overwritten — this preserves the original
  -- creation audit trail and any soft-delete/reactivation state set later via the HQ admin console.
  flag_name                  = EXCLUDED.flag_name,
  flag_name2                 = EXCLUDED.flag_name2,
  flag_description           = EXCLUDED.flag_description,
  flag_description2          = EXCLUDED.flag_description2,
  governance_category        = EXCLUDED.governance_category,
  is_billable                = EXCLUDED.is_billable,
  is_kill_switch              = EXCLUDED.is_kill_switch,
  is_sensitive                = EXCLUDED.is_sensitive,
  allowed_values              = EXCLUDED.allowed_values,
  validation_rules            = EXCLUDED.validation_rules,
  data_type                   = EXCLUDED.data_type,
  default_value               = EXCLUDED.default_value,
  plan_binding_type           = EXCLUDED.plan_binding_type,
  enabled_plan_codes          = EXCLUDED.enabled_plan_codes,
  allows_tenant_override      = EXCLUDED.allows_tenant_override,
  override_requires_approval  = EXCLUDED.override_requires_approval,
  ui_group                    = EXCLUDED.ui_group,
  ui_display_order            = EXCLUDED.ui_display_order,
  updated_at                  = CURRENT_TIMESTAMP,
  updated_by                  = 'system_admin',
  updated_info                = 'Migration: 0684_add_feature_flag_human_codes_scan_labels.sql';
-- Upsert: creates the flag on first run, updates it in place on any re-run or later migration
-- that targets the same flag_key.

-- Verify insertion
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM hq_ff_feature_flags_mst WHERE flag_key = 'human_codes_scan_labels'
  ) THEN
    RAISE EXCEPTION 'Failed to insert feature flag: human_codes_scan_labels';
  END IF;
  RAISE NOTICE 'Flag definition verified: human_codes_scan_labels';
END $$;

-- ================================================================
-- SECTION 3: PLAN MAPPINGS (plan_binding_type = plan_bound)
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
  (gen_random_uuid(), 'FREE_TRIAL',    'human_codes_scan_labels', 'true'::jsonb,  true,  'Enabled by default',        CURRENT_TIMESTAMP, 'system_admin', 'Migration: 0684_add_feature_flag_human_codes_scan_labels.sql', 1, true),
  (gen_random_uuid(), 'STARTER',    'human_codes_scan_labels', 'true'::jsonb,  true,  'Enabled by default',        CURRENT_TIMESTAMP, 'system_admin', 'Migration: 0684_add_feature_flag_human_codes_scan_labels.sql', 1, true),
  (gen_random_uuid(), 'GROWTH',     'human_codes_scan_labels', 'true'::jsonb,  true,  'Enabled by default',        CURRENT_TIMESTAMP, 'system_admin', 'Migration: 0684_add_feature_flag_human_codes_scan_labels.sql', 1, true),
  (gen_random_uuid(), 'PRO',        'human_codes_scan_labels', 'true'::jsonb,  true,  'Enabled by default',        CURRENT_TIMESTAMP, 'system_admin', 'Migration: 0684_add_feature_flag_human_codes_scan_labels.sql', 1, true),
  (gen_random_uuid(), 'ENTERPRISE', 'human_codes_scan_labels', 'true'::jsonb,  true,  'Enabled by default',        CURRENT_TIMESTAMP, 'system_admin', 'Migration: 0684_add_feature_flag_human_codes_scan_labels.sql', 1, true)
ON CONFLICT (plan_code, flag_key) DO UPDATE SET
  plan_specific_value = EXCLUDED.plan_specific_value,
  is_enabled          = EXCLUDED.is_enabled,
  notes               = EXCLUDED.notes,
  updated_at          = CURRENT_TIMESTAMP,
  updated_by          = EXCLUDED.created_by,
  updated_info        = EXCLUDED.created_info;
-- Upsert: same pattern as the flag definition above — id/created_*/rec_status/is_active are
-- preserved on conflict, only the mapping's value/enablement/notes are refreshed.

DO $$
DECLARE v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM sys_ff_pln_flag_mappings_dtl WHERE flag_key = 'human_codes_scan_labels';
  RAISE NOTICE 'Plan mappings created: % rows', v_count;
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
    SELECT 1 FROM hq_ff_feature_flags_mst WHERE flag_key = 'human_codes_scan_labels'
  ) INTO v_flag_exists;

  SELECT COUNT(*) INTO v_mapping_count
  FROM sys_ff_pln_flag_mappings_dtl
  WHERE flag_key = 'human_codes_scan_labels';

  RAISE NOTICE '';
  RAISE NOTICE 'MIGRATION COMPLETED: human_codes_scan_labels';
  RAISE NOTICE '  Flag Definition : %', CASE WHEN v_flag_exists THEN 'YES' ELSE 'MISSING' END;
  RAISE NOTICE '  Plan Mappings   : % rows', v_mapping_count;
  RAISE NOTICE '';
  RAISE NOTICE 'Next Steps:';
  RAISE NOTICE '  1. User applies: supabase migration up (or reviews via remote MCP apply_migration)';
  RAISE NOTICE '  2. Verify on the REMOTE db (authoritative) — local Studio has unrepresentative data';
  RAISE NOTICE '  3. No Postgres type regeneration needed — data-only insert, not a schema change';
  RAISE NOTICE '  4. Sync web-admin/lib/constants/feature-flags.ts (FLAG_CATALOG) — REQUIRED';
  RAISE NOTICE '  5. Test flag resolution via hq_ff_get_effective_value()';

  IF NOT v_flag_exists THEN
    RAISE EXCEPTION 'Migration failed: flag definition missing';
  END IF;
END $$;

-- ================================================================
-- SECTION 5: ROLLBACK (manual reference only — do NOT execute)
-- ================================================================

/*
DELETE FROM sys_ff_pln_flag_mappings_dtl WHERE flag_key = 'human_codes_scan_labels';
DELETE FROM hq_ff_feature_flags_mst WHERE flag_key = 'human_codes_scan_labels';
SELECT COUNT(*) FROM hq_ff_feature_flags_mst WHERE flag_key = 'human_codes_scan_labels'; -- Expected: 0
*/

-- ================================================================
-- END OF MIGRATION
-- ================================================================
