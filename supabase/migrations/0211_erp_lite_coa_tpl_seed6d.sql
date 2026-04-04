-- ==================================================================
-- Migration: 0211_erp_lite_coa_tpl_seed6d.sql
-- Purpose: Seed canonical version-2 ERP-Lite template packages with a
--          structured 6-digit hierarchical COA and business-type routing
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Notes:
--   - Creates version 2 packages instead of mutating version 1 content
--   - Keeps version 1 packages for audit/history, but shifts resolution
--     to version 2 assignments
--   - Uses the current HQ usage-code catalog only
-- ==================================================================

BEGIN;

INSERT INTO public.sys_fin_acc_group_cd (
  acc_group_code,
  acc_type_id,
  parent_group_id,
  name,
  name2,
  description,
  description2,
  stmt_section,
  report_role_code,
  group_level,
  rec_order,
  created_at,
  created_by,
  created_info,
  is_active,
  rec_status
)
SELECT
  seed.acc_group_code,
  t.acc_type_id,
  NULL,
  seed.name,
  seed.name2,
  seed.description,
  seed.description2,
  seed.stmt_section,
  seed.report_role_code,
  seed.group_level,
  seed.rec_order,
  CURRENT_TIMESTAMP,
  'system_seed',
  'Migration 0211',
  true,
  1
FROM (
  VALUES
    ('ASSET_NONCURRENT', 'ASSET', 'Non-Current Assets', 'الأصول غير المتداولة', 'ERP-Lite non-current asset grouping for version 2 canonical COA.', 'تصنيف ERP-Lite للأصول غير المتداولة في دليل الحسابات القياسي الإصدار 2.', 'ASSETS', 'NONCURRENT_ASSETS', 1, 15),
    ('LIAB_NONCURRENT', 'LIABILITY', 'Non-Current Liabilities', 'الالتزامات غير المتداولة', 'ERP-Lite non-current liability grouping for version 2 canonical COA.', 'تصنيف ERP-Lite للالتزامات غير المتداولة في دليل الحسابات القياسي الإصدار 2.', 'LIABILITIES', 'NONCURRENT_LIABILITIES', 1, 55),
    ('EQUITY_CORE', 'EQUITY', 'Equity', 'حقوق الملكية', 'ERP-Lite equity grouping for version 2 canonical COA.', 'تصنيف ERP-Lite لحقوق الملكية في دليل الحسابات القياسي الإصدار 2.', 'EQUITY', 'EQUITY', 1, 65),
    ('REV_OTHER', 'REVENUE', 'Other Revenue', 'إيرادات أخرى', 'ERP-Lite other revenue grouping for version 2 canonical COA.', 'تصنيف ERP-Lite للإيرادات الأخرى في دليل الحسابات القياسي الإصدار 2.', 'REVENUE', 'OTHER_REVENUE', 1, 75),
    ('EXP_DIRECT', 'EXPENSE', 'Direct Costs', 'تكاليف مباشرة', 'ERP-Lite direct cost grouping for version 2 canonical COA.', 'تصنيف ERP-Lite للتكاليف المباشرة في دليل الحسابات القياسي الإصدار 2.', 'EXPENSES', 'DIRECT_COSTS', 1, 85),
    ('EXP_ADMIN', 'EXPENSE', 'Administrative Expenses', 'مصروفات إدارية', 'ERP-Lite administrative expense grouping for version 2 canonical COA.', 'تصنيف ERP-Lite للمصروفات الإدارية في دليل الحسابات القياسي الإصدار 2.', 'EXPENSES', 'ADMIN_EXPENSES', 1, 86),
    ('EXP_OTHER', 'EXPENSE', 'Other Expenses', 'مصروفات أخرى', 'ERP-Lite other expense grouping for version 2 canonical COA.', 'تصنيف ERP-Lite للمصروفات الأخرى في دليل الحسابات القياسي الإصدار 2.', 'EXPENSES', 'OTHER_EXPENSES', 1, 87)
) AS seed(acc_group_code, acc_type_code, name, name2, description, description2, stmt_section, report_role_code, group_level, rec_order)
JOIN public.sys_fin_acc_type_cd t
  ON t.acc_type_code = seed.acc_type_code
ON CONFLICT (acc_group_code) DO UPDATE SET
  acc_type_id = EXCLUDED.acc_type_id,
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  stmt_section = EXCLUDED.stmt_section,
  report_role_code = EXCLUDED.report_role_code,
  group_level = EXCLUDED.group_level,
  rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active,
  rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_seed',
  updated_info = 'Migration 0211';

INSERT INTO public.sys_fin_acc_group_cd (
  acc_group_code,
  acc_type_id,
  parent_group_id,
  name,
  name2,
  description,
  description2,
  stmt_section,
  report_role_code,
  group_level,
  rec_order,
  created_at,
  created_by,
  created_info,
  is_active,
  rec_status
)
SELECT
  seed.acc_group_code,
  t.acc_type_id,
  parent.acc_group_id,
  seed.name,
  seed.name2,
  seed.description,
  seed.description2,
  seed.stmt_section,
  seed.report_role_code,
  seed.group_level,
  seed.rec_order,
  CURRENT_TIMESTAMP,
  'system_seed',
  'Migration 0211',
  true,
  1
