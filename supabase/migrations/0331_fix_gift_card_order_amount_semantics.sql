-- =============================================================================
-- 0331_fix_gift_card_order_amount_semantics.sql
-- =============================================================================
-- Purpose
--   Repair historical orders where gift card redemption was netted from
--   org_orders_mst.total and then counted again via total_credit_applied_amount.
--
-- Business rule
--   Gift card redemption is stored-value settlement. It must NOT reduce the
--   order sale total. It must reduce outstanding through
--   total_credit_applied_amount only.
--
-- Safety model
--   This migration is intentionally conservative. It only targets rows that:
--   1. have a persisted gift_card_applied_amount
--   2. have an active GIFT_CARD credit application row
--   3. reconstruct the full sale total when current total + gift card amount is
--      compared to the header's own subtotal/charges/discount/tax/rounding parts
--
-- Important
--   Create-only for review. Do NOT run automatically. Review the preview SELECTs
--   first and confirm the candidate set before applying this migration.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Preview 1: candidate rows that match the old double-count pattern
-- -----------------------------------------------------------------------------
WITH charge_totals AS (
  SELECT
    tenant_org_id,
    order_id,
    ROUND(COALESCE(SUM(amount), 0), 4) AS total_charges_amount
  FROM public.org_order_charges_dtl
  WHERE is_voided = FALSE
  GROUP BY tenant_org_id, order_id
),
discount_totals AS (
  SELECT
    tenant_org_id,
    order_id,
    ROUND(COALESCE(SUM(discount_amount), 0), 4) AS total_discount_amount
  FROM public.org_order_discounts_dtl
  WHERE is_voided = FALSE
  GROUP BY tenant_org_id, order_id
),
tax_totals AS (
  SELECT
    tenant_org_id,
    order_id,
    ROUND(COALESCE(SUM(tax_amount), 0), 4) AS total_tax_amount
  FROM public.org_order_taxes_dtl
  WHERE rec_status = 1
  GROUP BY tenant_org_id, order_id
),
payment_totals AS (
  SELECT
    tenant_org_id,
    order_id,
    ROUND(
      COALESCE(SUM(CASE WHEN payment_status = 'COMPLETED' THEN amount ELSE 0 END), 0),
      4
    ) AS total_paid_amount,
    ROUND(
      COALESCE(SUM(CASE WHEN payment_status = 'COMPLETED' THEN change_returned_amount ELSE 0 END), 0),
      4
    ) AS change_returned_amount
  FROM public.org_order_payments_dtl
  WHERE is_active = TRUE
  GROUP BY tenant_org_id, order_id
),
credit_totals AS (
  SELECT
    tenant_org_id,
    order_id,
    ROUND(COALESCE(SUM(applied_amount), 0), 4) AS total_credit_applied_amount
  FROM public.org_order_credit_apps_dtl
  WHERE is_active = TRUE
  GROUP BY tenant_org_id, order_id
),
gift_card_credit_totals AS (
  SELECT
    tenant_org_id,
    order_id,
    ROUND(COALESCE(SUM(applied_amount), 0), 4) AS gift_card_credit_amount
  FROM public.org_order_credit_apps_dtl
  WHERE is_active = TRUE
    AND credit_type = 'GIFT_CARD'
  GROUP BY tenant_org_id, order_id
),
refund_totals AS (
  SELECT
    tenant_org_id,
    order_id,
    ROUND(COALESCE(SUM(refund_amount), 0), 4) AS total_refunded_amount
  FROM public.org_order_refunds_dtl
  WHERE is_active = TRUE
    AND refund_status = 'PROCESSED'
  GROUP BY tenant_org_id, order_id
),
recomputed AS (
  SELECT
    o.tenant_org_id,
    o.id,
    o.order_no,
    o.payment_type_code,
    ROUND(COALESCE(o.total, 0), 4) AS current_total,
    ROUND(COALESCE(o.outstanding_amount, 0), 4) AS current_outstanding_amount,
    ROUND(COALESCE(o.gift_card_applied_amount, 0), 4) AS header_gift_card_amount,
    ROUND(COALESCE(gc.gift_card_credit_amount, 0), 4) AS gift_card_credit_amount,
    ROUND(COALESCE(p.total_paid_amount, 0), 4) AS total_paid_amount,
    ROUND(COALESCE(c.total_credit_applied_amount, 0), 4) AS total_credit_applied_amount,
    ROUND(COALESCE(r.total_refunded_amount, 0), 4) AS total_refunded_amount,
    ROUND(
      COALESCE(o.subtotal, 0)
      + COALESCE(ch.total_charges_amount, 0)
      - COALESCE(d.total_discount_amount, 0)
      + COALESCE(t.total_tax_amount, 0)
      + COALESCE(o.rounding_adjustment_amount, 0),
      4
    ) AS expected_sale_total,
    ROUND(COALESCE(p.change_returned_amount, 0), 4) AS change_returned_amount
  FROM public.org_orders_mst o
  LEFT JOIN charge_totals ch
    ON ch.tenant_org_id = o.tenant_org_id
   AND ch.order_id = o.id
  LEFT JOIN discount_totals d
    ON d.tenant_org_id = o.tenant_org_id
   AND d.order_id = o.id
  LEFT JOIN tax_totals t
    ON t.tenant_org_id = o.tenant_org_id
   AND t.order_id = o.id
  LEFT JOIN payment_totals p
    ON p.tenant_org_id = o.tenant_org_id
   AND p.order_id = o.id
  LEFT JOIN credit_totals c
    ON c.tenant_org_id = o.tenant_org_id
   AND c.order_id = o.id
  LEFT JOIN gift_card_credit_totals gc
    ON gc.tenant_org_id = o.tenant_org_id
   AND gc.order_id = o.id
  LEFT JOIN refund_totals r
    ON r.tenant_org_id = o.tenant_org_id
   AND r.order_id = o.id
  WHERE COALESCE(o.rec_status, 1) = 1
    AND COALESCE(o.gift_card_applied_amount, 0) > 0
    AND COALESCE(gc.gift_card_credit_amount, 0) > 0
),
candidate_orders AS (
  SELECT
    *,
    ROUND(
      GREATEST(0, expected_sale_total - total_paid_amount - total_credit_applied_amount + total_refunded_amount),
      4
    ) AS expected_outstanding_amount,
    ROUND(
      GREATEST(0, expected_sale_total - total_credit_applied_amount),
      4
    ) AS expected_net_receivable_amount
  FROM recomputed
  WHERE expected_sale_total > current_total
    AND ABS((current_total + header_gift_card_amount) - expected_sale_total) <= 0.0001
    AND ABS(gift_card_credit_amount - header_gift_card_amount) <= 0.0001
)
SELECT
  tenant_org_id,
  id AS order_id,
  order_no,
  current_total,
  expected_sale_total,
  header_gift_card_amount,
  total_paid_amount,
  total_credit_applied_amount,
  current_outstanding_amount,
  expected_outstanding_amount,
  expected_net_receivable_amount
