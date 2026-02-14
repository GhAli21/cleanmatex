-- Migration 0106: Add branch_id to transaction tables (org_payments_dtl_tr, org_gift_card_transactions, org_rcpt_receipts_mst)
BEGIN;

-- =============================================================================
-- 1. org_payments_dtl_tr
-- =============================================================================
ALTER TABLE org_payments_dtl_tr
  ADD COLUMN IF NOT EXISTS branch_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_org_payment_branch' AND table_name = 'org_payments_dtl_tr') THEN
    ALTER TABLE org_payments_dtl_tr
      ADD CONSTRAINT fk_org_payment_branch
      FOREIGN KEY (branch_id, tenant_org_id)
      REFERENCES org_branches_mst(id, tenant_org_id)
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_org_payments_branch
  ON org_payments_dtl_tr(tenant_org_id, branch_id)
  WHERE branch_id IS NOT NULL;

COMMENT ON COLUMN org_payments_dtl_tr.branch_id IS 'Branch where payment was received';

-- Backfill org_payments_dtl_tr: from order, then invoice, then voucher
UPDATE org_payments_dtl_tr p
SET branch_id = o.branch_id
FROM org_orders_mst o
WHERE p.order_id = o.id AND p.branch_id IS NULL AND o.branch_id IS NOT NULL;

UPDATE org_payments_dtl_tr p
SET branch_id = i.branch_id
FROM org_invoice_mst i
WHERE p.invoice_id = i.id AND p.branch_id IS NULL AND i.branch_id IS NOT NULL;

UPDATE org_payments_dtl_tr p
SET branch_id = v.branch_id
FROM org_fin_vouchers_mst v
WHERE p.voucher_id = v.id AND p.branch_id IS NULL AND v.branch_id IS NOT NULL;

-- =============================================================================
-- 2. org_gift_card_transactions
-- =============================================================================
ALTER TABLE org_gift_card_transactions
  ADD COLUMN IF NOT EXISTS branch_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_org_gift_card_trans_branch' AND table_name = 'org_gift_card_transactions') THEN
    ALTER TABLE org_gift_card_transactions
      ADD CONSTRAINT fk_org_gift_card_trans_branch
      FOREIGN KEY (branch_id, tenant_org_id)
      REFERENCES org_branches_mst(id, tenant_org_id)
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_gift_card_trans_branch
  ON org_gift_card_transactions(tenant_org_id, branch_id)
  WHERE branch_id IS NOT NULL;

COMMENT ON COLUMN org_gift_card_transactions.branch_id IS 'Branch where transaction occurred';

-- Backfill org_gift_card_transactions: from order, then invoice
UPDATE org_gift_card_transactions g
SET branch_id = o.branch_id
FROM org_orders_mst o
WHERE g.order_id = o.id AND g.branch_id IS NULL AND o.branch_id IS NOT NULL;

UPDATE org_gift_card_transactions g
SET branch_id = i.branch_id
FROM org_invoice_mst i
WHERE g.invoice_id = i.id AND g.branch_id IS NULL AND i.branch_id IS NOT NULL;

-- =============================================================================
-- 3. org_rcpt_receipts_mst
-- =============================================================================
ALTER TABLE org_rcpt_receipts_mst
  ADD COLUMN IF NOT EXISTS branch_id UUID NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_org_rcpt_receipt_branch' AND table_name = 'org_rcpt_receipts_mst') THEN
    ALTER TABLE org_rcpt_receipts_mst
      ADD CONSTRAINT fk_org_rcpt_receipt_branch
      FOREIGN KEY (branch_id, tenant_org_id)
      REFERENCES org_branches_mst(id, tenant_org_id)
      ON DELETE SET NULL ON UPDATE NO ACTION;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_rcpt_receipts_branch
  ON org_rcpt_receipts_mst(tenant_org_id, branch_id)
  WHERE branch_id IS NOT NULL;

COMMENT ON COLUMN org_rcpt_receipts_mst.branch_id IS 'Branch for receipt';

