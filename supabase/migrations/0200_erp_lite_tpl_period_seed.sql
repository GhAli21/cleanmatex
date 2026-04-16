-- ==================================================================
-- Migration: 0200_erp_lite_tpl_period_seed.sql
-- Purpose: Create ERP-Lite template period and operational defaults
--          and seed published baseline templates per main business type
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Notes:
--   - Seeds one published template package per main business type
--   - Seeds one global fallback template package
--   - Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.sys_fin_period_tpl_mst (
  period_tpl_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tpl_pkg_id UUID NOT NULL,
  fiscal_start_month SMALLINT NOT NULL DEFAULT 1,
  period_style_code VARCHAR(12) NOT NULL DEFAULT 'MONTHLY',
  seed_horizon_months SMALLINT NOT NULL DEFAULT 24,
  default_open_status VARCHAR(12) NOT NULL DEFAULT 'OPEN',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT uq_sfpm_pkg UNIQUE (tpl_pkg_id),
  CONSTRAINT fk_sfpm_pkg FOREIGN KEY (tpl_pkg_id)
    REFERENCES public.sys_fin_tpl_pkg_mst(tpl_pkg_id) ON DELETE CASCADE,
  CONSTRAINT chk_sfpm_mon CHECK (fiscal_start_month BETWEEN 1 AND 12),
  CONSTRAINT chk_sfpm_style CHECK (period_style_code IN ('MONTHLY')),
  CONSTRAINT chk_sfpm_seed CHECK (seed_horizon_months BETWEEN 12 AND 60),
  CONSTRAINT chk_sfpm_stat CHECK (default_open_status IN ('OPEN', 'SOFT_LOCKED', 'CLOSED'))
);

CREATE TABLE IF NOT EXISTS public.sys_fin_period_tpl_dtl (
  period_tpl_line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_tpl_id UUID NOT NULL,
  line_no SMALLINT NOT NULL,
  month_no SMALLINT NOT NULL,
  label_text VARCHAR(30),
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT uq_sfpd_line UNIQUE (period_tpl_id, line_no),
  CONSTRAINT fk_sfpd_tpl FOREIGN KEY (period_tpl_id)
    REFERENCES public.sys_fin_period_tpl_mst(period_tpl_id) ON DELETE CASCADE,
  CONSTRAINT chk_sfpd_line CHECK (line_no BETWEEN 1 AND 12),
  CONSTRAINT chk_sfpd_mon CHECK (month_no BETWEEN 1 AND 12)
);

CREATE TABLE IF NOT EXISTS public.sys_fin_oper_tpl_dtl (
  oper_tpl_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tpl_pkg_id UUID NOT NULL,
  oper_code VARCHAR(40) NOT NULL,
  target_account_code VARCHAR(40),
  config_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  status_code VARCHAR(12) NOT NULL DEFAULT 'ACTIVE',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT uq_sfot_code UNIQUE (tpl_pkg_id, oper_code),
  CONSTRAINT fk_sfot_pkg FOREIGN KEY (tpl_pkg_id)
    REFERENCES public.sys_fin_tpl_pkg_mst(tpl_pkg_id) ON DELETE CASCADE,
  CONSTRAINT chk_sfot_stat CHECK (status_code IN ('ACTIVE', 'INACTIVE'))
);

CREATE INDEX IF NOT EXISTS idx_sfpm_pkg
  ON public.sys_fin_period_tpl_mst(tpl_pkg_id, is_active);

CREATE INDEX IF NOT EXISTS idx_sfpd_tpl
  ON public.sys_fin_period_tpl_dtl(period_tpl_id, line_no);

CREATE INDEX IF NOT EXISTS idx_sfot_pkg
  ON public.sys_fin_oper_tpl_dtl(tpl_pkg_id, oper_code, is_active);

COMMENT ON TABLE public.sys_fin_period_tpl_mst IS
  'ERP-Lite HQ period policy template header.';
COMMENT ON TABLE public.sys_fin_oper_tpl_dtl IS
  'ERP-Lite HQ operational defaults template rows such as default petty cash box behavior.';

