-- Migration 0087: Payments optional of invoice + sys_bill + sys_payment_* renames
-- 1. sys_payment_type_cd and sys_payment_method_cd renames
-- 2. org_payments_dtl_tr: nullable invoice_id, order_id, customer_id, payment_kind
-- 3. sys_bill_invoice_payments_tr: currency_code, payment_method_code FK, payment_type_code, tax, vat, amount
-- Migration 0087: Payments optional of invoice + sys_bill + sys_payment_* renames
BEGIN;

-- =============================================================================
-- 1.1 sys_payment_type_cd: rename PK column
-- =============================================================================
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sys_payment_type_cd' AND column_name = 'payment_type_id') THEN
    ALTER TABLE sys_payment_type_cd RENAME COLUMN payment_type_id TO payment_type_code;
  END IF;
END $$;

COMMENT ON COLUMN sys_payment_type_cd.payment_type_code IS 'PK: payment type code (e.g. PAY_IN_ADVANCE, PAY_ON_COLLECTION)';

-- =============================================================================
-- 1.2 sys_payment_method_cd: rename display columns
-- =============================================================================
DO $$ 
BEGIN
  -- Check and rename each column individually
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sys_payment_method_cd' AND column_name = 'payment_type_color1') THEN
    ALTER TABLE sys_payment_method_cd RENAME COLUMN payment_type_color1 TO payment_method_color1;
  END IF;
  
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sys_payment_method_cd' AND column_name = 'payment_type_color2') THEN
    ALTER TABLE sys_payment_method_cd RENAME COLUMN payment_type_color2 TO payment_method_color2;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sys_payment_method_cd' AND column_name = 'payment_type_color3') THEN
    ALTER TABLE sys_payment_method_cd RENAME COLUMN payment_type_color3 TO payment_method_color3;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sys_payment_method_cd' AND column_name = 'payment_type_icon') THEN
    ALTER TABLE sys_payment_method_cd RENAME COLUMN payment_type_icon TO payment_method_icon;
  END IF;

  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sys_payment_method_cd' AND column_name = 'payment_type_image') THEN
    ALTER TABLE sys_payment_method_cd RENAME COLUMN payment_type_image TO payment_method_image;
  END IF;
END $$;

-- =============================================================================
-- 2. org_payments_dtl_tr: nullable invoice_id, order_id, customer_id, payment_kind
-- =============================================================================
ALTER TABLE IF EXISTS org_payments_dtl_tr
  ALTER COLUMN invoice_id DROP NOT NULL;

