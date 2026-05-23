-- ============================================================
-- Migration: 0320_bvm_wiring_phase1b_line_type.sql
-- Feature:   BVM Wiring Phase 1B — Add CREDIT_APPLICATION line type
-- Purpose:   Extends the line_type CHECK constraint and lookup table
--            to include 'CREDIT_APPLICATION' for ORDER_CREDIT_APPLICATION
--            voucher lines created during order submission wiring.
-- Depends:   0318_bvm_wiring_phase1a_schema.sql
-- ============================================================

-- 1. Seed the new line type into the lookup table
INSERT INTO sys_fin_vch_line_type_cd (code, name, name2, rec_order, is_active, rec_status)
VALUES ('CREDIT_APPLICATION', 'Credit Application', 'تطبيق ائتمان', 10, true, 1)
ON CONFLICT (code) DO NOTHING;

-- 2. Drop + re-add constraint to include CREDIT_APPLICATION
--    (same DROP RESTRICT + ADD pattern used in migration 0318 for chk_vch_trx_ln_role)
ALTER TABLE org_fin_voucher_trx_lines_dtl
  DROP CONSTRAINT IF EXISTS chk_vch_trx_ln_type;

ALTER TABLE org_fin_voucher_trx_lines_dtl
  ADD CONSTRAINT chk_vch_trx_ln_type CHECK (
    line_type = ANY (ARRAY[
      'RECEIPT'::text,
      'PAYMENT'::text,
      'REFUND'::text,
      'EXPENSE'::text,
      'ADVANCE'::text,
      'TRANSFER'::text,
      'ADJUSTMENT'::text,
      'FEE'::text,
      'ROUNDING'::text,
      'CREDIT_APPLICATION'::text
    ])
  );
