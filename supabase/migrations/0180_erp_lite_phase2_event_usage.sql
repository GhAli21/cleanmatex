-- ==================================================================
-- Migration: 0180_erp_lite_phase2_event_usage.sql
-- Purpose: Create ERP-Lite Phase 2 event and usage code governance catalogs
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Phase: ERP-Lite Phase 2 - HQ Governance Foundation
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.sys_fin_evt_cd (
  evt_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  evt_code VARCHAR(60) NOT NULL,
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
  CONSTRAINT uq_sfe_code UNIQUE (evt_code),
  CONSTRAINT chk_sfe_phase CHECK (phase_code IN ('V1', 'V2', 'V3'))
);

CREATE TABLE IF NOT EXISTS public.sys_fin_usage_code_cd (
  usage_code_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usage_code VARCHAR(60) NOT NULL,
  exp_acc_type_id UUID NOT NULL,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  normal_balance VARCHAR(10) NOT NULL,
  phase_code VARCHAR(10) NOT NULL,
  is_required_v1 BOOLEAN NOT NULL DEFAULT false,
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
  CONSTRAINT uq_sfuc_code UNIQUE (usage_code),
  CONSTRAINT fk_sfuc_type FOREIGN KEY (exp_acc_type_id)
    REFERENCES public.sys_fin_acc_type_cd(acc_type_id),
  CONSTRAINT chk_sfuc_bal CHECK (normal_balance IN ('DEBIT', 'CREDIT', 'EITHER')),
  CONSTRAINT chk_sfuc_phase CHECK (phase_code IN ('V1', 'V2', 'V3'))
);

CREATE INDEX IF NOT EXISTS idx_sfe_code ON public.sys_fin_evt_cd(evt_code);
CREATE INDEX IF NOT EXISTS idx_sfe_phase ON public.sys_fin_evt_cd(phase_code, is_active);
CREATE INDEX IF NOT EXISTS idx_sfuc_code ON public.sys_fin_usage_code_cd(usage_code);
CREATE INDEX IF NOT EXISTS idx_sfuc_type ON public.sys_fin_usage_code_cd(exp_acc_type_id, phase_code);