INSERT INTO public.sys_fin_tpl_pkg_mst (
  tpl_pkg_code,
  version_no,
  name,
  name2,
  description,
  description2,
  phase_scope_code,
  main_business_type_code,
  status_code,
  compat_version,
  effective_from,
  approved_at,
  approved_by,
  published_at,
  published_by,
  created_by,
  created_info,
  rec_status,
  rec_order,
  is_active
)
VALUES
  ('ERP_LITE_SMALL_STD', 1, 'ERP-Lite Small Laundry Standard', 'القالب القياسي لمغسلة صغيرة', 'Published ERP-Lite baseline for small laundry tenants.', 'خط أساس منشور لـ ERP-Lite لمستأجري المغاسل الصغيرة.', 'ALL', 'SMALL_LAUNDRY', 'DRAFT', 'erp_lite_runtime_v1', CURRENT_DATE, CURRENT_TIMESTAMP, 'system_seed', CURRENT_TIMESTAMP, 'system_seed', 'system_seed', 'Migration 0200', 1, 10, true),
  ('ERP_LITE_MEDIUM_STD', 1, 'ERP-Lite Medium Dry Clean Standard', 'القالب القياسي لتنظيف جاف متوسط', 'Published ERP-Lite baseline for medium dry-clean tenants.', 'خط أساس منشور لـ ERP-Lite لمستأجري التنظيف الجاف المتوسط.', 'ALL', 'MEDIUM_DRY_CLEAN', 'DRAFT', 'erp_lite_runtime_v1', CURRENT_DATE, CURRENT_TIMESTAMP, 'system_seed', CURRENT_TIMESTAMP, 'system_seed', 'system_seed', 'Migration 0200', 1, 20, true),
  ('ERP_LITE_MINI_STD', 1, 'ERP-Lite Mini Shop Standard', 'القالب القياسي للمتجر الصغير', 'Published ERP-Lite baseline for mini-shop tenants.', 'خط أساس منشور لـ ERP-Lite لمستأجري المتاجر الصغيرة.', 'ALL', 'MINI_SHOP', 'DRAFT', 'erp_lite_runtime_v1', CURRENT_DATE, CURRENT_TIMESTAMP, 'system_seed', CURRENT_TIMESTAMP, 'system_seed', 'system_seed', 'Migration 0200', 1, 30, true),
  ('ERP_LITE_FULL_STD', 1, 'ERP-Lite Full Service Standard', 'القالب القياسي للخدمة الكاملة', 'Published ERP-Lite baseline for full-service laundry tenants.', 'خط أساس منشور لـ ERP-Lite لمستأجري الخدمة الكاملة.', 'ALL', 'FULL_SERVICE', 'DRAFT', 'erp_lite_runtime_v1', CURRENT_DATE, CURRENT_TIMESTAMP, 'system_seed', CURRENT_TIMESTAMP, 'system_seed', 'system_seed', 'Migration 0200', 1, 40, true),
  ('ERP_LITE_IND_STD', 1, 'ERP-Lite Industrial Standard', 'القالب القياسي للمغسلة الصناعية', 'Published ERP-Lite baseline for industrial laundry tenants.', 'خط أساس منشور لـ ERP-Lite لمستأجري المغاسل الصناعية.', 'ALL', 'INDUSTRIAL', 'DRAFT', 'erp_lite_runtime_v1', CURRENT_DATE, CURRENT_TIMESTAMP, 'system_seed', CURRENT_TIMESTAMP, 'system_seed', 'system_seed', 'Migration 0200', 1, 50, true),
  ('ERP_LITE_GLOBAL_STD', 1, 'ERP-Lite Global Fallback', 'القالب الاحتياطي العالمي لـ ERP-Lite', 'Published ERP-Lite fallback used when tenant business type is missing or unmatched.', 'قالب احتياطي منشور لـ ERP-Lite يُستخدم عندما يكون نوع العمل للمستأجر مفقوداً أو غير مطابق.', 'ALL', NULL, 'DRAFT', 'erp_lite_runtime_v1', CURRENT_DATE, CURRENT_TIMESTAMP, 'system_seed', CURRENT_TIMESTAMP, 'system_seed', 'system_seed', 'Migration 0200', 1, 90, true)
