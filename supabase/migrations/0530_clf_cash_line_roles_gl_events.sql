-- =============================================================================
-- Migration 0530 — CLF M7: cash voucher line roles + ERP-Lite GL events
-- Package CLF (Cash Ledger Foundation), release R1 — see
-- docs/features/Order_Fin/POS_Session_Cash_Drawer_Hardening/IMPLEMENTATION_PLAN.md §4B.2a-A, §4B.3.8, §4B.9
--
-- What this migration does
--   1. Two new voucher line roles (chk_vch_trx_ln_role is recreated with the full
--      existing list + the new codes):
--        CASH_PAY_IN      — owner/manager brings outside cash into a drawer
--                           (drawer "Cash in / Cash out" dialog, RECEIPT_VOUCHER).
--        CASH_OVER_SHORT  — the over/short adjustment voucher line created by
--                           finance from a drawer close/open variance event.
--                           Carries NO payment method, so the drawer ledger gate
--                           never treats it as cash — it never enters a drawer.
--   2. ERP-Lite governance (same pattern as 0424 / B6), under the PUBLISHED
--      ERP_LITE_V1_CORE v1 package, all NON_BLOCKING from day one:
--        usage codes  CASH_OVER_SHORT (EXPENSE, normal DEBIT),
--                     OWNER_CONTRIBUTION (EQUITY, normal CREDIT)
--        events       CASH_OVER     Dr CASH_MAIN          / Cr CASH_OVER_SHORT
--                     CASH_SHORT    Dr CASH_OVER_SHORT    / Cr CASH_MAIN
--                     CASH_PAID_IN  Dr CASH_MAIN          / Cr OWNER_CONTRIBUTION
--      GL = one cash-on-hand account per branch + currency (ADR-057); drawers are
--      operational detail below it, so custody transfers post nothing.
--
-- Tenants: each ERP-Lite tenant still maps the two new usage codes to real
-- accounts (sys_fin_org_acc_map_dtl). Until then dispatches land as NON_BLOCKING
-- exceptions in org_fin_post_exc_tr — no operational impact. Tenants without
-- ERP-Lite are unaffected (ERP-Lite is optional; vouchers never depend on it).
--
-- Reversal (forward migration):
--   Set the 3 rules + 3 policies to DRAFT (or delete them — additive);
--   delete the 3 sys_fin_evt_cd rows and the 2 usage_type_dtl + usage_code_cd rows;
--   recreate chk_vch_trx_ln_role without CASH_PAY_IN / CASH_OVER_SHORT
--   (only possible while no line uses them).
--
-- Created as a file only. STOP-AND-WAIT: the owner applies it.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Voucher line roles
-- -----------------------------------------------------------------------------
ALTER TABLE public.org_fin_voucher_trx_lines_dtl DROP CONSTRAINT IF EXISTS chk_vch_trx_ln_role;
ALTER TABLE public.org_fin_voucher_trx_lines_dtl
  ADD CONSTRAINT chk_vch_trx_ln_role CHECK (line_role = ANY (ARRAY[
    'ORDER_PAYMENT', 'INVOICE_PAYMENT', 'WALLET_TOPUP', 'GIFT_CARD_SALE',
    'CUSTOMER_CREDIT_RECEIPT', 'CUSTOMER_CREDIT_ISSUE', 'CUSTOMER_ADVANCE_RECEIPT',
    'SUPPLIER_PAYMENT', 'EXPENSE_PAYMENT', 'SHOP_RENT_PAYMENT', 'UTILITY_PAYMENT',
    'EMPLOYEE_ADVANCE_PAYMENT', 'PETTY_CASH_ISSUE', 'CUSTOMER_REFUND', 'ORDER_REFUND',
    'INVOICE_REFUND', 'PETTY_CASH_RETURN', 'WALLET_REFUND', 'GIFT_CARD_REFUND',
    'INTERNAL_TRANSFER', 'ORDER_CREDIT_APPLICATION', 'STATEMENT_PAYMENT',
    'STATEMENT_CREDIT_APPLICATION',
    -- CLF (0530)
    'CASH_PAY_IN', 'CASH_OVER_SHORT'
  ]::TEXT[]));

COMMENT ON CONSTRAINT chk_vch_trx_ln_role ON public.org_fin_voucher_trx_lines_dtl IS
  'Allowed voucher line roles; mirrored in lib/constants/voucher.ts LINE_ROLE. CLF 0530 added CASH_PAY_IN and CASH_OVER_SHORT.';

