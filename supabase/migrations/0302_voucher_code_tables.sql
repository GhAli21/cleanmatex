-- ==================================================================
-- 0302_voucher_code_tables.sql
-- Business Voucher Module (BVM) — Phase 1, Step 3
-- Sys-level lookup/code tables for voucher types, line types,
-- line roles, target types, directions, and expense categories.
-- All sys_* tables are global (no tenant_org_id).
-- org_fin_exp_cat_cf is tenant-scoped with RLS.
-- ==================================================================

BEGIN;

-- ==================================================================
-- 1. sys_fin_vch_type_cd — Voucher types
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_fin_vch_type_cd (
  code           TEXT    PRIMARY KEY,
  name           TEXT    NOT NULL,
  name2          TEXT,
  description    TEXT,
  description2   TEXT,
  direction_hint TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT true,
  rec_status     SMALLINT DEFAULT 1,
  rec_order      INTEGER,
  created_at     TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by     TEXT,
  updated_at     TIMESTAMPTZ,
  updated_by     TEXT
);

COMMENT ON TABLE sys_fin_vch_type_cd IS 'BVM voucher type codes: RECEIPT_VOUCHER, PAYMENT_VOUCHER, REFUND_VOUCHER, ADJUSTMENT_VOUCHER, TRANSFER_VOUCHER';

INSERT INTO sys_fin_vch_type_cd (code, name, name2, description, description2, direction_hint, rec_order)
VALUES
  ('RECEIPT_VOUCHER',    'Receipt Voucher',    'سند قبض',       'Money received from customers or other sources', 'أموال مستلمة من العملاء أو مصادر أخرى', 'IN',      1),
  ('PAYMENT_VOUCHER',   'Payment Voucher',    'سند صرف',       'Money paid out for expenses, suppliers, etc.',   'أموال مصروفة للمصاريف والموردين',         'OUT',     2),
  ('REFUND_VOUCHER',    'Refund Voucher',     'سند استرداد',   'Refund issued to a customer',                   'استرداد مبلغ للعميل',                     'OUT',     3),
  ('ADJUSTMENT_VOUCHER','Adjustment Voucher', 'سند تسوية',     'Non-cash balance correction',                   'تسوية رصيد غير نقدي',                     'NEUTRAL', 4),
  ('TRANSFER_VOUCHER',  'Transfer Voucher',   'سند تحويل',     'Internal transfer between accounts or drawers', 'تحويل داخلي بين الحسابات أو الصناديق',    'NEUTRAL', 5)
ON CONFLICT (code) DO NOTHING;

-- ==================================================================
-- 2. sys_fin_vch_line_type_cd — Line types
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_fin_vch_line_type_cd (
  code         TEXT    PRIMARY KEY,
  name         TEXT    NOT NULL,
  name2        TEXT,
  description  TEXT,
  description2 TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  rec_status   SMALLINT DEFAULT 1,
  rec_order    INTEGER,
  created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by   TEXT,
  updated_at   TIMESTAMPTZ,
  updated_by   TEXT
);

COMMENT ON TABLE sys_fin_vch_line_type_cd IS 'BVM voucher line type codes';

INSERT INTO sys_fin_vch_line_type_cd (code, name, name2, rec_order)
VALUES
  ('RECEIPT',    'Receipt',    'قبض',         1),
  ('PAYMENT',    'Payment',    'صرف',          2),
  ('REFUND',     'Refund',     'استرداد',      3),
  ('EXPENSE',    'Expense',    'مصروف',        4),
  ('ADVANCE',    'Advance',    'سلفة',         5),
  ('TRANSFER',   'Transfer',   'تحويل',        6),
  ('ADJUSTMENT', 'Adjustment', 'تسوية',        7),
  ('FEE',        'Fee',        'رسوم',         8),
  ('ROUNDING',   'Rounding',   'تقريب',        9)
ON CONFLICT (code) DO NOTHING;

-- ==================================================================
-- 3. sys_fin_vch_line_role_cd — Line roles
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_fin_vch_line_role_cd (
  code         TEXT    PRIMARY KEY,
  name         TEXT    NOT NULL,
  name2        TEXT,
  description  TEXT,
  description2 TEXT,
  line_type    TEXT,
  direction    TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  rec_status   SMALLINT DEFAULT 1,
  rec_order    INTEGER,
  created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by   TEXT,
  updated_at   TIMESTAMPTZ,
  updated_by   TEXT
);

COMMENT ON TABLE sys_fin_vch_line_role_cd IS 'BVM line role codes — defines the business purpose of each transaction line';

