-- =============================================================================
-- Migration 0546 — A6-1b: cash change rounding voucher line role + ERP-Lite GL events
-- Package POS_Session_Cash_Drawer_Hardening, wave A6 (owner decision 2026-10-02):
-- round the cash CHANGE only and persist the difference as an explicit line.
-- See docs/features/Order_Fin/POS_Session_Cash_Drawer_Hardening/IMPLEMENTATION_PLAN.md §A6.
--
-- What this migration does
--   1. One new voucher line role (chk_vch_trx_ln_role recreated with the full
--      existing list + the new code):
--        CASH_CHANGE_ROUNDING — the difference between the exact change owed to the
--                               customer and the rounded change actually handed out.
--                               line_type ROUNDING (already allowed), carries the cash
--                               payment method + the payment's drawer session so the
--                               drawer ledger gate stamps it like any other cash line:
--                                 OUT = drawer holds LESS than the exact amount (business
--                                       gave more change)  -> rounding loss
--                                 IN  = drawer holds MORE than the exact amount (customer
--                                       absorbed the fraction) -> rounding gain
--                               Order totals, tax and non-cash tenders are never touched.
--   2. ERP-Lite governance (same pattern as 0530), under the PUBLISHED
--      ERP_LITE_V1_CORE v1 package, NON_BLOCKING from day one:
--        usage code  CASH_ROUNDING (EXPENSE, normal DEBIT) — cash rounding gain/loss
--        events      CASH_ROUND_LOSS  Dr CASH_ROUNDING / Cr CASH_MAIN
--                    CASH_ROUND_GAIN  Dr CASH_MAIN     / Cr CASH_ROUNDING
--
-- Tenants: each ERP-Lite tenant still maps the new usage code to a real account
-- (sys_fin_org_acc_map_dtl). Until then dispatches land as NON_BLOCKING exceptions in
-- org_fin_post_exc_tr — no operational impact. Tenants without ERP-Lite are unaffected.
--
-- Reversal (forward migration):
--   Set the 2 rules + 2 policies to DRAFT (or delete them — additive); delete the 2
--   sys_fin_evt_cd rows and the usage_type_dtl + usage_code_cd row; recreate
--   chk_vch_trx_ln_role without CASH_CHANGE_ROUNDING (only while no line uses it).
--
-- Created as a file only. STOP-AND-WAIT: the owner applies it.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. Voucher line role
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
    'CASH_PAY_IN', 'CASH_OVER_SHORT',
    -- A6-1b (0546)
    'CASH_CHANGE_ROUNDING'
  ]::TEXT[]));

COMMENT ON CONSTRAINT chk_vch_trx_ln_role ON public.org_fin_voucher_trx_lines_dtl IS
  'Allowed voucher line roles; mirrored in lib/constants/voucher.ts LINE_ROLE. CLF 0530 added CASH_PAY_IN and CASH_OVER_SHORT; A6-1b 0546 added CASH_CHANGE_ROUNDING.';

-- -----------------------------------------------------------------------------
-- 2. Usage code
-- -----------------------------------------------------------------------------
INSERT INTO public.sys_fin_usage_code_cd (
  usage_code, primary_acc_type_id, name, name2, description, description2,
  normal_balance, phase_code, is_required_v1, rec_order,
  created_at, created_by, created_info, is_active, rec_status
)
SELECT
  seed.usage_code, t.acc_type_id, seed.name, seed.name2, seed.description, seed.description2,
  seed.normal_balance, 'V1', FALSE, seed.rec_order,
  CURRENT_TIMESTAMP, 'system_admin', 'Migration 0546', TRUE, 1
FROM (
  VALUES
    ('CASH_ROUNDING', 'EXPENSE', 'Cash Rounding', 'فروقات تقريب النقدية',
     'Usage code for the cash rounding gain/loss account: the difference between exact and rounded cash change.',
     'رمز استخدام لحساب أرباح وخسائر تقريب النقدية: الفرق بين الباقي الدقيق والباقي المقرّب.',
     'DEBIT', 200)
) AS seed(usage_code, acc_type_code, name, name2, description, description2, normal_balance, rec_order)
JOIN public.sys_fin_acc_type_cd t ON t.acc_type_code = seed.acc_type_code
ON CONFLICT (usage_code) DO UPDATE SET
  primary_acc_type_id = EXCLUDED.primary_acc_type_id,
  name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  normal_balance = EXCLUDED.normal_balance, phase_code = EXCLUDED.phase_code,
  is_required_v1 = EXCLUDED.is_required_v1, rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin', updated_info = 'Migration 0546';

