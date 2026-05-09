-- =============================================================================
-- Migration: 0255_ord_discount_audit_backfill.sql
-- Purpose:   Backfill org_ord_discounts_dtl from existing org_orders_mst data.
--            Inserts one discount line per source per order for orders that
--            already have discount amounts but no audit rows yet.
--
-- Sources backfilled (in this order, applied_seq 1..N):
--   1. MANUAL       — discount > 0 and no promo_code_id / gift_card_id
--   2. PROMO_CODE   — promo_discount_amount > 0
--   3. GIFT_CARD    — gift_card_discount_amount > 0
--
-- Idempotent: skips orders that already have at least one row in the table.
-- Safe to re-run: existing rows are never modified or deleted.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------
-- 1. MANUAL discount backfill
--    Condition: discount > 0, no promo_code_id, no gift_card_id
--    (pure manual/rule-based discount stored in the discount column)
-- -----------------------------------------------------------------------
INSERT INTO org_ord_discounts_dtl (
  id,
  tenant_org_id,
  order_id,
  applied_seq,
  source_type,
  source_id,
  source_name,
  source_name2,
  discount_type,
  discount_rate,
  discount_amount,
  is_voided,
  rec_status,
  created_at,
  created_by,
  created_info
)
SELECT
  gen_random_uuid(),
  o.tenant_org_id,
  o.id                    AS order_id,
  1                       AS applied_seq,
  'MANUAL'                AS source_type,
  NULL                    AS source_id,
  'Manual Discount'       AS source_name,
  'خصم يدوي'             AS source_name2,
  CASE
    WHEN o.discount_type ILIKE 'PERCENTAGE' THEN 'PERCENTAGE'
    ELSE 'FIXED_AMOUNT'
  END                     AS discount_type,
  CASE
    WHEN o.discount_type ILIKE 'PERCENTAGE' THEN o.discount_rate::NUMERIC(5,2)
    ELSE NULL
  END                     AS discount_rate,
  o.discount              AS discount_amount,
  CASE WHEN o.status IN ('CANCELLED', 'RETURNED') THEN TRUE ELSE FALSE END AS is_voided,
  1                       AS rec_status,
  COALESCE(o.created_at, NOW()) AS created_at,
  'system-backfill'       AS created_by,
  'backfill-0255'         AS created_info
FROM org_orders_mst o
WHERE
  o.discount > 0
  AND o.promo_code_id IS NULL
  AND o.gift_card_id IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM org_ord_discounts_dtl d
    WHERE d.order_id = o.id
      AND d.tenant_org_id = o.tenant_org_id
  );

-- -----------------------------------------------------------------------
-- 2. PROMO_CODE discount backfill
--    Condition: promo_discount_amount > 0
-- -----------------------------------------------------------------------
INSERT INTO org_ord_discounts_dtl (
  id,
  tenant_org_id,
  order_id,
  applied_seq,
  source_type,
  source_id,
  source_name,
  source_name2,
  discount_type,
  discount_rate,
  discount_amount,
  is_voided,
  rec_status,
  created_at,
  created_by,
  created_info
)
SELECT
  gen_random_uuid(),
  o.tenant_org_id,
  o.id                    AS order_id,
  -- seq after any MANUAL row that might exist
  COALESCE((
    SELECT MAX(d2.applied_seq)
    FROM org_ord_discounts_dtl d2
    WHERE d2.order_id = o.id AND d2.tenant_org_id = o.tenant_org_id
  ), 0) + 1               AS applied_seq,
  'PROMO_CODE'            AS source_type,
  o.promo_code_id         AS source_id,
  COALESCE(pc.promo_code, 'Promo Code') AS source_name,
  NULL                    AS source_name2,
  'FIXED_AMOUNT'          AS discount_type,
  NULL                    AS discount_rate,
  o.promo_discount_amount AS discount_amount,
  CASE WHEN o.status IN ('CANCELLED', 'RETURNED') THEN TRUE ELSE FALSE END AS is_voided,
  1                       AS rec_status,
  COALESCE(o.created_at, NOW()) AS created_at,
  'system-backfill'       AS created_by,
  'backfill-0255'         AS created_info
FROM org_orders_mst o
LEFT JOIN org_promo_codes_mst pc
  ON pc.id = o.promo_code_id
WHERE
  o.promo_discount_amount > 0
  AND NOT EXISTS (
    SELECT 1
    FROM org_ord_discounts_dtl d
    WHERE d.order_id = o.id
      AND d.tenant_org_id = o.tenant_org_id
      AND d.source_type = 'PROMO_CODE'
  );

-- -----------------------------------------------------------------------
-- 3. GIFT_CARD discount backfill
--    Condition: gift_card_discount_amount > 0
-- -----------------------------------------------------------------------
INSERT INTO org_ord_discounts_dtl (
  id,
  tenant_org_id,
  order_id,
  applied_seq,
  source_type,
  source_id,
  source_name,
  source_name2,
  discount_type,
  discount_rate,
  discount_amount,
  is_voided,
  rec_status,
  created_at,
  created_by,
  created_info
)
SELECT
  gen_random_uuid(),
  o.tenant_org_id,
  o.id                    AS order_id,
  COALESCE((
    SELECT MAX(d2.applied_seq)
    FROM org_ord_discounts_dtl d2
    WHERE d2.order_id = o.id AND d2.tenant_org_id = o.tenant_org_id
  ), 0) + 1               AS applied_seq,
  'GIFT_CARD'             AS source_type,
  o.gift_card_id          AS source_id,
  CONCAT('Gift Card …', RIGHT(COALESCE(gc.card_number, '????'), 4)) AS source_name,
  NULL                    AS source_name2,
  'FIXED_AMOUNT'          AS discount_type,
  NULL                    AS discount_rate,
  o.gift_card_discount_amount AS discount_amount,
  CASE WHEN o.status IN ('CANCELLED', 'RETURNED') THEN TRUE ELSE FALSE END AS is_voided,
  1                       AS rec_status,
  COALESCE(o.created_at, NOW()) AS created_at,
  'system-backfill'       AS created_by,
  'backfill-0255'         AS created_info
FROM org_orders_mst o
LEFT JOIN org_gift_cards_mst gc
  ON gc.id = o.gift_card_id
WHERE
  o.gift_card_discount_amount > 0
  AND NOT EXISTS (
    SELECT 1
    FROM org_ord_discounts_dtl d
    WHERE d.order_id = o.id
      AND d.tenant_org_id = o.tenant_org_id
      AND d.source_type = 'GIFT_CARD'
  );

COMMIT;
