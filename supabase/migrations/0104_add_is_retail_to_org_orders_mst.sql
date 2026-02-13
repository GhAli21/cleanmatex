-- Migration 0104: Add is_retail to org_orders_mst
-- Purpose: Store retail flag on order for efficient filtering and reporting
-- Retail = all items have service_category_code = 'RETAIL_ITEMS'

BEGIN;

-- Add column
ALTER TABLE org_orders_mst
  ADD COLUMN IF NOT EXISTS is_retail BOOLEAN NOT NULL DEFAULT false;

-- Backfill existing retail orders (all items must be RETAIL_ITEMS)
UPDATE org_orders_mst o
SET is_retail = true
WHERE o.service_category_code = 'RETAIL_ITEMS'
  AND NOT EXISTS (
    SELECT 1 FROM org_order_items_dtl oi
    WHERE oi.order_id = o.id
      AND oi.tenant_org_id = o.tenant_org_id
      AND (oi.service_category_code IS NULL OR oi.service_category_code != 'RETAIL_ITEMS')
  );

-- Partial index for filter performance
CREATE INDEX IF NOT EXISTS idx_orders_is_retail
  ON org_orders_mst(tenant_org_id, is_retail)
  WHERE is_retail = true;

COMMENT ON COLUMN org_orders_mst.is_retail IS 'True when order contains only retail items (RETAIL_ITEMS); skips laundry workflow.';

COMMIT;
