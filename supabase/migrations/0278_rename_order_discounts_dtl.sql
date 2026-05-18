-- =============================================================================
-- Migration 0278: Rename org_ord_discounts_dtl → org_order_discounts_dtl
-- and extend with promotion linkage and stacking columns.
-- =============================================================================

BEGIN;

-- ── 1. Rename table ───────────────────────────────────────────────────────────
ALTER TABLE public.org_ord_discounts_dtl RENAME TO org_order_discounts_dtl;

-- ── 2. Rename indexes to match new table name ─────────────────────────────────
ALTER INDEX IF EXISTS idx_ord_disc_tenant_order  RENAME TO idx_order_disc_tenant_order;
ALTER INDEX IF EXISTS idx_ord_disc_tenant_source RENAME TO idx_order_disc_tenant_source;
ALTER INDEX IF EXISTS idx_ord_disc_order_source  RENAME TO idx_order_disc_order_source;

-- ── 3. Drop old RLS policy and recreate with new table name ───────────────────
DROP POLICY IF EXISTS tenant_isolation_org_ord_discounts_dtl  ON public.org_order_discounts_dtl;
DROP POLICY IF EXISTS tenant_isolation_ord_discounts_dtl      ON public.org_order_discounts_dtl;

CREATE POLICY tenant_isolation_org_order_discounts_dtl
  ON public.org_order_discounts_dtl
  FOR ALL
  USING  (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

-- ── 4. Extend table with promotion linkage and stacking columns ───────────────
-- promotion_id links to org_promotions_mst (FK added in migration 0288 after rename)
ALTER TABLE public.org_order_discounts_dtl
  ADD COLUMN IF NOT EXISTS promotion_id   UUID,
  ADD COLUMN IF NOT EXISTS stacking_group TEXT,
  ADD COLUMN IF NOT EXISTS charge_type    TEXT;

COMMIT;