-- Backfill org_rcpt_receipts_mst: from order, then voucher
UPDATE org_rcpt_receipts_mst r
SET branch_id = o.branch_id
FROM org_orders_mst o
WHERE r.order_id = o.id AND r.branch_id IS NULL AND o.branch_id IS NOT NULL;

UPDATE org_rcpt_receipts_mst r
SET branch_id = v.branch_id
FROM org_fin_vouchers_mst v
WHERE r.voucher_id = v.id AND r.branch_id IS NULL AND v.branch_id IS NOT NULL;

--============================

-- =============================================================================
-- Step 1: org_orders_mst
-- Fill NULL branch_id with tenant's main branch (is_main = true)
-- Uses first main branch per tenant when multiple exist
-- =============================================================================
UPDATE org_orders_mst o
SET branch_id = (
  SELECT b.id
  FROM org_branches_mst b
  WHERE b.tenant_org_id = o.tenant_org_id
    AND b.is_main = true
  ORDER BY b.created_at NULLS LAST, b.id
  LIMIT 1
)
WHERE o.branch_id IS NULL
  AND EXISTS (
    SELECT 1 FROM org_branches_mst b
    WHERE b.tenant_org_id = o.tenant_org_id AND b.is_main = true
  );

-- =============================================================================
-- Step 2: org_invoice_mst
-- Fill from order.branch_id where invoice has order_id
-- =============================================================================
UPDATE org_invoice_mst i
SET branch_id = o.branch_id
FROM org_orders_mst o
WHERE i.order_id = o.id
  AND i.branch_id IS NULL
  AND o.branch_id IS NOT NULL;

-- =============================================================================
-- Step 3: org_fin_vouchers_mst
-- Fill from order.branch_id where voucher has order_id
-- =============================================================================
UPDATE org_fin_vouchers_mst v
SET branch_id = o.branch_id
FROM org_orders_mst o
WHERE v.order_id = o.id
  AND v.branch_id IS NULL
  AND o.branch_id IS NOT NULL;

-- =============================================================================
-- Step 4: org_payments_dtl_tr
-- Fill from order, then invoice->order, then voucher
-- =============================================================================
UPDATE org_payments_dtl_tr p
SET branch_id = o.branch_id
FROM org_orders_mst o
WHERE p.order_id = o.id
  AND p.branch_id IS NULL
  AND o.branch_id IS NOT NULL;

UPDATE org_payments_dtl_tr p
SET branch_id = i.branch_id
FROM org_invoice_mst i
WHERE p.invoice_id = i.id
  AND p.branch_id IS NULL
  AND i.branch_id IS NOT NULL;

UPDATE org_payments_dtl_tr p
SET branch_id = v.branch_id
FROM org_fin_vouchers_mst v
WHERE p.voucher_id = v.id
  AND p.branch_id IS NULL
  AND v.branch_id IS NOT NULL;

-- =============================================================================
-- Step 5: org_gift_card_transactions
-- Fill from order, then invoice->order
-- =============================================================================
UPDATE org_gift_card_transactions g
SET branch_id = o.branch_id
FROM org_orders_mst o
WHERE g.order_id = o.id
  AND g.branch_id IS NULL
  AND o.branch_id IS NOT NULL;

UPDATE org_gift_card_transactions g
SET branch_id = i.branch_id
FROM org_invoice_mst i
WHERE g.invoice_id = i.id
  AND g.branch_id IS NULL
  AND i.branch_id IS NOT NULL;

-- =============================================================================
-- Step 6: org_rcpt_receipts_mst
-- Fill from order, then voucher
-- =============================================================================
UPDATE org_rcpt_receipts_mst r
SET branch_id = o.branch_id
FROM org_orders_mst o
WHERE r.order_id = o.id
  AND r.branch_id IS NULL
  AND o.branch_id IS NOT NULL;

UPDATE org_rcpt_receipts_mst r
SET branch_id = v.branch_id
FROM org_fin_vouchers_mst v
WHERE r.voucher_id = v.id
  AND r.branch_id IS NULL
  AND v.branch_id IS NOT NULL;

--============================

COMMIT;
