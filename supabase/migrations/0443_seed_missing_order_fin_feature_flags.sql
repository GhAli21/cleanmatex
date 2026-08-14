-- ================================================================
-- Migration: Seed Missing Order-Fin Feature Flags
--            (order_fin_refund_execution, tax_inclusive_pricing)
-- ================================================================
-- Purpose     : Both flags exist in web-admin/lib/constants/feature-flags.ts
--               (FLAG_CATALOG) and are referenced by shipped code, but were
--               NEVER registered in hq_ff_feature_flags_mst. Without the DB
--               rows the flags cannot be toggled from the HQ console and the
--               features they gate (B9 refund execution, B11 tax-inclusive
--               pricing) are permanently unreachable — including for QA.
--               This violates CLAUDE.md's rule that every feature flag must be
--               registered via a migration, then mirrored into FLAG_CATALOG.
--
-- Governance  : beta (refund execution) · experimental (tax inclusive)
-- Data Type   : boolean (both)
-- Plan Binding: independent (both) — no plan mappings required
--
-- Created     : 2026-08-14
-- Created by  : system_admin
-- Migration   : 0443_seed_missing_order_fin_feature_flags.sql
--
-- Components:
--   [X] Flag Definition (hq_ff_feature_flags_mst) x2
--   [ ] Plan Mappings (sys_ff_pln_flag_mappings_dtl) — N/A (independent)
--
-- SAFETY: data-only INSERT/UPSERT. No schema change, no Postgres/Prisma type
--         regeneration needed. Both flags default to FALSE, so applying this
--         migration changes NO tenant's behaviour — it only makes the flags
--         visible and toggleable in the HQ console.
--
-- Evidence (2026-08-14):
--   SELECT flag_key FROM hq_ff_feature_flags_mst
--    WHERE flag_key IN ('order_fin_refund_execution','tax_inclusive_pricing');
--   -> 0 rows (remote, authoritative)
--   Values below mirror the existing FLAG_CATALOG entries exactly
--   (feature-flags.ts lines 75 and 371) per the DB-mirror rule.
-- ================================================================

-- ================================================================
-- SECTION 1: VALIDATION (UPSERT-SAFE)
-- ================================================================

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM hq_ff_feature_flags_mst WHERE flag_key = 'order_fin_refund_execution') THEN
    RAISE NOTICE 'ℹ️  Flag already exists: order_fin_refund_execution — this migration will UPDATE it in place';
  END IF;
  IF EXISTS (SELECT 1 FROM hq_ff_feature_flags_mst WHERE flag_key = 'tax_inclusive_pricing') THEN
    RAISE NOTICE 'ℹ️  Flag already exists: tax_inclusive_pricing — this migration will UPDATE it in place';
  END IF;

  RAISE NOTICE '✅ Prerequisites validated for: order_fin_refund_execution, tax_inclusive_pricing';
END $$;

-- ================================================================
-- SECTION 2: FLAG DEFINITIONS
-- ================================================================

