-- ==================================================================
-- 0088_org_fin_vouchers_and_receipt_voucher_id.sql
-- Receipt Voucher Feature: org_fin_vouchers_mst as parent of payment rows,
-- voucher_id on org_payments_dtl_tr and org_rcpt_receipts_mst, audit log, RLS.
-- Plan: receipt_voucher_feature_3d67fc3b.plan.md
-- ==================================================================

BEGIN;

-- ==================================================================
-- Step 2 — Code tables
-- ==================================================================

CREATE TABLE IF NOT EXISTS sys_fin_voucher_category_cd (
  code VARCHAR(30) PRIMARY KEY,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  updated_at TIMESTAMP,
  updated_by VARCHAR(120)
);

COMMENT ON TABLE sys_fin_voucher_category_cd IS 'Voucher category: CASH_IN, CASH_OUT, NON_CASH';

INSERT INTO sys_fin_voucher_category_cd (code, name, name2, description, description2)
VALUES
  ('CASH_IN', 'Cash In', 'وارد نقدي', 'Money received', 'أموال مستلمة'),
  ('CASH_OUT', 'Cash Out', 'صادر نقدي', 'Money paid out', 'أموال صادرة'),
  ('NON_CASH', 'Non-Cash', 'غير نقدي', 'No cash movement (e.g. credit note)', 'بدون حركة نقدية')
ON CONFLICT (code) DO NOTHING;

-- Optional: voucher subtype (extensible without new migration)
CREATE TABLE IF NOT EXISTS sys_fin_voucher_subtype_cd (
  code VARCHAR(50) PRIMARY KEY,
  voucher_category_code VARCHAR(30) NOT NULL,
  name VARCHAR(250) NOT NULL,
  name2 VARCHAR(250),
  description TEXT,
  description2 TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  CONSTRAINT fk_fin_voucher_subtype_cat
    FOREIGN KEY (voucher_category_code) REFERENCES sys_fin_voucher_category_cd(code) ON DELETE RESTRICT
);

COMMENT ON TABLE sys_fin_voucher_subtype_cd IS 'Voucher subtypes: SALE_PAYMENT, ADVANCE, DEPOSIT, REFUND, CREDIT_NOTE, etc.';

INSERT INTO sys_fin_voucher_subtype_cd (code, voucher_category_code, name, name2)
VALUES
  ('SALE_PAYMENT', 'CASH_IN', 'Sale Payment', 'دفعة مبيعات'),
  ('ADVANCE', 'CASH_IN', 'Advance', 'دفعة مقدمة'),
  ('DEPOSIT', 'CASH_IN', 'Deposit', 'عربون'),
  ('REFUND', 'CASH_OUT', 'Refund', 'استرداد'),
  ('CREDIT_NOTE', 'NON_CASH', 'Credit Note', 'إشعار دائن'),
  ('WRITE_OFF', 'NON_CASH', 'Write-Off', 'شطب'),
  ('PRICE_CORRECTION', 'NON_CASH', 'Price Correction', 'تصحيح سعر'),
  ('PENALTY_FEE', 'CASH_IN', 'Penalty Fee', 'غرامة')
ON CONFLICT (code) DO NOTHING;