INSERT INTO sys_fin_vch_line_role_cd (code, name, name2, line_type, direction, rec_order)
VALUES
  ('ORDER_PAYMENT',            'Order Payment',              'دفعة طلب',               'RECEIPT',    'IN',      1),
  ('INVOICE_PAYMENT',          'Invoice Payment',            'دفعة فاتورة',            'RECEIPT',    'IN',      2),
  ('WALLET_TOPUP',             'Wallet Top-Up',              'شحن محفظة',              'RECEIPT',    'IN',      3),
  ('GIFT_CARD_SALE',           'Gift Card Sale',             'بيع بطاقة هدية',         'RECEIPT',    'IN',      4),
  ('CUSTOMER_CREDIT_RECEIPT',  'Customer Credit Receipt',    'قبض رصيد عميل',          'RECEIPT',    'IN',      5),
  ('CUSTOMER_ADVANCE_RECEIPT', 'Customer Advance Receipt',   'قبض دفعة مقدمة',         'RECEIPT',    'IN',      6),
  ('SUPPLIER_PAYMENT',         'Supplier Payment',           'دفع مورد',               'PAYMENT',    'OUT',     7),
  ('EXPENSE_PAYMENT',          'Expense Payment',            'دفع مصروف',              'EXPENSE',    'OUT',     8),
  ('SHOP_RENT_PAYMENT',        'Shop Rent Payment',          'دفع إيجار محل',          'EXPENSE',    'OUT',     9),
  ('UTILITY_PAYMENT',          'Utility Payment',            'دفع خدمات',              'EXPENSE',    'OUT',     10),
  ('EMPLOYEE_ADVANCE_PAYMENT', 'Employee Advance Payment',   'سلفة موظف',              'ADVANCE',    'OUT',     11),
  ('PETTY_CASH_ISSUE',         'Petty Cash Issue',           'صرف نثرية',              'PAYMENT',    'OUT',     12),
  ('CUSTOMER_REFUND',          'Customer Refund',            'استرداد عميل',           'REFUND',     'OUT',     13),
  ('ORDER_REFUND',             'Order Refund',               'استرداد طلب',            'REFUND',     'OUT',     14),
  ('INVOICE_REFUND',           'Invoice Refund',             'استرداد فاتورة',         'REFUND',     'OUT',     15),
  ('PETTY_CASH_RETURN',        'Petty Cash Return',          'إرجاع نثرية',            'RECEIPT',    'IN',      16),
  ('WALLET_REFUND',            'Wallet Refund',              'استرداد محفظة',          'REFUND',     'OUT',     17),
  ('GIFT_CARD_REFUND',         'Gift Card Refund',           'استرداد بطاقة هدية',     'REFUND',     'OUT',     18),
  ('INTERNAL_TRANSFER',        'Internal Transfer',          'تحويل داخلي',            'TRANSFER',   'NEUTRAL', 19)
ON CONFLICT (code) DO NOTHING;

-- ==================================================================
-- 4. sys_fin_vch_target_type_cd — Target types
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_fin_vch_target_type_cd (
  code         TEXT    PRIMARY KEY,
  name         TEXT    NOT NULL,
  name2        TEXT,
  description  TEXT,
  description2 TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  rec_status   SMALLINT DEFAULT 1,
  rec_order    INTEGER,
  created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by   TEXT,
  updated_at   TIMESTAMPTZ,
  updated_by   TEXT
);

COMMENT ON TABLE sys_fin_vch_target_type_cd IS 'BVM line target type codes — what entity the line is applied against';

INSERT INTO sys_fin_vch_target_type_cd (code, name, name2, rec_order)
VALUES
  ('ORDER',        'Order',        'طلب',          1),
  ('INVOICE',      'Invoice',      'فاتورة',        2),
  ('CUSTOMER',     'Customer',     'عميل',          3),
  ('SUPPLIER',     'Supplier',     'مورد',          4),
  ('EMPLOYEE',     'Employee',     'موظف',          5),
  ('WALLET',       'Wallet',       'محفظة',         6),
  ('GIFT_CARD',    'Gift Card',    'بطاقة هدية',   7),
  ('CREDIT_NOTE',  'Credit Note',  'إشعار دائن',   8),
  ('EXPENSE',      'Expense',      'مصروف',         9),
  ('BANK_ACCOUNT', 'Bank Account', 'حساب بنكي',    10),
  ('CASH_DRAWER',  'Cash Drawer',  'صندوق نقد',    11),
  ('PETTY_CASH',   'Petty Cash',   'نثرية',         12),
  ('OTHER',        'Other',        'أخرى',          13)
ON CONFLICT (code) DO NOTHING;

-- ==================================================================
-- 5. sys_fin_vch_direction_cd — Directions
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_fin_vch_direction_cd (
  code         TEXT    PRIMARY KEY,
  name         TEXT    NOT NULL,
  name2        TEXT,
  description  TEXT,
  description2 TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  rec_status   SMALLINT DEFAULT 1,
  rec_order    INTEGER,
  created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by   TEXT,
  updated_at   TIMESTAMPTZ,
  updated_by   TEXT
);

COMMENT ON TABLE sys_fin_vch_direction_cd IS 'BVM cash flow direction codes';

INSERT INTO sys_fin_vch_direction_cd (code, name, name2, description, description2, rec_order)
VALUES
  ('IN',      'In',      'وارد',   'Money flowing into the business',               'أموال واردة للمنشأة',          1),
  ('OUT',     'Out',     'صادر',   'Money flowing out of the business',             'أموال صادرة من المنشأة',       2),
  ('NEUTRAL', 'Neutral', 'محايد',  'No net cash movement (adjustment/transfer)',    'بدون حركة نقدية صافية',       3)
