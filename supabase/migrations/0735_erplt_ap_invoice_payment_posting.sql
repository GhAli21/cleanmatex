-- ============================================================================
-- Migration: 0735_erplt_ap_invoice_payment_posting
-- Feature:   Tax Config §4.1.4 — ERP-Lite supplier invoice and payment journals
-- Purpose:   Supplier invoices and supplier payments were saved with no ledger
--            entry, so recoverable input VAT and withheld tax never reached an
--            account. This seeds the two posting events, their rules and
--            non-blocking policies, and the two liability usage codes they
--            credit. It does not change a document's amounts.
--
-- Journals (base currency = document amount × the rate already stored on it):
--   AP_INVOICE_POSTED    Dr EXPENSE_GENERAL (total − recoverable)
--                        Dr VAT_INPUT       (recoverable, only when > 0)
--                        Cr AP_CONTROL      (invoice total)
--   AP_PAYMENT_RECORDED  Dr AP_CONTROL      (amount that settles the invoice)
--                        Cr cash/bank       (amount − withheld, by settlement)
--                        Cr WHT_PAYABLE     (withheld, only when > 0)
--
-- A missing policy must not be invented here for organizations that have no
-- chart: the app skips posting when these rows are absent. Once they exist,
-- a failed post is recorded as a finance exception and does not, by policy,
-- block the document. A SQL error inside the document transaction still
-- rolls that document back — the same behavior expenses already have — so
-- this migration also maps the two usage codes onto the standard chart.
--
-- Do not edit. A later change is a new migration.
-- ============================================================================

BEGIN;

-- ─── 1. Events ─────────────────────────────────────────────────────────────
-- evt_code is the stable id the posting engine loads. Names are bilingual
-- because the finance exception queue shows them.

