-- Migration: 0326_orders_mst_idempotency_key.sql
-- Purpose: Add idempotency_key column to org_orders_mst so the submit-order
--          route can store and check idempotency keys per tenant per order.
--          The route owns the full D11 idempotency lifecycle: check before
--          calling the orchestrator, store after success (best-effort UPDATE).
-- Scope: org_orders_mst (tenant-scoped, RLS enforced)

ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS idempotency_key TEXT;

-- Unique per tenant — same key cannot map to two different orders for the same org.
-- Partial unique index (excludes NULLs automatically in PostgreSQL).
CREATE UNIQUE INDEX IF NOT EXISTS uq_org_orders_mst_idempotency_key
  ON org_orders_mst (tenant_org_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL;