-- -----------------------------------------------------------------------------
-- 2. Usage codes
-- -----------------------------------------------------------------------------
INSERT INTO public.sys_fin_usage_code_cd (
  usage_code, primary_acc_type_id, name, name2, description, description2,
  normal_balance, phase_code, is_required_v1, rec_order,
  created_at, created_by, created_info, is_active, rec_status
)
SELECT
  seed.usage_code, t.acc_type_id, seed.name, seed.name2, seed.description, seed.description2,
  seed.normal_balance, 'V1', FALSE, seed.rec_order,
  CURRENT_TIMESTAMP, 'system_admin', 'Migration 0530', TRUE, 1
FROM (
  VALUES
    ('CASH_OVER_SHORT', 'EXPENSE', 'Cash Over and Short', 'فروقات النقدية (زيادة وعجز)',
     'Usage code for the cash over/short account: differences between counted and expected drawer cash.',
     'رمز استخدام لحساب فروقات النقدية: الفرق بين النقدية المعدودة والمتوقعة في الصندوق.',
     'DEBIT', 170),
    ('OWNER_CONTRIBUTION', 'EQUITY', 'Owner Contribution', 'مساهمة المالك',
     'Usage code for cash the owner brings into the business (drawer pay-in).',
     'رمز استخدام للنقدية التي يُدخلها المالك إلى النشاط (إيداع في الصندوق).',
     'CREDIT', 180)
) AS seed(usage_code, acc_type_code, name, name2, description, description2, normal_balance, rec_order)
JOIN public.sys_fin_acc_type_cd t ON t.acc_type_code = seed.acc_type_code
ON CONFLICT (usage_code) DO UPDATE SET
  primary_acc_type_id = EXCLUDED.primary_acc_type_id,
  name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  normal_balance = EXCLUDED.normal_balance, phase_code = EXCLUDED.phase_code,
  is_required_v1 = EXCLUDED.is_required_v1, rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin', updated_info = 'Migration 0530';

INSERT INTO public.sys_fin_usage_type_dtl (
  usage_code_id, acc_type_id, is_primary, rec_order,
  created_at, created_by, created_info, is_active, rec_status
)
SELECT
  uc.usage_code_id, t.acc_type_id, TRUE, seed.rec_order,
  CURRENT_TIMESTAMP, 'system_admin', 'Migration 0530', TRUE, 1
FROM (
  VALUES
    ('CASH_OVER_SHORT', 'EXPENSE', 170),
    ('OWNER_CONTRIBUTION', 'EQUITY', 180)
) AS seed(usage_code, acc_type_code, rec_order)
JOIN public.sys_fin_usage_code_cd uc ON uc.usage_code = seed.usage_code
JOIN public.sys_fin_acc_type_cd t ON t.acc_type_code = seed.acc_type_code
ON CONFLICT (usage_code_id, acc_type_id) DO UPDATE SET
  is_primary = EXCLUDED.is_primary, rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin', updated_info = 'Migration 0530';