ON CONFLICT (code) DO NOTHING;

-- ==================================================================
-- 6. sys_fin_exp_cat_cd — System expense category templates
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_fin_exp_cat_cd (
  code         TEXT    PRIMARY KEY,
  name         TEXT    NOT NULL,
  name2        TEXT,
  description  TEXT,
  description2 TEXT,
  is_active    BOOLEAN NOT NULL DEFAULT true,
  rec_status   SMALLINT DEFAULT 1,
  rec_order    INTEGER,
  created_at   TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
  created_by   TEXT,
  updated_at   TIMESTAMPTZ,
  updated_by   TEXT
);

COMMENT ON TABLE sys_fin_exp_cat_cd IS 'System-level expense category templates — global reference codes used by org_fin_exp_cat_cf';

INSERT INTO sys_fin_exp_cat_cd (code, name, name2, rec_order)
VALUES
  ('RENT',        'Rent',        'إيجار',         1),
  ('UTILITIES',   'Utilities',   'خدمات',          2),
  ('SUPPLIES',    'Supplies',    'مستلزمات',       3),
  ('SALARY',      'Salary',      'رواتب',          4),
  ('PETTY_CASH',  'Petty Cash',  'نثرية',          5),
  ('BANK_FEE',    'Bank Fee',    'رسوم بنكية',     6),
  ('GATEWAY_FEE', 'Gateway Fee', 'رسوم بوابة',     7),
  ('OTHER',       'Other',       'أخرى',           8)
ON CONFLICT (code) DO NOTHING;

-- ==================================================================
-- 7. org_fin_exp_cat_cf — Tenant expense category configuration
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_fin_exp_cat_cf (
  id            UUID     NOT NULL DEFAULT gen_random_uuid(),
  tenant_org_id UUID     NOT NULL,
  sys_cat_code  TEXT,
  custom_name   TEXT,
  custom_name2  TEXT,
  is_active     BOOLEAN  NOT NULL DEFAULT true,
  rec_status    SMALLINT DEFAULT 1,
  rec_order     INTEGER,
  rec_notes     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by    TEXT,
  created_info  TEXT,
  updated_at    TIMESTAMPTZ,
  updated_by    TEXT,
  updated_info  TEXT,

  CONSTRAINT PK_org_fin_exp_cat_cf
    PRIMARY KEY (id, tenant_org_id),

  CONSTRAINT fk_exp_cat_cf_tenant
    FOREIGN KEY (tenant_org_id)
    REFERENCES org_tenants_mst(id) ON DELETE CASCADE,

  CONSTRAINT fk_exp_cat_cf_sys_code
    FOREIGN KEY (sys_cat_code)
    REFERENCES sys_fin_exp_cat_cd(code) ON DELETE RESTRICT,

  CONSTRAINT uq_exp_cat_cf_per_tenant
    UNIQUE (tenant_org_id, sys_cat_code)
);

COMMENT ON TABLE org_fin_exp_cat_cf IS 'Tenant-level expense category configuration. Extends sys_fin_exp_cat_cd with custom labels per tenant. custom_name overrides sys name when set.';

CREATE INDEX IF NOT EXISTS idx_exp_cat_cf_tenant
  ON org_fin_exp_cat_cf (tenant_org_id, is_active);

ALTER TABLE org_fin_exp_cat_cf ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_org_fin_exp_cat_cf
  ON org_fin_exp_cat_cf;

CREATE POLICY tenant_isolation_org_fin_exp_cat_cf
  ON org_fin_exp_cat_cf
  FOR ALL
  USING  (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- ==================================================================
-- 8. org_tenants_mst — add is_hq_test_demo flag
-- ==================================================================

ALTER TABLE org_tenants_mst
  ADD COLUMN IF NOT EXISTS is_hq_test_demo BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN org_tenants_mst.is_hq_test_demo IS 'True for HQ test/demo tenants used in seeding and dev fixtures. Never set on production tenants.';

UPDATE org_tenants_mst
SET is_hq_test_demo = true
WHERE id IN (
  '11111111-1111-1111-1111-111111111111',
  '20000002-2222-2222-2222-222222222221',
  'c9ac29d1-219c-4a3a-8887-f860550c32be'
);

-- ==================================================================
-- 9. Seed org_fin_exp_cat_cf for all demo/test tenants
--    One row per sys expense category per demo tenant.
-- ==================================================================

INSERT INTO org_fin_exp_cat_cf (
  id, tenant_org_id, sys_cat_code,
  is_active, rec_status, rec_order,
  created_by
)
SELECT
  gen_random_uuid(),
  t.id,
  s.code,
  true,
  1,
  s.rec_order,
  'seed'
FROM org_tenants_mst t
CROSS JOIN sys_fin_exp_cat_cd s
WHERE t.is_hq_test_demo = true
ON CONFLICT (tenant_org_id, sys_cat_code) DO NOTHING;

COMMIT;