INSERT INTO public.sys_fin_evt_cd (
  evt_code, name, name2, description, description2, phase_code, is_locked, rec_order,
  created_at, created_by, created_info, is_active, rec_status
) VALUES
  ('AP_INVOICE_POSTED', 'Supplier Invoice Posted', 'تم ترحيل فاتورة المورد',
   'ERP-Lite event: a supplier invoice recognizes the expense, recoverable input VAT and the payable.',
   'حدث ERP-Lite: فاتورة المورد تثبت المصروف وضريبة المدخلات القابلة للاسترداد والذمة الدائنة.',
   'V1', true, 210, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0735', true, 1),
  ('AP_PAYMENT_RECORDED', 'Supplier Payment Recorded', 'تم تسجيل دفعة المورد',
   'ERP-Lite event: a supplier payment clears the payable, pays cash or bank, and holds back withholding tax.',
   'حدث ERP-Lite: دفعة المورد تُسقِط الذمة وتدفع نقداً أو من البنك وتُبقي ضريبة الاستقطاع.',
   'V1', true, 220, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0735', true, 1)
ON CONFLICT (evt_code) DO UPDATE SET
  name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  phase_code = EXCLUDED.phase_code, is_locked = EXCLUDED.is_locked, rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin', updated_info = 'Migration 0735';

-- ─── 2. Usage codes ────────────────────────────────────────────────────────
-- AP_CONTROL is the supplier control account (standard chart 211001).
-- WHT_PAYABLE is tax withheld from the supplier and owed to the authority.
-- Neither is required for ERP-Lite readiness: an organization with no chart
-- must still open, and the document save reports a posting failure instead.

INSERT INTO public.sys_fin_usage_code_cd (
  usage_code, primary_acc_type_id, name, name2, description, description2,
  normal_balance, phase_code, is_required_v1, rec_order,
  created_at, created_by, created_info, is_active, rec_status
)
SELECT
  seed.usage_code, t.acc_type_id, seed.name, seed.name2, seed.description, seed.description2,
  seed.normal_balance, 'V1', false, seed.rec_order,
  CURRENT_TIMESTAMP, 'system_admin', 'Migration 0735', true, 1
FROM (
  VALUES
    ('AP_CONTROL', 'LIABILITY', 'Accounts Payable', 'حسابات الدائنين',
     'Usage code for the supplier payable control account credited by a supplier invoice and debited by a supplier payment.',
     'رمز استخدام لحساب الذمم الدائنة للموردين: يُدان بفاتورة المورد ويُخصم بدفعة المورد.',
     'CREDIT', 130),
    ('WHT_PAYABLE', 'LIABILITY', 'Withholding Tax Payable', 'ضريبة الاستقطاع المستحقة',
     'Usage code for tax withheld from a supplier payment and still owed to the authority.',
     'رمز استخدام لضريبة استُقطعت من دفعة مورد وما زالت مستحقة للجهة الضريبية.',
     'CREDIT', 140)
) AS seed(usage_code, acc_type_code, name, name2, description, description2, normal_balance, rec_order)
JOIN public.sys_fin_acc_type_cd t ON t.acc_type_code = seed.acc_type_code
ON CONFLICT (usage_code) DO UPDATE SET
  primary_acc_type_id = EXCLUDED.primary_acc_type_id,
  name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  normal_balance = EXCLUDED.normal_balance, phase_code = EXCLUDED.phase_code,
  is_required_v1 = EXCLUDED.is_required_v1, rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin', updated_info = 'Migration 0735';

-- ─── 3. Standard chart: payable hint + withholding account ─────────────────
-- 211001 already exists as "Accounts Payable" and is the control account.
-- The hint tells a later template apply which usage it serves. 212003 is new:
-- withholding is a tax liability, so it sits with output VAT under 212000,
-- not with trade payables.

UPDATE public.sys_fin_coa_tpl_dtl
   SET usage_hint_code = 'AP_CONTROL',
       updated_at = CURRENT_TIMESTAMP,
       updated_by = 'system_admin',
       updated_info = 'Migration 0735 — supplier invoices credit this control account'
 WHERE account_code = '211001'
   AND usage_hint_code IS NULL;

INSERT INTO public.sys_fin_coa_tpl_dtl (
  coa_tpl_id, parent_tpl_line_id, account_code, account_level, acc_type_id, acc_group_id,
  name, name2, description, description2,
  is_postable, is_control_account, is_system_linked, manual_post_allowed,
  branch_mode_code, usage_hint_code, is_system_seeded, is_locked,
  allow_rename, allow_code_change, allow_tenant_children, effective_from,
  created_by, created_info, rec_status, rec_order, is_active
)
SELECT
  sibling.coa_tpl_id, parent.coa_tpl_line_id, '212003', public.fn_fin_code_lvl('212003'),
  sibling.acc_type_id, sibling.acc_group_id,
  'Withholding Tax Payable', 'ضريبة الاستقطاع المستحقة',
  'Tax withheld from a supplier payment and owed to the authority. Usage WHT_PAYABLE.',
  'ضريبة استُقطعت من دفعة مورد ومستحقة للجهة الضريبية. الاستخدام WHT_PAYABLE.',
  true, false, true, true,
  'GLOBAL', 'WHT_PAYABLE', true, true,
  true, false, false, CURRENT_DATE,
  'system_admin', 'Migration 0735', 1, 116, true
FROM public.sys_fin_coa_tpl_dtl sibling
JOIN public.sys_fin_coa_tpl_dtl parent
  ON parent.coa_tpl_id = sibling.coa_tpl_id
 AND parent.account_code = '212000'
WHERE sibling.account_code = '212001'
  AND NOT EXISTS (
    SELECT 1 FROM public.sys_fin_coa_tpl_dtl existing
    WHERE existing.coa_tpl_id = sibling.coa_tpl_id
      AND existing.account_code = '212003'
  );

-- New organizations pick the map up from the template. usage_hint_code stays
-- an informational hint (0199); the usage template row is what an apply maps. is_required here means
-- a fresh apply creates the map; it does not block an organization that has
-- no chart yet (is_required_v1 on the usage code stays false).

INSERT INTO public.sys_fin_usage_tpl_dtl (
  tpl_pkg_id, usage_code_id, target_account_code, coa_tpl_line_id, branch_scope_code,
  is_required, effective_from, created_by, created_info, rec_status, rec_order, is_active
)
SELECT
  p.tpl_pkg_id, u.usage_code_id, seed.account_code, d.coa_tpl_line_id, 'GLOBAL',
  true, CURRENT_DATE, 'system_admin', 'Migration 0735', 1, seed.rec_order, true
FROM public.sys_fin_tpl_pkg_mst p
JOIN public.sys_fin_coa_tpl_mst h ON h.tpl_pkg_id = p.tpl_pkg_id
JOIN (
  VALUES
    ('AP_CONTROL', '211001', 130),
    ('WHT_PAYABLE', '212003', 140)
) AS seed(usage_code, account_code, rec_order) ON true
JOIN public.sys_fin_usage_code_cd u ON u.usage_code = seed.usage_code
JOIN public.sys_fin_coa_tpl_dtl d
  ON d.coa_tpl_id = h.coa_tpl_id AND d.account_code = seed.account_code
WHERE p.version_no = 2
  AND p.tpl_pkg_code IN (
    'ERP_LITE_SMALL_STD', 'ERP_LITE_MEDIUM_STD', 'ERP_LITE_MINI_STD',
    'ERP_LITE_FULL_STD', 'ERP_LITE_IND_STD', 'ERP_LITE_GLOBAL_STD'
  )
ON CONFLICT (tpl_pkg_id, usage_code_id, branch_scope_code) DO UPDATE SET
  target_account_code = EXCLUDED.target_account_code,
  coa_tpl_line_id = EXCLUDED.coa_tpl_line_id,
  is_required = EXCLUDED.is_required,
  rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_admin',
  updated_info = 'Migration 0735';

-- Organizations that already applied the standard chart get 212003 beside
-- their existing output-VAT account, then a global usage map. One row per
-- organization: a branch-scoped duplicate of 212001 must not create two
-- accounts with the same code (uq_ofa_tenant_code).

INSERT INTO public.org_fin_acct_mst (
  tenant_org_id, parent_account_id, branch_id, acc_type_id, acc_group_id,
  account_code, name, name2, description, description2,
  is_postable, is_control_account, is_system_linked, manual_post_allowed,
  effective_from, created_by, created_info, rec_status, rec_order, is_active,
  account_level, is_system_seeded, is_locked, source_tpl_pkg_id, source_tpl_line_id,
  allow_tenant_children
)
SELECT DISTINCT ON (src.tenant_org_id)
  src.tenant_org_id, src.parent_account_id, NULL, src.acc_type_id, src.acc_group_id,
  '212003', 'Withholding Tax Payable', 'ضريبة الاستقطاع المستحقة',
  'Tax withheld from a supplier payment and owed to the authority.',
  'ضريبة استُقطعت من دفعة مورد ومستحقة للجهة الضريبية.',
  true, false, true, true,
  CURRENT_DATE, 'system_admin', 'Migration 0735', 1, 116, true,
  src.account_level, true, true, src.source_tpl_pkg_id, tpl.coa_tpl_line_id,
  false
FROM public.org_fin_acct_mst src
LEFT JOIN LATERAL (
  SELECT d.coa_tpl_line_id
  FROM public.sys_fin_coa_tpl_dtl d
  JOIN public.sys_fin_coa_tpl_mst h ON h.coa_tpl_id = d.coa_tpl_id
  WHERE d.account_code = '212003'
    AND h.tpl_pkg_id = src.source_tpl_pkg_id
    AND d.is_active = true
  LIMIT 1
) tpl ON true
WHERE src.account_code = '212001'
  AND src.is_active = true
  AND src.rec_status = 1
  AND NOT EXISTS (
    SELECT 1 FROM public.org_fin_acct_mst existing
    WHERE existing.tenant_org_id = src.tenant_org_id
      AND existing.account_code = '212003'
  )
ORDER BY src.tenant_org_id, src.is_system_seeded DESC, src.created_at;

-- tenant_org_id is on every source row: the map is inserted per organization
-- that already has the target account. A map that is already active is left
-- alone so a hand-made mapping is not overwritten.

INSERT INTO public.org_fin_usage_map_mst (
  tenant_org_id, branch_id, usage_code_id, account_id, status_code, effective_from,
  created_by, created_info, rec_status, rec_order, is_active
)
SELECT DISTINCT ON (a.tenant_org_id, u.usage_code)
  a.tenant_org_id, NULL, u.usage_code_id, a.id, 'ACTIVE', CURRENT_DATE,
  'system_admin', 'Migration 0735', 1,
  CASE u.usage_code WHEN 'AP_CONTROL' THEN 130 ELSE 140 END,
  true
FROM public.org_fin_acct_mst a
JOIN public.sys_fin_usage_code_cd u
  ON (u.usage_code = 'AP_CONTROL' AND a.account_code = '211001')
  OR (u.usage_code = 'WHT_PAYABLE' AND a.account_code = '212003')
WHERE a.is_active = true
  AND a.rec_status = 1
  AND NOT EXISTS (
    SELECT 1 FROM public.org_fin_usage_map_mst m
    WHERE m.tenant_org_id = a.tenant_org_id
      AND m.usage_code_id = u.usage_code_id
      AND m.branch_id IS NULL
      AND m.status_code = 'ACTIVE'
      AND m.is_active = true
      AND m.rec_status = 1
  )
ORDER BY a.tenant_org_id, u.usage_code, a.is_system_seeded DESC, a.created_at;

-- ─── 4. Mapping rules ──────────────────────────────────────────────────────
-- Draft first, then activated below, matching 0546 / 0725. The package is
-- already published; these rules are the new lines on it.

INSERT INTO public.sys_fin_map_rule_mst (
  pkg_id, evt_id, rule_code, version_no, name, name2, description, description2,
  priority_no, condition_json, is_fallback, stop_on_match, status_code, rec_order,
  created_at, created_by, created_info, is_active, rec_status
)
SELECT
  p.pkg_id, e.evt_id, seed.rule_code, 1, seed.name, seed.name2, seed.description, seed.description2,
  seed.priority_no, '{}'::jsonb, true, true, 'DRAFT', seed.priority_no,
  CURRENT_TIMESTAMP, 'system_admin', 'Migration 0735', true, 1
FROM (
  VALUES
    ('AP_INVOICE_POSTED_V1', 'AP_INVOICE_POSTED',
     'Supplier invoice posted v1', 'ترحيل فاتورة المورد v1',
     'Dr expense (total minus recoverable VAT), Dr Input VAT, Cr Accounts Payable.',
     'مدين المصروف (الإجمالي ناقص ضريبة المدخلات القابلة للاسترداد)، مدين ضريبة المدخلات، دائن حسابات الدائنين.',
     210),
    ('AP_PAYMENT_RECORDED_V1', 'AP_PAYMENT_RECORDED',
     'Supplier payment recorded v1', 'تسجيل دفعة المورد v1',
     'Dr Accounts Payable for the amount that settles the invoice, Cr cash or bank for the cash paid, Cr withholding payable for the withheld part.',
     'مدين حسابات الدائنين بالمبلغ الذي يُسوي الفاتورة، دائن النقد أو البنك بالمدفوع، دائن ضريبة الاستقطاع بالمستقطع.',
     220)
) AS seed(rule_code, evt_code, name, name2, description, description2, priority_no)
JOIN public.sys_fin_gov_pkg_mst p ON p.pkg_code = 'ERP_LITE_V1_CORE' AND p.version_no = 1
JOIN public.sys_fin_evt_cd e ON e.evt_code = seed.evt_code
ON CONFLICT (pkg_id, rule_code) DO UPDATE SET
  evt_id = EXCLUDED.evt_id, name = EXCLUDED.name, name2 = EXCLUDED.name2,
  description = EXCLUDED.description, description2 = EXCLUDED.description2,
  priority_no = EXCLUDED.priority_no, condition_json = EXCLUDED.condition_json,
  is_fallback = EXCLUDED.is_fallback, stop_on_match = EXCLUDED.stop_on_match,
  rec_order = EXCLUDED.rec_order, is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin', updated_info = 'Migration 0735';

INSERT INTO public.sys_fin_map_rule_dtl (
  rule_id, line_no, entry_side, usage_code_id, resolver_id, amount_source_code,
  line_type_code, condition_json, rec_order,
  created_at, created_by, created_info, is_active, rec_status
)
SELECT
  r.rule_id, seed.line_no, seed.entry_side, uc.usage_code_id, res.resolver_id, seed.amount_source_code,
  seed.line_type_code, seed.cond::jsonb, seed.rec_order,
  CURRENT_TIMESTAMP, 'system_admin', 'Migration 0735', true, 1
FROM (
  VALUES
    ('AP_INVOICE_POSTED_V1', 10, 'DR', 'EXPENSE_GENERAL', NULL, 'net_amount', 'MAIN', '{}', 10),
    ('AP_INVOICE_POSTED_V1', 15, 'DR', 'VAT_INPUT', NULL, 'tax_amount', 'VAT', '{"when":"tax_amount > 0"}', 15),
    ('AP_INVOICE_POSTED_V1', 20, 'CR', 'AP_CONTROL', NULL, 'gross_amount', 'MAIN', '{}', 20),
    ('AP_PAYMENT_RECORDED_V1', 10, 'DR', 'AP_CONTROL', NULL, 'gross_amount', 'MAIN', '{}', 10),
    ('AP_PAYMENT_RECORDED_V1', 20, 'CR', NULL, 'PAYMENT_METHOD_MAP', 'net_amount', 'MAIN', '{}', 20),
    ('AP_PAYMENT_RECORDED_V1', 30, 'CR', 'WHT_PAYABLE', NULL, 'tax_amount', 'VAT', '{"when":"tax_amount > 0"}', 30)
) AS seed(rule_code, line_no, entry_side, usage_code, acct_resolver_code, amount_source_code, line_type_code, cond, rec_order)
JOIN public.sys_fin_map_rule_mst r ON r.rule_code = seed.rule_code
LEFT JOIN public.sys_fin_usage_code_cd uc ON uc.usage_code = seed.usage_code
LEFT JOIN public.sys_fin_resolver_cd res ON res.resolver_code = seed.acct_resolver_code
ON CONFLICT (rule_id, line_no) DO UPDATE SET
  entry_side = EXCLUDED.entry_side, usage_code_id = EXCLUDED.usage_code_id, resolver_id = EXCLUDED.resolver_id,
  amount_source_code = EXCLUDED.amount_source_code, line_type_code = EXCLUDED.line_type_code,
  condition_json = EXCLUDED.condition_json, rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin', updated_info = 'Migration 0735';

-- ─── 5. Policy: never block the supplier document ──────────────────────────

INSERT INTO public.sys_fin_auto_post_mst (
  pkg_id, evt_id, policy_ver, is_enabled, blocking_mode, required_success,
  retry_allowed, repost_allowed, status_code, failure_action_code, notes, notes2, rec_order,
  created_at, created_by, created_info, is_active, rec_status
)
SELECT
  p.pkg_id, e.evt_id, 1, true, 'NON_BLOCKING', false, true, true, 'DRAFT', 'FINANCE_EXCEPTION',
  'Post the supplier document; a posting failure goes to the finance exception queue and does not, by this policy, block the save.',
  'رحّل مستند المورد؛ فشل الترحيل يذهب إلى قائمة استثناءات المالية ولا يمنع الحفظ بموجب هذه السياسة.',
  seed.rec_order, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0735', true, 1
FROM (
  VALUES ('AP_INVOICE_POSTED', 210), ('AP_PAYMENT_RECORDED', 220)
) AS seed(evt_code, rec_order)
JOIN public.sys_fin_gov_pkg_mst p ON p.pkg_code = 'ERP_LITE_V1_CORE' AND p.version_no = 1
JOIN public.sys_fin_evt_cd e ON e.evt_code = seed.evt_code
ON CONFLICT (pkg_id, evt_id, policy_ver) DO UPDATE SET
  is_enabled = EXCLUDED.is_enabled, blocking_mode = EXCLUDED.blocking_mode,
  required_success = EXCLUDED.required_success, retry_allowed = EXCLUDED.retry_allowed,
  repost_allowed = EXCLUDED.repost_allowed, failure_action_code = EXCLUDED.failure_action_code,
  notes = EXCLUDED.notes, notes2 = EXCLUDED.notes2, rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active, rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin', updated_info = 'Migration 0735';

UPDATE public.sys_fin_map_rule_mst r
   SET status_code = 'ACTIVE', updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin',
       updated_info = 'Migration 0735 — activate supplier invoice and payment rules'
  FROM public.sys_fin_evt_cd e
 WHERE r.evt_id = e.evt_id
   AND e.evt_code IN ('AP_INVOICE_POSTED', 'AP_PAYMENT_RECORDED')
   AND r.status_code = 'DRAFT';

UPDATE public.sys_fin_auto_post_mst ap
   SET status_code = 'ACTIVE', effective_from = COALESCE(ap.effective_from, CURRENT_DATE),
       updated_at = CURRENT_TIMESTAMP, updated_by = 'system_admin',
       updated_info = 'Migration 0735 — activate supplier invoice and payment policies'
  FROM public.sys_fin_evt_cd e
 WHERE ap.evt_id = e.evt_id
   AND e.evt_code IN ('AP_INVOICE_POSTED', 'AP_PAYMENT_RECORDED')
   AND ap.status_code = 'DRAFT';

-- ─── 6. Validation ─────────────────────────────────────────────────────────

DO $$
DECLARE
  v INTEGER;
BEGIN
  SELECT count(*) INTO v FROM public.sys_fin_evt_cd
   WHERE evt_code IN ('AP_INVOICE_POSTED', 'AP_PAYMENT_RECORDED') AND is_active = true;
  IF v <> 2 THEN
    RAISE EXCEPTION '0735: expected 2 posting events, found %', v;
  END IF;

  SELECT count(*) INTO v FROM public.sys_fin_usage_code_cd
   WHERE usage_code IN ('AP_CONTROL', 'WHT_PAYABLE') AND is_active = true;
  IF v <> 2 THEN
    RAISE EXCEPTION '0735: expected 2 usage codes, found %', v;
  END IF;

  SELECT count(*) INTO v FROM public.sys_fin_map_rule_mst r
    JOIN public.sys_fin_evt_cd e ON e.evt_id = r.evt_id
   WHERE e.evt_code IN ('AP_INVOICE_POSTED', 'AP_PAYMENT_RECORDED') AND r.status_code = 'ACTIVE';
  IF v <> 2 THEN
    RAISE EXCEPTION '0735: expected 2 ACTIVE mapping rules, found %', v;
  END IF;

  SELECT count(*) INTO v FROM public.sys_fin_map_rule_dtl d
    JOIN public.sys_fin_map_rule_mst r ON r.rule_id = d.rule_id
   WHERE r.rule_code IN ('AP_INVOICE_POSTED_V1', 'AP_PAYMENT_RECORDED_V1') AND d.is_active = true;
  IF v <> 6 THEN
    RAISE EXCEPTION '0735: expected 6 rule lines, found %', v;
  END IF;

  -- The cash/bank line has a resolver and no usage code. A dropped LEFT JOIN
  -- would leave that line with neither, and the engine could not post it.
  SELECT count(*) INTO v FROM public.sys_fin_map_rule_dtl d
    JOIN public.sys_fin_map_rule_mst r ON r.rule_id = d.rule_id
    JOIN public.sys_fin_resolver_cd res ON res.resolver_id = d.resolver_id
   WHERE r.rule_code = 'AP_PAYMENT_RECORDED_V1' AND d.line_no = 20
     AND res.resolver_code = 'PAYMENT_METHOD_MAP' AND d.usage_code_id IS NULL;
  IF v <> 1 THEN
    RAISE EXCEPTION '0735: payment cash/bank line is missing PAYMENT_METHOD_MAP';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.sys_fin_coa_tpl_dtl vat
    WHERE vat.account_code = '212001'
      AND NOT EXISTS (
        SELECT 1 FROM public.sys_fin_coa_tpl_dtl wht
        WHERE wht.coa_tpl_id = vat.coa_tpl_id AND wht.account_code = '212003'
      )
  ) THEN
    RAISE EXCEPTION '0735: a chart template has output VAT (212001) but no withholding account (212003)';
  END IF;
END $$;

COMMIT;
