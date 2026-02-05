-- Migration 0091: Enhance org_payments_dtl_tr – amount breakdown, check details, payment channel, promo/gift FKs
-- Payment & Order Data Enhancement Plan

BEGIN;

-- Rename tax / vat for clarity (0088 added tax, vat)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'org_payments_dtl_tr' AND column_name = 'tax') THEN
    ALTER TABLE org_payments_dtl_tr RENAME COLUMN tax TO tax_amount;
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'org_payments_dtl_tr' AND column_name = 'tax_amount') THEN
    ALTER TABLE org_payments_dtl_tr ADD COLUMN tax_amount DECIMAL(19, 4) DEFAULT 0;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'org_payments_dtl_tr' AND column_name = 'vat') THEN
    ALTER TABLE org_payments_dtl_tr RENAME COLUMN vat TO vat_amount;
  ELSIF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'org_payments_dtl_tr' AND column_name = 'vat_amount') THEN
    ALTER TABLE org_payments_dtl_tr ADD COLUMN vat_amount DECIMAL(19, 4) DEFAULT 0;
  END IF;
END $$;

-- Amount breakdown
ALTER TABLE org_payments_dtl_tr
  ADD COLUMN IF NOT EXISTS subtotal DECIMAL(19, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_rate DECIMAL(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_amount DECIMAL(19, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5, 2) DEFAULT 0;

-- Discount breakdown
ALTER TABLE org_payments_dtl_tr
  ADD COLUMN IF NOT EXISTS manual_discount_amount DECIMAL(19, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_discount_amount DECIMAL(19, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gift_card_applied_amount DECIMAL(19, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS promo_code_id UUID,
  ADD COLUMN IF NOT EXISTS gift_card_id UUID;

-- Currency exchange rate
ALTER TABLE org_payments_dtl_tr
  ADD COLUMN IF NOT EXISTS currency_ex_rate DECIMAL(10, 6) NOT NULL DEFAULT 1.000000;

-- Check details
ALTER TABLE org_payments_dtl_tr
  ADD COLUMN IF NOT EXISTS check_number VARCHAR(100),
  ADD COLUMN IF NOT EXISTS check_bank VARCHAR(100),
  ADD COLUMN IF NOT EXISTS check_date DATE;

-- Payment channel
ALTER TABLE org_payments_dtl_tr
  ADD COLUMN IF NOT EXISTS payment_channel VARCHAR(30) DEFAULT 'web_admin';

-- Foreign keys
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_payments_promo_code' AND table_name = 'org_payments_dtl_tr') THEN
    ALTER TABLE org_payments_dtl_tr
      ADD CONSTRAINT fk_payments_promo_code
      FOREIGN KEY (promo_code_id) REFERENCES org_promo_codes_mst(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_payments_gift_card' AND table_name = 'org_payments_dtl_tr') THEN
    ALTER TABLE org_payments_dtl_tr
      ADD CONSTRAINT fk_payments_gift_card
      FOREIGN KEY (gift_card_id) REFERENCES org_gift_cards_mst(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Index for check numbers
CREATE INDEX IF NOT EXISTS idx_payments_check_number
  ON org_payments_dtl_tr(tenant_org_id, check_number)
  WHERE check_number IS NOT NULL;

COMMIT;
