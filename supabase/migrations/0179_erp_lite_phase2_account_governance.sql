-- ==================================================================
-- Migration: 0179_erp_lite_phase2_account_governance.sql
-- Purpose: Create ERP-Lite Phase 2 HQ account type and account group governance tables
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Phase: ERP-Lite Phase 2 - HQ Governance Foundation
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.sys_fin_acc_type_cd (
  acc_type_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acc_type_code VARCHAR(50) NOT NULL,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  normal_balance VARCHAR(10) NOT NULL,
  statement_family VARCHAR(20) NOT NULL,
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
  CONSTRAINT uq_sfat_code UNIQUE (acc_type_code),
  CONSTRAINT chk_sfat_bal CHECK (normal_balance IN ('DEBIT', 'CREDIT')),
  CONSTRAINT chk_sfat_stmt CHECK (statement_family IN ('BALANCE_SHEET', 'PROFIT_LOSS'))
);

CREATE TABLE IF NOT EXISTS public.sys_fin_acc_group_cd (
  acc_group_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  acc_group_code VARCHAR(60) NOT NULL,
  acc_type_id UUID NOT NULL,
  parent_group_id UUID,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  stmt_section VARCHAR(30) NOT NULL,
  report_role_code VARCHAR(30),
  group_level SMALLINT NOT NULL DEFAULT 1,
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
  CONSTRAINT uq_sfag_code UNIQUE (acc_group_code),
  CONSTRAINT fk_sfag_type FOREIGN KEY (acc_type_id)
    REFERENCES public.sys_fin_acc_type_cd(acc_type_id),
  CONSTRAINT fk_sfag_prnt FOREIGN KEY (parent_group_id)
    REFERENCES public.sys_fin_acc_group_cd(acc_group_id),
  CONSTRAINT chk_sfag_stmt CHECK (
    stmt_section IN ('ASSETS', 'LIABILITIES', 'EQUITY', 'REVENUE', 'EXPENSES')
  ),
  CONSTRAINT chk_sfag_lvl CHECK (group_level >= 1)
);

CREATE INDEX IF NOT EXISTS idx_sfat_code ON public.sys_fin_acc_type_cd(acc_type_code);
CREATE INDEX IF NOT EXISTS idx_sfat_actv ON public.sys_fin_acc_type_cd(is_active, rec_status);
CREATE INDEX IF NOT EXISTS idx_sfag_code ON public.sys_fin_acc_group_cd(acc_group_code);
CREATE INDEX IF NOT EXISTS idx_sfag_type ON public.sys_fin_acc_group_cd(acc_type_id, is_active);
CREATE INDEX IF NOT EXISTS idx_sfag_prnt ON public.sys_fin_acc_group_cd(parent_group_id);
CREATE INDEX IF NOT EXISTS idx_sfag_stmt ON public.sys_fin_acc_group_cd(stmt_section, report_role_code);

