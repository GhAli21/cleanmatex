-- Migration: 0310_relax_voucher_total_amount_constraint.sql
-- Purpose: Allow total_amount = 0 on org_fin_vouchers_mst for DRAFT BVM vouchers.
--          BVM vouchers are created as DRAFT with total_amount = 0; lines are added after.
--          Positive-amount enforcement happens at post-time in the service layer.
--          Relaxes CHECK (total_amount > 0) → CHECK (total_amount >= 0).

ALTER TABLE org_fin_vouchers_mst
  DROP CONSTRAINT IF EXISTS chk_fin_voucher_total_positive;

ALTER TABLE org_fin_vouchers_mst
  ADD CONSTRAINT chk_fin_voucher_total_non_negative
    CHECK (total_amount >= 0);