INSERT INTO public.sys_fin_usage_type_dtl (
  usage_code_id, acc_type_id, is_primary, rec_order,
  created_at, created_by, created_info, is_active, rec_status
)
SELECT
  uc.usage_code_id, t.acc_type_id, TRUE, 200,
  CURRENT_TIMESTAMP, 'system_admin', 'Migration 0546', TRUE, 1
FROM public.sys_fin_usage_code_cd uc
JOIN public.sys_fin_acc_type_cd t ON t.acc_type_code = 'EXPENSE'
WHERE uc.usage_code = 'CASH_ROUNDING'
ON CONFLICT (usage_code_id, acc_type_id) DO UPDATE SET
  is_primary = EXCLUDED.is_primary, rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin', updated_info = 'Migration 0546';

-- -----------------------------------------------------------------------------
-- 3. Event codes
-- -----------------------------------------------------------------------------
INSERT INTO public.sys_fin_evt_cd (
  evt_code, name, name2, description, description2, phase_code, is_locked, rec_order,
  created_at, created_by, created_info, is_active, rec_status
) VALUES
  ('CASH_ROUND_LOSS', 'Cash Rounding Loss', 'خسارة تقريب النقدية',
   'ERP-Lite v1 event: rounded cash change handed out exceeded the exact change owed (drawer holds less).',
   'حدث ERP-Lite v1: الباقي النقدي المقرّب المسلّم أكبر من الباقي الدقيق المستحق (الصندوق يحتوي أقل).',
   'V1', TRUE, 200, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0546', TRUE, 1),
  ('CASH_ROUND_GAIN', 'Cash Rounding Gain', 'ربح تقريب النقدية',
   'ERP-Lite v1 event: rounded cash change handed out was below the exact change owed (drawer holds more).',
   'حدث ERP-Lite v1: الباقي النقدي المقرّب المسلّم أقل من الباقي الدقيق المستحق (الصندوق يحتوي أكثر).',
   'V1', TRUE, 210, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0546', TRUE, 1)
ON CONFLICT (evt_code) DO UPDATE SET
  name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  phase_code = EXCLUDED.phase_code, is_locked = EXCLUDED.is_locked, rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin', updated_info = 'Migration 0546';

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
  CURRENT_TIMESTAMP, 'system_admin', 'Migration 0546', TRUE, 1
FROM (
  VALUES
    ('CASH_ROUND_LOSS_V1', 'CASH_ROUND_LOSS', 'Cash rounding loss v1', 'خسارة تقريب النقدية v1',
     'A6 v1 rule: recognise a cash change rounding loss.', 'قاعدة A6 v1: إثبات خسارة تقريب الباقي النقدي.', 200),
    ('CASH_ROUND_GAIN_V1', 'CASH_ROUND_GAIN', 'Cash rounding gain v1', 'ربح تقريب النقدية v1',
     'A6 v1 rule: recognise a cash change rounding gain.', 'قاعدة A6 v1: إثبات ربح تقريب الباقي النقدي.', 210)
) AS seed(rule_code, evt_code, name, name2, description, description2, priority_no)
JOIN public.sys_fin_gov_pkg_mst p ON p.pkg_code = 'ERP_LITE_V1_CORE' AND p.version_no = 1
JOIN public.sys_fin_evt_cd e ON e.evt_code = seed.evt_code
ON CONFLICT (pkg_id, rule_code) DO UPDATE SET
  evt_id = EXCLUDED.evt_id, name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  priority_no = EXCLUDED.priority_no, condition_json = EXCLUDED.condition_json,
  is_fallback = EXCLUDED.is_fallback, stop_on_match = EXCLUDED.stop_on_match,
  rec_order = EXCLUDED.rec_order, is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin', updated_info = 'Migration 0546';

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
  CURRENT_TIMESTAMP, 'system_admin', 'Migration 0546', TRUE, 1
FROM (
  VALUES
    -- CASH_ROUND_LOSS: Dr Cash rounding, Cr Cash on hand
    ('CASH_ROUND_LOSS_V1', 10, 'DR', 'CASH_ROUNDING', 10),
    ('CASH_ROUND_LOSS_V1', 20, 'CR', 'CASH_MAIN', 20),
    -- CASH_ROUND_GAIN: Dr Cash on hand, Cr Cash rounding
    ('CASH_ROUND_GAIN_V1', 10, 'DR', 'CASH_MAIN', 10),
    ('CASH_ROUND_GAIN_V1', 20, 'CR', 'CASH_ROUNDING', 20)
) AS seed(rule_code, line_no, entry_side, usage_code, rec_order)
JOIN public.sys_fin_map_rule_mst r ON r.rule_code = seed.rule_code
JOIN public.sys_fin_usage_code_cd uc ON uc.usage_code = seed.usage_code
ON CONFLICT (rule_id, line_no) DO UPDATE SET
  usage_code_id = EXCLUDED.usage_code_id, resolver_id = EXCLUDED.resolver_id,
  amount_source_code = EXCLUDED.amount_source_code, line_type_code = EXCLUDED.line_type_code,
  condition_json = EXCLUDED.condition_json, rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin', updated_info = 'Migration 0546';

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
  CURRENT_TIMESTAMP, 'system_admin', 'Migration 0546', TRUE, 1
FROM (
  VALUES
    ('CASH_ROUND_LOSS', 'Post the rounding loss; a posting failure goes to the finance exception queue and never blocks the sale.',
     'رحّل خسارة التقريب؛ أي فشل في الترحيل يذهب لقائمة استثناءات المالية ولا يمنع البيع.', 200),
    ('CASH_ROUND_GAIN', 'Post the rounding gain; a posting failure goes to the finance exception queue and never blocks the sale.',
     'رحّل ربح التقريب؛ أي فشل في الترحيل يذهب لقائمة استثناءات المالية ولا يمنع البيع.', 210)
) AS seed(evt_code, notes, notes2, rec_order)
JOIN public.sys_fin_gov_pkg_mst p ON p.pkg_code = 'ERP_LITE_V1_CORE' AND p.version_no = 1
JOIN public.sys_fin_evt_cd e ON e.evt_code = seed.evt_code
ON CONFLICT (pkg_id, evt_id, policy_ver) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled, blocking_mode = EXCLUDED.blocking_mode,
  required_success = EXCLUDED.required_success, retry_allowed = EXCLUDED.retry_allowed,
  repost_allowed = EXCLUDED.repost_allowed, failure_action_code = EXCLUDED.failure_action_code,
  notes = EXCLUDED.notes, notes2 = EXCLUDED.notes2, rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin', updated_info = 'Migration 0546';

-- -----------------------------------------------------------------------------
-- 7. Activate the new rules + policies (the package itself is already PUBLISHED)
-- -----------------------------------------------------------------------------
UPDATE public.sys_fin_map_rule_mst r
SET status_code = 'ACTIVE', updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin',
    updated_info = 'Migration 0546 — activate cash rounding rules'
FROM public.sys_fin_evt_cd e
WHERE r.evt_id = e.evt_id
  AND e.evt_code IN ('CASH_ROUND_LOSS', 'CASH_ROUND_GAIN')
  AND r.status_code = 'DRAFT';

UPDATE public.sys_fin_auto_post_mst ap
SET status_code = 'ACTIVE', effective_from = COALESCE(ap.effective_from, CURRENT_DATE),
    updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin',
    updated_info = 'Migration 0546 — activate cash rounding policies'
FROM public.sys_fin_evt_cd e
WHERE ap.evt_id = e.evt_id
  AND e.evt_code IN ('CASH_ROUND_LOSS', 'CASH_ROUND_GAIN')
  AND ap.status_code = 'DRAFT';

-- -----------------------------------------------------------------------------
-- 8. Validation
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.sys_fin_usage_code_cd
   WHERE usage_code IN ('CASH_ROUNDING', 'CASH_MAIN');
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'A6 0546: expected 2 usage codes (1 new + CASH_MAIN), found %', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.sys_fin_map_rule_mst r
    JOIN public.sys_fin_evt_cd e ON e.evt_id = r.evt_id
   WHERE e.evt_code IN ('CASH_ROUND_LOSS', 'CASH_ROUND_GAIN') AND r.status_code = 'ACTIVE';
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'A6 0546: expected 2 ACTIVE mapping rules, found %', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.sys_fin_map_rule_dtl d
    JOIN public.sys_fin_map_rule_mst r ON r.rule_id = d.rule_id
   WHERE r.rule_code IN ('CASH_ROUND_LOSS_V1', 'CASH_ROUND_GAIN_V1');
  IF v_count <> 4 THEN
    RAISE EXCEPTION 'A6 0546: expected 4 Dr/Cr lines, found %', v_count;
  END IF;

  SELECT COUNT(*) INTO v_count FROM public.sys_fin_auto_post_mst ap
    JOIN public.sys_fin_evt_cd e ON e.evt_id = ap.evt_id
   WHERE e.evt_code IN ('CASH_ROUND_LOSS', 'CASH_ROUND_GAIN')
     AND ap.status_code = 'ACTIVE' AND ap.blocking_mode = 'NON_BLOCKING';
  IF v_count <> 2 THEN
    RAISE EXCEPTION 'A6 0546: expected 2 ACTIVE NON_BLOCKING policies, found %', v_count;
  END IF;
END $$;

COMMIT;