INSERT INTO public.sys_fin_acc_type_cd (
  acc_type_code,
  name,
  name2,
  description,
  description2,
  normal_balance,
  statement_family,
  rec_order,
  created_at,
  created_by,
  created_info,
  is_active,
  rec_status
) VALUES
  ('ASSET', 'Asset', 'أصل', 'HQ-governed asset account type for ERP-Lite.', 'نوع حساب الأصل المحكوم مركزياً لـ ERP-Lite.', 'DEBIT', 'BALANCE_SHEET', 10, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0179', true, 1),
  ('LIABILITY', 'Liability', 'التزام', 'HQ-governed liability account type for ERP-Lite.', 'نوع حساب الالتزام المحكوم مركزياً لـ ERP-Lite.', 'CREDIT', 'BALANCE_SHEET', 20, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0179', true, 1),
  ('EQUITY', 'Equity', 'حقوق ملكية', 'HQ-governed equity account type for ERP-Lite.', 'نوع حساب حقوق الملكية المحكوم مركزياً لـ ERP-Lite.', 'CREDIT', 'BALANCE_SHEET', 30, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0179', true, 1),
  ('REVENUE', 'Revenue', 'إيراد', 'HQ-governed revenue account type for ERP-Lite.', 'نوع حساب الإيراد المحكوم مركزياً لـ ERP-Lite.', 'CREDIT', 'PROFIT_LOSS', 40, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0179', true, 1),
  ('EXPENSE', 'Expense', 'مصروف', 'HQ-governed expense account type for ERP-Lite.', 'نوع حساب المصروف المحكوم مركزياً لـ ERP-Lite.', 'DEBIT', 'PROFIT_LOSS', 50, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0179', true, 1)
ON CONFLICT (acc_type_code) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  normal_balance = EXCLUDED.normal_balance,
  statement_family = EXCLUDED.statement_family,
  rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active,
  rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_admin',
  updated_info = 'Migration 0179';

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
  'system_admin',
  'Migration 0179',
  true,
  1
FROM (
  VALUES
    ('ASSET_CURRENT', 'ASSET', NULL, 'Current Assets', 'الأصول المتداولة', 'Asset group for current operational assets.', 'مجموعة أصول للأصول التشغيلية المتداولة.', 'ASSETS', 'CURRENT_ASSETS', 1, 10),
    ('LIAB_CURRENT', 'LIABILITY', NULL, 'Current Liabilities', 'الالتزامات المتداولة', 'Liability group for short-term obligations.', 'مجموعة التزامات للالتزامات قصيرة الأجل.', 'LIABILITIES', 'CURRENT_LIABILITIES', 1, 50),
    ('REV_OPERATING', 'REVENUE', NULL, 'Operating Revenue', 'الإيرادات التشغيلية', 'Revenue group for core laundry service revenue.', 'مجموعة إيرادات للإيرادات التشغيلية الأساسية.', 'REVENUE', 'OPERATING_REVENUE', 1, 70),
    ('EXP_OPERATING', 'EXPENSE', NULL, 'Operating Expenses', 'المصروفات التشغيلية', 'Expense group for operating costs and petty cash expenses.', 'مجموعة مصروفات للمصروفات التشغيلية ومصروفات العهدة النقدية.', 'EXPENSES', 'OPERATING_EXPENSES', 1, 80)
) AS seed(acc_group_code, acc_type_code, parent_group_code, name, name2, description, description2, stmt_section, report_role_code, group_level, rec_order)
JOIN public.sys_fin_acc_type_cd t
  ON t.acc_type_code = seed.acc_type_code
LEFT JOIN public.sys_fin_acc_group_cd parent
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
  updated_by = 'system_admin',
  updated_info = 'Migration 0179';

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
  'system_admin',
  'Migration 0179',
  true,
  1
FROM (
  VALUES
    ('ASSET_RECEIVABLE', 'ASSET', 'ASSET_CURRENT', 'Receivables', 'الذمم المدينة', 'Asset group for receivable control accounts.', 'مجموعة أصول لحسابات الذمم المدينة.', 'ASSETS', 'RECEIVABLES', 2, 20),
    ('ASSET_CASH_BANK', 'ASSET', 'ASSET_CURRENT', 'Cash and Bank', 'النقد والبنك', 'Asset group for cash, petty cash, and bank clearing accounts.', 'مجموعة أصول للنقد والعهدة والبنك.', 'ASSETS', 'CASH_BANK', 2, 30),
    ('ASSET_TAX_INPUT', 'ASSET', 'ASSET_CURRENT', 'Recoverable Input Tax', 'ضريبة مدخلات قابلة للاسترداد', 'Asset group for recoverable input VAT accounts.', 'مجموعة أصول لحسابات ضريبة المدخلات القابلة للاسترداد.', 'ASSETS', 'INPUT_TAX', 2, 40),
    ('LIAB_TAX_OUTPUT', 'LIABILITY', 'LIAB_CURRENT', 'Output Tax Payable', 'ضريبة مخرجات مستحقة', 'Liability group for output VAT payable accounts.', 'مجموعة التزامات لحسابات ضريبة المخرجات المستحقة.', 'LIABILITIES', 'OUTPUT_TAX', 2, 60)
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
  updated_by = 'system_admin',
  updated_info = 'Migration 0179';

COMMIT;