ON CONFLICT (tpl_pkg_code, version_no) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  phase_scope_code = EXCLUDED.phase_scope_code,
  main_business_type_code = EXCLUDED.main_business_type_code,
  status_code = EXCLUDED.status_code,
  compat_version = EXCLUDED.compat_version,
  effective_from = EXCLUDED.effective_from,
  approved_at = EXCLUDED.approved_at,
  approved_by = EXCLUDED.approved_by,
  published_at = EXCLUDED.published_at,
  published_by = EXCLUDED.published_by,
  rec_status = EXCLUDED.rec_status,
  rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_seed',
  updated_info = 'Migration 0200';

INSERT INTO public.sys_fin_tpl_assign_mst (
  tpl_pkg_id,
  assignment_mode,
  main_business_type_code,
  priority_no,
  is_default_fallback,
  status_code,
  created_by,
  created_info,
  rec_status,
  rec_order,
  is_active
)
SELECT
  p.tpl_pkg_id,
  'BTYPE',
  p.main_business_type_code,
  100,
  false,
  'ACTIVE',
  'system_seed',
  'Migration 0200 - default business-type assignment',
  1,
  p.rec_order,
  true
FROM public.sys_fin_tpl_pkg_mst p
WHERE p.tpl_pkg_code IN (
  'ERP_LITE_SMALL_STD',
  'ERP_LITE_MEDIUM_STD',
  'ERP_LITE_MINI_STD',
  'ERP_LITE_FULL_STD',
  'ERP_LITE_IND_STD'
)
AND NOT EXISTS (
  SELECT 1
  FROM public.sys_fin_tpl_assign_mst a
  WHERE a.tpl_pkg_id = p.tpl_pkg_id
    AND a.assignment_mode = 'BTYPE'
    AND a.main_business_type_code = p.main_business_type_code
    AND a.status_code = 'ACTIVE'
    AND a.is_active = true
    AND a.rec_status = 1
);

INSERT INTO public.sys_fin_tpl_assign_mst (
  tpl_pkg_id,
  assignment_mode,
  priority_no,
  is_default_fallback,
  status_code,
  created_by,
  created_info,
  rec_status,
  rec_order,
  is_active
)
SELECT
  p.tpl_pkg_id,
  'FALLBACK',
  999,
  true,
  'ACTIVE',
  'system_seed',
  'Migration 0200 - global fallback assignment',
  1,
  999,
  true
FROM public.sys_fin_tpl_pkg_mst p
WHERE p.tpl_pkg_code = 'ERP_LITE_GLOBAL_STD'
AND NOT EXISTS (
  SELECT 1
  FROM public.sys_fin_tpl_assign_mst a
  WHERE a.tpl_pkg_id = p.tpl_pkg_id
    AND a.assignment_mode = 'FALLBACK'
    AND a.is_default_fallback = true
    AND a.status_code = 'ACTIVE'
    AND a.is_active = true
    AND a.rec_status = 1
);

INSERT INTO public.sys_fin_coa_tpl_mst (
  tpl_pkg_id,
  coa_template_code,
  name,
  name2,
  description,
  description2,
  status_code,
  created_by,
  created_info,
  rec_status,
  rec_order,
  is_active
)
SELECT
  p.tpl_pkg_id,
  p.tpl_pkg_code || '_COA',
  p.name || ' COA',
  COALESCE(p.name2, p.name) || ' COA',
  'Default ERP-Lite COA template for package ' || p.tpl_pkg_code,
  'قالب شجرة حسابات افتراضي لـ ERP-Lite للحزمة ' || p.tpl_pkg_code,
  'ACTIVE',
  'system_seed',
  'Migration 0200 - default COA template headers',
  1,
  p.rec_order,
  true
