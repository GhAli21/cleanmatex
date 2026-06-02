-- ============================================================================
-- 0335_order_fin_legacy_field_drop.sql
-- ----------------------------------------------------------------------------
-- Why:
-- Order Fin canonical snapshot columns now back the active runtime reads and
-- writes for order financial semantics. The remaining legacy names below were
-- retained only during the staged rollout window. This cleanup removes the old
-- `org_orders_mst` mirrors after code search, tests, typecheck, and build
-- proved the runtime no longer depends on the legacy database columns.
--
-- Safety:
-- - Create-only migration for review; do not execute automatically.
-- - Uses `IF EXISTS` so review environments with partial schema drift stay
--   readable.
-- - Uses normal `DROP COLUMN` semantics without CASCADE.
-- ============================================================================

ALTER TABLE public.org_orders_mst
  DROP COLUMN IF EXISTS subtotal,
  DROP COLUMN IF EXISTS discount,
  DROP COLUMN IF EXISTS tax,
  DROP COLUMN IF EXISTS total,
  DROP COLUMN IF EXISTS paid_amount,
  DROP COLUMN IF EXISTS gift_card_applied_amount,
  DROP COLUMN IF EXISTS promo_discount_amount,
  DROP COLUMN IF EXISTS service_charge,
  DROP COLUMN IF EXISTS service_charge_type,
  DROP COLUMN IF EXISTS net_receivable_amount,
  DROP COLUMN IF EXISTS vat_amount;
