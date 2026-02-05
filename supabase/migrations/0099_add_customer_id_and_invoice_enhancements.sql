-- Migration 0099: Add customer_id and invoice enhancements to org_invoice_mst
-- Invoices Feature Enhancement Plan - Part 0 + Part 1

BEGIN;

-- Part 0: Best-practice invoice columns
ALTER TABLE org_invoice_mst
  ADD COLUMN IF NOT EXISTS invoice_date DATE,
  ADD COLUMN IF NOT EXISTS branch_id UUID,
  ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(50),
  ADD COLUMN IF NOT EXISTS service_charge DECIMAL(19, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_charge_type VARCHAR(50),
  ADD COLUMN IF NOT EXISTS gift_card_id UUID,
  ADD COLUMN IF NOT EXISTS gift_card_discount_amount DECIMAL(19, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS customer_reference VARCHAR(120),
  ADD COLUMN IF NOT EXISTS trans_desc VARCHAR(255),
  ADD COLUMN IF NOT EXISTS tax_rate DECIMAL(5, 3),
  ADD COLUMN IF NOT EXISTS paid_by_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS handed_to_name VARCHAR(255),
  ADD COLUMN IF NOT EXISTS handed_to_mobile_no VARCHAR(50),
  ADD COLUMN IF NOT EXISTS handed_to_date TIMESTAMP(6),
  ADD COLUMN IF NOT EXISTS handed_to_by_user UUID,
  ADD COLUMN IF NOT EXISTS rec_status SMALLINT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Part 1: customer_id
ALTER TABLE org_invoice_mst
  ADD COLUMN IF NOT EXISTS customer_id UUID;

-- FK: branch_id (composite with tenant_org_id)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_org_invoice_branch' AND table_name = 'org_invoice_mst') THEN
    ALTER TABLE org_invoice_mst
      ADD CONSTRAINT fk_org_invoice_branch
      FOREIGN KEY (branch_id, tenant_org_id) REFERENCES org_branches_mst(id, tenant_org_id) ON DELETE SET NULL;
  END IF;
END $$;

-- FK: gift_card_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_org_invoice_gift_card' AND table_name = 'org_invoice_mst') THEN
    ALTER TABLE org_invoice_mst
      ADD CONSTRAINT fk_org_invoice_gift_card
      FOREIGN KEY (gift_card_id) REFERENCES org_gift_cards_mst(id) ON DELETE SET NULL;
  END IF;
END $$;

-- FK: handed_to_by_user
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_org_invoice_handed_to_user' AND table_name = 'org_invoice_mst') THEN
    ALTER TABLE org_invoice_mst
      ADD CONSTRAINT fk_org_invoice_handed_to_user
      FOREIGN KEY (handed_to_by_user) REFERENCES org_users_mst(id) ON DELETE SET NULL;
  END IF;
END $$;

-- FK: customer_id
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_org_invoice_customer' AND table_name = 'org_invoice_mst') THEN
    ALTER TABLE org_invoice_mst
      ADD CONSTRAINT fk_org_invoice_customer
      FOREIGN KEY (customer_id) REFERENCES org_customers_mst(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_org_invoice_branch ON org_invoice_mst(tenant_org_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_org_invoice_customer ON org_invoice_mst(tenant_org_id, customer_id);

-- Backfill invoice_date from created_at
UPDATE org_invoice_mst SET invoice_date = created_at::date WHERE invoice_date IS NULL AND created_at IS NOT NULL;

-- Backfill rec_status and is_active
UPDATE org_invoice_mst SET rec_status = 1 WHERE rec_status IS NULL;
UPDATE org_invoice_mst SET is_active = true WHERE is_active IS NULL;

-- Backfill customer_id from order
UPDATE org_invoice_mst inv
SET customer_id = ord.customer_id
FROM org_orders_mst ord
WHERE inv.tenant_org_id=ord.tenant_org_id
and inv.order_id = ord.id AND inv.customer_id IS NULL;

COMMIT;
