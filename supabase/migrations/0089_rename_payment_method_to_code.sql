-- Migration 0089: Rename payment_method → payment_method_code in remaining tables
-- Tables: org_invoice_mst, org_orders_mst, org_subscriptions_mst, sys_bill_invoices_mst
-- Includes: Data normalization and FK constraints to sys_payment_method_cd

BEGIN;

-- =============================================================================
-- 1. org_invoice_mst: payment_method → payment_method_code
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'org_invoice_mst' AND column_name = 'payment_method') THEN
    ALTER TABLE org_invoice_mst RENAME COLUMN payment_method TO payment_method_code;
  END IF;
END $$;

-- Data normalization
UPDATE org_invoice_mst
  SET payment_method_code = UPPER(TRIM(COALESCE(payment_method_code, 'CASH')))
  WHERE payment_method_code IS NOT NULL;

UPDATE org_invoice_mst
  SET payment_method_code = 'CASH'
  WHERE payment_method_code IS NULL
     OR payment_method_code NOT IN (SELECT payment_method_code FROM sys_payment_method_cd);

-- Add FK constraint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_org_invoice_payment_method'
                   AND table_name = 'org_invoice_mst') THEN
    ALTER TABLE org_invoice_mst
    ADD CONSTRAINT fk_org_invoice_payment_method
    FOREIGN KEY (payment_method_code) REFERENCES sys_payment_method_cd(payment_method_code) ON DELETE RESTRICT;
  END IF;
END $$;

-- =============================================================================
-- 2. org_orders_mst: payment_method → payment_method_code
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'org_orders_mst' AND column_name = 'payment_method') THEN
    ALTER TABLE org_orders_mst RENAME COLUMN payment_method TO payment_method_code;
  END IF;
END $$;

-- Data normalization
UPDATE org_orders_mst
  SET payment_method_code = UPPER(TRIM(COALESCE(payment_method_code, 'CASH')))
  WHERE payment_method_code IS NOT NULL;

UPDATE org_orders_mst
  SET payment_method_code = 'CASH'
  WHERE payment_method_code IS NULL
     OR payment_method_code NOT IN (SELECT payment_method_code FROM sys_payment_method_cd);

-- Add FK constraint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_org_orders_payment_method'
                   AND table_name = 'org_orders_mst') THEN
    ALTER TABLE org_orders_mst
    ADD CONSTRAINT fk_org_orders_payment_method
    FOREIGN KEY (payment_method_code) REFERENCES sys_payment_method_cd(payment_method_code) ON DELETE RESTRICT;
  END IF;
END $$;

-- =============================================================================
-- 3. org_subscriptions_mst: last_payment_method → last_payment_method_code
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'org_subscriptions_mst' AND column_name = 'last_payment_method') THEN
    ALTER TABLE org_subscriptions_mst RENAME COLUMN last_payment_method TO last_payment_method_code;
  END IF;
END $$;

-- Data normalization
UPDATE org_subscriptions_mst
  SET last_payment_method_code = UPPER(TRIM(COALESCE(last_payment_method_code, 'CASH')))
  WHERE last_payment_method_code IS NOT NULL;

UPDATE org_subscriptions_mst
  SET last_payment_method_code = 'CASH'
  WHERE last_payment_method_code IS NULL
     OR last_payment_method_code NOT IN (SELECT payment_method_code FROM sys_payment_method_cd);

-- Add FK constraint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_org_subs_payment_method'
                   AND table_name = 'org_subscriptions_mst') THEN
    ALTER TABLE org_subscriptions_mst
    ADD CONSTRAINT fk_org_subs_payment_method
    FOREIGN KEY (last_payment_method_code) REFERENCES sys_payment_method_cd(payment_method_code) ON DELETE RESTRICT;
  END IF;
END $$;

-- =============================================================================
-- 4. sys_bill_invoices_mst: payment_method → payment_method_code
-- =============================================================================
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_name = 'sys_bill_invoices_mst' AND column_name = 'payment_method') THEN
    ALTER TABLE sys_bill_invoices_mst RENAME COLUMN payment_method TO payment_method_code;
  END IF;
END $$;

-- Data normalization
UPDATE sys_bill_invoices_mst
  SET payment_method_code = UPPER(TRIM(COALESCE(payment_method_code, 'CASH')))
  WHERE payment_method_code IS NOT NULL;

UPDATE sys_bill_invoices_mst
  SET payment_method_code = 'CASH'
  WHERE payment_method_code IS NULL
     OR payment_method_code NOT IN (SELECT payment_method_code FROM sys_payment_method_cd);

-- Add FK constraint
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints
                 WHERE constraint_name = 'fk_sys_bill_inv_payment_method'
                   AND table_name = 'sys_bill_invoices_mst') THEN
    ALTER TABLE sys_bill_invoices_mst
    ADD CONSTRAINT fk_sys_bill_inv_payment_method
    FOREIGN KEY (payment_method_code) REFERENCES sys_payment_method_cd(payment_method_code) ON DELETE RESTRICT;
  END IF;
END $$;

COMMIT;