FROM public.sys_fin_tpl_pkg_mst p
WHERE p.tpl_pkg_code IN (
  'ERP_LITE_SMALL_STD',
  'ERP_LITE_MEDIUM_STD',
  'ERP_LITE_MINI_STD',
  'ERP_LITE_FULL_STD',
  'ERP_LITE_IND_STD',
  'ERP_LITE_GLOBAL_STD'
)
ON CONFLICT (tpl_pkg_id) DO UPDATE SET
  coa_template_code = EXCLUDED.coa_template_code,
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  status_code = EXCLUDED.status_code,
  rec_status = EXCLUDED.rec_status,
  rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_seed',
  updated_info = 'Migration 0200';

WITH coa_hdr AS (
  SELECT p.tpl_pkg_code, c.coa_tpl_id
  FROM public.sys_fin_tpl_pkg_mst p
  JOIN public.sys_fin_coa_tpl_mst c
    ON c.tpl_pkg_id = p.tpl_pkg_id
  WHERE p.tpl_pkg_code IN (
    'ERP_LITE_SMALL_STD',
    'ERP_LITE_MEDIUM_STD',
    'ERP_LITE_MINI_STD',
    'ERP_LITE_FULL_STD',
    'ERP_LITE_IND_STD',
    'ERP_LITE_GLOBAL_STD'
  )
)
INSERT INTO public.sys_fin_coa_tpl_dtl (
  coa_tpl_id,
  parent_tpl_line_id,
  account_code,
  acc_type_id,
  acc_group_id,
  name,
  name2,
  description,
  description2,
  is_postable,
  is_control_account,
  is_system_linked,
  manual_post_allowed,
  branch_mode_code,
  usage_hint_code,
  created_by,
  created_info,
  rec_status,
  rec_order,
  is_active
)
SELECT
  h.coa_tpl_id,
  NULL,
  seed.account_code,
  t.acc_type_id,
  g.acc_group_id,
  seed.name,
  seed.name2,
  seed.description,
  seed.description2,
  false,
  false,
  false,
  false,
  'GLOBAL',
  NULL,
  'system_seed',
  'Migration 0200 - COA template headers',
  1,
  seed.rec_order,
  true
FROM coa_hdr h
JOIN (
  VALUES
    ('1000', 'ASSET', 'ASSET_CURRENT', 'Current Assets', 'الأصول المتداولة', 'Current assets header.', 'رأس الأصول المتداولة.', 1000),
    ('2000', 'LIABILITY', 'LIAB_CURRENT', 'Current Liabilities', 'الالتزامات المتداولة', 'Current liabilities header.', 'رأس الالتزامات المتداولة.', 2000),
    ('3000', 'EQUITY', NULL, 'Equity', 'حقوق الملكية', 'Equity header.', 'رأس حقوق الملكية.', 3000),
    ('4000', 'REVENUE', 'REV_OPERATING', 'Operating Revenue', 'الإيرادات التشغيلية', 'Operating revenue header.', 'رأس الإيرادات التشغيلية.', 4000),
    ('5000', 'EXPENSE', 'EXP_OPERATING', 'Operating Expenses', 'المصروفات التشغيلية', 'Operating expense header.', 'رأس المصروفات التشغيلية.', 5000)
) AS seed(account_code, acc_type_code, acc_group_code, name, name2, description, description2, rec_order)
  ON TRUE
JOIN public.sys_fin_acc_type_cd t
  ON t.acc_type_code = seed.acc_type_code
 AND t.is_active = true
 AND t.rec_status = 1
LEFT JOIN public.sys_fin_acc_group_cd g
  ON g.acc_group_code = seed.acc_group_code
 AND g.is_active = true
 AND g.rec_status = 1
ON CONFLICT (coa_tpl_id, account_code) DO UPDATE SET
  acc_type_id = EXCLUDED.acc_type_id,
  acc_group_id = EXCLUDED.acc_group_id,
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  is_postable = EXCLUDED.is_postable,
  is_control_account = EXCLUDED.is_control_account,
  is_system_linked = EXCLUDED.is_system_linked,
  manual_post_allowed = EXCLUDED.manual_post_allowed,
  branch_mode_code = EXCLUDED.branch_mode_code,
  usage_hint_code = EXCLUDED.usage_hint_code,
  rec_status = EXCLUDED.rec_status,
  rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_seed',
  updated_info = 'Migration 0200';

