-- ==================================================================
-- Migration: 0181_erp_lite_phase2_gov_rules.sql
-- Purpose: Create ERP-Lite Phase 2 governance package and mapping rule tables
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Phase: ERP-Lite Phase 2 - HQ Governance Foundation
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.sys_fin_resolver_cd (
  resolver_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  resolver_code VARCHAR(60) NOT NULL,
  resolver_kind VARCHAR(20) NOT NULL DEFAULT 'ACCOUNT',
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  phase_code VARCHAR(10) NOT NULL,
  is_locked BOOLEAN NOT NULL DEFAULT false,
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
  CONSTRAINT uq_sfrc_code UNIQUE (resolver_code),
  CONSTRAINT chk_sfrc_kind CHECK (resolver_kind IN ('ACCOUNT')),
  CONSTRAINT chk_sfrc_phase CHECK (phase_code IN ('V1', 'V2', 'V3'))
);

CREATE TABLE IF NOT EXISTS public.sys_fin_gov_pkg_mst (
  pkg_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pkg_code VARCHAR(80) NOT NULL,
  version_no INTEGER NOT NULL DEFAULT 1,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  phase_code VARCHAR(10) NOT NULL,
  compat_version VARCHAR(50) NOT NULL,
  status_code VARCHAR(20) NOT NULL,
  effective_from DATE,
  effective_to DATE,
  acc_type_cat_ver INTEGER NOT NULL DEFAULT 1,
  evt_cat_ver INTEGER NOT NULL DEFAULT 1,
  usage_cat_ver INTEGER NOT NULL DEFAULT 1,
  rule_set_ver INTEGER NOT NULL DEFAULT 1,
  auto_post_ver INTEGER NOT NULL DEFAULT 1,
  resolver_cat_ver INTEGER NOT NULL DEFAULT 1,
  approved_at TIMESTAMP,
  approved_by VARCHAR(120),
  published_at TIMESTAMP,
  published_by VARCHAR(120),
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
  CONSTRAINT uq_sfgp_code_ver UNIQUE (pkg_code, version_no),
  CONSTRAINT chk_sfgp_phase CHECK (phase_code IN ('V1', 'V2', 'V3')),
  CONSTRAINT chk_sfgp_stat CHECK (status_code IN ('DRAFT', 'APPROVED', 'PUBLISHED', 'SUPERSEDED', 'RETIRED'))
);

CREATE TABLE IF NOT EXISTS public.sys_fin_map_rule_mst (
  rule_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pkg_id UUID NOT NULL,
  evt_id UUID NOT NULL,
  rule_code VARCHAR(80) NOT NULL,
  version_no INTEGER NOT NULL DEFAULT 1,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  priority_no INTEGER NOT NULL DEFAULT 100,
  condition_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_fallback BOOLEAN NOT NULL DEFAULT false,
  stop_on_match BOOLEAN NOT NULL DEFAULT true,
  status_code VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
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
  CONSTRAINT uq_sfmr_pkg_rule UNIQUE (pkg_id, rule_code),
  CONSTRAINT fk_sfmr_pkg FOREIGN KEY (pkg_id)
    REFERENCES public.sys_fin_gov_pkg_mst(pkg_id),
  CONSTRAINT fk_sfmr_evt FOREIGN KEY (evt_id)
    REFERENCES public.sys_fin_evt_cd(evt_id),
  CONSTRAINT chk_sfmr_stat CHECK (status_code IN ('DRAFT', 'ACTIVE', 'INACTIVE', 'SUPERSEDED'))
);

CREATE TABLE IF NOT EXISTS public.sys_fin_map_rule_dtl (
  rule_line_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rule_id UUID NOT NULL,
  line_no INTEGER NOT NULL,
  entry_side VARCHAR(10) NOT NULL,
  usage_code_id UUID,
  resolver_id UUID,
  amount_source_code VARCHAR(60) NOT NULL,
  line_type_code VARCHAR(20) NOT NULL DEFAULT 'MAIN',
  condition_json JSONB NOT NULL DEFAULT '{}'::jsonb,
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
  CONSTRAINT uq_sfml_rule_line UNIQUE (rule_id, line_no),
  CONSTRAINT fk_sfml_rule FOREIGN KEY (rule_id)
    REFERENCES public.sys_fin_map_rule_mst(rule_id),
  CONSTRAINT fk_sfml_uc FOREIGN KEY (usage_code_id)
    REFERENCES public.sys_fin_usage_code_cd(usage_code_id),
  CONSTRAINT fk_sfml_res FOREIGN KEY (resolver_id)
    REFERENCES public.sys_fin_resolver_cd(resolver_id),
  CONSTRAINT chk_sfml_side CHECK (entry_side IN ('DR', 'CR')),
  CONSTRAINT chk_sfml_type CHECK (line_type_code IN ('MAIN', 'VAT', 'ADJUSTMENT')),
  CONSTRAINT chk_sfml_src CHECK ((usage_code_id IS NOT NULL) <> (resolver_id IS NOT NULL))
);