FROM candidate_orders
ORDER BY order_no;

-- -----------------------------------------------------------------------------
-- Preview 2: known order example from the investigation
-- -----------------------------------------------------------------------------
WITH invoice_rows AS (
  SELECT
    io.order_id,
    MAX(inv.invoice_no) AS invoice_no,
    MAX(inv.status) AS invoice_status,
    MAX(inv.outstanding_amount) AS invoice_outstanding_amount
  FROM public.org_invoice_orders_dtl io
  JOIN public.org_invoice_mst inv
    ON inv.id = io.invoice_id
  GROUP BY io.order_id
)
SELECT
  o.id AS order_id,
  o.order_no,
  o.total,
  o.total_paid_amount,
  o.total_credit_applied_amount,
  o.outstanding_amount,
  o.net_receivable_amount,
  o.gift_card_applied_amount,
  i.invoice_no,
  i.invoice_status,
  i.invoice_outstanding_amount
FROM public.org_orders_mst o
LEFT JOIN invoice_rows i
  ON i.order_id = o.id
WHERE o.id = '4a64e48e-d29e-45e0-9671-2dcd6a9d3c5e';

-- -----------------------------------------------------------------------------
-- Repair update: only the candidate rows identified above
-- -----------------------------------------------------------------------------
WITH charge_totals AS (
  SELECT
    tenant_org_id,
    order_id,
    ROUND(COALESCE(SUM(amount), 0), 4) AS total_charges_amount
  FROM public.org_order_charges_dtl
  WHERE is_voided = FALSE
  GROUP BY tenant_org_id, order_id
),
discount_totals AS (
  SELECT
    tenant_org_id,
    order_id,
    ROUND(COALESCE(SUM(discount_amount), 0), 4) AS total_discount_amount
  FROM public.org_order_discounts_dtl
  WHERE is_voided = FALSE
  GROUP BY tenant_org_id, order_id
),
tax_totals AS (
  SELECT
    tenant_org_id,
    order_id,
    ROUND(COALESCE(SUM(tax_amount), 0), 4) AS total_tax_amount
  FROM public.org_order_taxes_dtl
  WHERE rec_status = 1
  GROUP BY tenant_org_id, order_id
),
payment_totals AS (
  SELECT
    tenant_org_id,
    order_id,
    ROUND(
      COALESCE(SUM(CASE WHEN payment_status = 'COMPLETED' THEN amount ELSE 0 END), 0),
      4
    ) AS total_paid_amount,
    ROUND(
      COALESCE(SUM(CASE WHEN payment_status = 'COMPLETED' THEN change_returned_amount ELSE 0 END), 0),
      4
    ) AS change_returned_amount
  FROM public.org_order_payments_dtl
  WHERE is_active = TRUE
  GROUP BY tenant_org_id, order_id
),
credit_totals AS (
  SELECT
    tenant_org_id,
    order_id,
    ROUND(COALESCE(SUM(applied_amount), 0), 4) AS total_credit_applied_amount
  FROM public.org_order_credit_apps_dtl
  WHERE is_active = TRUE
  GROUP BY tenant_org_id, order_id
),
gift_card_credit_totals AS (
  SELECT
    tenant_org_id,
    order_id,
    ROUND(COALESCE(SUM(applied_amount), 0), 4) AS gift_card_credit_amount
  FROM public.org_order_credit_apps_dtl
  WHERE is_active = TRUE
    AND credit_type = 'GIFT_CARD'
  GROUP BY tenant_org_id, order_id
),
refund_totals AS (
  SELECT
    tenant_org_id,
    order_id,
    ROUND(COALESCE(SUM(refund_amount), 0), 4) AS total_refunded_amount
  FROM public.org_order_refunds_dtl
  WHERE is_active = TRUE
    AND refund_status = 'PROCESSED'
  GROUP BY tenant_org_id, order_id
),
candidate_orders AS (
  SELECT
    o.tenant_org_id,
    o.id,
    o.payment_type_code,
    ROUND(
      COALESCE(o.subtotal, 0)
      + COALESCE(ch.total_charges_amount, 0)
      - COALESCE(d.total_discount_amount, 0)
      + COALESCE(t.total_tax_amount, 0)
      + COALESCE(o.rounding_adjustment_amount, 0),
      4
    ) AS expected_sale_total,
    ROUND(COALESCE(ch.total_charges_amount, 0), 4) AS total_charges_amount,
    ROUND(COALESCE(d.total_discount_amount, 0), 4) AS total_discount_amount,
    ROUND(COALESCE(t.total_tax_amount, 0), 4) AS total_tax_amount,
    ROUND(COALESCE(p.total_paid_amount, 0), 4) AS total_paid_amount,
    ROUND(COALESCE(c.total_credit_applied_amount, 0), 4) AS total_credit_applied_amount,
    ROUND(COALESCE(r.total_refunded_amount, 0), 4) AS total_refunded_amount,
    ROUND(COALESCE(p.change_returned_amount, 0), 4) AS change_returned_amount
  FROM public.org_orders_mst o
  LEFT JOIN charge_totals ch
    ON ch.tenant_org_id = o.tenant_org_id
   AND ch.order_id = o.id
  LEFT JOIN discount_totals d
    ON d.tenant_org_id = o.tenant_org_id
   AND d.order_id = o.id
  LEFT JOIN tax_totals t
    ON t.tenant_org_id = o.tenant_org_id
   AND t.order_id = o.id
  LEFT JOIN payment_totals p
    ON p.tenant_org_id = o.tenant_org_id
   AND p.order_id = o.id
  LEFT JOIN credit_totals c
    ON c.tenant_org_id = o.tenant_org_id
   AND c.order_id = o.id
  LEFT JOIN gift_card_credit_totals gc
    ON gc.tenant_org_id = o.tenant_org_id
   AND gc.order_id = o.id
  LEFT JOIN refund_totals r
    ON r.tenant_org_id = o.tenant_org_id
   AND r.order_id = o.id
  WHERE COALESCE(o.rec_status, 1) = 1
    AND COALESCE(o.gift_card_applied_amount, 0) > 0
    AND COALESCE(gc.gift_card_credit_amount, 0) > 0
    AND ROUND(
      COALESCE(o.subtotal, 0)
      + COALESCE(ch.total_charges_amount, 0)
      - COALESCE(d.total_discount_amount, 0)
      + COALESCE(t.total_tax_amount, 0)
      + COALESCE(o.rounding_adjustment_amount, 0),
      4
    ) > ROUND(COALESCE(o.total, 0), 4)
    AND ABS(
      (
        ROUND(COALESCE(o.total, 0), 4)
        + ROUND(COALESCE(o.gift_card_applied_amount, 0), 4)
      ) - ROUND(
        COALESCE(o.subtotal, 0)
        + COALESCE(ch.total_charges_amount, 0)
        - COALESCE(d.total_discount_amount, 0)
        + COALESCE(t.total_tax_amount, 0)
        + COALESCE(o.rounding_adjustment_amount, 0),
        4
      )
    ) <= 0.0001
    AND ABS(
      ROUND(COALESCE(gc.gift_card_credit_amount, 0), 4)
      - ROUND(COALESCE(o.gift_card_applied_amount, 0), 4)
    ) <= 0.0001
)
UPDATE public.org_orders_mst o
SET
  total = c.expected_sale_total,
  total_charges_amount = c.total_charges_amount,
  total_discount_amount = c.total_discount_amount,
  total_tax_amount = c.total_tax_amount,
  total_paid_amount = c.total_paid_amount,
  total_credit_applied_amount = c.total_credit_applied_amount,
  net_receivable_amount = ROUND(GREATEST(0, c.expected_sale_total - c.total_credit_applied_amount), 4),
  outstanding_amount = ROUND(
    GREATEST(0, c.expected_sale_total - c.total_paid_amount - c.total_credit_applied_amount + c.total_refunded_amount),
    4
  ),
  payment_status = CASE
    WHEN ROUND(
      GREATEST(0, c.expected_sale_total - c.total_paid_amount - c.total_credit_applied_amount + c.total_refunded_amount),
      4
    ) <= 0
      AND ROUND(c.total_paid_amount + c.total_credit_applied_amount - c.total_refunded_amount, 4) > c.expected_sale_total
      THEN 'OVERPAID'
    WHEN ROUND(
      GREATEST(0, c.expected_sale_total - c.total_paid_amount - c.total_credit_applied_amount + c.total_refunded_amount),
      4
    ) <= 0
      AND ROUND(c.total_paid_amount + c.total_credit_applied_amount - c.total_refunded_amount, 4) > 0
      THEN 'PAID'
    WHEN ROUND(c.total_paid_amount + c.total_credit_applied_amount - c.total_refunded_amount, 4) > 0
      THEN 'PARTIALLY_PAID'
    WHEN c.payment_type_code = 'PAY_ON_COLLECTION'
      THEN 'PENDING_COLLECTION'
    ELSE 'UNPAID'
  END,
  pay_on_collection_amount = CASE
    WHEN c.payment_type_code = 'PAY_ON_COLLECTION'
      THEN NULLIF(
        ROUND(
          GREATEST(0, c.expected_sale_total - c.total_paid_amount - c.total_credit_applied_amount + c.total_refunded_amount),
          4
        ),
        0
      )
    ELSE NULL
  END,
  change_returned_amount = CASE
    WHEN c.change_returned_amount > 0 THEN c.change_returned_amount
    ELSE NULL
  END,
  financial_engine_version = 2,
  updated_at = NOW()
