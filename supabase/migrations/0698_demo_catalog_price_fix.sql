-- =============================================================================
-- 0698_demo_catalog_price_fix.sql
-- Line-Level Money Snapshot, P10-02: demo catalog cleanup (PF-24), delegated by
-- the owner. Demo organization 11111111-... only; no other organization changes.
--
-- 1. Six demo products have no price_type. They become PER_PC, the same meaning
--    the calculator already gives an empty value, so no price changes.
-- 2. Demo products whose sale price is below their own minimum cannot be sold:
--    the calculator refuses them with PRICE_BELOW_MINIMUM. Their minimums are
--    about ten times the sale price, left over from an older price scale. The
--    minimum is cleared and the sale price is kept, so prices stay as shown today.
--
-- No schema object is created or altered. No order reads these values after it
-- is created, so stored orders do not change.
-- =============================================================================

BEGIN;

UPDATE public.org_product_data_mst
SET price_type = 'PER_PC',
    updated_at = CURRENT_TIMESTAMP,
    updated_by = 'system_migration',
    updated_info = 'Migration 0698: empty price_type set to PER_PC (P10-02)'
WHERE tenant_org_id = '11111111-1111-1111-1111-111111111111'::uuid
  AND price_type IS NULL;

UPDATE public.org_product_data_mst
SET min_sell_price = NULL,
    updated_at = CURRENT_TIMESTAMP,
    updated_by = 'system_migration',
    updated_info = 'Migration 0698: minimum above the sale price cleared (PF-24)'
WHERE tenant_org_id = '11111111-1111-1111-1111-111111111111'::uuid
  AND min_sell_price IS NOT NULL
  AND default_sell_price IS NOT NULL
  AND default_sell_price < min_sell_price;

COMMIT;