CREATE INDEX IF NOT EXISTS idx_sfrc_code ON public.sys_fin_resolver_cd(resolver_code);
CREATE INDEX IF NOT EXISTS idx_sfgp_stat ON public.sys_fin_gov_pkg_mst(status_code, phase_code, is_active);
CREATE INDEX IF NOT EXISTS idx_sfmr_pkg_evt ON public.sys_fin_map_rule_mst(pkg_id, evt_id, is_active);
CREATE INDEX IF NOT EXISTS idx_sfmr_code ON public.sys_fin_map_rule_mst(rule_code);
CREATE INDEX IF NOT EXISTS idx_sfml_rule ON public.sys_fin_map_rule_dtl(rule_id, line_no);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sfmr_evt_prio
  ON public.sys_fin_map_rule_mst(pkg_id, evt_id, priority_no);
CREATE UNIQUE INDEX IF NOT EXISTS uq_sfmr_evt_fall
  ON public.sys_fin_map_rule_mst(pkg_id, evt_id, is_fallback)
  WHERE is_fallback = true;

INSERT INTO public.sys_fin_resolver_cd (
  resolver_code,
  resolver_kind,
  name,
  name2,
  description,
  description2,
  phase_code,
  is_locked,
  rec_order,
  created_at,
  created_by,
  created_info,
  is_active,
  rec_status
) VALUES (
  'PAYMENT_METHOD_MAP',
  'ACCOUNT',
  'Payment Method Account Resolver',
  'محلل حساب طريقة الدفع',
  'Resolves the correct tenant cash, bank clearing, or wallet account from the payment method context.',
  'يحلل حساب النقد أو التسوية البنكية أو المحفظة الصحيح للمستأجر من سياق طريقة الدفع.',
  'V1',
  true,
  10,
  CURRENT_TIMESTAMP,
  'system_admin',
  'Migration 0181',
  true,
  1
)
ON CONFLICT (resolver_code) DO UPDATE SET
  resolver_kind = EXCLUDED.resolver_kind,
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  phase_code = EXCLUDED.phase_code,
  is_locked = EXCLUDED.is_locked,
  rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active,
  rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_admin',
  updated_info = 'Migration 0181';

INSERT INTO public.sys_fin_gov_pkg_mst (
  pkg_code,
  version_no,
  name,
  name2,
  description,
  description2,
  phase_code,
  compat_version,
  status_code,
  acc_type_cat_ver,
  evt_cat_ver,
  usage_cat_ver,
  rule_set_ver,
  auto_post_ver,
  resolver_cat_ver,
  rec_order,
  created_at,
  created_by,
  created_info,
  is_active,
  rec_status
) VALUES (
  'ERP_LITE_V1_CORE',
  1,
  'ERP-Lite V1 Core Governance Package',
  'حزمة الحوكمة الأساسية ERP-Lite V1',
  'Draft governance package for the approved v1 ERP-Lite rule set.',
  'حزمة حوكمة مسودة لمجموعة قواعد ERP-Lite v1 المعتمدة.',
  'V1',
  'erp_lite_runtime_v1',
  'DRAFT',
  1,
  1,
  1,
  1,
  1,
  1,
  10,
  CURRENT_TIMESTAMP,
  'system_admin',
  'Migration 0181',
  true,
  1
)
ON CONFLICT (pkg_code, version_no) DO UPDATE SET
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  phase_code = EXCLUDED.phase_code,
  compat_version = EXCLUDED.compat_version,
  status_code = EXCLUDED.status_code,
  acc_type_cat_ver = EXCLUDED.acc_type_cat_ver,
  evt_cat_ver = EXCLUDED.evt_cat_ver,
  usage_cat_ver = EXCLUDED.usage_cat_ver,
  rule_set_ver = EXCLUDED.rule_set_ver,
  auto_post_ver = EXCLUDED.auto_post_ver,
  resolver_cat_ver = EXCLUDED.resolver_cat_ver,
  rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active,
  rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_admin',
  updated_info = 'Migration 0181';