-- ==================================================================
-- Step 3 — Create org_fin_vouchers_mst
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_fin_vouchers_mst (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  branch_id UUID NULL,
  voucher_no VARCHAR(50) NOT NULL,
  voucher_category VARCHAR(30) NOT NULL,
  voucher_subtype VARCHAR(50) NULL,
  voucher_type VARCHAR(30) NULL,
  invoice_id UUID NULL,
  order_id UUID NULL,
  customer_id UUID NULL,
  total_amount DECIMAL(19, 4) NOT NULL,
  currency_code VARCHAR(3) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft',
  issued_at TIMESTAMPTZ NULL,
  voided_at TIMESTAMPTZ NULL,
  void_reason TEXT NULL,
  reason_code VARCHAR(50) NULL,
  reversed_by_voucher_id UUID NULL,
  content_html TEXT NULL,
  content_text TEXT NULL,
  metadata JSONB NULL,
  rec_status SMALLINT DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMPTZ,
  updated_by VARCHAR(120),
  updated_info TEXT,
  CONSTRAINT chk_fin_voucher_category
    CHECK (voucher_category IN ('CASH_IN', 'CASH_OUT', 'NON_CASH')),
  CONSTRAINT chk_fin_voucher_total_positive
    CHECK (total_amount > 0),
  CONSTRAINT uq_fin_voucher_tenant_no
    UNIQUE (tenant_org_id, voucher_no),
  CONSTRAINT fk_fin_voucher_tenant
    FOREIGN KEY (tenant_org_id) REFERENCES org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_fin_voucher_branch
    FOREIGN KEY (branch_id, tenant_org_id) REFERENCES org_branches_mst(id, tenant_org_id) ON DELETE SET NULL,
  CONSTRAINT fk_fin_voucher_order
    FOREIGN KEY (order_id, tenant_org_id) REFERENCES org_orders_mst(id, tenant_org_id) ON DELETE SET NULL,
  CONSTRAINT fk_fin_voucher_invoice
    FOREIGN KEY (invoice_id, tenant_org_id) REFERENCES org_invoice_mst(id, tenant_org_id) ON DELETE SET NULL,
  CONSTRAINT fk_fin_voucher_customer
    FOREIGN KEY (customer_id, tenant_org_id) REFERENCES org_customers_mst(id, tenant_org_id) ON DELETE SET NULL,
  CONSTRAINT fk_fin_voucher_reversed
    FOREIGN KEY (reversed_by_voucher_id) REFERENCES org_fin_vouchers_mst(id) ON DELETE SET NULL
);

COMMENT ON TABLE org_fin_vouchers_mst IS 'Finance vouchers: parent of payment rows; receipt/refund/credit/adjustment';
COMMENT ON COLUMN org_fin_vouchers_mst.voucher_category IS 'CASH_IN, CASH_OUT, NON_CASH';
COMMENT ON COLUMN org_fin_vouchers_mst.voucher_type IS 'RECEIPT, PAYMENT, CREDIT, ADJUSTMENT, ADVANCE, DEPOSIT, PENALTY, WRITE_OFF';