WITH coa_hdr AS (
  SELECT p.tpl_pkg_code, c.coa_tpl_id
  FROM public.sys_fin_tpl_pkg_mst p
  JOIN public.sys_fin_coa_tpl_mst c
    ON c.tpl_pkg_id = p.tpl_pkg_id
  WHERE p.tpl_pkg_code IN (
    'ERP_LITE_SMALL_STD',
    'ERP_LITE_MEDIUM_STD',
    'ERP_LITE_MINI_STD',
    'ERP_LITE_FULL_STD',
    'ERP_LITE_IND_STD',
    'ERP_LITE_GLOBAL_STD'
  )
),
parent_lines AS (
  SELECT d.coa_tpl_id, d.account_code, d.coa_tpl_line_id
  FROM public.sys_fin_coa_tpl_dtl d
  WHERE d.account_code IN ('1000', '2000', '3000', '4000', '5000')
)
INSERT INTO public.sys_fin_coa_tpl_dtl (
  coa_tpl_id,
  parent_tpl_line_id,
  account_code,
  acc_type_id,
  acc_group_id,
  name,
  name2,
  description,
  description2,
  is_postable,
  is_control_account,
  is_system_linked,
  manual_post_allowed,
  branch_mode_code,
  usage_hint_code,
  created_by,
  created_info,
  rec_status,
  rec_order,
  is_active
)
SELECT
  h.coa_tpl_id,
  p.coa_tpl_line_id,
  seed.account_code,
  t.acc_type_id,
  g.acc_group_id,
  seed.name,
  seed.name2,
  seed.description,
  seed.description2,
  seed.is_postable,
  seed.is_control_account,
  seed.is_system_linked,
  seed.manual_post_allowed,
  seed.branch_mode_code,
  seed.usage_hint_code,
  'system_seed',
  'Migration 0200 - COA template accounts',
  1,
  seed.rec_order,
  true
FROM public.sys_fin_tpl_pkg_mst pkg
JOIN public.sys_fin_coa_tpl_mst h
  ON h.tpl_pkg_id = pkg.tpl_pkg_id