ALTER TABLE IF EXISTS org_payments_dtl_tr
  ADD COLUMN IF NOT EXISTS order_id UUID NULL REFERENCES org_orders_mst(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS org_payments_dtl_tr
  ADD COLUMN IF NOT EXISTS customer_id UUID NULL REFERENCES org_customers_mst(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS org_payments_dtl_tr
  ADD COLUMN IF NOT EXISTS payment_kind VARCHAR(30) NOT NULL DEFAULT 'invoice';

COMMENT ON COLUMN org_payments_dtl_tr.payment_kind IS 'invoice | deposit | advance | pos';

ALTER TABLE IF EXISTS org_payments_dtl_tr
  DROP CONSTRAINT IF EXISTS chk_org_payment_ref;

-- Safe check for adding the check constraint
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chk_org_payment_ref' AND table_name = 'org_payments_dtl_tr') THEN
        ALTER TABLE org_payments_dtl_tr ADD CONSTRAINT chk_org_payment_ref CHECK (
            invoice_id IS NOT NULL OR order_id IS NOT NULL OR customer_id IS NOT NULL
        );
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_org_payments_order ON org_payments_dtl_tr(order_id) WHERE order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_org_payments_customer ON org_payments_dtl_tr(customer_id) WHERE customer_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_org_payments_kind ON org_payments_dtl_tr(tenant_org_id, payment_kind);

-- =============================================================================
-- 3. sys_bill_invoice_payments_tr: currency_code, payment_method_code, tax, vat
-- =============================================================================

-- 3.1 currency -> currency_code
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sys_bill_invoice_payments_tr' AND column_name = 'currency') THEN
    ALTER TABLE sys_bill_invoice_payments_tr RENAME COLUMN currency TO currency_code;
  END IF;
END $$;

-- Data update: Default to OMR as per Oman location context
UPDATE sys_bill_invoice_payments_tr SET currency_code = 'OMR' WHERE currency_code IS NULL;

ALTER TABLE IF EXISTS sys_bill_invoice_payments_tr ALTER COLUMN currency_code SET NOT NULL;
ALTER TABLE IF EXISTS sys_bill_invoice_payments_tr ALTER COLUMN currency_code DROP DEFAULT;

-- 3.2 payment_method -> payment_method_code
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'sys_bill_invoice_payments_tr' AND column_name = 'payment_method') THEN
    ALTER TABLE sys_bill_invoice_payments_tr RENAME COLUMN payment_method TO payment_method_code;
  END IF;
END $$;

-- Clean up data for foreign key consistency
UPDATE sys_bill_invoice_payments_tr 
SET payment_method_code = UPPER(TRIM(COALESCE(payment_method_code, 'CASH'))) 
WHERE payment_method_code IS NOT NULL;

UPDATE sys_bill_invoice_payments_tr 
SET payment_method_code = 'CASH'
WHERE payment_method_code IS NULL OR payment_method_code NOT IN (SELECT payment_method_code FROM sys_payment_method_cd);

-- Add Foreign Key with existence check
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_sys_bill_pay_method' AND table_name = 'sys_bill_invoice_payments_tr') THEN
        ALTER TABLE sys_bill_invoice_payments_tr ADD CONSTRAINT fk_sys_bill_pay_method
        FOREIGN KEY (payment_method_code) REFERENCES sys_payment_method_cd(payment_method_code) ON DELETE RESTRICT;
    END IF;
END $$;

ALTER TABLE IF EXISTS sys_bill_invoice_payments_tr ALTER COLUMN payment_method_code SET NOT NULL;

-- 3.3 Add payment_type_code
ALTER TABLE IF EXISTS sys_bill_invoice_payments_tr 
  ADD COLUMN IF NOT EXISTS payment_type_code VARCHAR(30) NULL 
  REFERENCES sys_payment_type_cd(payment_type_code) ON DELETE SET NULL;

-- 3.4 Add tax and vat
ALTER TABLE IF EXISTS sys_bill_invoice_payments_tr ADD COLUMN IF NOT EXISTS tax DECIMAL(19, 4) NULL DEFAULT 0;
ALTER TABLE IF EXISTS sys_bill_invoice_payments_tr ADD COLUMN IF NOT EXISTS vat DECIMAL(19, 4) NULL DEFAULT 0;

-- 3.5 Ensure precision for amounts
ALTER TABLE IF EXISTS sys_bill_invoice_payments_tr ALTER COLUMN amount TYPE DECIMAL(19, 4);

COMMIT;
/*
BEGIN;

-- =============================================================================
-- 1.1 sys_payment_type_cd: rename PK column
-- =============================================================================
ALTER TABLE sys_payment_type_cd
  RENAME COLUMN payment_type_id TO payment_type_code;

COMMENT ON COLUMN sys_payment_type_cd.payment_type_code IS 'PK: payment type code (e.g. PAY_IN_ADVANCE, PAY_ON_COLLECTION)';

-- =============================================================================
-- 1.2 sys_payment_method_cd: rename display columns
-- =============================================================================
ALTER TABLE sys_payment_method_cd
  RENAME COLUMN payment_type_color1 TO payment_method_color1;

ALTER TABLE sys_payment_method_cd
  RENAME COLUMN payment_type_color2 TO payment_method_color2;

ALTER TABLE sys_payment_method_cd
  RENAME COLUMN payment_type_color3 TO payment_method_color3;

ALTER TABLE sys_payment_method_cd
  RENAME COLUMN payment_type_icon TO payment_method_icon;

ALTER TABLE sys_payment_method_cd
  RENAME COLUMN payment_type_image TO payment_method_image;

-- =============================================================================
-- 2. org_payments_dtl_tr: nullable invoice_id, order_id, customer_id, payment_kind
-- =============================================================================
ALTER TABLE org_payments_dtl_tr
  ALTER COLUMN invoice_id DROP NOT NULL;

ALTER TABLE org_payments_dtl_tr
  ADD COLUMN IF NOT EXISTS order_id UUID NULL REFERENCES org_orders_mst(id) ON DELETE SET NULL;

ALTER TABLE org_payments_dtl_tr
  ADD COLUMN IF NOT EXISTS customer_id UUID NULL REFERENCES org_customers_mst(id) ON DELETE SET NULL;

ALTER TABLE org_payments_dtl_tr
  ADD COLUMN IF NOT EXISTS payment_kind VARCHAR(30) NOT NULL DEFAULT 'invoice';

COMMENT ON COLUMN org_payments_dtl_tr.payment_kind IS 'invoice | deposit | advance | pos';

ALTER TABLE org_payments_dtl_tr
  DROP CONSTRAINT IF EXISTS chk_org_payment_ref;

ALTER TABLE org_payments_dtl_tr
  ADD CONSTRAINT chk_org_payment_ref CHECK (
    invoice_id IS NOT NULL OR order_id IS NOT NULL OR customer_id IS NOT NULL
  );

CREATE INDEX IF NOT EXISTS idx_org_payments_order
  ON org_payments_dtl_tr(order_id) WHERE order_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_org_payments_customer
  ON org_payments_dtl_tr(customer_id) WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_org_payments_kind
  ON org_payments_dtl_tr(tenant_org_id, payment_kind);

-- =============================================================================
-- 3. sys_bill_invoice_payments_tr: currency_code, payment_method_code, tax, vat
-- =============================================================================

-- 3.1 currency -> currency_code, NOT NULL, no default
ALTER TABLE sys_bill_invoice_payments_tr
  RENAME COLUMN currency TO currency_code;

UPDATE sys_bill_invoice_payments_tr
  SET currency_code = 'OMR'
  WHERE currency_code IS NULL;

ALTER TABLE sys_bill_invoice_payments_tr
  ALTER COLUMN currency_code SET NOT NULL;

ALTER TABLE sys_bill_invoice_payments_tr
  ALTER COLUMN currency_code DROP DEFAULT;

-- 3.2 payment_method -> payment_method_code, FK to sys_payment_method_cd
ALTER TABLE sys_bill_invoice_payments_tr
  RENAME COLUMN payment_method TO payment_method_code;

-- Backfill: map common values to sys_payment_method_cd codes (CASH, CARD, etc.)
UPDATE sys_bill_invoice_payments_tr
  SET payment_method_code = UPPER(TRIM(COALESCE(payment_method_code, 'CASH')))
  WHERE payment_method_code IS NOT NULL;

UPDATE sys_bill_invoice_payments_tr
  SET payment_method_code = 'CASH'
  WHERE payment_method_code IS NULL
     OR payment_method_code NOT IN (SELECT payment_method_code FROM sys_payment_method_cd);

ALTER TABLE sys_bill_invoice_payments_tr
  ADD CONSTRAINT fk_sys_bill_pay_method
  FOREIGN KEY (payment_method_code) REFERENCES sys_payment_method_cd(payment_method_code) ON DELETE RESTRICT;

ALTER TABLE sys_bill_invoice_payments_tr
  ALTER COLUMN payment_method_code SET NOT NULL;

-- 3.3 Add payment_type_code (FK to sys_payment_type_cd)
ALTER TABLE sys_bill_invoice_payments_tr
  ADD COLUMN IF NOT EXISTS payment_type_code VARCHAR(30) NULL
  REFERENCES sys_payment_type_cd(payment_type_code) ON DELETE SET NULL;

-- 3.4 Add tax and vat
ALTER TABLE sys_bill_invoice_payments_tr
  ADD COLUMN IF NOT EXISTS tax DECIMAL(19, 4) NULL DEFAULT 0;

ALTER TABLE sys_bill_invoice_payments_tr
  ADD COLUMN IF NOT EXISTS vat DECIMAL(19, 4) NULL DEFAULT 0;

-- 3.5 amount to DECIMAL(19, 4) if not already
ALTER TABLE sys_bill_invoice_payments_tr
  ALTER COLUMN amount TYPE DECIMAL(19, 4);

COMMIT;
*/