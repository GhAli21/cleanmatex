-- Migration 0096: Add trans_desc to org_payments_dtl_tr (transaction description)
-- Column: trans_desc VARCHAR(500) nullable

ALTER TABLE org_payments_dtl_tr
  ADD COLUMN IF NOT EXISTS trans_desc VARCHAR(500);

COMMENT ON COLUMN org_payments_dtl_tr.trans_desc IS 'Short description or reference for the payment transaction';
