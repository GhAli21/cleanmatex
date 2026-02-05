-- Migration 0090: Enhance org_orders_mst – currency, VAT, discount breakdown, payment type, service charge, payment terms
-- Payment & Order Data Enhancement Plan

BEGIN;

-- Currency fields (no default for currency_code – populated from tenant settings)
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3),
  ADD COLUMN IF NOT EXISTS currency_ex_rate DECIMAL(10, 6) NOT NULL DEFAULT 1.000000;

-- VAT breakdown
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS vat_rate DECIMAL(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS vat_amount DECIMAL(19, 4) DEFAULT 0;

-- Discount breakdown
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS discount_rate DECIMAL(5, 2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS discount_type VARCHAR(20),
  ADD COLUMN IF NOT EXISTS promo_code_id UUID,
  ADD COLUMN IF NOT EXISTS gift_card_id UUID,
  ADD COLUMN IF NOT EXISTS promo_discount_amount DECIMAL(19, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS gift_card_discount_amount DECIMAL(19, 4) DEFAULT 0;

-- Payment type (FK to sys_payment_type_cd)
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS payment_type_code VARCHAR(30);

-- Service charge
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS service_charge DECIMAL(19, 4) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS service_charge_type VARCHAR(50);

-- Payment terms
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS payment_terms VARCHAR(50),
  ADD COLUMN IF NOT EXISTS payment_due_date DATE;

-- Foreign keys (safe add)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_orders_promo_code' AND table_name = 'org_orders_mst') THEN
    ALTER TABLE org_orders_mst
      ADD CONSTRAINT fk_orders_promo_code
      FOREIGN KEY (promo_code_id) REFERENCES org_promo_codes_mst(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_orders_gift_card' AND table_name = 'org_orders_mst') THEN
    ALTER TABLE org_orders_mst
      ADD CONSTRAINT fk_orders_gift_card
      FOREIGN KEY (gift_card_id) REFERENCES org_gift_cards_mst(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_orders_payment_type' AND table_name = 'org_orders_mst') THEN
    ALTER TABLE org_orders_mst
      ADD CONSTRAINT fk_orders_payment_type
      FOREIGN KEY (payment_type_code) REFERENCES sys_payment_type_cd(payment_type_code) ON DELETE SET NULL;
  END IF;
END $$;

-- Comments
COMMENT ON COLUMN org_orders_mst.currency_code IS 'ISO 4217 currency code (from tenant settings)';
COMMENT ON COLUMN org_orders_mst.currency_ex_rate IS 'Exchange rate to base currency at time of order';
COMMENT ON COLUMN org_orders_mst.vat_rate IS 'VAT percentage applied (e.g. 5.00 for 5%)';
COMMENT ON COLUMN org_orders_mst.vat_amount IS 'Calculated VAT amount in currency';

COMMIT;
