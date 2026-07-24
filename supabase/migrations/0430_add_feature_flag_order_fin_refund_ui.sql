-- ================================================================
-- Migration: Add Feature Flag — order_fin_refund_ui
-- ================================================================
-- Purpose     : Backfill migration for a flag already created via the HQ
--               admin UI on 2026-07-19. Gates the Order Fin refund UI
--               (B34) for the tenant under test; OFF confirms the hub
--               stays hidden. Values below mirror the live remote row
--               exactly (supabase_remote_db, verified 2026-07-24) so the
--               flag becomes reproducible via migration across
--               environments where it does not yet exist. On the remote
--               DB itself this migration is a no-op (ON CONFLICT DO
--               NOTHING — the row is already present).
-- Governance  : experimental
-- Data Type   : boolean
-- Plan Binding: independent
--
-- Created     : 2026-07-24
-- Created by  : system_admin
-- Migration   : 0430_add_feature_flag_order_fin_refund_ui.sql
--
-- Components:
--   [X] Flag Definition (hq_ff_feature_flags_mst)
--   [ ] Plan Mappings — N/A (independent)
-- ================================================================

-- ================================================================
-- SECTION 1: VALIDATION (IDEMPOTENT)
-- ================================================================

DO $$
BEGIN
  -- Guard: skip if flag already exists
  IF EXISTS (
    SELECT 1 FROM hq_ff_feature_flags_mst
    WHERE flag_key = 'order_fin_refund_ui'
  ) THEN
    RAISE NOTICE '⚠️  Flag already exists: order_fin_refund_ui — migration will skip';
    RETURN;
  END IF;

  RAISE NOTICE '✅ Prerequisites validated for: order_fin_refund_ui';
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
  'order_fin_refund_ui',
  'order_fin_refund_ui',
  'order_fin_refund_ui',
  'set **ON** for the tenant under test to exercise B34; leave OFF to confirm the hub stays hidden.',
  '',

  -- Governance
  'experimental',
  false,
  false,
  false,

  -- Validation
  NULL,
  '[]'::jsonb,

  -- Data
  'boolean',
  'true'::jsonb,

  -- Plan integration
  'independent',
  '[]'::jsonb,

  -- Override control
  true,
  false,

  -- UI
  NULL,
  0,

  -- Audit
  CURRENT_TIMESTAMP,
  'system_admin',
  'Migration: 0430_add_feature_flag_order_fin_refund_ui.sql',
  1,
  true
)
ON CONFLICT (flag_key) DO NOTHING; -- idempotent — row already exists on remote as of 2026-07-19

-- Verify insertion
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM hq_ff_feature_flags_mst WHERE flag_key = 'order_fin_refund_ui'
  ) THEN
    RAISE EXCEPTION 'Failed to insert feature flag: order_fin_refund_ui';
  END IF;
  RAISE NOTICE '✅ Flag definition verified: order_fin_refund_ui';
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
    SELECT 1 FROM hq_ff_feature_flags_mst WHERE flag_key = 'order_fin_refund_ui'
  ) INTO v_flag_exists;

  SELECT COUNT(*) INTO v_mapping_count
  FROM sys_ff_pln_flag_mappings_dtl
  WHERE flag_key = 'order_fin_refund_ui';

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION COMPLETED: order_fin_refund_ui';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '  Flag Definition : %', CASE WHEN v_flag_exists THEN 'YES' ELSE 'MISSING ❌' END;
  RAISE NOTICE '  Plan Mappings   : % rows', v_mapping_count;
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next Steps:';
  RAISE NOTICE '  1. User applies: supabase migration up (or reviews via remote MCP apply_migration)';
  RAISE NOTICE '  2. Verify on the REMOTE db (authoritative) — local Studio has unrepresentative data';
  RAISE NOTICE '  3. No Postgres type regeneration needed — data-only insert, not a schema change';
  RAISE NOTICE '  4. Sync web-admin/lib/constants/feature-flags.ts (FLAG_CATALOG) — see Step 5b, REQUIRED';
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
DELETE FROM sys_ff_pln_flag_mappings_dtl WHERE flag_key = 'order_fin_refund_ui';
DELETE FROM hq_ff_feature_flags_mst WHERE flag_key = 'order_fin_refund_ui';
SELECT COUNT(*) FROM hq_ff_feature_flags_mst WHERE flag_key = 'order_fin_refund_ui'; -- Expected: 0
*/

-- ================================================================
-- END OF MIGRATION
-- ================================================================
