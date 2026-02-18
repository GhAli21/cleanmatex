-- ==================================================================
-- 0110_add_id_sku_to_org_inv_stock_by_branch.sql
-- Purpose: Add id_sku (SKU) to org_inv_stock_by_branch for branch-specific SKU override
-- Dependencies: 0103_inventory_branch_and_deduct.sql
-- ==================================================================

BEGIN;

ALTER TABLE org_inv_stock_by_branch
  ADD COLUMN IF NOT EXISTS id_sku TEXT;

COMMENT ON COLUMN org_inv_stock_by_branch.id_sku IS
  'Branch-specific SKU; NULL = use product-level id_sku';

-- Optional backfill from product
UPDATE org_inv_stock_by_branch b
SET id_sku = p.id_sku
FROM org_product_data_mst p
WHERE b.product_id = p.id
  AND b.tenant_org_id = p.tenant_org_id
  AND b.id_sku IS NULL
  AND p.id_sku IS NOT NULL;

COMMIT;
