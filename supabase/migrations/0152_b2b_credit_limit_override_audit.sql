-- Migration 0152: B2B Credit Limit Override Audit
-- Add credit_limit_override_by and credit_limit_override_at to org_orders_mst
-- When admin overrides credit limit in payment modal, these fields record who and when.
-- DO NOT APPLY automatically - user applies migrations

BEGIN;

ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS credit_limit_override_by TEXT,
  ADD COLUMN IF NOT EXISTS credit_limit_override_at TIMESTAMP;

COMMENT ON COLUMN org_orders_mst.credit_limit_override_by IS 'B2B: User ID or name who overrode credit limit';
COMMENT ON COLUMN org_orders_mst.credit_limit_override_at IS 'B2B: Timestamp when credit limit was overridden';

COMMIT;