JOIN (
  VALUES
    ('1100', '1000', 'ASSET', 'ASSET_RECEIVABLE', 'Accounts Receivable', 'الذمم المدينة', 'Receivable control account.', 'حساب رقابي للذمم المدينة.', true, true, true, false, 'GLOBAL', 'ACCOUNTS_RECEIVABLE', 1100),
    ('1110', '1000', 'ASSET', 'ASSET_CASH_BANK', 'Cash Main', 'الصندوق الرئيسي', 'Main cash account.', 'حساب الصندوق الرئيسي.', true, false, true, false, 'GLOBAL', 'CASH_MAIN', 1110),
    ('1120', '1000', 'ASSET', 'ASSET_CASH_BANK', 'Bank Card Clearing', 'تسوية بطاقات البنك', 'Card clearing account.', 'حساب تسوية بطاقات البنك.', true, false, true, false, 'GLOBAL', 'BANK_CARD_CLEARING', 1120),
    ('1130', '1000', 'ASSET', 'ASSET_CASH_BANK', 'Petty Cash Main', 'العهدة النقدية الرئيسية', 'Main petty cash account.', 'حساب العهدة النقدية الرئيسية.', true, false, true, false, 'GLOBAL', 'PETTY_CASH_MAIN', 1130),
    ('1140', '1000', 'ASSET', 'ASSET_TAX_INPUT', 'Input VAT Recoverable', 'ضريبة المدخلات القابلة للاسترداد', 'Recoverable input VAT account.', 'حساب ضريبة المدخلات القابلة للاسترداد.', true, false, true, false, 'GLOBAL', 'VAT_INPUT', 1140),
    ('1150', '1000', 'ASSET', 'ASSET_CASH_BANK', 'Bank Main Operating', 'البنك التشغيلي الرئيسي', 'Operating bank asset account.', 'حساب أصل للبنك التشغيلي الرئيسي.', true, false, false, true, 'GLOBAL', NULL, 1150),
    ('2100', '2000', 'LIABILITY', 'LIAB_TAX_OUTPUT', 'Output VAT Payable', 'ضريبة المخرجات المستحقة', 'Output VAT payable account.', 'حساب ضريبة المخرجات المستحقة.', true, false, true, false, 'GLOBAL', 'VAT_OUTPUT', 2100),
    ('2110', '2000', 'LIABILITY', 'LIAB_CURRENT', 'Wallet Clearing', 'تسوية المحفظة', 'Wallet clearing liability.', 'التزام تسوية المحفظة.', true, false, true, false, 'GLOBAL', 'WALLET_CLEARING', 2110),
    ('2120', '2000', 'LIABILITY', 'LIAB_CURRENT', 'Refund Payable', 'استردادات مستحقة', 'Refund payable liability.', 'التزام الاستردادات المستحقة.', true, false, true, false, 'GLOBAL', 'REFUND_PAYABLE', 2120),
    ('2130', '2000', 'LIABILITY', 'LIAB_CURRENT', 'Accounts Payable Control', 'الذمم الدائنة الرقابية', 'Accounts payable control account.', 'حساب رقابي للذمم الدائنة.', true, true, false, true, 'GLOBAL', NULL, 2130),
    ('3100', '3000', 'EQUITY', NULL, 'Owner Capital', 'رأس المال', 'Owner capital equity account.', 'حساب حقوق ملكية لرأس المال.', true, false, false, true, 'GLOBAL', NULL, 3100),
    ('3200', '3000', 'EQUITY', NULL, 'Retained Earnings', 'الأرباح المحتجزة', 'Retained earnings account.', 'حساب الأرباح المحتجزة.', true, false, false, true, 'GLOBAL', NULL, 3200),
    ('4100', '4000', 'REVENUE', 'REV_OPERATING', 'Core Service Revenue', 'إيراد الخدمة الأساسية', 'Primary service revenue account.', 'حساب إيراد الخدمة الأساسية.', true, false, true, false, 'GLOBAL', 'SALES_REVENUE', 4100),
    ('4110', '4000', 'REVENUE', 'REV_OPERATING', 'Delivery Revenue', 'إيراد التوصيل', 'Delivery revenue account.', 'حساب إيراد التوصيل.', true, false, false, true, 'GLOBAL', NULL, 4110),
    ('5100', '5000', 'EXPENSE', 'EXP_OPERATING', 'General Operating Expense', 'مصروف تشغيلي عام', 'General expense account.', 'حساب مصروف تشغيلي عام.', true, false, true, false, 'GLOBAL', 'EXPENSE_GENERAL', 5100),
    ('5110', '5000', 'EXPENSE', 'EXP_OPERATING', 'Petty Cash Expense', 'مصروف العهدة النقدية', 'Petty cash expense account.', 'حساب مصروف العهدة النقدية.', true, false, true, false, 'GLOBAL', 'PETTY_CASH_EXPENSE', 5110),
    ('5140', '5000', 'EXPENSE', 'EXP_OPERATING', 'Rounding Loss', 'خسارة فروقات التقريب', 'Rounding loss account.', 'حساب خسارة فروقات التقريب.', true, false, false, true, 'GLOBAL', 'ROUNDING_ADJUSTMENT', 5140)
) AS seed(account_code, parent_code, acc_type_code, acc_group_code, name, name2, description, description2, is_postable, is_control_account, is_system_linked, manual_post_allowed, branch_mode_code, usage_hint_code, rec_order)
  ON TRUE
JOIN parent_lines p
  ON p.coa_tpl_id = h.coa_tpl_id
 AND p.account_code = seed.parent_code
JOIN public.sys_fin_acc_type_cd t
  ON t.acc_type_code = seed.acc_type_code
 AND t.is_active = true
 AND t.rec_status = 1
LEFT JOIN public.sys_fin_acc_group_cd g
  ON g.acc_group_code = seed.acc_group_code
 AND g.is_active = true
 AND g.rec_status = 1