INSERT INTO public.sys_fin_map_rule_mst (
  pkg_id,
  evt_id,
  rule_code,
  version_no,
  name,
  name2,
  description,
  description2,
  priority_no,
  condition_json,
  is_fallback,
  stop_on_match,
  status_code,
  rec_order,
  created_at,
  created_by,
  created_info,
  is_active,
  rec_status
)
SELECT
  p.pkg_id,
  e.evt_id,
  seed.rule_code,
  1,
  seed.name,
  seed.name2,
  seed.description,
  seed.description2,
  seed.priority_no,
  seed.condition_json::jsonb,
  seed.is_fallback,
  seed.stop_on_match,
  'DRAFT',
  seed.priority_no,
  CURRENT_TIMESTAMP,
  'system_admin',
  'Migration 0181',
  true,
  1
FROM (
  VALUES
    ('ORDER_INVOICED_V1', 'ORDER_INVOICED', 'Order invoiced v1', 'فوترة الطلب v1', 'Draft v1 rule for invoice posting.', 'قاعدة مسودة v1 لقيود الفاتورة.', 10, '{}', true, true),
    ('ORDER_SETTLED_CASH_V1', 'ORDER_SETTLED_CASH', 'Order settled cash v1', 'تسوية الطلب نقداً v1', 'Draft v1 rule for cash settlement posting.', 'قاعدة مسودة v1 لتسوية الطلب النقدية.', 20, '{}', true, true),
    ('ORDER_SETTLED_CARD_V1', 'ORDER_SETTLED_CARD', 'Order settled card v1', 'تسوية الطلب بالبطاقة v1', 'Draft v1 rule for card settlement posting.', 'قاعدة مسودة v1 لتسوية الطلب بالبطاقة.', 30, '{}', true, true),
    ('ORDER_SETTLED_WALLET_V1', 'ORDER_SETTLED_WALLET', 'Order settled wallet v1', 'تسوية الطلب بالمحفظة v1', 'Draft v1 rule for wallet settlement posting.', 'قاعدة مسودة v1 لتسوية الطلب بالمحفظة.', 40, '{}', true, true),
    ('PAYMENT_RECEIVED_V1', 'PAYMENT_RECEIVED', 'Payment received v1', 'استلام دفعة v1', 'Draft v1 rule for standalone payment posting.', 'قاعدة مسودة v1 لقيود الدفعة المستقلة.', 50, '{}', true, true),
    ('REFUND_ISSUED_V1', 'REFUND_ISSUED', 'Refund issued v1', 'إصدار استرداد v1', 'Draft v1 rule for refund posting.', 'قاعدة مسودة v1 لقيود الاسترداد.', 60, '{}', true, true),
    ('EXPENSE_RECORDED_V1', 'EXPENSE_RECORDED', 'Expense recorded v1', 'تسجيل مصروف v1', 'Draft v1 rule for expense posting.', 'قاعدة مسودة v1 لقيود المصروف.', 70, '{}', true, true),
    ('PETTY_CASH_TOPUP_V1', 'PETTY_CASH_TOPUP', 'Petty cash top-up v1', 'تغذية العهدة النقدية v1', 'Draft v1 rule for petty cash top-up posting.', 'قاعدة مسودة v1 لقيود تغذية العهدة النقدية.', 80, '{}', true, true),
    ('PETTY_CASH_SPENT_V1', 'PETTY_CASH_SPENT', 'Petty cash spent v1', 'صرف عهدة نقدية v1', 'Draft v1 rule for petty cash spend posting.', 'قاعدة مسودة v1 لقيود صرف العهدة النقدية.', 90, '{}', true, true)
) AS seed(rule_code, evt_code, name, name2, description, description2, priority_no, condition_json, is_fallback, stop_on_match)
JOIN public.sys_fin_gov_pkg_mst p
  ON p.pkg_code = 'ERP_LITE_V1_CORE' AND p.version_no = 1
JOIN public.sys_fin_evt_cd e
  ON e.evt_code = seed.evt_code
ON CONFLICT (pkg_id, rule_code) DO UPDATE SET
  evt_id = EXCLUDED.evt_id,
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  priority_no = EXCLUDED.priority_no,
  condition_json = EXCLUDED.condition_json,
  is_fallback = EXCLUDED.is_fallback,
  stop_on_match = EXCLUDED.stop_on_match,
  status_code = EXCLUDED.status_code,
  rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active,
  rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_admin',
  updated_info = 'Migration 0181';

INSERT INTO public.sys_fin_map_rule_dtl (
  rule_id,
  line_no,
  entry_side,
  usage_code_id,
  resolver_id,
  amount_source_code,
  line_type_code,
  condition_json,
  rec_order,
  created_at,
  created_by,
  created_info,
  is_active,
  rec_status
)
SELECT
  r.rule_id,
  seed.line_no,
  seed.entry_side,
  uc.usage_code_id,
  res.resolver_id,
  seed.amount_source_code,
  seed.line_type_code,
  seed.condition_json::jsonb,
  seed.rec_order,
  CURRENT_TIMESTAMP,
  'system_admin',
  'Migration 0181',
  true,
  1
