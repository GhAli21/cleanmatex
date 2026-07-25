-- ================================================================
-- Migration: B12 — Order Amendment lineage columns + governance flag
-- ================================================================
-- Purpose: extend the existing org_order_edit_history audit table (mig 0127)
-- with the two columns D011's governed-amendment model requires that it
-- doesn't already have — edit_reason and a settlement lineage pointer — and
-- register the order_fin_governed_amendments flag that gates the new
-- reason/idempotency/settlement requirements in OrderService.updateOrder.
--
-- Deliberately NOT a new table: org_order_edit_history already provides the
-- immutable before/after snapshot + actor + timestamp D011 calls for; see
-- B12's own doc (Design decisions #1) for the reuse rationale.
--
-- Components:
--   [X] org_order_edit_history: + edit_reason, + settlement_lineage
--   [X] Feature Flag Definition (hq_ff_feature_flags_mst)
--   [ ] Plan Mappings — N/A (independent)
--
-- Created: 2026-07-25
-- ================================================================

-- ================================================================
-- SECTION 1: org_order_edit_history — amendment lineage columns
-- ================================================================

ALTER TABLE org_order_edit_history
  ADD COLUMN IF NOT EXISTS edit_reason TEXT;

COMMENT ON COLUMN org_order_edit_history.edit_reason IS
  'B12/D011: operator-entered reason, required when the edit is financially governed (item change on an order with prior payments). NULL for non-financial or unpaid-order edits.';

ALTER TABLE org_order_edit_history
  ADD COLUMN IF NOT EXISTS settlement_lineage JSONB;

COMMENT ON COLUMN org_order_edit_history.settlement_lineage IS
  'B12/D011: lineage back to the real settlement fact(s) this edit produced — {"paymentId"?: string, "dispositionIds"?: string[]}. Populated only when payment_adjusted = true.';

-- ================================================================
-- SECTION 2: FLAG DEFINITION (UPSERT-SAFE)
-- ================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM hq_ff_feature_flags_mst
    WHERE flag_key = 'order_fin_governed_amendments'
  ) THEN
    RAISE NOTICE 'ℹ️  Flag already exists: order_fin_governed_amendments — this migration will UPDATE it in place';
  END IF;
  RAISE NOTICE '✅ Prerequisites validated for: order_fin_governed_amendments';
END $$;

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
  'order_fin_governed_amendments',
  'Governed Order Amendments',
  'تعديلات الطلب الخاضعة للحوكمة',
  'Requires a reason and routes the financial delta through a real collect-additional or overpayment-resolution step when editing items on an order that already has payments recorded. When off, item edits reprice as before with no reason/settlement requirement.',
  'يتطلب سببًا ويوجّه الفرق المالي عبر خطوة تحصيل إضافي أو تسوية دفع زائد حقيقية عند تعديل عناصر طلب له مدفوعات مسجلة بالفعل. عند التعطيل، يعاد تسعير تعديلات العناصر كما كان دون طلب سبب أو تسوية.',
  'experimental',
  false,
  false,
  false,
  NULL,
  '[]'::jsonb,
  'boolean',
  'false'::jsonb,
  'independent',
  '[]'::jsonb,
  true,
  false,
  'Billing Features',
  13,
  CURRENT_TIMESTAMP,
  'system_admin',
  'Migration: 0438_b12_order_amendment_lineage_and_flag.sql',
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
  updated_info                = 'Migration: 0438_b12_order_amendment_lineage_and_flag.sql';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM hq_ff_feature_flags_mst WHERE flag_key = 'order_fin_governed_amendments'
  ) THEN
    RAISE EXCEPTION 'Failed to insert feature flag: order_fin_governed_amendments';
  END IF;
  RAISE NOTICE '✅ Flag definition verified: order_fin_governed_amendments';
END $$;

-- ================================================================
-- SECTION 3: VERIFICATION SUMMARY
-- ================================================================

DO $$
DECLARE
  v_flag_exists      BOOLEAN;
  v_reason_col       BOOLEAN;
  v_lineage_col      BOOLEAN;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM hq_ff_feature_flags_mst WHERE flag_key = 'order_fin_governed_amendments'
  ) INTO v_flag_exists;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'org_order_edit_history' AND column_name = 'edit_reason'
  ) INTO v_reason_col;

  SELECT EXISTS(
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'org_order_edit_history' AND column_name = 'settlement_lineage'
  ) INTO v_lineage_col;

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION COMPLETED: 0438_b12_order_amendment_lineage_and_flag';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '  Flag Definition          : %', CASE WHEN v_flag_exists THEN 'YES' ELSE 'MISSING ❌' END;
  RAISE NOTICE '  edit_reason column       : %', CASE WHEN v_reason_col THEN 'YES' ELSE 'MISSING ❌' END;
  RAISE NOTICE '  settlement_lineage column: %', CASE WHEN v_lineage_col THEN 'YES' ELSE 'MISSING ❌' END;
  RAISE NOTICE '════════════════════════════════════════════════════════';

  IF NOT (v_flag_exists AND v_reason_col AND v_lineage_col) THEN
    RAISE EXCEPTION 'Migration failed: one or more expected objects are missing';
  END IF;
END $$;

-- ================================================================
-- SECTION 4: ROLLBACK (manual reference only — do NOT execute)
-- ================================================================

/*
DELETE FROM hq_ff_feature_flags_mst WHERE flag_key = 'order_fin_governed_amendments';
ALTER TABLE org_order_edit_history DROP COLUMN IF EXISTS settlement_lineage;
ALTER TABLE org_order_edit_history DROP COLUMN IF EXISTS edit_reason;
*/

-- ================================================================
-- END OF MIGRATION
-- ================================================================
