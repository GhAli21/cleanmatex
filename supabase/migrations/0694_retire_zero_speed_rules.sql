-- =============================================================================
-- 0694_retire_zero_speed_rules.sql
--
-- Purpose: one-off cleanup of the product-level speed rules that 0640 seeded with
-- a zero multiplier (32 rows on remote when written: 28 retail items, 4 services).
-- They added nothing to the price, but as the most specific rule they stopped a
-- rule for a category or for all products from reaching their product.
--
-- Deploy the application code first. It leaves retail items out of a rule for all
-- products (speedRulesForProduct, Line-Level P9 follow-up). Before that code, these
-- rows are the only thing keeping such a rule off retail items.
--
-- Effect on new orders (existing orders keep their stored figures):
--   - Retail items: price unchanged; Express stays ready at once (their category's
--     Express hours are 0).
--   - SAREE and TUXEDO_PRM: they now follow a general rule if one exists, else cost
--     the same as Standard. Their Express time moves from the seeded 0 hours to the
--     general rule's hours, else the category's Express hours.
--
-- Scope: deliberately across tenants, as a data fix. Only rows carrying 0640's seed
-- mark are touched, so a zero rule a tenant created on purpose stays. A rule an order
-- line used stays too (its FK is ON DELETE RESTRICT, and history must stay explainable).
-- Each removed rule keeps one history row, as a delete on the Speed Pricing screen does.
-- No objects are created or altered, so there is nothing to COMMENT ON.
-- =============================================================================

BEGIN;

WITH removed AS (
  DELETE FROM public.org_speed_price_rules_cf AS r
  WHERE r.speed_price_type = 'MULTIPLIER'
    AND r.multiplier_speed = 0
    AND r.product_id IS NOT NULL
    AND r.created_by IS NULL
    AND r.created_info LIKE 'Backfilled from org_product_data_mst express fields by migration 0640%'
    AND NOT EXISTS (
      SELECT 1 FROM public.org_order_items_dtl AS i
      WHERE i.tenant_org_id = r.tenant_org_id AND i.speed_rule_id = r.id
    )
    AND NOT EXISTS (
      SELECT 1 FROM public.org_order_item_pieces_dtl AS p
      WHERE p.tenant_org_id = r.tenant_org_id AND p.speed_rule_id = r.id
    )
  RETURNING r.id, r.tenant_org_id, r.product_id, r.multiplier_speed, r.effective_from, r.effective_to
)
INSERT INTO public.org_price_history_audit (
  tenant_org_id, entity_type, entity_id, product_id, old_price, new_price,
  change_reason, effective_from, effective_to, created_info
)
SELECT tenant_org_id, 'speed_rule', id, product_id, multiplier_speed, NULL,
       'DELETE: zero multiplier seed rule', effective_from, effective_to, 'Migration 0694'
FROM removed;

COMMIT;