CREATE INDEX IF NOT EXISTS idx_fin_vouchers_tenant_created
  ON org_fin_vouchers_mst(tenant_org_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fin_vouchers_tenant_status
  ON org_fin_vouchers_mst(tenant_org_id, status);
CREATE INDEX IF NOT EXISTS idx_fin_vouchers_invoice
  ON org_fin_vouchers_mst(invoice_id) WHERE invoice_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fin_vouchers_order
  ON org_fin_vouchers_mst(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fin_vouchers_customer
  ON org_fin_vouchers_mst(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fin_vouchers_voucher_no
  ON org_fin_vouchers_mst(tenant_org_id, voucher_no);

-- ==================================================================
-- Step 4 — Create org_fin_voucher_audit_log
-- ==================================================================

CREATE TABLE IF NOT EXISTS org_fin_voucher_audit_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id UUID NOT NULL,
  tenant_org_id UUID NOT NULL,
  action VARCHAR(30) NOT NULL,
  snapshot_or_reason TEXT NULL,
  changed_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  changed_by VARCHAR(120) NULL,
  CONSTRAINT fk_fin_voucher_audit_voucher
    FOREIGN KEY (voucher_id, tenant_org_id) REFERENCES org_fin_vouchers_mst(id, tenant_org_id) ON DELETE CASCADE
);

COMMENT ON TABLE org_fin_voucher_audit_log IS 'Audit log for voucher actions: issued, voided, reversed, edited, approved';

CREATE INDEX IF NOT EXISTS idx_fin_voucher_audit_voucher
  ON org_fin_voucher_audit_log(voucher_id);
CREATE INDEX IF NOT EXISTS idx_fin_voucher_audit_tenant_changed
  ON org_fin_voucher_audit_log(tenant_org_id, changed_at DESC);

-- ==================================================================
-- Step 5 — Voucher number: application-level (no DB sequence here)
-- ==================================================================
-- Voucher_no is generated in app (e.g. RCP-2025-00001). Backfill uses ROW_NUMBER.

-- ==================================================================
-- Step 6 — Alter org_payments_dtl_tr: add voucher_id
-- ==================================================================

ALTER TABLE org_payments_dtl_tr
  ADD COLUMN IF NOT EXISTS voucher_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_org_payments_voucher' AND table_name = 'org_payments_dtl_tr') THEN
    ALTER TABLE org_payments_dtl_tr
      ADD CONSTRAINT fk_org_payments_voucher
      FOREIGN KEY (voucher_id, tenant_org_id) REFERENCES org_fin_vouchers_mst(id, tenant_org_id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_org_payments_voucher ON org_payments_dtl_tr(voucher_id) WHERE voucher_id IS NOT NULL;

-- ==================================================================
-- Step 7 — Alter org_rcpt_receipts_mst: add voucher_id, order_id nullable
-- ==================================================================

ALTER TABLE org_rcpt_receipts_mst
  ADD COLUMN IF NOT EXISTS voucher_id UUID NULL;

ALTER TABLE org_rcpt_receipts_mst
  ALTER COLUMN order_id DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_org_rcpt_receipts_voucher' AND table_name = 'org_rcpt_receipts_mst') THEN
    ALTER TABLE org_rcpt_receipts_mst
      ADD CONSTRAINT fk_org_rcpt_receipts_voucher
      FOREIGN KEY (voucher_id, tenant_org_id) REFERENCES org_fin_vouchers_mst(id, tenant_org_id) ON DELETE SET NULL;
  END IF;
END $$;

-- Drop existing FK that required (order_id, tenant_org_id) so we can have voucher-only rows
ALTER TABLE org_rcpt_receipts_mst DROP CONSTRAINT IF EXISTS fk_rcpt_receipt_order;
-- Re-add FK for rows that have order_id (optional reference)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_rcpt_receipt_order' AND table_name = 'org_rcpt_receipts_mst') THEN
    ALTER TABLE org_rcpt_receipts_mst
      ADD CONSTRAINT fk_rcpt_receipt_order
      FOREIGN KEY (order_id, tenant_org_id) REFERENCES org_orders_mst(id, tenant_org_id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN foreign_key_violation THEN NULL;
END $$;

-- For rows with order_id NULL we cannot have FK to org_orders_mst. So we add FK only when order_id IS NOT NULL.
-- In PostgreSQL, a FK with NULL in any column is not checked. So (order_id, tenant_org_id) REFERENCES org_orders_mst(id, tenant_org_id)
-- works: when order_id IS NULL, the row is not validated. So we need the FK to allow NULL order_id.
-- The standard FK (order_id, tenant_org_id) REFERENCES org_orders_mst(id, tenant_org_id) does allow NULL in order_id.
-- So we only need to re-add the FK. But we dropped it - re-add it.
ALTER TABLE org_rcpt_receipts_mst
  ADD CONSTRAINT fk_rcpt_receipt_order
  FOREIGN KEY (order_id, tenant_org_id) REFERENCES org_orders_mst(id, tenant_org_id) ON DELETE CASCADE;
-- Error: when order_id IS NULL, (NULL, tenant_org_id) would be checked - actually in SQL, NULL in FK means "no check". So the row passes.
-- So the FK is valid. But we need to handle the case where order_id is NULL - then we cannot reference org_orders_mst. In PostgreSQL,
-- (NULL, tenant_org_id) REFERENCES (id, tenant_org_id) - the row is considered to satisfy the FK (nothing to check). So we're good.
-- Re-add:
-- Already dropped. Add again:
</think>
Checking whether org_orders_mst has a unique constraint on (id, tenant_org_id) for the composite FK:
<｜tool▁calls▁begin｜><｜tool▁call▁begin｜>
Grep