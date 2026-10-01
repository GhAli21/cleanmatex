-- ================================================================
-- Migration: Add Feature Flag — multi_currency_fx
-- ================================================================
-- Purpose     : Gates the Tenant Currency & FX feature (stage 5A-3,
--               docs/features/Tenant_Currency_FX/implementation_plan_01.md
--               §7.3, Q5): multi-currency portfolio + rate book + screen
--               (5C). OFF by default for every plan until the screen (5C)
--               ships — the flag exists ahead of the UI so permissions and
--               plan gating are already wired when it does.
-- Governance  : tenant_feature
-- Data Type   : boolean
-- Plan Binding: plan_bound (top plans only — GROWTH, PRO, ENTERPRISE)
--
-- Created     : 2026-10-01
-- Created by  : system_admin
-- Migration   : 0539_add_feature_flag_multi_currency_fx.sql
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
    WHERE flag_key = 'multi_currency_fx'
  ) THEN
    RAISE NOTICE 'ℹ️  Flag already exists: multi_currency_fx — this migration will UPDATE it in place';
  END IF;

  IF (SELECT COUNT(*) FROM sys_pln_subscription_plans_mst WHERE plan_code IN ('GROWTH','PRO','ENTERPRISE')) < 3 THEN
    RAISE EXCEPTION 'Missing plan codes for multi_currency_fx mapping — expected GROWTH, PRO, ENTERPRISE';
  END IF;

  RAISE NOTICE '✅ Prerequisites validated for: multi_currency_fx';
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
  'multi_currency_fx',
  'Multi-Currency & FX',
  'العملات المتعددة وأسعار الصرف',
  'Enables the tenant currency portfolio (foreign currencies, contexts) and the tenant exchange-rate book/screen.',
  'يُفعّل محفظة عملات المستأجر (عملات أجنبية وسياقات استخدامها) وشاشة/دفتر أسعار الصرف الخاص بالمستأجر.',

  -- Governance
  'tenant_feature', true, false, false,

  -- Validation
  NULL, '[]'::jsonb,

  -- Data
  'boolean', 'false'::jsonb,

  -- Plan integration
  'plan_bound', '["GROWTH","PRO","ENTERPRISE"]'::jsonb,

  -- Override control
  true, false,

  -- UI
  'Finance', 20,

  -- Audit
  CURRENT_TIMESTAMP,
  'system_admin',
  'Migration: 0539_add_feature_flag_multi_currency_fx.sql',
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
  updated_info                = 'Migration: 0539_add_feature_flag_multi_currency_fx.sql';

-- Verify insertion
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM hq_ff_feature_flags_mst WHERE flag_key = 'multi_currency_fx'
  ) THEN
    RAISE EXCEPTION 'Failed to insert feature flag: multi_currency_fx';
  END IF;
  RAISE NOTICE '✅ Flag definition verified: multi_currency_fx';
END $$;

-- ================================================================
-- SECTION 3: PLAN MAPPINGS
-- ================================================================
-- "Top plans" (plan 01 §10 Q5): GROWTH, PRO, ENTERPRISE enabled by default
-- once 5C ships; FREE_TRIAL and STARTER are not mapped (not available).
-- All default_value/mapping rows stay OFF (false) until 5C (the tenant
-- Currencies/Rates screen) ships — the flag exists ahead of the UI so
-- permissions (0538) and this gating are already wired when it does.

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
  (gen_random_uuid(), 'GROWTH',     'multi_currency_fx', 'false'::jsonb, false, 'Available on this plan; stays off until the tenant Currencies screen (5C) ships', CURRENT_TIMESTAMP, 'system_admin', 'Migration: 0539_add_feature_flag_multi_currency_fx.sql', 1, true),
  (gen_random_uuid(), 'PRO',        'multi_currency_fx', 'false'::jsonb, false, 'Available on this plan; stays off until the tenant Currencies screen (5C) ships', CURRENT_TIMESTAMP, 'system_admin', 'Migration: 0539_add_feature_flag_multi_currency_fx.sql', 1, true),
  (gen_random_uuid(), 'ENTERPRISE', 'multi_currency_fx', 'false'::jsonb, false, 'Available on this plan; stays off until the tenant Currencies screen (5C) ships', CURRENT_TIMESTAMP, 'system_admin', 'Migration: 0539_add_feature_flag_multi_currency_fx.sql', 1, true)
ON CONFLICT (plan_code, flag_key) DO UPDATE SET
  plan_specific_value = EXCLUDED.plan_specific_value,
  is_enabled          = EXCLUDED.is_enabled,
  notes                = EXCLUDED.notes,
  updated_at           = CURRENT_TIMESTAMP,
  updated_by           = EXCLUDED.created_by,
  updated_info         = EXCLUDED.created_info;

DO $$
DECLARE v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count
  FROM sys_ff_pln_flag_mappings_dtl WHERE flag_key = 'multi_currency_fx';
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
    SELECT 1 FROM hq_ff_feature_flags_mst WHERE flag_key = 'multi_currency_fx'
  ) INTO v_flag_exists;

  SELECT COUNT(*) INTO v_mapping_count
  FROM sys_ff_pln_flag_mappings_dtl
  WHERE flag_key = 'multi_currency_fx';

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION COMPLETED: multi_currency_fx';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '  Flag Definition : %', CASE WHEN v_flag_exists THEN 'YES' ELSE 'MISSING ❌' END;
  RAISE NOTICE '  Plan Mappings   : % rows', v_mapping_count;
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next Steps:';
  RAISE NOTICE '  1. User applies: supabase migration up (or reviews via remote MCP apply_migration)';
  RAISE NOTICE '  2. Verify on the REMOTE db (authoritative) — local Studio has unrepresentative data';
  RAISE NOTICE '  3. No Postgres type regeneration needed — data-only insert, not a schema change';
  RAISE NOTICE '  4. Sync web-admin/lib/constants/feature-flags.ts (FLAG_CATALOG) — REQUIRED, see skill Step 5b';
  RAISE NOTICE '  5. Test flag resolution via hq_ff_get_effective_value()';
  RAISE NOTICE '════════════════════════════════════════════════════════';

  IF NOT v_flag_exists THEN
    RAISE EXCEPTION 'Migration failed: flag definition missing';
  END IF;
END $$;

-- ================================================================
-- SECTION 5: ROLLBACK (manual reference only — do NOT execute)
-- ================================================================

/*
DELETE FROM sys_ff_pln_flag_mappings_dtl WHERE flag_key = 'multi_currency_fx';
DELETE FROM hq_ff_feature_flags_mst WHERE flag_key = 'multi_currency_fx';
SELECT COUNT(*) FROM hq_ff_feature_flags_mst WHERE flag_key = 'multi_currency_fx'; -- Expected: 0
*/

-- ================================================================
-- END OF MIGRATION
-- ================================================================