WHERE pkg.tpl_pkg_code IN (
  'ERP_LITE_SMALL_STD',
  'ERP_LITE_MEDIUM_STD',
  'ERP_LITE_MINI_STD',
  'ERP_LITE_FULL_STD',
  'ERP_LITE_IND_STD',
  'ERP_LITE_GLOBAL_STD'
)
ON CONFLICT (coa_tpl_id, account_code) DO UPDATE SET
  parent_tpl_line_id = EXCLUDED.parent_tpl_line_id,
  acc_type_id = EXCLUDED.acc_type_id,
  acc_group_id = EXCLUDED.acc_group_id,
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  is_postable = EXCLUDED.is_postable,
  is_control_account = EXCLUDED.is_control_account,
  is_system_linked = EXCLUDED.is_system_linked,
  manual_post_allowed = EXCLUDED.manual_post_allowed,
  branch_mode_code = EXCLUDED.branch_mode_code,
  usage_hint_code = EXCLUDED.usage_hint_code,
  rec_status = EXCLUDED.rec_status,
  rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_seed',
  updated_info = 'Migration 0200';

INSERT INTO public.sys_fin_usage_tpl_dtl (
  tpl_pkg_id,
  usage_code_id,
  target_account_code,
  branch_scope_code,
  is_required,
  created_by,
  created_info,
  rec_status,
  rec_order,
  is_active
)
SELECT
  p.tpl_pkg_id,
  uc.usage_code_id,
  seed.target_account_code,
  'GLOBAL',
  seed.is_required,
  'system_seed',
  'Migration 0200 - usage template seeds',
  1,
  seed.rec_order,
  true
FROM public.sys_fin_tpl_pkg_mst p
JOIN (
  VALUES
    ('SALES_REVENUE', '4100', true, 10),
    ('VAT_OUTPUT', '2100', true, 20),
    ('VAT_INPUT', '1140', true, 30),
    ('ACCOUNTS_RECEIVABLE', '1100', true, 40),
    ('CASH_MAIN', '1110', true, 50),
    ('BANK_CARD_CLEARING', '1120', true, 60),
    ('PETTY_CASH_MAIN', '1130', true, 70),
    ('WALLET_CLEARING', '2110', false, 80),
    ('REFUND_PAYABLE', '2120', false, 90),
    ('EXPENSE_GENERAL', '5100', false, 100),
    ('PETTY_CASH_EXPENSE', '5110', false, 110),
    ('ROUNDING_ADJUSTMENT', '5140', false, 120)
  ) AS seed(usage_code, target_account_code, is_required, rec_order)
  ON TRUE
JOIN public.sys_fin_usage_code_cd uc
  ON uc.usage_code = seed.usage_code
 AND uc.is_active = true
 AND uc.rec_status = 1
WHERE p.tpl_pkg_code IN (
  'ERP_LITE_SMALL_STD',
  'ERP_LITE_MEDIUM_STD',
  'ERP_LITE_MINI_STD',
  'ERP_LITE_FULL_STD',
  'ERP_LITE_IND_STD',
  'ERP_LITE_GLOBAL_STD'
)
ON CONFLICT (tpl_pkg_id, usage_code_id, branch_scope_code) DO UPDATE SET
  target_account_code = EXCLUDED.target_account_code,
  is_required = EXCLUDED.is_required,
  rec_status = EXCLUDED.rec_status,
  rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_seed',
  updated_info = 'Migration 0200';

INSERT INTO public.sys_fin_period_tpl_mst (
  tpl_pkg_id,
  fiscal_start_month,
  period_style_code,
  seed_horizon_months,
  default_open_status,
  created_by,
  created_info,
  rec_status,
  rec_order,
  is_active
)
SELECT
  p.tpl_pkg_id,
  1,
  'MONTHLY',
  24,
  'OPEN',
  'system_seed',
  'Migration 0200 - period policy',
  1,
  p.rec_order,
  true