-- ---- 2a. order_fin_refund_execution (B9 — Refund Execution Parity) ----
-- Gates real refund execution: REFUND_VOUCHER + cash-drawer CASH_OUT for CASH
-- refunds, and the manual-settlement reference for ORIGINAL_METHOD. Flag OFF
-- keeps the exact pre-B9 record-only behaviour (no voucher, no drawer movement,
-- no gateway call) — see migration 0418 and B09's work package.
INSERT INTO hq_ff_feature_flags_mst (
  flag_key, flag_name, flag_name2, flag_description, flag_description2,
  governance_category, is_billable, is_kill_switch, is_sensitive,
  allowed_values, validation_rules, data_type, default_value,
  plan_binding_type, enabled_plan_codes,
  allows_tenant_override, override_requires_approval,
  ui_group, ui_display_order,
  created_at, created_by, created_info, rec_status, is_active
) VALUES (
  'order_fin_refund_execution',
  'Refund Execution Parity',
  'تنفيذ المبالغ المستردة',
  'Executes refunds for real: issues a REFUND_VOUCHER and a cash-drawer CASH_OUT movement for CASH refunds, and requires a manual settlement reference for ORIGINAL_METHOD refunds. When OFF, refunds stay record-only (approved and tracked, but no voucher, drawer movement, or gateway call).',
  'ينفذ عمليات الاسترداد فعلياً: يصدر سند استرداد وحركة صرف نقدي من الدرج للمبالغ النقدية، ويتطلب مرجع تسوية يدوي للاسترداد بنفس طريقة الدفع الأصلية. عند الإيقاف يبقى الاسترداد مسجلاً فقط دون سند أو حركة درج أو استدعاء بوابة الدفع.',
  'beta', false, false, false,
  NULL, '[]'::jsonb, 'boolean', 'false'::jsonb,
  'independent', '[]'::jsonb,
  true, false,
  'Billing Features', 12,
  CURRENT_TIMESTAMP, 'system_admin', 'Migration: 0443_seed_missing_order_fin_feature_flags.sql', 1, true
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
  updated_info               = 'Migration: 0443_seed_missing_order_fin_feature_flags.sql';

-- ---- 2b. tax_inclusive_pricing (B11 — Tax-Inclusive Calculation) ----
-- Opts a tenant into TAX_INCLUSIVE pricing, where catalog prices already embed
-- VAT/GST and the engine extracts rather than adds tax. OFF = TAX_EXCLUSIVE,
-- byte-identical to pre-B11 behaviour. Experimental: there is no settings-UI
-- toggle for tax_pricing_mode yet, so a pilot tenant is configured directly.
INSERT INTO hq_ff_feature_flags_mst (
  flag_key, flag_name, flag_name2, flag_description, flag_description2,
  governance_category, is_billable, is_kill_switch, is_sensitive,
  allowed_values, validation_rules, data_type, default_value,
  plan_binding_type, enabled_plan_codes,
  allows_tenant_override, override_requires_approval,
  ui_group, ui_display_order,
  created_at, created_by, created_info, rec_status, is_active
) VALUES (
  'tax_inclusive_pricing',
  'Tax Inclusive Pricing',
  'التسعير شامل الضريبة',
  'Treats catalog prices as already including VAT/GST. The engine extracts the embedded tax instead of adding it on top, so the displayed price is the final price. When OFF, pricing is tax-exclusive and tax is added to the subtotal (unchanged legacy behaviour).',
  'يعامل أسعار الكتالوج على أنها شاملة لضريبة القيمة المضافة. يستخرج المحرك الضريبة المضمّنة بدلاً من إضافتها، فيكون السعر المعروض هو السعر النهائي. عند الإيقاف يكون التسعير غير شامل للضريبة وتُضاف الضريبة إلى المجموع الفرعي.',
  'experimental', false, false, false,
  NULL, '[]'::jsonb, 'boolean', 'false'::jsonb,
  'independent', '[]'::jsonb,
  true, false,
  'Finance', 0,
  CURRENT_TIMESTAMP, 'system_admin', 'Migration: 0443_seed_missing_order_fin_feature_flags.sql', 1, true
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
  updated_info               = 'Migration: 0443_seed_missing_order_fin_feature_flags.sql';

-- ================================================================
-- SECTION 3: PLAN MAPPINGS
-- ================================================================

-- No plan mappings — both flags are plan-independent.

-- ================================================================
-- SECTION 4: VERIFICATION SUMMARY
-- ================================================================

DO $$
DECLARE
  v_flag_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_flag_count
  FROM hq_ff_feature_flags_mst
  WHERE flag_key IN ('order_fin_refund_execution', 'tax_inclusive_pricing');

  RAISE NOTICE '';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '✅ MIGRATION COMPLETED: seed missing Order-Fin flags';
  RAISE NOTICE '════════════════════════════════════════════════════════';
  RAISE NOTICE '  Flag definitions present : % of 2', v_flag_count;
  RAISE NOTICE '  Both default to FALSE — no tenant behaviour changes.';
  RAISE NOTICE '';
  RAISE NOTICE '🎯 Next Steps:';
  RAISE NOTICE '  1. Verify on the REMOTE db (authoritative)';
  RAISE NOTICE '  2. No Postgres/Prisma type regeneration needed (data-only)';
  RAISE NOTICE '  3. FLAG_CATALOG already contains both entries — no sync needed';
  RAISE NOTICE '  4. QA_TEST_GUIDE sections 16 (B9) and 22 (B11) become runnable';
  RAISE NOTICE '════════════════════════════════════════════════════════';

  IF v_flag_count <> 2 THEN
    RAISE EXCEPTION 'Migration failed: expected 2 flag definitions, found %', v_flag_count;
  END IF;
END $$;

-- ================================================================
-- SECTION 5: ROLLBACK (manual reference only — do NOT execute)
-- ================================================================

/*
DELETE FROM hq_ff_feature_flags_mst
 WHERE flag_key IN ('order_fin_refund_execution', 'tax_inclusive_pricing');

SELECT COUNT(*) FROM hq_ff_feature_flags_mst
 WHERE flag_key IN ('order_fin_refund_execution', 'tax_inclusive_pricing'); -- Expected: 0
*/

-- ================================================================
-- END OF MIGRATION
-- ================================================================
