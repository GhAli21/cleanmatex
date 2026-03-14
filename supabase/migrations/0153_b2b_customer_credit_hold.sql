-- Migration 0153: B2B Customer Credit Hold
-- Add is_credit_hold to org_customers_mst for dunning hold_orders action.
-- When dunning level triggers hold_orders, set is_credit_hold=true to block new orders.
-- DO NOT APPLY automatically - user applies migrations

BEGIN;

ALTER TABLE org_customers_mst
  ADD COLUMN IF NOT EXISTS is_credit_hold BOOLEAN DEFAULT false;

COMMENT ON COLUMN org_customers_mst.is_credit_hold IS 'B2B: When true, block new orders (set by dunning hold_orders action)';

COMMIT;
