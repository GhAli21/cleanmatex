-- ==================================================================
-- 0100_org_fin_vouchers_and_receipt_voucher_id.sql
-- Receipt Voucher Feature: org_fin_vouchers_mst as parent of payment rows,
-- voucher_id on org_payments_dtl_tr and org_rcpt_receipts_mst, audit log, RLS.
-- Plan: receipt_voucher_feature_3d67fc3b.plan.md
-- ==================================================================

BEGIN;

DO $$ 
BEGIN

    -- 1. Handle the Foreign Key on the child table (payments)
    -- We drop it first to ensure we can recreate it with the new definition (referencing composite key)
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_org_payment_invoice' AND table_name = 'org_payments_dtl_tr'
    ) THEN
        ALTER TABLE org_payments_dtl_tr DROP CONSTRAINT fk_org_payment_invoice;
    END IF;

    -- 2. Handle the Primary Key on the master table (invoices)
    -- We drop the old PK (usually on just 'id') so we can add the new composite one
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'org_invoice_mst_pkey' AND table_name = 'org_invoice_mst'
    ) THEN
        ALTER TABLE org_invoice_mst DROP CONSTRAINT org_invoice_mst_pkey;
    END IF;

    -- 3. Add the new Composite Primary Key (id, tenant_org_id)
    -- We perform a check to avoid "multiple primary keys" error
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_type = 'PRIMARY KEY' AND table_name = 'org_invoice_mst'
    ) THEN
        ALTER TABLE org_invoice_mst ADD PRIMARY KEY (id, tenant_org_id);
    END IF;

    -- 4. Re-create the Foreign Key with the new composite relationship
    -- (invoice_id, tenant_org_id) -> (id, tenant_org_id)
    ALTER TABLE org_payments_dtl_tr 
    ADD CONSTRAINT fk_org_payment_invoice
    FOREIGN KEY (invoice_id, tenant_org_id) REFERENCES org_invoice_mst(id, tenant_org_id) ON DELETE CASCADE;

END $$;

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
  id UUID NOT NULL DEFAULT gen_random_uuid(),
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
  constraint PK_org_fin_vouchers_mst primary key (id, tenant_org_id),
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
    FOREIGN KEY (customer_id) REFERENCES org_customers_mst(id) ON DELETE SET NULL,
	--FOREIGN KEY (customer_id, tenant_org_id) REFERENCES org_customers_mst(id, tenant_org_id) ON DELETE SET NULL,
  CONSTRAINT fk_fin_voucher_reversed
    FOREIGN KEY (reversed_by_voucher_id,tenant_org_id) REFERENCES org_fin_vouchers_mst(id, tenant_org_id) ON DELETE SET NULL
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

ALTER TABLE org_rcpt_receipts_mst DROP CONSTRAINT IF EXISTS fk_rcpt_receipt_order;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_rcpt_receipt_order' AND table_name = 'org_rcpt_receipts_mst') THEN
    ALTER TABLE org_rcpt_receipts_mst
      ADD CONSTRAINT fk_rcpt_receipt_order
      FOREIGN KEY (order_id, tenant_org_id) REFERENCES org_orders_mst(id, tenant_org_id) ON DELETE CASCADE;
  END IF;
END $$;

-- ==================================================================
-- Step 8 — RLS policies
-- ==================================================================

ALTER TABLE org_fin_vouchers_mst ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_fin_voucher_audit_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_org_fin_vouchers ON org_fin_vouchers_mst;
CREATE POLICY tenant_isolation_org_fin_vouchers ON org_fin_vouchers_mst
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

DROP POLICY IF EXISTS tenant_isolation_org_fin_voucher_audit ON org_fin_voucher_audit_log;
CREATE POLICY tenant_isolation_org_fin_voucher_audit ON org_fin_voucher_audit_log
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- ==================================================================
-- Step 9 — Backfill existing payments (one voucher per payment row)
-- ==================================================================

DO $$
DECLARE
  r RECORD;
  v_voucher_id UUID;
  v_voucher_no VARCHAR(50);
  v_seq INTEGER;
  v_tenant UUID;
  v_year TEXT;
BEGIN
  FOR r IN (
    SELECT p.id, p.tenant_org_id, p.invoice_id, p.order_id, p.customer_id,
           COALESCE(p.paid_amount, 0) AS paid_amount,
           COALESCE(p.currency_code, 'OMR') AS currency_code,
           p.paid_at, p.created_at, p.created_by
    FROM org_payments_dtl_tr p
    WHERE p.voucher_id IS NULL
      AND (p.paid_at IS NOT NULL OR p.status IN ('completed', 'paid', 'success'))
      AND COALESCE(p.paid_amount, 0) > 0
    ORDER BY p.tenant_org_id, p.created_at
  )
  LOOP
    v_tenant := r.tenant_org_id;
    v_year := TO_CHAR(COALESCE(r.paid_at, r.created_at)::DATE, 'YYYY');
    SELECT COALESCE(MAX(
      NULLIF(REGEXP_REPLACE(voucher_no, '^RCP-' || v_year || '-(\d+)$', '\1'), '')::INTEGER
    ), 0) + 1 INTO v_seq
    FROM org_fin_vouchers_mst
    WHERE tenant_org_id = v_tenant AND voucher_no LIKE 'RCP-' || v_year || '-%';
    v_voucher_no := 'RCP-' || v_year || '-' || LPAD(v_seq::TEXT, 5, '0');

    INSERT INTO org_fin_vouchers_mst (
      tenant_org_id, voucher_no, voucher_category, voucher_subtype, voucher_type,
      invoice_id, order_id, customer_id, total_amount, currency_code,
      status, issued_at, created_at, created_by
    ) VALUES (
      r.tenant_org_id, v_voucher_no, 'CASH_IN', 'SALE_PAYMENT', 'RECEIPT',
      r.invoice_id, r.order_id, r.customer_id, r.paid_amount, r.currency_code,
      'issued', COALESCE(r.paid_at, r.created_at), r.created_at, r.created_by
    )
    RETURNING id INTO v_voucher_id;

    UPDATE org_payments_dtl_tr SET voucher_id = v_voucher_id WHERE id = r.id;
  END LOOP;
END $$;

COMMIT;