INSERT INTO public.sys_fin_evt_cd (
  evt_code,
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
) VALUES
  ('ORDER_INVOICED', 'Order Invoiced', 'تمت فوترة الطلب', 'ERP-Lite v1 event for invoice creation and receivable recognition.', 'حدث ERP-Lite v1 لإنشاء الفاتورة وإثبات الذمم المدينة.', 'V1', true, 10, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0180', true, 1),
  ('ORDER_SETTLED_CASH', 'Order Settled - Cash', 'تمت تسوية الطلب نقداً', 'ERP-Lite v1 event for cash order settlement.', 'حدث ERP-Lite v1 لتسوية الطلب النقدية.', 'V1', true, 20, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0180', true, 1),
  ('ORDER_SETTLED_CARD', 'Order Settled - Card', 'تمت تسوية الطلب بالبطاقة', 'ERP-Lite v1 event for card order settlement.', 'حدث ERP-Lite v1 لتسوية الطلب بالبطاقة.', 'V1', true, 30, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0180', true, 1),
  ('ORDER_SETTLED_WALLET', 'Order Settled - Wallet', 'تمت تسوية الطلب بالمحفظة', 'ERP-Lite v1 event for wallet-based order settlement.', 'حدث ERP-Lite v1 لتسوية الطلب بالمحفظة.', 'V1', true, 40, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0180', true, 1),
  ('PAYMENT_RECEIVED', 'Payment Received', 'تم استلام دفعة', 'ERP-Lite v1 event for standalone payment receipt.', 'حدث ERP-Lite v1 لاستلام دفعة مستقلة.', 'V1', true, 50, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0180', true, 1),
  ('REFUND_ISSUED', 'Refund Issued', 'تم إصدار استرداد', 'ERP-Lite v1 event for refund issuance.', 'حدث ERP-Lite v1 لإصدار الاسترداد.', 'V1', true, 60, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0180', true, 1),
  ('EXPENSE_RECORDED', 'Expense Recorded', 'تم تسجيل مصروف', 'ERP-Lite v1 event for basic expense recording.', 'حدث ERP-Lite v1 لتسجيل المصروف الأساسي.', 'V1', true, 70, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0180', true, 1),
  ('PETTY_CASH_TOPUP', 'Petty Cash Top Up', 'تمت تغذية العهدة النقدية', 'ERP-Lite v1 event for petty cash top-up.', 'حدث ERP-Lite v1 لتغذية العهدة النقدية.', 'V1', true, 80, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0180', true, 1),
  ('PETTY_CASH_SPENT', 'Petty Cash Spent', 'تم صرف من العهدة النقدية', 'ERP-Lite v1 event for petty cash spending.', 'حدث ERP-Lite v1 لصرف من العهدة النقدية.', 'V1', true, 90, CURRENT_TIMESTAMP, 'system_admin', 'Migration 0180', true, 1)
ON CONFLICT (evt_code) DO UPDATE SET
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
  updated_info = 'Migration 0180';

INSERT INTO public.sys_fin_usage_code_cd (
  usage_code,
  exp_acc_type_id,
  name,
  name2,
  description,
  description2,
  normal_balance,
  phase_code,
  is_required_v1,
  rec_order,
  created_at,
  created_by,
  created_info,
  is_active,
  rec_status
)
SELECT
  seed.usage_code,
  t.acc_type_id,
  seed.name,
  seed.name2,
  seed.description,
  seed.description2,
  seed.normal_balance,
  'V1',
  seed.is_required_v1,
  seed.rec_order,
  CURRENT_TIMESTAMP,
  'system_admin',
  'Migration 0180',
  true,
  1
FROM (
  VALUES
    ('SALES_REVENUE', 'REVENUE', 'Sales Revenue', 'إيراد المبيعات', 'Usage code for tenant revenue accounts used by ERP-Lite sales posting.', 'رمز استخدام لحسابات الإيرادات المستخدمة في قيود مبيعات ERP-Lite.', 'CREDIT', true, 10),
    ('VAT_OUTPUT', 'LIABILITY', 'Output VAT', 'ضريبة مخرجات', 'Usage code for VAT payable accounts on sales.', 'رمز استخدام لحسابات ضريبة المخرجات على المبيعات.', 'CREDIT', true, 20),
    ('VAT_INPUT', 'ASSET', 'Input VAT', 'ضريبة مدخلات', 'Usage code for recoverable purchase VAT accounts.', 'رمز استخدام لحسابات ضريبة المدخلات القابلة للاسترداد.', 'DEBIT', true, 30),
    ('ACCOUNTS_RECEIVABLE', 'ASSET', 'Accounts Receivable', 'الذمم المدينة', 'Usage code for customer receivable control accounts.', 'رمز استخدام لحسابات الذمم المدينة للعملاء.', 'DEBIT', true, 40),
    ('CASH_MAIN', 'ASSET', 'Cash Main', 'الصندوق الرئيسي', 'Usage code for main cash-on-hand account.', 'رمز استخدام لحساب الصندوق الرئيسي.', 'DEBIT', true, 50),
    ('BANK_CARD_CLEARING', 'ASSET', 'Bank Card Clearing', 'تسوية بطاقات البنك', 'Usage code for card settlement clearing account.', 'رمز استخدام لحساب تسوية بطاقات البنك.', 'DEBIT', true, 60),
    ('PETTY_CASH_MAIN', 'ASSET', 'Petty Cash Main', 'العهدة النقدية الرئيسية', 'Usage code for main petty cash account.', 'رمز استخدام لحساب العهدة النقدية الرئيسية.', 'DEBIT', true, 70),
    ('WALLET_CLEARING', 'LIABILITY', 'Wallet Clearing', 'تسوية المحفظة', 'Optional usage code for customer wallet liability clearing.', 'رمز استخدام اختياري لتسوية التزام محفظة العميل.', 'CREDIT', false, 80),
    ('REFUND_PAYABLE', 'LIABILITY', 'Refund Payable', 'استردادات مستحقة', 'Optional usage code for refund payable obligations.', 'رمز استخدام اختياري لالتزامات الاسترداد المستحقة.', 'CREDIT', false, 90),
    ('EXPENSE_GENERAL', 'EXPENSE', 'General Expense', 'مصروف عام', 'Optional usage code for general operating expenses.', 'رمز استخدام اختياري للمصروفات التشغيلية العامة.', 'DEBIT', false, 100),
    ('PETTY_CASH_EXPENSE', 'EXPENSE', 'Petty Cash Expense', 'مصروف العهدة النقدية', 'Optional usage code for petty cash expenses.', 'رمز استخدام اختياري لمصروفات العهدة النقدية.', 'DEBIT', false, 110),
    ('ROUNDING_ADJUSTMENT', 'EXPENSE', 'Rounding Adjustment', 'تسوية فروقات التقريب', 'Optional usage code for rounding adjustment entries.', 'رمز استخدام اختياري لتسويات فروقات التقريب.', 'EITHER', false, 120)
) AS seed(usage_code, acc_type_code, name, name2, description, description2, normal_balance, is_required_v1, rec_order)
JOIN public.sys_fin_acc_type_cd t
  ON t.acc_type_code = seed.acc_type_code
ON CONFLICT (usage_code) DO UPDATE SET
  exp_acc_type_id = EXCLUDED.exp_acc_type_id,
  name = EXCLUDED.name,
  name2 = EXCLUDED.name2,
  description = EXCLUDED.description,
  description2 = EXCLUDED.description2,
  normal_balance = EXCLUDED.normal_balance,
  phase_code = EXCLUDED.phase_code,
  is_required_v1 = EXCLUDED.is_required_v1,
  rec_order = EXCLUDED.rec_order,
  is_active = EXCLUDED.is_active,
  rec_status = EXCLUDED.rec_status,
  updated_at = CURRENT_TIMESTAMP,
  updated_by = 'system_admin',
  updated_info = 'Migration 0180';

COMMIT;