FROM public.sys_fin_tpl_pkg_mst p
WHERE p.tpl_pkg_code IN (
  'ERP_LITE_SMALL_STD',
  'ERP_LITE_MEDIUM_STD',
  'ERP_LITE_MINI_STD',
  'ERP_LITE_FULL_STD',
  'ERP_LITE_IND_STD',
  'ERP_LITE_GLOBAL_STD'
)
ON CONFLICT (tpl_pkg_id) DO UPDATE SET
  fiscal_start_month = EXCLUDED.fiscal_start_month,
  period_style_code = EXCLUDED.period_style_code,
  seed_horizon_months = EXCLUDED.seed_horizon_months,
  default_open_status = EXCLUDED.default_open_status,
  rec_status = EXCLUDED.rec_status,
  rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_seed',
  updated_info = 'Migration 0200';

INSERT INTO public.sys_fin_period_tpl_dtl (
  period_tpl_id,
  line_no,
  month_no,
  label_text,
  created_by,
  created_info,
  rec_status,
  rec_order,
  is_active
)
SELECT
  p.period_tpl_id,
  seed.line_no,
  seed.month_no,
  seed.label_text,
  'system_seed',
  'Migration 0200 - period detail labels',
  1,
  seed.line_no,
  true
FROM public.sys_fin_period_tpl_mst p
JOIN public.sys_fin_tpl_pkg_mst pkg
  ON pkg.tpl_pkg_id = p.tpl_pkg_id
JOIN (
  VALUES
    (1, 1, 'Jan'),
    (2, 2, 'Feb'),
    (3, 3, 'Mar'),
    (4, 4, 'Apr'),
    (5, 5, 'May'),
    (6, 6, 'Jun'),
    (7, 7, 'Jul'),
    (8, 8, 'Aug'),
    (9, 9, 'Sep'),
    (10, 10, 'Oct'),
    (11, 11, 'Nov'),
    (12, 12, 'Dec')
  ) AS seed(line_no, month_no, label_text)
  ON TRUE
WHERE pkg.tpl_pkg_code IN (
  'ERP_LITE_SMALL_STD',
  'ERP_LITE_MEDIUM_STD',
  'ERP_LITE_MINI_STD',
  'ERP_LITE_FULL_STD',
  'ERP_LITE_IND_STD',
  'ERP_LITE_GLOBAL_STD'
)
ON CONFLICT (period_tpl_id, line_no) DO UPDATE SET
  month_no = EXCLUDED.month_no,
  label_text = EXCLUDED.label_text,
  rec_status = EXCLUDED.rec_status,
  rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_seed',
  updated_info = 'Migration 0200';

INSERT INTO public.sys_fin_oper_tpl_dtl (
  tpl_pkg_id,
  oper_code,
  target_account_code,
  config_json,
  status_code,
  created_by,
  created_info,
  rec_status,
  rec_order,
  is_active
)
SELECT
  p.tpl_pkg_id,
  'PETTY_CASH_DEFAULT',
  '1130',
  jsonb_build_object(
    'cashbox_code', 'PETTY-MAIN',
    'cashbox_name', 'Main Petty Cash',
    'cashbox_name2', 'العهدة النقدية الرئيسية',
    'opening_balance', 0,
    'is_default', true,
    'currency_source', 'TENANT'
  ),
  'ACTIVE',
  'system_seed',
  'Migration 0200 - operational defaults',
  1,
  10,
  true
FROM public.sys_fin_tpl_pkg_mst p
WHERE p.tpl_pkg_code IN (
  'ERP_LITE_SMALL_STD',
  'ERP_LITE_MEDIUM_STD',
  'ERP_LITE_MINI_STD',
  'ERP_LITE_FULL_STD',
  'ERP_LITE_IND_STD',
  'ERP_LITE_GLOBAL_STD'
)
ON CONFLICT (tpl_pkg_id, oper_code) DO UPDATE SET
  target_account_code = EXCLUDED.target_account_code,
  config_json = EXCLUDED.config_json,
  status_code = EXCLUDED.status_code,
  rec_status = EXCLUDED.rec_status,
  rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_seed',
  updated_info = 'Migration 0200';

COMMIT;
