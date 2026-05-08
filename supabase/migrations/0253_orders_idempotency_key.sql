-- Migration 0253: Add idempotency_key to org_orders_mst
-- Prevents double-submission when a client retries after a network timeout.
-- The unique partial index enforces one order per key per tenant while
-- allowing NULL (orders submitted without an idempotency key are unaffected).

ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_org_orders_mst_idempotency_key
  ON org_orders_mst (tenant_org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;

COMMENT ON COLUMN org_orders_mst.idempotency_key IS
  'Client-supplied UUID (per submit session). Unique per tenant — used to return the existing order on retry instead of creating a duplicate.';
