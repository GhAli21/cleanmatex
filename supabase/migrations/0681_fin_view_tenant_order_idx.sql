-- 0681_fin_view_tenant_order_idx.sql
-- Reusable Order Financial View P3-02: tenant-first order lookups for the two
-- read-model sources that still had an order_id-only index (found when writing
-- the vouchers and receivable loaders; Phase 0 had missed them). Index only.

-- ── org_fin_vouchers_mst ─────────────────────────────────────────────────────
-- Vouchers of one order, looked up by (tenant_org_id, order_id). Also serves
-- the composite FK fk_fin_voucher_order (order_id, tenant_org_id) on parent
-- delete, since both columns are matched by equality. Partial: most vouchers
-- have no order.
CREATE INDEX idx_fin_vouchers_tenant_order
  ON public.org_fin_vouchers_mst (tenant_org_id, order_id)
  WHERE order_id IS NOT NULL;

COMMENT ON INDEX public.idx_fin_vouchers_tenant_order IS
  'Tenant-first lookup of an order''s vouchers (order financial view); also covers the (order_id, tenant_org_id) FK to org_orders_mst.';

-- Replaced by idx_fin_vouchers_tenant_order, which covers every query that used
-- it. RESTRICT: nothing depends on a plain index, so this fails loudly if that
-- ever changes.
DROP INDEX public.idx_fin_vouchers_order RESTRICT;

-- ── org_invoice_mst ──────────────────────────────────────────────────────────
-- Invoices of one order, looked up by (tenant_org_id, order_id). Partial:
-- statement invoices carry no single order. idx_org_invoice_order (order_id)
-- stays: the single-column FK fk_org_invoice_order cascades from
-- org_orders_mst by order_id alone and needs an order_id-leading index.
CREATE INDEX idx_invoice_tenant_order
  ON public.org_invoice_mst (tenant_org_id, order_id)
  WHERE order_id IS NOT NULL;

COMMENT ON INDEX public.idx_invoice_tenant_order IS
  'Tenant-first lookup of an order''s invoices; idx_org_invoice_order stays for the order_id-only FK cascade.';
