-- =============================================================================
-- Migration 0510: B18 charge backfill
--
-- B18 (Order_Fin remediation) wired a PREFERENCE org_order_charges_dtl row
-- per preference row (item/piece/order level, extra_price > 0) but only for
-- orders created going forward — deliberately deferred backfilling existing
-- orders pending its own migration + owner sign-off (see
-- docs/features/Order_Fin/Remediation_Work_Packages/B18_Order_Charge_Write_Path.md,
-- "Out of scope" — owner chose "fix forward only, flag backfill separately").
--
-- Safety: this migration does NOT touch total_amount / outstanding_amount /
-- total_paid_amount / subtotal_amount on org_orders_mst. Pre-B18 orders were
-- already billed correctly at creation time — service_pref_charge /
-- extra_price were already priced into the item/order total before this
-- ledger existed. Backfilling org_order_charges_dtl + total_charges_amount /
-- other_charges_amount is pure retroactive bookkeeping so the reconciliation
-- module (order-snapshot-checks.ts: ORDER_CHARGES_MATCH_SNAPSHOT /
-- ORDER_PIECES_MATCH_CHARGES / ORDER_PREFERENCES_MATCH_CHARGES) stops
-- BLOCKER-failing on these orders — it does not change what any customer
-- owes or was charged. No CRITICAL RULE #15 concern: nothing user-editable
-- is rewritten, and no already-collected amount changes.
--
-- Idempotent: the INSERT only targets preference rows with no existing
-- charge row (matched by charge_source_id); the header UPDATE only touches
-- orders carrying this migration's own created_info marker, so re-running
-- this file is a no-op on the second pass.
-- =============================================================================

BEGIN;

WITH missing_preferences AS (
  SELECT
    p.id              AS preference_id,
    p.tenant_org_id,
    p.order_id,
    p.extra_price,
    p.preference_code,
    o.currency_code,
    ROW_NUMBER() OVER (
      PARTITION BY p.order_id
      ORDER BY p.created_at, p.id
    ) AS seq_in_order
  FROM public.org_order_preferences_dtl p
  JOIN public.org_orders_mst o
    ON o.id = p.order_id AND o.tenant_org_id = p.tenant_org_id
  WHERE p.extra_price > 0
    AND p.rec_status = 1
    AND NOT EXISTS (
      SELECT 1 FROM public.org_order_charges_dtl c
      WHERE c.tenant_org_id = p.tenant_org_id
        AND c.charge_source_id = p.id
    )
),
inserted AS (
  INSERT INTO public.org_order_charges_dtl (
    tenant_org_id, order_id, charge_type, charge_source_id,
    label, amount, currency_code, applied_seq,
    created_info, rec_status
  )
  SELECT
    tenant_org_id,
    order_id,
    'PREFERENCE',
    preference_id,
    preference_code,
    extra_price,
    currency_code,
    seq_in_order,
    'backfill:0510_b18_charge_backfill',
    1
  FROM missing_preferences
  RETURNING order_id, tenant_org_id
)
SELECT count(*) AS backfilled_charge_rows FROM inserted;

WITH affected_orders AS (
  SELECT DISTINCT order_id, tenant_org_id
  FROM public.org_order_charges_dtl
  WHERE created_info = 'backfill:0510_b18_charge_backfill'
),
charge_sums AS (
  SELECT
    c.order_id,
    c.tenant_org_id,
    SUM(c.amount) FILTER (WHERE c.is_voided = FALSE) AS active_charges_amount
  FROM public.org_order_charges_dtl c
  JOIN affected_orders a
    ON a.order_id = c.order_id AND a.tenant_org_id = c.tenant_org_id
  GROUP BY c.order_id, c.tenant_org_id
)
UPDATE public.org_orders_mst o
SET
  total_charges_amount = cs.active_charges_amount,
  other_charges_amount = cs.active_charges_amount,
  updated_at = NOW()
FROM charge_sums cs
WHERE o.id = cs.order_id
  AND o.tenant_org_id = cs.tenant_org_id;

COMMIT;