-- -----------------------------------------------------------------------------
-- 3. Event codes
-- -----------------------------------------------------------------------------
INSERT INTO public.sys_fin_evt_cd (
  evt_code, name, name2, description, description2, phase_code, is_locked, rec_order,
  created_at, created_by, created_info, is_active, rec_status
) VALUES
  ('CASH_OVER', 'Cash Over', 'زيادة في النقدية',
   'ERP-Lite v1 event: a drawer count found more cash than expected (CLF over/short).',
   'حدث ERP-Lite v1: جرد الصندوق وجد نقدية أكثر من المتوقع (فروقات النقدية).',
   'V1', TRUE, 170, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0530', TRUE, 1),
  ('CASH_SHORT', 'Cash Short', 'عجز في النقدية',
   'ERP-Lite v1 event: a drawer count found less cash than expected (CLF over/short).',
   'حدث ERP-Lite v1: جرد الصندوق وجد نقدية أقل من المتوقع (فروقات النقدية).',
   'V1', TRUE, 180, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0530', TRUE, 1),
  ('CASH_PAID_IN', 'Cash Paid In', 'إيداع نقدية في الصندوق',
   'ERP-Lite v1 event: the owner brought outside cash into a drawer (drawer pay-in voucher).',
   'حدث ERP-Lite v1: أدخل المالك نقدية من خارج النشاط إلى الصندوق (سند إيداع).',
   'V1', TRUE, 190, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0530', TRUE, 1)
ON CONFLICT (evt_code) DO UPDATE SET
  name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  phase_code = EXCLUDED.phase_code, is_locked = EXCLUDED.is_locked, rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin', updated_info = 'Migration 0530';

-- -----------------------------------------------------------------------------
-- 4. Mapping rules (headers)
-- -----------------------------------------------------------------------------
INSERT INTO public.sys_fin_map_rule_mst (
  pkg_id, evt_id, rule_code, version_no, name, name2, description, description2,
  priority_no, condition_json, is_fallback, stop_on_match, status_code, rec_order,
  created_at, created_by, created_info, is_active, rec_status
)
SELECT
  p.pkg_id, e.evt_id, seed.rule_code, 1, seed.name, seed.name2, seed.description, seed.description2,
  seed.priority_no, '{}'::JSONB, TRUE, TRUE, 'DRAFT', seed.priority_no,
  CURRENT_TIMESTAMP, 'system_admin', 'Migration 0530', TRUE, 1
FROM (
  VALUES
    ('CASH_OVER_V1', 'CASH_OVER', 'Cash over v1', 'زيادة نقدية v1',
     'CLF v1 rule: recognise a drawer cash overage.', 'قاعدة CLF v1: إثبات زيادة نقدية الصندوق.', 170),
    ('CASH_SHORT_V1', 'CASH_SHORT', 'Cash short v1', 'عجز نقدية v1',
     'CLF v1 rule: recognise a drawer cash shortage.', 'قاعدة CLF v1: إثبات عجز نقدية الصندوق.', 180),
    ('CASH_PAID_IN_V1', 'CASH_PAID_IN', 'Cash paid in v1', 'إيداع نقدية v1',
     'CLF v1 rule: owner cash brought into a drawer.', 'قاعدة CLF v1: نقدية أدخلها المالك إلى الصندوق.', 190)
) AS seed(rule_code, evt_code, name, name2, description, description2, priority_no)
JOIN public.sys_fin_gov_pkg_mst p ON p.pkg_code = 'ERP_LITE_V1_CORE' AND p.version_no = 1
JOIN public.sys_fin_evt_cd e ON e.evt_code = seed.evt_code
ON CONFLICT (pkg_id, rule_code) DO UPDATE SET
  evt_id = EXCLUDED.evt_id, name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  priority_no = EXCLUDED.priority_no, condition_json = EXCLUDED.condition_json,
  is_fallback = EXCLUDED.is_fallback, stop_on_match = EXCLUDED.stop_on_match,
  rec_order = EXCLUDED.rec_order, is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin', updated_info = 'Migration 0530';

-- -----------------------------------------------------------------------------
-- 5. Mapping rules (Dr/Cr lines)
-- -----------------------------------------------------------------------------
INSERT INTO public.sys_fin_map_rule_dtl (
  rule_id, line_no, entry_side, usage_code_id, resolver_id, amount_source_code,
  line_type_code, condition_json, rec_order,
  created_at, created_by, created_info, is_active, rec_status
)
SELECT
  r.rule_id, seed.line_no, seed.entry_side, uc.usage_code_id, NULL, 'gross_amount',
  'MAIN', '{}'::JSONB, seed.rec_order,
  CURRENT_TIMESTAMP, 'system_admin', 'Migration 0530', TRUE, 1
FROM (
  VALUES
    -- CASH_OVER: Dr Cash on hand, Cr Cash over/short
    ('CASH_OVER_V1', 10, 'DR', 'CASH_MAIN', 10),
    ('CASH_OVER_V1', 20, 'CR', 'CASH_OVER_SHORT', 20),
    -- CASH_SHORT: Dr Cash over/short, Cr Cash on hand
    ('CASH_SHORT_V1', 10, 'DR', 'CASH_OVER_SHORT', 10),
    ('CASH_SHORT_V1', 20, 'CR', 'CASH_MAIN', 20),
    -- CASH_PAID_IN: Dr Cash on hand, Cr Owner contribution
    ('CASH_PAID_IN_V1', 10, 'DR', 'CASH_MAIN', 10),
    ('CASH_PAID_IN_V1', 20, 'CR', 'OWNER_CONTRIBUTION', 20)
) AS seed(rule_code, line_no, entry_side, usage_code, rec_order)
JOIN public.sys_fin_map_rule_mst r ON r.rule_code = seed.rule_code
JOIN public.sys_fin_usage_code_cd uc ON uc.usage_code = seed.usage_code
ON CONFLICT (rule_id, line_no) DO UPDATE SET
  usage_code_id = EXCLUDED.usage_code_id, resolver_id = EXCLUDED.resolver_id,
  amount_source_code = EXCLUDED.amount_source_code, line_type_code = EXCLUDED.line_type_code,
  condition_json = EXCLUDED.condition_json, rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin', updated_info = 'Migration 0530';

-- -----------------------------------------------------------------------------
-- 6. Auto-post policies — NON_BLOCKING from day one
-- -----------------------------------------------------------------------------
INSERT INTO public.sys_fin_auto_post_mst (
  pkg_id, evt_id, policy_ver, is_enabled, blocking_mode, required_success,
  retry_allowed, repost_allowed, status_code, failure_action_code, notes, notes2, rec_order,
  created_at, created_by, created_info, is_active, rec_status
)
SELECT
  p.pkg_id, e.evt_id, 1, TRUE, 'NON_BLOCKING', FALSE, TRUE, TRUE, 'DRAFT', 'FINANCE_EXCEPTION',
  seed.notes, seed.notes2, seed.rec_order,
  CURRENT_TIMESTAMP, 'system_admin', 'Migration 0530', TRUE, 1
FROM (
  VALUES
    ('CASH_OVER', 'Post the overage; a posting failure goes to the finance exception queue and never blocks the drawer close.',
     'رحّل الزيادة؛ أي فشل في الترحيل يذهب لقائمة استثناءات المالية ولا يمنع إغلاق الصندوق.', 170),
    ('CASH_SHORT', 'Post the shortage; a posting failure goes to the finance exception queue and never blocks the drawer close.',
     'رحّل العجز؛ أي فشل في الترحيل يذهب لقائمة استثناءات المالية ولا يمنع إغلاق الصندوق.', 180),
    ('CASH_PAID_IN', 'Post the pay-in; a posting failure goes to the finance exception queue and never blocks the voucher.',
     'رحّل الإيداع؛ أي فشل في الترحيل يذهب لقائمة استثناءات المالية ولا يمنع السند.', 190)
) AS seed(evt_code, notes, notes2, rec_order)
JOIN public.sys_fin_gov_pkg_mst p ON p.pkg_code = 'ERP_LITE_V1_CORE' AND p.version_no = 1
JOIN public.sys_fin_evt_cd e ON e.evt_code = seed.evt_code
ON CONFLICT (pkg_id, evt_id, policy_ver) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled, blocking_mode = EXCLUDED.blocking_mode,
  required_success = EXCLUDED.required_success, retry_allowed = EXCLUDED.retry_allowed,
  repost_allowed = EXCLUDED.repost_allowed, failure_action_code = EXCLUDED.failure_action_code,
  notes = EXCLUDED.notes, notes2 = EXCLUDED.notes2, rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin', updated_info = 'Migration 0530';

-- -----------------------------------------------------------------------------
-- 7. Activate the new rules + policies (the package itself is already PUBLISHED)
-- -----------------------------------------------------------------------------
UPDATE public.sys_fin_map_rule_mst r
SET status_code = 'ACTIVE', updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin',
    updated_info = 'Migration 0530 — activate CLF rules'
FROM public.sys_fin_evt_cd e
WHERE r.evt_id = e.evt_id
  AND e.evt_code IN ('CASH_OVER', 'CASH_SHORT', 'CASH_PAID_IN')
  AND r.status_code = 'DRAFT';

UPDATE public.sys_fin_auto_post_mst ap
SET status_code = 'ACTIVE', effective_from = COALESCE(ap.effective_from, CURRENT_DATE),
    updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin',
    updated_info = 'Migration 0530 — activate CLF policies'
FROM public.sys_fin_evt_cd e
WHERE ap.evt_id = e.evt_id
  AND e.evt_code IN ('CASH_OVER', 'CASH_SHORT', 'CASH_PAID_IN')
  AND ap.status_code = 'DRAFT';

-- -----------------------------------------------------------------------------
-- 8. Validation
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.sys_fin_usage_code_cd
   WHERE usage_code IN ('CASH_OVER_SHORT', 'OWNER_CONTRIBUTION', 'CASH_MAIN');
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'CLF 0530: expected 3 usage codes (2 new + CASH_MAIN), found %', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.sys_fin_map_rule_mst r
    JOIN public.sys_fin_evt_cd e ON e.evt_id = r.evt_id
   WHERE e.evt_code IN ('CASH_OVER', 'CASH_SHORT', 'CASH_PAID_IN') AND r.status_code = 'ACTIVE';
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'CLF 0530: expected 3 ACTIVE mapping rules, found %', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.sys_fin_map_rule_dtl d
    JOIN public.sys_fin_map_rule_mst r ON r.rule_id = d.rule_id
   WHERE r.rule_code IN ('CASH_OVER_V1', 'CASH_SHORT_V1', 'CASH_PAID_IN_V1');
  IF v_count <> 6 THEN
    RAISE EXCEPTION 'CLF 0530: expected 6 Dr/Cr lines, found %', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.sys_fin_auto_post_mst ap
    JOIN public.sys_fin_evt_cd e ON e.evt_id = ap.evt_id
   WHERE e.evt_code IN ('CASH_OVER', 'CASH_SHORT', 'CASH_PAID_IN')
     AND ap.status_code = 'ACTIVE' AND ap.blocking_mode = 'NON_BLOCKING';
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'CLF 0530: expected 3 ACTIVE NON_BLOCKING policies, found %', v_count;
  END IF;
END $$;

COMMIT;
