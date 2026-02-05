-- Migration 0092: Enhance org_invoice_mst – currency, VAT, discount breakdown
-- Payment & Order Data Enhancement Plan

BEGIN;

-- Currency fields (no default for currency_code – from tenant settings)
ALTER TABLE org_invoice_mst
  ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3),
  ADD COLUMN IF NOT EXISTS currency_ex_rate DECIMAL(10, 6) NOT NULL DEFAULT 1.000000;

-- VAT breakdown
ALTER TABLE org_invoice_mst
  ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(19, 4) DEFAULT 0;

-- Discount breakdown
ALTER TABLE org_invoice_mst
  ADD COLUMN IF NOT EXISTS discount_rate DECIMAL(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS promo_code_id UUID,
  ADD COLUMN IF NOT EXISTS promo_discount_amount DECIMAL(19, 4) DEFAULT 0;

-- Foreign key
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_invoice_promo_code' AND table_name = 'org_invoice_mst') THEN
    ALTER TABLE org_invoice_mst
      ADD CONSTRAINT fk_invoice_promo_code
      FOREIGN KEY (promo_code_id) REFERENCES org_promo_codes_mst(id) ON DELETE SET NULL;
  END IF;
END $$;

COMMIT;