FROM (
  VALUES
    ('ASSET_INVENTORY', 'ASSET', 'ASSET_CURRENT', 'Inventory', 'المخزون', 'Inventory grouping for canonical ERP-Lite COA.', 'تصنيف المخزون في دليل الحسابات القياسي لـ ERP-Lite.', 'ASSETS', 'INVENTORY', 2, 21),
    ('ASSET_PREPAID', 'ASSET', 'ASSET_CURRENT', 'Prepaid and Recoverables', 'مصروفات مقدمة ومستردات', 'Prepaid and tax recoverable grouping for canonical ERP-Lite COA.', 'تصنيف المصروفات المقدمة والمستردات في دليل الحسابات القياسي لـ ERP-Lite.', 'ASSETS', 'PREPAID', 2, 22),
    ('ASSET_FIXED', 'ASSET', 'ASSET_NONCURRENT', 'Property and Equipment', 'الممتلكات والمعدات', 'Fixed asset grouping for canonical ERP-Lite COA.', 'تصنيف الممتلكات والمعدات في دليل الحسابات القياسي لـ ERP-Lite.', 'ASSETS', 'FIXED_ASSETS', 2, 23),
    ('ASSET_ACC_DEPR', 'ASSET', 'ASSET_NONCURRENT', 'Accumulated Depreciation', 'مجمع الإهلاك', 'Contra-asset grouping for accumulated depreciation accounts.', 'تصنيف حسابات مجمع الإهلاك كحسابات مقابلة للأصول.', 'ASSETS', 'ACCUM_DEPR', 2, 24),
    ('LIAB_PAYABLE', 'LIABILITY', 'LIAB_CURRENT', 'Payables', 'الدائنون', 'Payable grouping for canonical ERP-Lite COA.', 'تصنيف الدائنين في دليل الحسابات القياسي لـ ERP-Lite.', 'LIABILITIES', 'PAYABLES', 2, 61),
    ('LIAB_CUST_OBL', 'LIABILITY', 'LIAB_CURRENT', 'Customer Obligations', 'التزامات العملاء', 'Customer liability grouping for canonical ERP-Lite COA.', 'تصنيف التزامات العملاء في دليل الحسابات القياسي لـ ERP-Lite.', 'LIABILITIES', 'CUSTOMER_LIABILITY', 2, 62),
    ('LIAB_WALLET', 'LIABILITY', 'LIAB_CURRENT', 'Wallet and Store Credit', 'المحفظة والرصيد الدائن', 'Wallet and store-credit liability grouping.', 'تصنيف التزامات المحفظة والرصيد الدائن.', 'LIABILITIES', 'WALLET_LIABILITY', 2, 63),
    ('LIAB_ACCRUAL', 'LIABILITY', 'LIAB_CURRENT', 'Accruals and Provisions', 'الاستحقاقات والمخصصات', 'Accrual and provision grouping for canonical ERP-Lite COA.', 'تصنيف الاستحقاقات والمخصصات في دليل الحسابات القياسي لـ ERP-Lite.', 'LIABILITIES', 'ACCRUALS', 2, 64),
    ('EQUITY_CAPITAL', 'EQUITY', 'EQUITY_CORE', 'Capital', 'رأس المال', 'Capital grouping for canonical ERP-Lite COA.', 'تصنيف رأس المال في دليل الحسابات القياسي لـ ERP-Lite.', 'EQUITY', 'CAPITAL', 2, 66),
    ('EQUITY_RETAINED', 'EQUITY', 'EQUITY_CORE', 'Retained Earnings', 'الأرباح المبقاة', 'Retained earnings grouping for canonical ERP-Lite COA.', 'تصنيف الأرباح المبقاة في دليل الحسابات القياسي لـ ERP-Lite.', 'EQUITY', 'RETAINED_EARNINGS', 2, 67),
    ('EQUITY_CYPL', 'EQUITY', 'EQUITY_CORE', 'Current Year Earnings', 'أرباح السنة الحالية', 'Current year earnings grouping for canonical ERP-Lite COA.', 'تصنيف أرباح السنة الحالية في دليل الحسابات القياسي لـ ERP-Lite.', 'EQUITY', 'CURRENT_YEAR_EARNINGS', 2, 68),
    ('REV_SERVICE', 'REVENUE', 'REV_OPERATING', 'Service Revenue', 'إيراد الخدمات', 'Service revenue grouping for canonical ERP-Lite COA.', 'تصنيف إيراد الخدمات في دليل الحسابات القياسي لـ ERP-Lite.', 'REVENUE', 'SERVICE_REVENUE', 2, 71),
    ('EXP_BRANCH_OP', 'EXPENSE', 'EXP_OPERATING', 'Branch Operating Expenses', 'مصروفات تشغيل الفرع', 'Branch operating expense grouping for canonical ERP-Lite COA.', 'تصنيف مصروفات تشغيل الفرع في دليل الحسابات القياسي لـ ERP-Lite.', 'EXPENSES', 'BRANCH_OPERATING', 2, 88)
) AS seed(acc_group_code, acc_type_code, parent_group_code, name, name2, description, description2, stmt_section, report_role_code, group_level, rec_order)
JOIN public.sys_fin_acc_type_cd t
  ON t.acc_type_code = seed.acc_type_code
JOIN public.sys_fin_acc_group_cd parent
  ON parent.acc_group_code = seed.parent_group_code
ON CONFLICT (acc_group_code) DO UPDATE SET
  acc_type_id = EXCLUDED.acc_type_id,
  parent_group_id = EXCLUDED.parent_group_id,
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  stmt_section = EXCLUDED.stmt_section,
  report_role_code = EXCLUDED.report_role_code,
  group_level = EXCLUDED.group_level,
  rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active,
  rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_seed',
  updated_info = 'Migration 0211';

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
  ('ERP_LITE_SMALL_STD', 2, 'ERP-Lite Small Laundry Standard v2', 'القالب القياسي لمغسلة صغيرة الإصدار 2', 'Published ERP-Lite canonical 6-digit baseline for small laundry tenants.', 'خط أساس منشور قياسي مكوَّن من 6 أرقام لمستأجري المغاسل الصغيرة.', 'ALL', 'SMALL_LAUNDRY', 'PUBLISHED', 'erp_lite_runtime_v2', CURRENT_DATE, CURRENT_TIMESTAMP, 'system_seed', CURRENT_TIMESTAMP, 'system_seed', 'system_seed', 'Migration 0211', 1, 10, true),
  ('ERP_LITE_MEDIUM_STD', 2, 'ERP-Lite Medium Dry Clean Standard v2', 'القالب القياسي لتنظيف جاف متوسط الإصدار 2', 'Published ERP-Lite canonical 6-digit baseline for medium dry-clean tenants.', 'خط أساس منشور قياسي مكوَّن من 6 أرقام لمستأجري التنظيف الجاف المتوسط.', 'ALL', 'MEDIUM_DRY_CLEAN', 'PUBLISHED', 'erp_lite_runtime_v2', CURRENT_DATE, CURRENT_TIMESTAMP, 'system_seed', CURRENT_TIMESTAMP, 'system_seed', 'system_seed', 'Migration 0211', 1, 20, true),
  ('ERP_LITE_MINI_STD', 2, 'ERP-Lite Mini Shop Standard v2', 'القالب القياسي للمتجر الصغير الإصدار 2', 'Published ERP-Lite canonical 6-digit baseline for mini-shop tenants.', 'خط أساس منشور قياسي مكوَّن من 6 أرقام لمستأجري المتاجر الصغيرة.', 'ALL', 'MINI_SHOP', 'PUBLISHED', 'erp_lite_runtime_v2', CURRENT_DATE, CURRENT_TIMESTAMP, 'system_seed', CURRENT_TIMESTAMP, 'system_seed', 'system_seed', 'Migration 0211', 1, 30, true),
  ('ERP_LITE_FULL_STD', 2, 'ERP-Lite Full Service Standard v2', 'القالب القياسي للخدمة الكاملة الإصدار 2', 'Published ERP-Lite canonical 6-digit baseline for full-service laundry tenants.', 'خط أساس منشور قياسي مكوَّن من 6 أرقام لمستأجري الخدمة الكاملة.', 'ALL', 'FULL_SERVICE', 'PUBLISHED', 'erp_lite_runtime_v2', CURRENT_DATE, CURRENT_TIMESTAMP, 'system_seed', CURRENT_TIMESTAMP, 'system_seed', 'system_seed', 'Migration 0211', 1, 40, true),
  ('ERP_LITE_IND_STD', 2, 'ERP-Lite Industrial Standard v2', 'القالب القياسي للمغسلة الصناعية الإصدار 2', 'Published ERP-Lite canonical 6-digit baseline for industrial laundry tenants.', 'خط أساس منشور قياسي مكوَّن من 6 أرقام لمستأجري المغاسل الصناعية.', 'ALL', 'INDUSTRIAL', 'PUBLISHED', 'erp_lite_runtime_v2', CURRENT_DATE, CURRENT_TIMESTAMP, 'system_seed', CURRENT_TIMESTAMP, 'system_seed', 'system_seed', 'Migration 0211', 1, 50, true),
  ('ERP_LITE_GLOBAL_STD', 2, 'ERP-Lite Global Fallback v2', 'القالب الاحتياطي العالمي لـ ERP-Lite الإصدار 2', 'Published ERP-Lite canonical 6-digit fallback package.', 'قالب احتياطي منشور مكوَّن من 6 أرقام لـ ERP-Lite.', 'ALL', NULL, 'PUBLISHED', 'erp_lite_runtime_v2', CURRENT_DATE, CURRENT_TIMESTAMP, 'system_seed', CURRENT_TIMESTAMP, 'system_seed', 'system_seed', 'Migration 0211', 1, 90, true)
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
  updated_info = 'Migration 0211';

