-- Migration: 0392_fix_credit_apps_type_constraint.sql
-- Fix: replace wrong hard-coded CHECK constraint on
--      org_order_credit_apps_dtl.credit_type with a proper FK to
--      sys_credit_app_types_cd, which is the authoritative lookup table.
--
-- Old constraint allowed ('CUSTOMER_CREDIT','CUSTOMER_ADVANCE','LOYALTY_CREDIT')
-- which did not match what the application sends ('CREDIT_NOTE','ADVANCE','LOYALTY_POINTS').
-- sys_credit_app_types_cd already seeds the correct values.
--
-- Rollback: see bottom of this file.

-- ── 1. Drop the old (wrong) CHECK constraint ────────────────────────────────
ALTER TABLE org_order_credit_apps_dtl
  DROP CONSTRAINT IF EXISTS chk_org_order_credit_apps_type;

-- ── 2. Add FK to sys_credit_app_types_cd ───────────────────────────────────
-- Name: fk_credit_apps_dtl_type (23 chars, within 30-char limit)
ALTER TABLE org_order_credit_apps_dtl
  ADD CONSTRAINT fk_credit_apps_dtl_type
    FOREIGN KEY (credit_type)
    REFERENCES sys_credit_app_types_cd (credit_app_type)
    ON UPDATE CASCADE
    ON DELETE RESTRICT;

-- ── Rollback (reference only — do NOT run as part of forward migration) ──────
-- ALTER TABLE org_order_credit_apps_dtl
--   DROP CONSTRAINT IF EXISTS fk_credit_apps_dtl_type;
-- ALTER TABLE org_order_credit_apps_dtl
--   ADD CONSTRAINT chk_org_order_credit_apps_type
--     CHECK (credit_type IN (
--       'GIFT_CARD', 'WALLET', 'CUSTOMER_CREDIT', 'LOYALTY_CREDIT', 'CUSTOMER_ADVANCE'
--     ));