FROM candidate_orders c
WHERE o.tenant_org_id = c.tenant_org_id
  AND o.id = c.id;

-- -----------------------------------------------------------------------------
-- Verification: order header vs AR invoice outstanding after repair
-- -----------------------------------------------------------------------------
WITH invoice_rows AS (
  SELECT
    io.order_id,
    MAX(inv.invoice_no) AS invoice_no,
    MAX(inv.status) AS invoice_status,
    MAX(inv.outstanding_amount) AS invoice_outstanding_amount
  FROM public.org_invoice_orders_dtl io
  JOIN public.org_invoice_mst inv
    ON inv.id = io.invoice_id
  GROUP BY io.order_id
)
SELECT
  o.id AS order_id,
  o.order_no,
  o.total,
  o.total_paid_amount,
  o.total_credit_applied_amount,
  o.outstanding_amount,
  o.net_receivable_amount,
  i.invoice_no,
  i.invoice_status,
  i.invoice_outstanding_amount,
  ROUND(ABS(COALESCE(i.invoice_outstanding_amount, 0) - COALESCE(o.outstanding_amount, 0)), 4) AS outstanding_delta
FROM public.org_orders_mst o
LEFT JOIN invoice_rows i
  ON i.order_id = o.id
WHERE COALESCE(o.gift_card_applied_amount, 0) > 0
ORDER BY outstanding_delta DESC, o.order_no;