UPDATE public.sys_fin_tpl_assign_mst a
SET
  status_code = 'INACTIVE',
  is_active = false,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_seed',
  updated_info = 'Migration 0211 - superseded by version 2 canonical assignments'
FROM public.sys_fin_tpl_pkg_mst p
WHERE a.tpl_pkg_id = p.tpl_pkg_id
  AND p.tpl_pkg_code IN (
    'ERP_LITE_SMALL_STD',
    'ERP_LITE_MEDIUM_STD',
    'ERP_LITE_MINI_STD',
    'ERP_LITE_FULL_STD',
    'ERP_LITE_IND_STD',
    'ERP_LITE_GLOBAL_STD'
  )
  AND p.version_no = 1
  AND a.status_code = 'ACTIVE'
  AND a.is_active = true
  AND a.rec_status = 1;

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
  50,
  false,
  'ACTIVE',
  'system_seed',
  'Migration 0211 - version 2 business-type assignment',
  1,
  p.rec_order,
  true
FROM public.sys_fin_tpl_pkg_mst p
WHERE p.version_no = 2
  AND p.tpl_pkg_code IN (
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
  'Migration 0211 - version 2 fallback assignment',
  1,
  999,
  true
FROM public.sys_fin_tpl_pkg_mst p
WHERE p.tpl_pkg_code = 'ERP_LITE_GLOBAL_STD'
  AND p.version_no = 2
  AND NOT EXISTS (
    SELECT 1
    FROM public.sys_fin_tpl_assign_mst a
    WHERE a.tpl_pkg_id = p.tpl_pkg_id
      AND a.assignment_mode = 'FALLBACK'
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
  p.tpl_pkg_code || '_COA_V2',
  p.name || ' COA',
  COALESCE(p.name2, p.name) || ' COA',
  'Canonical 6-digit ERP-Lite COA template for package ' || p.tpl_pkg_code,
  'قالب شجرة حسابات قياسي مكوَّن من 6 أرقام للحزمة ' || p.tpl_pkg_code,
  'ACTIVE',
  'system_seed',
  'Migration 0211',
  1,
  p.rec_order,
  true
FROM public.sys_fin_tpl_pkg_mst p
WHERE p.version_no = 2
  AND p.tpl_pkg_code IN (
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
  updated_info = 'Migration 0211';

DO $$
DECLARE
  v_rows INTEGER := 0;
BEGIN
  LOOP
    WITH pkg_targets AS (
      SELECT
        p.tpl_pkg_id,
        h.coa_tpl_id
      FROM public.sys_fin_tpl_pkg_mst p
      JOIN public.sys_fin_coa_tpl_mst h
        ON h.tpl_pkg_id = p.tpl_pkg_id
      WHERE p.version_no = 2
        AND p.tpl_pkg_code IN (
          'ERP_LITE_SMALL_STD',
          'ERP_LITE_MEDIUM_STD',
          'ERP_LITE_MINI_STD',
          'ERP_LITE_FULL_STD',
          'ERP_LITE_IND_STD',
          'ERP_LITE_GLOBAL_STD'
        )
    ),
    seed_lines AS (
      SELECT *
      FROM (
        VALUES
          ('100000', NULL, 'ASSET', NULL, 'Assets', 'الأصول', false, false, false, true, false, 10, NULL),
          ('110000', '100000', 'ASSET', 'ASSET_CURRENT', 'Current Assets', 'الأصول المتداولة', false, false, false, true, true, 20, NULL),
          ('111000', '110000', 'ASSET', 'ASSET_CASH_BANK', 'Cash and Cash Equivalents', 'النقد وما في حكمه', false, false, false, true, true, 30, NULL),
          ('111001', '111000', 'ASSET', 'ASSET_CASH_BANK', 'Cash Main', 'الصندوق الرئيسي', true, false, false, true, false, 31, 'CASH_MAIN'),
          ('111002', '111000', 'ASSET', 'ASSET_CASH_BANK', 'Bank Main', 'البنك الرئيسي', true, false, false, true, false, 32, NULL),
          ('111003', '111000', 'ASSET', 'ASSET_CASH_BANK', 'Bank Card Clearing', 'تسوية بطاقات البنك', true, false, true, true, false, 33, 'BANK_CARD_CLEARING'),
          ('111004', '111000', 'ASSET', 'ASSET_CASH_BANK', 'Wallet Settlement Clearing', 'تسوية المحفظة', true, false, true, true, false, 34, NULL),
          ('111005', '111000', 'ASSET', 'ASSET_CASH_BANK', 'Petty Cash Main', 'العهدة النقدية الرئيسية', true, false, true, true, false, 35, 'PETTY_CASH_MAIN'),
          ('112000', '110000', 'ASSET', 'ASSET_RECEIVABLE', 'Receivables', 'الذمم المدينة', false, false, false, true, true, 40, NULL),
          ('112001', '112000', 'ASSET', 'ASSET_RECEIVABLE', 'Accounts Receivable', 'الذمم المدينة للعملاء', true, true, true, true, false, 41, 'ACCOUNTS_RECEIVABLE'),
          ('112002', '112000', 'ASSET', 'ASSET_RECEIVABLE', 'Employee Receivable', 'ذمم مدينة على الموظفين', true, false, false, true, false, 42, NULL),
          ('112003', '112000', 'ASSET', 'ASSET_RECEIVABLE', 'Other Receivable', 'ذمم مدينة أخرى', true, false, false, true, false, 43, NULL),
          ('113000', '110000', 'ASSET', 'ASSET_INVENTORY', 'Inventory and Stock', 'المخزون', false, false, false, true, true, 50, NULL),
          ('113001', '113000', 'ASSET', 'ASSET_INVENTORY', 'Inventory Main', 'المخزون الرئيسي', true, false, false, true, false, 51, NULL),
          ('114000', '110000', 'ASSET', 'ASSET_PREPAID', 'Prepaid and Recoverables', 'مصروفات مقدمة ومستردات', false, false, false, true, true, 60, NULL),
          ('114001', '114000', 'ASSET', 'ASSET_PREPAID', 'Prepaid Expenses', 'مصروفات مقدمة', true, false, false, true, false, 61, NULL),
          ('114002', '114000', 'ASSET', 'ASSET_PREPAID', 'Supplier Advances', 'دفعات مقدمة للموردين', true, false, false, true, false, 62, NULL),
          ('114003', '114000', 'ASSET', 'ASSET_TAX_INPUT', 'Recoverable Input VAT', 'ضريبة مدخلات قابلة للاسترداد', true, false, true, true, false, 63, 'VAT_INPUT'),
          ('120000', '100000', 'ASSET', 'ASSET_NONCURRENT', 'Non-Current Assets', 'الأصول غير المتداولة', false, false, false, true, true, 70, NULL),
          ('121000', '120000', 'ASSET', 'ASSET_FIXED', 'Property and Equipment', 'الممتلكات والمعدات', false, false, false, true, true, 71, NULL),
          ('121001', '121000', 'ASSET', 'ASSET_FIXED', 'Furniture and Fixtures', 'الأثاث والتجهيزات', true, false, false, true, false, 72, NULL),
          ('121002', '121000', 'ASSET', 'ASSET_FIXED', 'Machinery and Equipment', 'الآلات والمعدات', true, false, false, true, false, 73, NULL),
          ('122000', '120000', 'ASSET', 'ASSET_ACC_DEPR', 'Accumulated Depreciation', 'مجمع الإهلاك', false, false, false, true, false, 74, NULL),
          ('122001', '122000', 'ASSET', 'ASSET_ACC_DEPR', 'Accumulated Depreciation - Furniture', 'مجمع إهلاك الأثاث', true, false, false, true, false, 75, NULL),
          ('122002', '122000', 'ASSET', 'ASSET_ACC_DEPR', 'Accumulated Depreciation - Equipment', 'مجمع إهلاك المعدات', true, false, false, true, false, 76, NULL),
          ('200000', NULL, 'LIABILITY', NULL, 'Liabilities', 'الالتزامات', false, false, false, true, false, 100, NULL),
          ('210000', '200000', 'LIABILITY', 'LIAB_CURRENT', 'Current Liabilities', 'الالتزامات المتداولة', false, false, false, true, true, 110, NULL),
          ('211000', '210000', 'LIABILITY', 'LIAB_PAYABLE', 'Payables', 'الدائنون', false, false, false, true, true, 111, NULL),
          ('211001', '211000', 'LIABILITY', 'LIAB_PAYABLE', 'Accounts Payable', 'حسابات الدائنين', true, true, true, true, false, 112, NULL),
          ('211002', '211000', 'LIABILITY', 'LIAB_PAYABLE', 'Supplier Payable', 'ذمم دائنة للموردين', true, false, false, true, false, 113, NULL),
          ('212000', '210000', 'LIABILITY', 'LIAB_TAX_OUTPUT', 'Tax Liabilities', 'الالتزامات الضريبية', false, false, false, true, true, 114, NULL),
          ('212001', '212000', 'LIABILITY', 'LIAB_TAX_OUTPUT', 'VAT Output', 'ضريبة المخرجات', true, false, true, true, false, 115, 'VAT_OUTPUT'),
          ('212002', '212000', 'LIABILITY', 'LIAB_TAX_OUTPUT', 'VAT Payable Control', 'حساب ضريبة المخرجات المستحقة', true, true, true, true, false, 116, NULL),
          ('213000', '210000', 'LIABILITY', 'LIAB_CUST_OBL', 'Customer Obligations', 'التزامات العملاء', false, false, false, true, true, 117, NULL),
          ('213001', '213000', 'LIABILITY', 'LIAB_CUST_OBL', 'Customer Deposit Liability', 'التزام عربون العملاء', true, false, true, true, false, 118, NULL),
          ('213002', '213000', 'LIABILITY', 'LIAB_CUST_OBL', 'Unearned Revenue', 'إيراد غير مكتسب', true, false, true, true, false, 119, NULL),
          ('213003', '213000', 'LIABILITY', 'LIAB_CUST_OBL', 'Refund Payable', 'استردادات مستحقة', true, false, true, true, false, 120, 'REFUND_PAYABLE'),
          ('214000', '210000', 'LIABILITY', 'LIAB_WALLET', 'Wallet and Store Credit', 'المحفظة والرصيد الدائن', false, false, false, true, true, 121, NULL),
          ('214001', '214000', 'LIABILITY', 'LIAB_WALLET', 'Customer Wallet Liability', 'التزام محفظة العميل', true, false, true, true, false, 122, 'WALLET_CLEARING'),
          ('214002', '214000', 'LIABILITY', 'LIAB_WALLET', 'Store Credit Liability', 'التزام الرصيد الدائن', true, false, true, true, false, 123, NULL),
          ('215000', '210000', 'LIABILITY', 'LIAB_ACCRUAL', 'Accruals and Provisions', 'الاستحقاقات والمخصصات', false, false, false, true, true, 124, NULL),
          ('215001', '215000', 'LIABILITY', 'LIAB_ACCRUAL', 'Accrued Expenses', 'مصروفات مستحقة', true, false, false, true, false, 125, NULL),
          ('220000', '200000', 'LIABILITY', 'LIAB_NONCURRENT', 'Non-Current Liabilities', 'الالتزامات غير المتداولة', false, false, false, true, true, 126, NULL),
          ('221000', '220000', 'LIABILITY', 'LIAB_NONCURRENT', 'Long-Term Obligations', 'التزامات طويلة الأجل', false, false, false, true, true, 127, NULL),
          ('221001', '221000', 'LIABILITY', 'LIAB_NONCURRENT', 'Long-Term Loan', 'قرض طويل الأجل', true, false, false, true, false, 128, NULL),
          ('300000', NULL, 'EQUITY', 'EQUITY_CORE', 'Equity', 'حقوق الملكية', false, false, false, true, false, 150, NULL),
          ('310000', '300000', 'EQUITY', 'EQUITY_CAPITAL', 'Owner Equity', 'حقوق المالك', false, false, false, true, true, 151, NULL),
          ('310001', '310000', 'EQUITY', 'EQUITY_CAPITAL', 'Capital', 'رأس المال', true, false, true, true, false, 152, NULL),
          ('320000', '300000', 'EQUITY', 'EQUITY_RETAINED', 'Retained Earnings', 'الأرباح المبقاة', false, false, false, true, true, 153, NULL),
          ('320001', '320000', 'EQUITY', 'EQUITY_RETAINED', 'Retained Earnings', 'الأرباح المبقاة', true, false, true, true, false, 154, NULL),
          ('330000', '300000', 'EQUITY', 'EQUITY_CYPL', 'Current Year Earnings', 'أرباح السنة الحالية', false, false, false, true, true, 155, NULL),
          ('330001', '330000', 'EQUITY', 'EQUITY_CYPL', 'Current Year Profit or Loss', 'ربح أو خسارة السنة الحالية', true, false, true, true, false, 156, NULL),
          ('400000', NULL, 'REVENUE', NULL, 'Revenue', 'الإيرادات', false, false, false, true, false, 200, NULL),
          ('410000', '400000', 'REVENUE', 'REV_OPERATING', 'Operating Revenue', 'الإيرادات التشغيلية', false, false, false, true, true, 210, NULL),
          ('411000', '410000', 'REVENUE', 'REV_SERVICE', 'Service Revenue', 'إيراد الخدمات', false, false, false, true, true, 211, NULL),
          ('411001', '411000', 'REVENUE', 'REV_SERVICE', 'Laundry Service Revenue', 'إيراد خدمات الغسيل', true, false, true, true, false, 212, 'SALES_REVENUE'),
          ('411002', '411000', 'REVENUE', 'REV_SERVICE', 'Dry Cleaning Revenue', 'إيراد التنظيف الجاف', true, false, false, true, false, 213, NULL),
          ('411003', '411000', 'REVENUE', 'REV_SERVICE', 'Ironing Service Revenue', 'إيراد خدمة الكي', true, false, false, true, false, 214, NULL),
          ('411004', '411000', 'REVENUE', 'REV_SERVICE', 'Delivery Revenue', 'إيراد التوصيل', true, false, false, true, false, 215, NULL),
          ('420000', '400000', 'REVENUE', 'REV_OTHER', 'Other Revenue', 'إيرادات أخرى', false, false, false, true, true, 216, NULL),
          ('420001', '420000', 'REVENUE', 'REV_OTHER', 'Other Revenue', 'إيرادات أخرى', true, false, false, true, false, 217, NULL),
          ('420002', '420000', 'REVENUE', 'REV_OTHER', 'Discounts Recovered', 'استرداد خصومات', true, false, false, true, false, 218, NULL),
          ('500000', NULL, 'EXPENSE', NULL, 'Expenses', 'المصروفات', false, false, false, true, false, 250, NULL),
          ('510000', '500000', 'EXPENSE', 'EXP_DIRECT', 'Direct Costs', 'تكاليف مباشرة', false, false, false, true, true, 260, NULL),
          ('511000', '510000', 'EXPENSE', 'EXP_DIRECT', 'Service Direct Costs', 'تكاليف مباشرة للخدمة', false, false, false, true, true, 261, NULL),
          ('511001', '511000', 'EXPENSE', 'EXP_DIRECT', 'Laundry Materials Expense', 'مصروف مواد الغسيل', true, false, false, true, false, 262, NULL),
          ('511002', '511000', 'EXPENSE', 'EXP_DIRECT', 'Dry Cleaning Materials Expense', 'مصروف مواد التنظيف الجاف', true, false, false, true, false, 263, NULL),
          ('520000', '500000', 'EXPENSE', 'EXP_OPERATING', 'Operating Expenses', 'مصروفات تشغيلية', false, false, false, true, true, 264, NULL),
          ('521000', '520000', 'EXPENSE', 'EXP_BRANCH_OP', 'Branch Operating Expenses', 'مصروفات تشغيل الفرع', false, false, false, true, true, 265, NULL),
          ('521001', '521000', 'EXPENSE', 'EXP_BRANCH_OP', 'Salaries and Wages', 'الرواتب والأجور', true, false, false, true, false, 266, NULL),
          ('521002', '521000', 'EXPENSE', 'EXP_BRANCH_OP', 'Rent Expense', 'مصروف الإيجار', true, false, false, true, false, 267, NULL),
          ('521003', '521000', 'EXPENSE', 'EXP_BRANCH_OP', 'Utilities Expense', 'مصروف المرافق', true, false, false, true, false, 268, NULL),
          ('521004', '521000', 'EXPENSE', 'EXP_BRANCH_OP', 'Maintenance Expense', 'مصروف الصيانة', true, false, false, true, false, 269, NULL),
          ('521005', '521000', 'EXPENSE', 'EXP_BRANCH_OP', 'Delivery Expense', 'مصروف التوصيل', true, false, false, true, false, 270, NULL),
          ('530000', '500000', 'EXPENSE', 'EXP_ADMIN', 'Administrative Expenses', 'مصروفات إدارية', false, false, false, true, true, 271, NULL),
          ('530001', '530000', 'EXPENSE', 'EXP_ADMIN', 'Office Expense', 'مصروف المكتب', true, false, false, true, false, 272, NULL),
          ('530002', '530000', 'EXPENSE', 'EXP_ADMIN', 'Bank Charges', 'الرسوم البنكية', true, false, false, true, false, 273, NULL),
          ('530003', '530000', 'EXPENSE', 'EXP_ADMIN', 'Software Subscription Expense', 'مصروف اشتراك البرامج', true, false, false, true, false, 274, NULL),
          ('530004', '530000', 'EXPENSE', 'EXP_ADMIN', 'General Expense', 'مصروف عام', true, false, false, true, false, 275, 'EXPENSE_GENERAL'),
          ('530005', '530000', 'EXPENSE', 'EXP_ADMIN', 'Bad Debt Expense', 'مصروف ديون معدومة', true, false, false, true, false, 276, NULL),
          ('530006', '530000', 'EXPENSE', 'EXP_ADMIN', 'Petty Cash Expense', 'مصروف العهدة النقدية', true, false, false, true, false, 277, 'PETTY_CASH_EXPENSE'),
          ('540000', '500000', 'EXPENSE', 'EXP_OTHER', 'Other Expenses', 'مصروفات أخرى', false, false, false, true, true, 278, NULL),
          ('540001', '540000', 'EXPENSE', 'EXP_OTHER', 'Loss on Adjustment', 'خسارة تسوية', true, false, false, true, false, 279, 'ROUNDING_ADJUSTMENT'),
          ('540002', '540000', 'EXPENSE', 'EXP_OTHER', 'Miscellaneous Expense', 'مصروفات متنوعة', true, false, false, true, false, 280, NULL)
      ) AS x(account_code, parent_code, acc_type_code, acc_group_code, name, name2, is_postable, is_control_account, is_system_linked, manual_post_allowed, allow_tenant_children, rec_order, usage_hint_code)
    )
    INSERT INTO public.sys_fin_coa_tpl_dtl (
      coa_tpl_id,
      parent_tpl_line_id,
      account_code,
      account_level,
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
      is_system_seeded,
      is_locked,
      allow_rename,
      allow_code_change,
      allow_tenant_children,
      effective_from,
      created_by,
      created_info,
      rec_status,
      rec_order,
      is_active
    )
    SELECT
      t.coa_tpl_id,
      parent.coa_tpl_line_id,
      s.account_code,
      public.fn_fin_code_lvl(s.account_code),
      ty.acc_type_id,
      grp.acc_group_id,
      s.name,
      s.name2,
      'Canonical ERP-Lite version 2 COA line ' || s.account_code,
      'سطر دليل حسابات قياسي ERP-Lite الإصدار 2 ' || s.account_code,
      s.is_postable,
      s.is_control_account,
      s.is_system_linked,
      s.manual_post_allowed,
      'GLOBAL',
      s.usage_hint_code,
      true,
      true,
      true,
      false,
      s.allow_tenant_children,
      CURRENT_DATE,
      'system_seed',
      'Migration 0211',
      1,
      s.rec_order,
      true
    FROM pkg_targets t
    JOIN seed_lines s
      ON true
    JOIN public.sys_fin_acc_type_cd ty
      ON ty.acc_type_code = s.acc_type_code
    LEFT JOIN public.sys_fin_acc_group_cd grp
      ON grp.acc_group_code = s.acc_group_code
    LEFT JOIN public.sys_fin_coa_tpl_dtl parent
      ON parent.coa_tpl_id = t.coa_tpl_id
     AND parent.account_code = s.parent_code
    WHERE (s.parent_code IS NULL OR parent.coa_tpl_line_id IS NOT NULL)
      AND NOT EXISTS (
        SELECT 1
        FROM public.sys_fin_coa_tpl_dtl d
        WHERE d.coa_tpl_id = t.coa_tpl_id
          AND d.account_code = s.account_code
      );

    GET DIAGNOSTICS v_rows = ROW_COUNT;
    EXIT WHEN v_rows = 0;
  END LOOP;
END;
$$;

WITH pkg_targets AS (
  SELECT
    p.tpl_pkg_id,
    h.coa_tpl_id
  FROM public.sys_fin_tpl_pkg_mst p
  JOIN public.sys_fin_coa_tpl_mst h
    ON h.tpl_pkg_id = p.tpl_pkg_id
  WHERE p.version_no = 2
    AND p.tpl_pkg_code IN (
      'ERP_LITE_SMALL_STD',
      'ERP_LITE_MEDIUM_STD',
      'ERP_LITE_MINI_STD',
      'ERP_LITE_FULL_STD',
      'ERP_LITE_IND_STD',
      'ERP_LITE_GLOBAL_STD'
    )
),
seed_lines AS (
  SELECT *
  FROM (
    VALUES
      ('100000', NULL, 'ASSET', NULL, 'Assets', 'الأصول', false, false, false, true, false, 10, NULL),
      ('110000', '100000', 'ASSET', 'ASSET_CURRENT', 'Current Assets', 'الأصول المتداولة', false, false, false, true, true, 20, NULL),
      ('111000', '110000', 'ASSET', 'ASSET_CASH_BANK', 'Cash and Cash Equivalents', 'النقد وما في حكمه', false, false, false, true, true, 30, NULL),
      ('111001', '111000', 'ASSET', 'ASSET_CASH_BANK', 'Cash Main', 'الصندوق الرئيسي', true, false, false, true, false, 31, 'CASH_MAIN'),
      ('111002', '111000', 'ASSET', 'ASSET_CASH_BANK', 'Bank Main', 'البنك الرئيسي', true, false, false, true, false, 32, NULL),
      ('111003', '111000', 'ASSET', 'ASSET_CASH_BANK', 'Bank Card Clearing', 'تسوية بطاقات البنك', true, false, true, true, false, 33, 'BANK_CARD_CLEARING'),
      ('111004', '111000', 'ASSET', 'ASSET_CASH_BANK', 'Wallet Settlement Clearing', 'تسوية المحفظة', true, false, true, true, false, 34, NULL),
      ('111005', '111000', 'ASSET', 'ASSET_CASH_BANK', 'Petty Cash Main', 'العهدة النقدية الرئيسية', true, false, true, true, false, 35, 'PETTY_CASH_MAIN'),
      ('112000', '110000', 'ASSET', 'ASSET_RECEIVABLE', 'Receivables', 'الذمم المدينة', false, false, false, true, true, 40, NULL),
      ('112001', '112000', 'ASSET', 'ASSET_RECEIVABLE', 'Accounts Receivable', 'الذمم المدينة للعملاء', true, true, true, true, false, 41, 'ACCOUNTS_RECEIVABLE'),
      ('112002', '112000', 'ASSET', 'ASSET_RECEIVABLE', 'Employee Receivable', 'ذمم مدينة على الموظفين', true, false, false, true, false, 42, NULL),
      ('112003', '112000', 'ASSET', 'ASSET_RECEIVABLE', 'Other Receivable', 'ذمم مدينة أخرى', true, false, false, true, false, 43, NULL),
      ('113000', '110000', 'ASSET', 'ASSET_INVENTORY', 'Inventory and Stock', 'المخزون', false, false, false, true, true, 50, NULL),
      ('113001', '113000', 'ASSET', 'ASSET_INVENTORY', 'Inventory Main', 'المخزون الرئيسي', true, false, false, true, false, 51, NULL),
      ('114000', '110000', 'ASSET', 'ASSET_PREPAID', 'Prepaid and Recoverables', 'مصروفات مقدمة ومستردات', false, false, false, true, true, 60, NULL),
      ('114001', '114000', 'ASSET', 'ASSET_PREPAID', 'Prepaid Expenses', 'مصروفات مقدمة', true, false, false, true, false, 61, NULL),
      ('114002', '114000', 'ASSET', 'ASSET_PREPAID', 'Supplier Advances', 'دفعات مقدمة للموردين', true, false, false, true, false, 62, NULL),
      ('114003', '114000', 'ASSET', 'ASSET_TAX_INPUT', 'Recoverable Input VAT', 'ضريبة مدخلات قابلة للاسترداد', true, false, true, true, false, 63, 'VAT_INPUT'),
      ('120000', '100000', 'ASSET', 'ASSET_NONCURRENT', 'Non-Current Assets', 'الأصول غير المتداولة', false, false, false, true, true, 70, NULL),
      ('121000', '120000', 'ASSET', 'ASSET_FIXED', 'Property and Equipment', 'الممتلكات والمعدات', false, false, false, true, true, 71, NULL),
      ('121001', '121000', 'ASSET', 'ASSET_FIXED', 'Furniture and Fixtures', 'الأثاث والتجهيزات', true, false, false, true, false, 72, NULL),
      ('121002', '121000', 'ASSET', 'ASSET_FIXED', 'Machinery and Equipment', 'الآلات والمعدات', true, false, false, true, false, 73, NULL),
      ('122000', '120000', 'ASSET', 'ASSET_ACC_DEPR', 'Accumulated Depreciation', 'مجمع الإهلاك', false, false, false, true, false, 74, NULL),
      ('122001', '122000', 'ASSET', 'ASSET_ACC_DEPR', 'Accumulated Depreciation - Furniture', 'مجمع إهلاك الأثاث', true, false, false, true, false, 75, NULL),
      ('122002', '122000', 'ASSET', 'ASSET_ACC_DEPR', 'Accumulated Depreciation - Equipment', 'مجمع إهلاك المعدات', true, false, false, true, false, 76, NULL),
      ('200000', NULL, 'LIABILITY', NULL, 'Liabilities', 'الالتزامات', false, false, false, true, false, 100, NULL),
      ('210000', '200000', 'LIABILITY', 'LIAB_CURRENT', 'Current Liabilities', 'الالتزامات المتداولة', false, false, false, true, true, 110, NULL),
      ('211000', '210000', 'LIABILITY', 'LIAB_PAYABLE', 'Payables', 'الدائنون', false, false, false, true, true, 111, NULL),
      ('211001', '211000', 'LIABILITY', 'LIAB_PAYABLE', 'Accounts Payable', 'حسابات الدائنين', true, true, true, true, false, 112, NULL),
      ('211002', '211000', 'LIABILITY', 'LIAB_PAYABLE', 'Supplier Payable', 'ذمم دائنة للموردين', true, false, false, true, false, 113, NULL),
      ('212000', '210000', 'LIABILITY', 'LIAB_TAX_OUTPUT', 'Tax Liabilities', 'الالتزامات الضريبية', false, false, false, true, true, 114, NULL),
      ('212001', '212000', 'LIABILITY', 'LIAB_TAX_OUTPUT', 'VAT Output', 'ضريبة المخرجات', true, false, true, true, false, 115, 'VAT_OUTPUT'),
      ('212002', '212000', 'LIABILITY', 'LIAB_TAX_OUTPUT', 'VAT Payable Control', 'حساب ضريبة المخرجات المستحقة', true, true, true, true, false, 116, NULL),
      ('213000', '210000', 'LIABILITY', 'LIAB_CUST_OBL', 'Customer Obligations', 'التزامات العملاء', false, false, false, true, true, 117, NULL),
      ('213001', '213000', 'LIABILITY', 'LIAB_CUST_OBL', 'Customer Deposit Liability', 'التزام عربون العملاء', true, false, true, true, false, 118, NULL),
      ('213002', '213000', 'LIABILITY', 'LIAB_CUST_OBL', 'Unearned Revenue', 'إيراد غير مكتسب', true, false, true, true, false, 119, NULL),
      ('213003', '213000', 'LIABILITY', 'LIAB_CUST_OBL', 'Refund Payable', 'استردادات مستحقة', true, false, true, true, false, 120, 'REFUND_PAYABLE'),
      ('214000', '210000', 'LIABILITY', 'LIAB_WALLET', 'Wallet and Store Credit', 'المحفظة والرصيد الدائن', false, false, false, true, true, 121, NULL),
      ('214001', '214000', 'LIABILITY', 'LIAB_WALLET', 'Customer Wallet Liability', 'التزام محفظة العميل', true, false, true, true, false, 122, 'WALLET_CLEARING'),
      ('214002', '214000', 'LIABILITY', 'LIAB_WALLET', 'Store Credit Liability', 'التزام الرصيد الدائن', true, false, true, true, false, 123, NULL),
      ('215000', '210000', 'LIABILITY', 'LIAB_ACCRUAL', 'Accruals and Provisions', 'الاستحقاقات والمخصصات', false, false, false, true, true, 124, NULL),
      ('215001', '215000', 'LIABILITY', 'LIAB_ACCRUAL', 'Accrued Expenses', 'مصروفات مستحقة', true, false, false, true, false, 125, NULL),
      ('220000', '200000', 'LIABILITY', 'LIAB_NONCURRENT', 'Non-Current Liabilities', 'الالتزامات غير المتداولة', false, false, false, true, true, 126, NULL),
      ('221000', '220000', 'LIABILITY', 'LIAB_NONCURRENT', 'Long-Term Obligations', 'التزامات طويلة الأجل', false, false, false, true, true, 127, NULL),
      ('221001', '221000', 'LIABILITY', 'LIAB_NONCURRENT', 'Long-Term Loan', 'قرض طويل الأجل', true, false, false, true, false, 128, NULL),
      ('300000', NULL, 'EQUITY', 'EQUITY_CORE', 'Equity', 'حقوق الملكية', false, false, false, true, false, 150, NULL),
      ('310000', '300000', 'EQUITY', 'EQUITY_CAPITAL', 'Owner Equity', 'حقوق المالك', false, false, false, true, true, 151, NULL),
      ('310001', '310000', 'EQUITY', 'EQUITY_CAPITAL', 'Capital', 'رأس المال', true, false, true, true, false, 152, NULL),
      ('320000', '300000', 'EQUITY', 'EQUITY_RETAINED', 'Retained Earnings', 'الأرباح المبقاة', false, false, false, true, true, 153, NULL),
      ('320001', '320000', 'EQUITY', 'EQUITY_RETAINED', 'Retained Earnings', 'الأرباح المبقاة', true, false, true, true, false, 154, NULL),
      ('330000', '300000', 'EQUITY', 'EQUITY_CYPL', 'Current Year Earnings', 'أرباح السنة الحالية', false, false, false, true, true, 155, NULL),
      ('330001', '330000', 'EQUITY', 'EQUITY_CYPL', 'Current Year Profit or Loss', 'ربح أو خسارة السنة الحالية', true, false, true, true, false, 156, NULL),
      ('400000', NULL, 'REVENUE', NULL, 'Revenue', 'الإيرادات', false, false, false, true, false, 200, NULL),
      ('410000', '400000', 'REVENUE', 'REV_OPERATING', 'Operating Revenue', 'الإيرادات التشغيلية', false, false, false, true, true, 210, NULL),
      ('411000', '410000', 'REVENUE', 'REV_SERVICE', 'Service Revenue', 'إيراد الخدمات', false, false, false, true, true, 211, NULL),
      ('411001', '411000', 'REVENUE', 'REV_SERVICE', 'Laundry Service Revenue', 'إيراد خدمات الغسيل', true, false, true, true, false, 212, 'SALES_REVENUE'),
      ('411002', '411000', 'REVENUE', 'REV_SERVICE', 'Dry Cleaning Revenue', 'إيراد التنظيف الجاف', true, false, false, true, false, 213, NULL),
      ('411003', '411000', 'REVENUE', 'REV_SERVICE', 'Ironing Service Revenue', 'إيراد خدمة الكي', true, false, false, true, false, 214, NULL),
      ('411004', '411000', 'REVENUE', 'REV_SERVICE', 'Delivery Revenue', 'إيراد التوصيل', true, false, false, true, false, 215, NULL),
      ('420000', '400000', 'REVENUE', 'REV_OTHER', 'Other Revenue', 'إيرادات أخرى', false, false, false, true, true, 216, NULL),
      ('420001', '420000', 'REVENUE', 'REV_OTHER', 'Other Revenue', 'إيرادات أخرى', true, false, false, true, false, 217, NULL),
      ('420002', '420000', 'REVENUE', 'REV_OTHER', 'Discounts Recovered', 'استرداد خصومات', true, false, false, true, false, 218, NULL),
      ('500000', NULL, 'EXPENSE', NULL, 'Expenses', 'المصروفات', false, false, false, true, false, 250, NULL),
      ('510000', '500000', 'EXPENSE', 'EXP_DIRECT', 'Direct Costs', 'تكاليف مباشرة', false, false, false, true, true, 260, NULL),
      ('511000', '510000', 'EXPENSE', 'EXP_DIRECT', 'Service Direct Costs', 'تكاليف مباشرة للخدمة', false, false, false, true, true, 261, NULL),
      ('511001', '511000', 'EXPENSE', 'EXP_DIRECT', 'Laundry Materials Expense', 'مصروف مواد الغسيل', true, false, false, true, false, 262, NULL),
      ('511002', '511000', 'EXPENSE', 'EXP_DIRECT', 'Dry Cleaning Materials Expense', 'مصروف مواد التنظيف الجاف', true, false, false, true, false, 263, NULL),
      ('520000', '500000', 'EXPENSE', 'EXP_OPERATING', 'Operating Expenses', 'مصروفات تشغيلية', false, false, false, true, true, 264, NULL),
      ('521000', '520000', 'EXPENSE', 'EXP_BRANCH_OP', 'Branch Operating Expenses', 'مصروفات تشغيل الفرع', false, false, false, true, true, 265, NULL),
      ('521001', '521000', 'EXPENSE', 'EXP_BRANCH_OP', 'Salaries and Wages', 'الرواتب والأجور', true, false, false, true, false, 266, NULL),
      ('521002', '521000', 'EXPENSE', 'EXP_BRANCH_OP', 'Rent Expense', 'مصروف الإيجار', true, false, false, true, false, 267, NULL),
      ('521003', '521000', 'EXPENSE', 'EXP_BRANCH_OP', 'Utilities Expense', 'مصروف المرافق', true, false, false, true, false, 268, NULL),
      ('521004', '521000', 'EXPENSE', 'EXP_BRANCH_OP', 'Maintenance Expense', 'مصروف الصيانة', true, false, false, true, false, 269, NULL),
      ('521005', '521000', 'EXPENSE', 'EXP_BRANCH_OP', 'Delivery Expense', 'مصروف التوصيل', true, false, false, true, false, 270, NULL),
      ('530000', '500000', 'EXPENSE', 'EXP_ADMIN', 'Administrative Expenses', 'مصروفات إدارية', false, false, false, true, true, 271, NULL),
      ('530001', '530000', 'EXPENSE', 'EXP_ADMIN', 'Office Expense', 'مصروف المكتب', true, false, false, true, false, 272, NULL),
      ('530002', '530000', 'EXPENSE', 'EXP_ADMIN', 'Bank Charges', 'الرسوم البنكية', true, false, false, true, false, 273, NULL),
      ('530003', '530000', 'EXPENSE', 'EXP_ADMIN', 'Software Subscription Expense', 'مصروف اشتراك البرامج', true, false, false, true, false, 274, NULL),
      ('530004', '530000', 'EXPENSE', 'EXP_ADMIN', 'General Expense', 'مصروف عام', true, false, false, true, false, 275, 'EXPENSE_GENERAL'),
      ('530005', '530000', 'EXPENSE', 'EXP_ADMIN', 'Bad Debt Expense', 'مصروف ديون معدومة', true, false, false, true, false, 276, NULL),
      ('530006', '530000', 'EXPENSE', 'EXP_ADMIN', 'Petty Cash Expense', 'مصروف العهدة النقدية', true, false, false, true, false, 277, 'PETTY_CASH_EXPENSE'),
      ('540000', '500000', 'EXPENSE', 'EXP_OTHER', 'Other Expenses', 'مصروفات أخرى', false, false, false, true, true, 278, NULL),
      ('540001', '540000', 'EXPENSE', 'EXP_OTHER', 'Loss on Adjustment', 'خسارة تسوية', true, false, false, true, false, 279, 'ROUNDING_ADJUSTMENT'),
      ('540002', '540000', 'EXPENSE', 'EXP_OTHER', 'Miscellaneous Expense', 'مصروفات متنوعة', true, false, false, true, false, 280, NULL)
  ) AS x(account_code, parent_code, acc_type_code, acc_group_code, name, name2, is_postable, is_control_account, is_system_linked, manual_post_allowed, allow_tenant_children, rec_order, usage_hint_code)
)
INSERT INTO public.sys_fin_coa_tpl_dtl (
  coa_tpl_id,
  parent_tpl_line_id,
  account_code,
  account_level,
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
  is_system_seeded,
  is_locked,
  allow_rename,
  allow_code_change,
  allow_tenant_children,
  effective_from,
  created_by,
  created_info,
  rec_status,
  rec_order,
  is_active
)
SELECT
  t.coa_tpl_id,
  parent.coa_tpl_line_id,
  s.account_code,
  public.fn_fin_code_lvl(s.account_code),
  ty.acc_type_id,
  grp.acc_group_id,
  s.name,
  s.name2,
  'Canonical ERP-Lite version 2 COA line ' || s.account_code,
  'سطر دليل حسابات قياسي ERP-Lite الإصدار 2 ' || s.account_code,
  s.is_postable,
  s.is_control_account,
  s.is_system_linked,
  s.manual_post_allowed,
  'GLOBAL',
  s.usage_hint_code,
  true,
  true,
  true,
  false,
  s.allow_tenant_children,
  CURRENT_DATE,
  'system_seed',
  'Migration 0211',
  1,
  s.rec_order,
  true
FROM pkg_targets t
JOIN seed_lines s
  ON true
JOIN public.sys_fin_acc_type_cd ty
  ON ty.acc_type_code = s.acc_type_code
LEFT JOIN public.sys_fin_acc_group_cd grp
  ON grp.acc_group_code = s.acc_group_code
LEFT JOIN public.sys_fin_coa_tpl_dtl parent
  ON parent.coa_tpl_id = t.coa_tpl_id
 AND parent.account_code = s.parent_code
WHERE (s.parent_code IS NULL OR parent.coa_tpl_line_id IS NOT NULL)
ON CONFLICT (coa_tpl_id, account_code) DO UPDATE SET
  parent_tpl_line_id = EXCLUDED.parent_tpl_line_id,
  account_level = EXCLUDED.account_level,
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
  is_system_seeded = EXCLUDED.is_system_seeded,
  is_locked = EXCLUDED.is_locked,
  allow_rename = EXCLUDED.allow_rename,
  allow_code_change = EXCLUDED.allow_code_change,
  allow_tenant_children = EXCLUDED.allow_tenant_children,
  effective_from = EXCLUDED.effective_from,
  rec_status = EXCLUDED.rec_status,
  rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_seed',
  updated_info = 'Migration 0211';

INSERT INTO public.sys_fin_usage_tpl_dtl (
  tpl_pkg_id,
  usage_code_id,
  target_account_code,
  coa_tpl_line_id,
  branch_scope_code,
  is_required,
  effective_from,
  created_by,
  created_info,
  rec_status,
  rec_order,
  is_active
)
SELECT
  p.tpl_pkg_id,
  u.usage_code_id,
  seed.account_code,
  d.coa_tpl_line_id,
  'GLOBAL',
  seed.is_required,
  CURRENT_DATE,
  'system_seed',
  'Migration 0211',
  1,
  seed.rec_order,
  true
FROM public.sys_fin_tpl_pkg_mst p
JOIN public.sys_fin_coa_tpl_mst h
  ON h.tpl_pkg_id = p.tpl_pkg_id
JOIN (
  VALUES
    ('SALES_REVENUE', '411001', true, 10),
    ('VAT_OUTPUT', '212001', true, 20),
    ('VAT_INPUT', '114003', true, 30),
    ('ACCOUNTS_RECEIVABLE', '112001', true, 40),
    ('CASH_MAIN', '111001', true, 50),
    ('BANK_CARD_CLEARING', '111003', true, 60),
    ('PETTY_CASH_MAIN', '111005', true, 70),
    ('WALLET_CLEARING', '214001', false, 80),
    ('REFUND_PAYABLE', '213003', false, 90),
    ('EXPENSE_GENERAL', '530004', false, 100),
    ('PETTY_CASH_EXPENSE', '530006', false, 110),
    ('ROUNDING_ADJUSTMENT', '540001', false, 120)
) AS seed(usage_code, account_code, is_required, rec_order)
  ON true
JOIN public.sys_fin_usage_code_cd u
  ON u.usage_code = seed.usage_code
JOIN public.sys_fin_coa_tpl_dtl d
  ON d.coa_tpl_id = h.coa_tpl_id
 AND d.account_code = seed.account_code
WHERE p.version_no = 2
  AND p.tpl_pkg_code IN (
    'ERP_LITE_SMALL_STD',
    'ERP_LITE_MEDIUM_STD',
    'ERP_LITE_MINI_STD',
    'ERP_LITE_FULL_STD',
    'ERP_LITE_IND_STD',
    'ERP_LITE_GLOBAL_STD'
  )
ON CONFLICT (tpl_pkg_id, usage_code_id, branch_scope_code) DO UPDATE SET
  target_account_code = EXCLUDED.target_account_code,
  coa_tpl_line_id = EXCLUDED.coa_tpl_line_id,
  is_required = EXCLUDED.is_required,
  effective_from = EXCLUDED.effective_from,
  rec_status = EXCLUDED.rec_status,
  rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_seed',
  updated_info = 'Migration 0211';

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
  'Migration 0211',
  1,
  p.rec_order,
  true
FROM public.sys_fin_tpl_pkg_mst p
WHERE p.version_no = 2
  AND p.tpl_pkg_code IN (
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
  updated_info = 'Migration 0211';

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
  m.month_no,
  m.month_no,
  m.label_text,
  'system_seed',
  'Migration 0211',
  1,
  m.month_no,
  true
FROM public.sys_fin_period_tpl_mst p
JOIN public.sys_fin_tpl_pkg_mst pkg
  ON pkg.tpl_pkg_id = p.tpl_pkg_id
JOIN (
  VALUES
    (1, 'Jan'), (2, 'Feb'), (3, 'Mar'), (4, 'Apr'),
    (5, 'May'), (6, 'Jun'), (7, 'Jul'), (8, 'Aug'),
    (9, 'Sep'), (10, 'Oct'), (11, 'Nov'), (12, 'Dec')
) AS m(month_no, label_text)
  ON true
WHERE pkg.version_no = 2
  AND pkg.tpl_pkg_code IN (
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
  updated_info = 'Migration 0211';

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
  '111005',
  jsonb_build_object(
    'cashbox_code', 'PETTY-MAIN',
    'cashbox_name', 'Main Petty Cash',
    'cashbox_name2', 'العهدة النقدية الرئيسية',
    'opening_balance', 0,
    'is_default', true
  ),
  'ACTIVE',
  'system_seed',
  'Migration 0211',
  1,
  p.rec_order,
  true
FROM public.sys_fin_tpl_pkg_mst p
WHERE p.version_no = 2
  AND p.tpl_pkg_code IN (
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
  updated_info = 'Migration 0211';

COMMIT;
