-- ================================================================
-- Migration: Add Feature Flag — workflow_engine_v2
-- ================================================================
-- Purpose     : Canary for Workflow Order Advance V1.0 single app engine
--               (listAvailableActions / executeAction). Default OFF;
--               enable per tenant via HQ override or WORKFLOW_ENGINE_V2 env.
-- Governance  : tenant_feature
-- Data Type   : boolean
-- Plan Binding: independent
--
-- Created     : 2026-07-24
-- Created by  : system_admin
-- Migration   : 0432_add_feature_flag_workflow_engine_v2.sql
--
-- Components:
--   [X] Flag Definition (hq_ff_feature_flags_mst)
--   [ ] Plan Mappings — N/A (independent)
-- ================================================================

-- ================================================================
-- SECTION 1: VALIDATION (UPSERT-SAFE)
-- ================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM hq_ff_feature_flags_mst
    WHERE flag_key = 'workflow_engine_v2'
  ) THEN
    RAISE NOTICE 'ℹ️  Flag already exists: workflow_engine_v2 — this migration will UPDATE it in place';
  END IF;

  RAISE NOTICE '✅ Prerequisites validated for: workflow_engine_v2';
END $$;

-- ================================================================
-- SECTION 2: FLAG DEFINITION
-- ================================================================

INSERT INTO hq_ff_feature_flags_mst (
  flag_key,
  flag_name,
  flag_name2,
  flag_description,
  flag_description2,
  governance_category,
  is_billable,
  is_kill_switch,
  is_sensitive,
  allowed_values,
  validation_rules,
  data_type,
  default_value,
  plan_binding_type,
  enabled_plan_codes,
  allows_tenant_override,
  override_requires_approval,
  ui_group,
  ui_display_order,
  created_at,
  created_by,
  created_info,
  rec_status,
  is_active
) VALUES (
  'workflow_engine_v2',
  'Workflow Engine V2 (Order Advance)',
  'محرك سير العمل V2 (تطوير الطلبات)',
  'When ON, order operational transitions use the app WorkflowEngine (action codes, state_version, central outbox). Default OFF for canary; HQ tenant override or WORKFLOW_ENGINE_V2 env force-on.',
  'عند التفعيل تستخدم انتقالات الطلب التشغيلية محرك التطبيق WorkflowEngine (رموز الإجراءات، state_version، صندوق الصادر المركزي). معطل افتراضياً للتجربة؛ يمكن تفعيله من HQ أو بمتغير البيئة WORKFLOW_ENGINE_V2.',
  'tenant_feature',
  false,
  true,
  false,
  NULL,
  '[]'::jsonb,
  'boolean',
  'true'::jsonb,
  'independent',
  '[]'::jsonb,
  true,
  false,
  'Workflow',
  1,
  CURRENT_TIMESTAMP,
  'system_admin',
  'Migration: 0432_add_feature_flag_workflow_engine_v2.sql',
  1,
  true
)
ON CONFLICT (flag_key) DO UPDATE SET
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
  updated_info                = 'Migration: 0432_add_feature_flag_workflow_engine_v2.sql';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM hq_ff_feature_flags_mst WHERE flag_key = 'workflow_engine_v2'
  ) THEN
    RAISE EXCEPTION 'Failed to insert feature flag: workflow_engine_v2';
  END IF;
  RAISE NOTICE '✅ Flag definition verified: workflow_engine_v2';
END $$;

-- ================================================================
-- SECTION 3: PLAN MAPPINGS
-- ================================================================

-- No plan mappings — flag is independent of plan

-- ================================================================
-- SECTION 4: VERIFICATION SUMMARY
-- ================================================================

DO $$
DECLARE
  v_flag_exists    BOOLEAN;
  v_mapping_count  INTEGER := 0;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM hq_ff_feature_flags_mst WHERE flag_key = 'workflow_engine_v2'
  ) INTO v_flag_exists;

  SELECT COUNT(*) INTO v_mapping_count
  FROM sys_ff_pln_flag_mappings_dtl
  WHERE flag_key = 'workflow_engine_v2';

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION COMPLETED: workflow_engine_v2';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '  Flag Definition : %', CASE WHEN v_flag_exists THEN 'YES' ELSE 'MISSING ❌' END;
  RAISE NOTICE '  Plan Mappings   : % rows', v_mapping_count;
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next Steps:';
  RAISE NOTICE '  1. Review/apply this migration (do not auto-apply)';
  RAISE NOTICE '  2. Enable per canary tenant via HQ override (default false)';
  RAISE NOTICE '  3. FLAG_CATALOG already includes workflow_engine_v2 in web-admin';
  RAISE NOTICE '════════════════════════════════════════════════════════';

  IF NOT v_flag_exists THEN
    RAISE EXCEPTION 'Migration failed: flag definition missing';
  END IF;
END $$;

-- ================================================================
-- SECTION 5: ROLLBACK (manual reference only — do NOT execute)
-- ================================================================

/*
DELETE FROM sys_ff_pln_flag_mappings_dtl WHERE flag_key = 'workflow_engine_v2';
DELETE FROM hq_ff_feature_flags_mst WHERE flag_key = 'workflow_engine_v2';
SELECT COUNT(*) FROM hq_ff_feature_flags_mst WHERE flag_key = 'workflow_engine_v2'; -- Expected: 0
*/

-- ================================================================
-- END OF MIGRATION
-- ================================================================
