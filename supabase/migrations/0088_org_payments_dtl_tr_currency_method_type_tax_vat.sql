-- Migration 0088: org_payments_dtl_tr – currency_code, payment_method_code (FK), drop payment_kind, tax, vat, payment_type_code, paid_amount DECIMAL(19,4)
-- Target: org_payments_dtl_tr only (not sys_bill_invoice_payments_tr)

-- Migration 0088: org_payments_dtl_tr – currency_code, payment_method_code (FK), drop payment_kind, tax, vat, payment_type_code, paid_amount DECIMAL(19,4)
BEGIN;

-- =============================================================================
-- 1. currency_code: add, NOT NULL, no default
-- =============================================================================
ALTER TABLE org_payments_dtl_tr
  ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) NULL;

-- Set default for existing records before setting NOT NULL
UPDATE org_payments_dtl_tr
  SET currency_code = 'OMR'
  WHERE currency_code IS NULL;

ALTER TABLE org_payments_dtl_tr
  ALTER COLUMN currency_code SET NOT NULL;

-- =============================================================================
-- 2. payment_method -> payment_method_code
-- =============================================================================
DO $$ 
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'org_payments_dtl_tr' AND column_name = 'payment_method') THEN
    ALTER TABLE org_payments_dtl_tr RENAME COLUMN payment_method TO payment_method_code;
  END IF;
END $$;

-- Data normalization for the new code format
UPDATE org_payments_dtl_tr
  SET payment_method_code = UPPER(TRIM(COALESCE(payment_method_code, 'CASH')))
  WHERE payment_method_code IS NOT NULL;

UPDATE org_payments_dtl_tr
  SET payment_method_code = 'CASH'
  WHERE payment_method_code IS NULL
     OR payment_method_code NOT IN (SELECT payment_method_code FROM sys_payment_method_cd);

-- Safe constraint handling
ALTER TABLE org_payments_dtl_tr
  DROP CONSTRAINT IF EXISTS fk_org_payments_payment_method;

DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_org_payments_payment_method' AND table_name = 'org_payments_dtl_tr') THEN
        ALTER TABLE org_payments_dtl_tr
        ADD CONSTRAINT fk_org_payments_payment_method
        FOREIGN KEY (payment_method_code) REFERENCES sys_payment_method_cd(payment_method_code) ON DELETE RESTRICT;
    END IF;
END $$;

ALTER TABLE org_payments_dtl_tr
  ALTER COLUMN payment_method_code SET NOT NULL;

-- =============================================================================
-- 3. Drop payment_kind (use payment_method_code only)
-- =============================================================================
DROP INDEX IF EXISTS idx_org_payments_kind;

ALTER TABLE org_payments_dtl_tr
  DROP COLUMN IF EXISTS payment_kind;

-- =============================================================================
-- 4. Add tax and vat
-- =============================================================================
ALTER TABLE org_payments_dtl_tr
  ADD COLUMN IF NOT EXISTS tax DECIMAL(19, 4) NULL DEFAULT 0;

ALTER TABLE org_payments_dtl_tr
  ADD COLUMN IF NOT EXISTS vat DECIMAL(19, 4) NULL DEFAULT 0;

-- =============================================================================
-- 5. Add payment_type_code FK to sys_payment_type_cd
-- =============================================================================
-- First ensure the column exists
ALTER TABLE org_payments_dtl_tr
  ADD COLUMN IF NOT EXISTS payment_type_code VARCHAR(30) NULL;

-- Then safely add the Foreign Key constraint
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'fk_org_payments_payment_type' AND table_name = 'org_payments_dtl_tr') THEN
        ALTER TABLE org_payments_dtl_tr
        ADD CONSTRAINT fk_org_payments_payment_type
        FOREIGN KEY (payment_type_code) REFERENCES sys_payment_type_cd(payment_type_code) ON DELETE SET NULL;
    END IF;
END $$;

-- =============================================================================
-- 6. paid_amount to DECIMAL(19, 4)
-- =============================================================================
ALTER TABLE org_payments_dtl_tr
  ALTER COLUMN paid_amount TYPE DECIMAL(19, 4);

COMMIT;

/*
BEGIN;

-- =============================================================================
-- 1. currency_code: add (table has no currency column), NOT NULL, no default
-- =============================================================================
ALTER TABLE org_payments_dtl_tr
  ADD COLUMN IF NOT EXISTS currency_code VARCHAR(3) NULL;

UPDATE org_payments_dtl_tr
  SET currency_code = 'OMR'
  WHERE currency_code IS NULL;

ALTER TABLE org_payments_dtl_tr
  ALTER COLUMN currency_code SET NOT NULL;

-- =============================================================================
-- 2. payment_method -> payment_method_code, NOT NULL, FK to sys_payment_method_cd
-- =============================================================================
ALTER TABLE org_payments_dtl_tr
  RENAME COLUMN payment_method TO payment_method_code;

UPDATE org_payments_dtl_tr
  SET payment_method_code = UPPER(TRIM(COALESCE(payment_method_code, 'CASH')))
  WHERE payment_method_code IS NOT NULL;

UPDATE org_payments_dtl_tr
  SET payment_method_code = 'CASH'
  WHERE payment_method_code IS NULL
     OR payment_method_code NOT IN (SELECT payment_method_code FROM sys_payment_method_cd);

ALTER TABLE org_payments_dtl_tr
  DROP CONSTRAINT IF EXISTS fk_org_payments_payment_method;

ALTER TABLE org_payments_dtl_tr
  ADD CONSTRAINT fk_org_payments_payment_method
  FOREIGN KEY (payment_method_code) REFERENCES sys_payment_method_cd(payment_method_code) ON DELETE RESTRICT;

ALTER TABLE org_payments_dtl_tr
  ALTER COLUMN payment_method_code SET NOT NULL;

-- =============================================================================
-- 3. Drop payment_kind (use payment_method_code only)
-- =============================================================================
DROP INDEX IF EXISTS idx_org_payments_kind;

ALTER TABLE org_payments_dtl_tr
  DROP COLUMN IF EXISTS payment_kind;

-- =============================================================================
-- 4. Add tax and vat
-- =============================================================================
ALTER TABLE org_payments_dtl_tr
  ADD COLUMN IF NOT EXISTS tax DECIMAL(19, 4) NULL DEFAULT 0;

ALTER TABLE org_payments_dtl_tr
  ADD COLUMN IF NOT EXISTS vat DECIMAL(19, 4) NULL DEFAULT 0;

-- =============================================================================
-- 5. Add payment_type_code FK to sys_payment_type_cd
-- =============================================================================
ALTER TABLE org_payments_dtl_tr
  ADD COLUMN IF NOT EXISTS payment_type_code VARCHAR(30) NULL
  REFERENCES sys_payment_type_cd(payment_type_code) ON DELETE SET NULL;

-- =============================================================================
-- 6. paid_amount to DECIMAL(19, 4)
-- =============================================================================
ALTER TABLE org_payments_dtl_tr
  ALTER COLUMN paid_amount TYPE DECIMAL(19, 4);

COMMIT;
*/
