-- 0004_seed_catalog_demo.sql
-- Seed demo price lists and items for existing demo tenants

BEGIN;

-- Demo Tenant IDs from existing seeds
-- Demo 1: 11111111-1111-1111-1111-111111111111
-- Demo 2: 20000002-2222-2222-2222-222222222221

-- Create a standard price list for each tenant
INSERT INTO org_price_lists_mst (
  tenant_org_id, name, name2, price_list_type, is_default, priority, is_active
) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Standard', 'قياسي', 'standard', true, 10, true),
  ('20000002-2222-2222-2222-222222222221', 'Standard', 'قياسي', 'standard', true, 10, true)
ON CONFLICT DO NOTHING;

-- Create an express price list for each tenant
INSERT INTO org_price_lists_mst (
  tenant_org_id, name, name2, price_list_type, is_default, priority, is_active
) VALUES
  ('11111111-1111-1111-1111-111111111111', 'Express', 'سريع', 'express', false, 20, true),
  ('20000002-2222-2222-2222-222222222221', 'Express', 'سريع', 'express', false, 20, true)
ON CONFLICT DO NOTHING;

-- Link a few existing products into price lists (if any exist)
-- Standard = product default price; Express = default_express_sell_price if set else +20%
WITH tenant_products AS (
  SELECT p.tenant_org_id, p.id as product_id, p.default_sell_price, p.default_express_sell_price
  FROM org_product_data_mst p
  WHERE p.is_active = true
    AND p.tenant_org_id IN ('11111111-1111-1111-1111-111111111111','20000002-2222-2222-2222-222222222221')
  LIMIT 50
), pl AS (
  SELECT id, tenant_org_id, price_list_type
  FROM org_price_lists_mst
  WHERE tenant_org_id IN ('11111111-1111-1111-1111-111111111111','20000002-2222-2222-2222-222222222221')
)
INSERT INTO org_price_list_items_dtl (
  tenant_org_id, price_list_id, product_id, price, discount_percent, min_quantity, is_active
)
SELECT tp.tenant_org_id,
       (SELECT id FROM pl WHERE pl.tenant_org_id = tp.tenant_org_id AND pl.price_list_type = 'standard' LIMIT 1) as price_list_id,
       tp.product_id,
       COALESCE(tp.default_sell_price, 0),
       0, 1, true
FROM tenant_products tp
ON CONFLICT DO NOTHING;

WITH tenant_products AS (
  SELECT p.tenant_org_id, p.id as product_id, p.default_sell_price, p.default_express_sell_price
  FROM org_product_data_mst p
  WHERE p.is_active = true
    AND p.tenant_org_id IN ('11111111-1111-1111-1111-111111111111','20000002-2222-2222-2222-222222222221')
  LIMIT 50
), pl AS (
  SELECT id, tenant_org_id, price_list_type
  FROM org_price_lists_mst
  WHERE tenant_org_id IN ('11111111-1111-1111-1111-111111111111','20000002-2222-2222-2222-222222222221')
)
INSERT INTO org_price_list_items_dtl (
  tenant_org_id, price_list_id, product_id, price, discount_percent, min_quantity, is_active
)
SELECT tp.tenant_org_id,
       (SELECT id FROM pl WHERE pl.tenant_org_id = tp.tenant_org_id AND pl.price_list_type = 'express' LIMIT 1) as price_list_id,
       tp.product_id,
       COALESCE(tp.default_express_sell_price, COALESCE(tp.default_sell_price, 0) * 1.2),
       0, 1, true
FROM tenant_products tp
ON CONFLICT DO NOTHING;

COMMIT;
