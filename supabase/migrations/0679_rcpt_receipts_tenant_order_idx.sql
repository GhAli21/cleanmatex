-- 0679_rcpt_receipts_tenant_order_idx.sql
-- Reusable Order Financial View P2-01: the order financial view loads an
-- order's receipts by (tenant_org_id, order_id). org_rcpt_receipts_mst was the
-- only read-model source without a tenant-first order index (Phase 0 finding).
-- No schema change; index only.

-- Tenant-first lookup of one order's receipts. Also serves the composite FK
-- fk_rcpt_receipt_order (order_id, tenant_org_id) on parent delete, since both
-- columns are matched by equality.
CREATE INDEX idx_rcpt_receipts_tenant_order
  ON org_rcpt_receipts_mst (tenant_org_id, order_id);

COMMENT ON INDEX idx_rcpt_receipts_tenant_order IS
  'Tenant-first lookup of an order''s receipts (order financial view); also covers the (order_id, tenant_org_id) FK to org_orders_mst.';

-- Replaced by idx_rcpt_receipts_tenant_order, which covers every query that
-- used it; keeping both only doubles write cost. RESTRICT: nothing depends on
-- a plain index, so this fails loudly if that ever changes.
DROP INDEX idx_rcpt_receipts_order RESTRICT;