FROM (
  VALUES
    ('ORDER_INVOICED_V1', 10, 'DR', 'ACCOUNTS_RECEIVABLE', NULL, 'gross_amount', 'MAIN', '{}', 10),
    ('ORDER_INVOICED_V1', 20, 'CR', 'SALES_REVENUE', NULL, 'net_amount', 'MAIN', '{}', 20),
    ('ORDER_INVOICED_V1', 30, 'CR', 'VAT_OUTPUT', NULL, 'tax_amount', 'VAT', '{"when":"tax_amount > 0"}', 30),
    ('ORDER_SETTLED_CASH_V1', 10, 'DR', 'CASH_MAIN', NULL, 'gross_amount', 'MAIN', '{}', 10),
    ('ORDER_SETTLED_CASH_V1', 20, 'CR', 'ACCOUNTS_RECEIVABLE', NULL, 'gross_amount', 'MAIN', '{}', 20),
    ('ORDER_SETTLED_CARD_V1', 10, 'DR', 'BANK_CARD_CLEARING', NULL, 'gross_amount', 'MAIN', '{}', 10),
    ('ORDER_SETTLED_CARD_V1', 20, 'CR', 'ACCOUNTS_RECEIVABLE', NULL, 'gross_amount', 'MAIN', '{}', 20),
    ('ORDER_SETTLED_WALLET_V1', 10, 'DR', 'WALLET_CLEARING', NULL, 'gross_amount', 'MAIN', '{}', 10),
    ('ORDER_SETTLED_WALLET_V1', 20, 'CR', 'ACCOUNTS_RECEIVABLE', NULL, 'gross_amount', 'MAIN', '{}', 20),
    ('PAYMENT_RECEIVED_V1', 10, 'DR', NULL, 'PAYMENT_METHOD_MAP', 'gross_amount', 'MAIN', '{}', 10),
    ('PAYMENT_RECEIVED_V1', 20, 'CR', 'ACCOUNTS_RECEIVABLE', NULL, 'gross_amount', 'MAIN', '{}', 20),
    ('REFUND_ISSUED_V1', 10, 'DR', 'SALES_REVENUE', NULL, 'net_amount', 'MAIN', '{}', 10),
    ('REFUND_ISSUED_V1', 20, 'DR', 'VAT_OUTPUT', NULL, 'tax_amount', 'VAT', '{"when":"tax_amount > 0"}', 20),
    ('REFUND_ISSUED_V1', 30, 'CR', 'ACCOUNTS_RECEIVABLE', NULL, 'gross_amount', 'MAIN', '{}', 30),
    ('EXPENSE_RECORDED_V1', 10, 'DR', 'EXPENSE_GENERAL', NULL, 'gross_amount', 'MAIN', '{}', 10),
    ('EXPENSE_RECORDED_V1', 20, 'CR', NULL, 'PAYMENT_METHOD_MAP', 'gross_amount', 'MAIN', '{}', 20),
    ('PETTY_CASH_TOPUP_V1', 10, 'DR', 'PETTY_CASH_MAIN', NULL, 'gross_amount', 'MAIN', '{}', 10),
    ('PETTY_CASH_TOPUP_V1', 20, 'CR', 'CASH_MAIN', NULL, 'gross_amount', 'MAIN', '{}', 20),
    ('PETTY_CASH_SPENT_V1', 10, 'DR', 'PETTY_CASH_EXPENSE', NULL, 'gross_amount', 'MAIN', '{}', 10),
    ('PETTY_CASH_SPENT_V1', 20, 'CR', 'PETTY_CASH_MAIN', NULL, 'gross_amount', 'MAIN', '{}', 20)
) AS seed(rule_code, line_no, entry_side, usage_code, acct_resolver_code, amount_source_code, line_type_code, condition_json, rec_order)
JOIN public.sys_fin_map_rule_mst r
  ON r.rule_code = seed.rule_code
LEFT JOIN public.sys_fin_usage_code_cd uc
  ON uc.usage_code = seed.usage_code
LEFT JOIN public.sys_fin_resolver_cd res
  ON res.resolver_code = seed.acct_resolver_code
ON CONFLICT (rule_id, line_no) DO UPDATE SET
  usage_code_id = EXCLUDED.usage_code_id,
  resolver_id = EXCLUDED.resolver_id,
  amount_source_code = EXCLUDED.amount_source_code,
  line_type_code = EXCLUDED.line_type_code,
  condition_json = EXCLUDED.condition_json,
  rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active,
  rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_admin',
  updated_info = 'Migration 0181';

COMMIT;
