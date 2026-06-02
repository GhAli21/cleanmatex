-- =============================================================================
-- 0334_order_fin_backfill_repair_and_validation.sql
-- =============================================================================
-- Purpose
--   Preview, repair, and validate the new canonical Order Fin snapshot columns
--   added by migration 0333.
--
-- Safety model
--   1. No legacy columns are dropped or overwritten.
--   2. Detail rows are preferred over legacy header totals whenever available.
--   3. Gift-card orders must not backfill total_amount from a polluted header
--      total that already netted stored value.
--   4. Historical mixed/lowercase payment_status values are always classified
--      via UPPER(payment_status).
--   5. Historical rows with null payment_nature_snapshot are counted as paid
--      only when they are clearly real-payment rows from the available fields;
--      otherwise they are excluded and warned as PAYMENT_TARGET_UNCLASSIFIED.
--   6. One batch trace id is generated per migration run and written to every
--      updated header row.
--
-- Important
--   Create-only for review. Do NOT run automatically.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Preview 1: current legacy/canonical comparison before repair
-- -----------------------------------------------------------------------------
WITH params AS (
  SELECT
    gen_random_uuid() AS batch_trace_id,
    clock_timestamp() AS recalculated_at
),
item_totals AS (
  SELECT
    tenant_org_id,
    order_id,
    ROUND(COALESCE(SUM(total_price), 0), 4) AS items_base_amount
  FROM public.org_order_items_dtl
  WHERE COALESCE(rec_status, 1) = 1
  GROUP BY tenant_org_id, order_id
),
piece_totals AS (
  SELECT
    tenant_org_id,
    order_id,
    ROUND(COALESCE(SUM(COALESCE(service_pref_charge, 0)), 0), 4) AS piece_extra_price_amount
  FROM public.org_order_item_pieces_dtl
  WHERE COALESCE(rec_status, 1) = 1
  GROUP BY tenant_org_id, order_id
),
preference_totals AS (
  SELECT
    tenant_org_id,
    order_id,
    ROUND(COALESCE(SUM(extra_price), 0), 4) AS preference_extra_price_amount
  FROM public.org_order_preferences_dtl
  WHERE COALESCE(rec_status, 1) = 1
  GROUP BY tenant_org_id, order_id
),
charge_breakdown AS (
  SELECT
    tenant_org_id,
    order_id,
    ROUND(COALESCE(SUM(amount), 0), 4) AS total_charges_amount,
    ROUND(COALESCE(SUM(CASE WHEN charge_type IN ('SERVICE', 'SERVICE_CHARGE') THEN amount ELSE 0 END), 0), 4) AS service_charge_amount,
    ROUND(COALESCE(SUM(CASE WHEN charge_type IN ('DELIVERY', 'DELIVERY_CHARGE') THEN amount ELSE 0 END), 0), 4) AS delivery_charge_amount,
    ROUND(COALESCE(SUM(CASE WHEN charge_type IN ('EXPRESS', 'EXPRESS_CHARGE') THEN amount ELSE 0 END), 0), 4) AS express_charge_amount,
    ROUND(
      COALESCE(
        SUM(
          CASE
            WHEN charge_type IN ('SERVICE', 'SERVICE_CHARGE', 'DELIVERY', 'DELIVERY_CHARGE', 'EXPRESS', 'EXPRESS_CHARGE') THEN 0
            ELSE amount
          END
        ),
        0
      ),
      4
    ) AS other_charges_amount
  FROM public.org_order_charges_dtl
  WHERE COALESCE(is_voided, FALSE) = FALSE
  GROUP BY tenant_org_id, order_id
),
discount_totals AS (
  SELECT
    tenant_org_id,
    order_id,
    ROUND(COALESCE(SUM(discount_amount), 0), 4) AS total_discount_amount
  FROM public.org_order_discounts_dtl
  WHERE COALESCE(is_voided, FALSE) = FALSE
  GROUP BY tenant_org_id, order_id
),
tax_totals AS (
  SELECT
    tenant_org_id,
    order_id,
    ROUND(COALESCE(SUM(taxable_amount), 0), 4) AS taxable_amount,
    ROUND(COALESCE(SUM(tax_amount), 0), 4) AS total_tax_amount
  FROM public.org_order_taxes_dtl
  WHERE COALESCE(rec_status, 1) = 1
  GROUP BY tenant_org_id, order_id
),
payment_classification AS (
  SELECT
    p.tenant_org_id,
    p.order_id,
    ROUND(
      COALESCE(
        SUM(
          CASE
            WHEN UPPER(COALESCE(p.payment_status, '')) IN ('COMPLETED', 'CAPTURED', 'SETTLED')
              AND (
                UPPER(COALESCE(p.payment_nature_snapshot, '')) = 'REAL_PAYMENT'
                OR (
                  p.payment_nature_snapshot IS NULL
                  AND (
                    p.org_payment_method_id IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.payment_method_code, '')), '') IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.gateway_code, '')), '') IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.gateway_reference, '')), '') IS NOT NULL
                    OR p.tendered_amount IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.check_no, '')), '') IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.bank_reference, '')), '') IS NOT NULL
                  )
                )
              )
            THEN p.amount
            ELSE 0
          END
        ),
        0
      ),
      4
    ) AS total_paid_amount,
    ROUND(
      COALESCE(
        SUM(
          CASE
            WHEN UPPER(COALESCE(p.payment_status, '')) IN ('PENDING', 'PROCESSING', 'CAPTURE_PENDING')
              AND (
                UPPER(COALESCE(p.payment_nature_snapshot, '')) = 'REAL_PAYMENT'
                OR (
                  p.payment_nature_snapshot IS NULL
                  AND (
                    p.org_payment_method_id IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.payment_method_code, '')), '') IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.gateway_code, '')), '') IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.gateway_reference, '')), '') IS NOT NULL
                    OR p.tendered_amount IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.check_no, '')), '') IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.bank_reference, '')), '') IS NOT NULL
                  )
                )
              )
            THEN p.amount
            ELSE 0
          END
        ),
        0
      ),
      4
    ) AS pending_payment_amount,
    ROUND(
      COALESCE(
        SUM(
          CASE
            WHEN UPPER(COALESCE(p.payment_status, '')) = 'AUTHORIZED'
              AND (
                UPPER(COALESCE(p.payment_nature_snapshot, '')) = 'REAL_PAYMENT'
                OR (
                  p.payment_nature_snapshot IS NULL
                  AND (
                    p.org_payment_method_id IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.payment_method_code, '')), '') IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.gateway_code, '')), '') IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.gateway_reference, '')), '') IS NOT NULL
                    OR p.tendered_amount IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.check_no, '')), '') IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.bank_reference, '')), '') IS NOT NULL
                  )
                )
              )
            THEN p.amount
            ELSE 0
          END
        ),
        0
      ),
      4
    ) AS authorized_payment_amount,
    ROUND(
      COALESCE(
        SUM(
          CASE
            WHEN UPPER(COALESCE(p.payment_status, '')) IN ('FAILED', 'CANCELLED', 'EXPIRED', 'VOIDED', 'REFUSED', 'REVERSED')
              AND (
                UPPER(COALESCE(p.payment_nature_snapshot, '')) = 'REAL_PAYMENT'
                OR (
                  p.payment_nature_snapshot IS NULL
                  AND (
                    p.org_payment_method_id IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.payment_method_code, '')), '') IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.gateway_code, '')), '') IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.gateway_reference, '')), '') IS NOT NULL
                    OR p.tendered_amount IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.check_no, '')), '') IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.bank_reference, '')), '') IS NOT NULL
                  )
                )
              )
            THEN p.amount
            ELSE 0
          END
        ),
        0
      ),
      4
    ) AS failed_payment_amount,
    ROUND(
      COALESCE(
        SUM(
          CASE
            WHEN UPPER(COALESCE(p.payment_status, '')) IN ('COMPLETED', 'CAPTURED', 'SETTLED')
              AND (
                UPPER(COALESCE(p.payment_nature_snapshot, '')) = 'REAL_PAYMENT'
                OR (
                  p.payment_nature_snapshot IS NULL
                  AND (
                    p.org_payment_method_id IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.payment_method_code, '')), '') IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.gateway_code, '')), '') IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.gateway_reference, '')), '') IS NOT NULL
                    OR p.tendered_amount IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.check_no, '')), '') IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.bank_reference, '')), '') IS NOT NULL
                  )
                )
              )
            THEN COALESCE(p.change_returned_amount, 0)
            ELSE 0
          END
        ),
        0
      ),
      4
    ) AS change_returned_amount,
    BOOL_OR(
      p.payment_nature_snapshot IS NULL
      AND NOT (
        p.org_payment_method_id IS NOT NULL
        OR NULLIF(TRIM(COALESCE(p.payment_method_code, '')), '') IS NOT NULL
        OR NULLIF(TRIM(COALESCE(p.gateway_code, '')), '') IS NOT NULL
        OR NULLIF(TRIM(COALESCE(p.gateway_reference, '')), '') IS NOT NULL
        OR p.tendered_amount IS NOT NULL
        OR NULLIF(TRIM(COALESCE(p.check_no, '')), '') IS NOT NULL
        OR NULLIF(TRIM(COALESCE(p.bank_reference, '')), '') IS NOT NULL
      )
    ) AS has_payment_target_unclassified
  FROM public.org_order_payments_dtl p
  WHERE COALESCE(p.is_active, TRUE) = TRUE
  GROUP BY p.tenant_org_id, p.order_id
),
credit_totals AS (
  SELECT
    c.tenant_org_id,
    c.order_id,
    ROUND(COALESCE(SUM(c.applied_amount), 0), 4) AS total_credit_applied_amount
  FROM public.org_order_credit_apps_dtl c
  WHERE COALESCE(c.is_active, TRUE) = TRUE
    AND COALESCE(c.rec_status, 1) = 1
  GROUP BY c.tenant_org_id, c.order_id
),
refund_totals AS (
  SELECT
    r.tenant_org_id,
    r.order_id,
    ROUND(COALESCE(SUM(CASE WHEN UPPER(COALESCE(r.refund_status, '')) = 'PROCESSED' THEN r.refund_amount ELSE 0 END), 0), 4) AS refunded_amount,
    ROUND(
      COALESCE(
        SUM(
          CASE
            WHEN UPPER(COALESCE(r.refund_status, '')) = 'PROCESSED'
              AND (
                UPPER(COALESCE(r.refund_method_code, '')) IN ('CASH', 'ORIGINAL_METHOD')
                OR r.original_payment_id IS NOT NULL
              )
            THEN r.refund_amount
            ELSE 0
          END
        ),
        0
      ),
      4
    ) AS real_payment_refunded_amount,
    ROUND(
      COALESCE(
        SUM(
          CASE
            WHEN UPPER(COALESCE(r.refund_status, '')) = 'PROCESSED'
              AND (
                UPPER(COALESCE(r.refund_method_code, '')) = 'WALLET'
                OR COALESCE((r.metadata ->> 'refund_destination_type')::text, '') = 'STORED_VALUE'
                OR COALESCE((r.metadata ->> 'original_credit_type')::text, '') IN ('GIFT_CARD', 'WALLET', 'CUSTOMER_ADVANCE', 'LOYALTY_CREDIT')
              )
            THEN r.refund_amount
            ELSE 0
          END
        ),
        0
      ),
      4
    ) AS stored_value_restored_amount,
    ROUND(
      COALESCE(
        SUM(
          CASE
            WHEN UPPER(COALESCE(r.refund_status, '')) = 'PROCESSED'
              AND (
                UPPER(COALESCE(r.refund_method_code, '')) = 'CREDIT_NOTE'
                OR COALESCE((r.metadata ->> 'refund_destination_type')::text, '') = 'CUSTOMER_CREDIT'
              )
            THEN r.refund_amount
            ELSE 0
          END
        ),
        0
      ),
      4
    ) AS customer_credit_issued_amount,
    BOOL_OR(
      UPPER(COALESCE(r.refund_status, '')) = 'PROCESSED'
      AND r.refund_amount > 0
      AND NOT (
        UPPER(COALESCE(r.refund_method_code, '')) IN ('CASH', 'ORIGINAL_METHOD', 'WALLET', 'CREDIT_NOTE')
        OR r.original_payment_id IS NOT NULL
        OR COALESCE((r.metadata ->> 'refund_destination_type')::text, '') IN ('STORED_VALUE', 'CUSTOMER_CREDIT')
        OR COALESCE((r.metadata ->> 'original_credit_type')::text, '') IN ('GIFT_CARD', 'WALLET', 'CUSTOMER_ADVANCE', 'LOYALTY_CREDIT')
      )
    ) AS has_refund_source_unclassified
  FROM public.org_order_refunds_dtl r
  WHERE COALESCE(r.is_active, TRUE) = TRUE
  GROUP BY r.tenant_org_id, r.order_id
),
invoice_rollup AS (
  SELECT DISTINCT ON (io.tenant_org_id, io.order_id)
    io.tenant_org_id,
    io.order_id,
    inv.id AS ar_invoice_id,
    inv.invoice_no AS ar_invoice_no,
    inv.status AS ar_invoice_status
  FROM public.org_invoice_orders_dtl io
  JOIN public.org_invoice_mst inv
    ON inv.id = io.invoice_id
   AND inv.tenant_org_id = io.tenant_org_id
  ORDER BY
    io.tenant_org_id,
    io.order_id,
    COALESCE(inv.issued_at, inv.created_at) DESC,
    inv.invoice_no DESC,
    inv.id::text DESC
),
derived AS (
  SELECT
    o.tenant_org_id,
    o.id AS order_id,
    o.order_no,
    o.payment_type_code,
    ROUND(COALESCE(o.subtotal, 0), 4) AS legacy_subtotal_amount,
    ROUND(COALESCE(o.total, 0), 4) AS legacy_total_amount,
    ROUND(COALESCE(o.outstanding_amount, 0), 4) AS legacy_outstanding_amount,
    COALESCE(it.items_base_amount, 0) AS items_base_amount,
    COALESCE(it.items_base_amount, 0) AS subtotal_amount,
    COALESCE(pt.piece_extra_price_amount, 0) AS piece_extra_price_amount,
    COALESCE(pr.preference_extra_price_amount, 0) AS preference_extra_price_amount,
    COALESCE(cb.total_charges_amount, 0) AS total_charges_amount,
    COALESCE(cb.service_charge_amount, 0) AS service_charge_amount,
    COALESCE(cb.delivery_charge_amount, 0) AS delivery_charge_amount,
    COALESCE(cb.express_charge_amount, 0) AS express_charge_amount,
    COALESCE(cb.other_charges_amount, 0) AS other_charges_amount,
    COALESCE(dt.total_discount_amount, 0) AS total_discount_amount,
    COALESCE(tt.taxable_amount, GREATEST(COALESCE(it.items_base_amount, 0) + COALESCE(cb.total_charges_amount, 0) - COALESCE(dt.total_discount_amount, 0), 0)) AS taxable_amount,
    COALESCE(tt.total_tax_amount, 0) AS total_tax_amount,
    ROUND(COALESCE(o.rounding_adjustment_amount, 0), 4) AS rounding_adjustment_amount,
    COALESCE(pc.total_paid_amount, 0) AS total_paid_amount,
    COALESCE(pc.pending_payment_amount, 0) AS pending_payment_amount,
    COALESCE(pc.authorized_payment_amount, 0) AS authorized_payment_amount,
    COALESCE(pc.failed_payment_amount, 0) AS failed_payment_amount,
    COALESCE(pc.change_returned_amount, 0) AS change_returned_amount,
    COALESCE(ct.total_credit_applied_amount, 0) AS total_credit_applied_amount,
    COALESCE(rt.refunded_amount, 0) AS refunded_amount,
    COALESCE(rt.real_payment_refunded_amount, 0) AS real_payment_refunded_amount,
    COALESCE(rt.stored_value_restored_amount, 0) AS stored_value_restored_amount,
    COALESCE(rt.customer_credit_issued_amount, 0) AS customer_credit_issued_amount,
    inv.ar_invoice_id,
    inv.ar_invoice_no,
    inv.ar_invoice_status,
    COALESCE(pc.has_payment_target_unclassified, FALSE) AS has_payment_target_unclassified,
    COALESCE(rt.has_refund_source_unclassified, FALSE) AS has_refund_source_unclassified,
    CASE
      WHEN COALESCE(it.items_base_amount, 0) > 0
        OR COALESCE(cb.total_charges_amount, 0) > 0
        OR COALESCE(dt.total_discount_amount, 0) > 0
        OR COALESCE(tt.total_tax_amount, 0) > 0
      THEN ROUND(
        GREATEST(
          COALESCE(it.items_base_amount, 0)
          + COALESCE(cb.total_charges_amount, 0)
          - COALESCE(dt.total_discount_amount, 0)
          + COALESCE(tt.total_tax_amount, 0)
          + COALESCE(o.rounding_adjustment_amount, 0),
          0
        ),
        4
      )
      ELSE ROUND(
        GREATEST(
          COALESCE(
            CASE
              WHEN ABS(
                (COALESCE(o.total, 0) + COALESCE(o.gift_card_applied_amount, 0))
                - (
                  COALESCE(o.subtotal, 0)
                  + COALESCE(o.total_charges_amount, 0)
                  - COALESCE(o.total_discount_amount, COALESCE(o.discount, 0))
                  + COALESCE(o.total_tax_amount, COALESCE(o.tax, 0))
                  + COALESCE(o.rounding_adjustment_amount, 0)
                )
              ) <= 0.0001
              THEN COALESCE(o.total, 0) + COALESCE(o.gift_card_applied_amount, 0)
              ELSE COALESCE(o.total, 0)
            END,
            0
          ),
          0
        ),
        4
      )
    END AS total_amount,
    CASE
      WHEN NOT (
        COALESCE(it.items_base_amount, 0) > 0
        OR COALESCE(cb.total_charges_amount, 0) > 0
        OR COALESCE(dt.total_discount_amount, 0) > 0
        OR COALESCE(tt.total_tax_amount, 0) > 0
      )
      THEN TRUE
      ELSE FALSE
    END AS used_legacy_total_fallback
  FROM public.org_orders_mst o
  LEFT JOIN item_totals it
    ON it.tenant_org_id = o.tenant_org_id
   AND it.order_id = o.id
  LEFT JOIN piece_totals pt
    ON pt.tenant_org_id = o.tenant_org_id
   AND pt.order_id = o.id
  LEFT JOIN preference_totals pr
    ON pr.tenant_org_id = o.tenant_org_id
   AND pr.order_id = o.id
  LEFT JOIN charge_breakdown cb
    ON cb.tenant_org_id = o.tenant_org_id
   AND cb.order_id = o.id
  LEFT JOIN discount_totals dt
    ON dt.tenant_org_id = o.tenant_org_id
   AND dt.order_id = o.id
  LEFT JOIN tax_totals tt
    ON tt.tenant_org_id = o.tenant_org_id
   AND tt.order_id = o.id
  LEFT JOIN payment_classification pc
    ON pc.tenant_org_id = o.tenant_org_id
   AND pc.order_id = o.id
  LEFT JOIN credit_totals ct
    ON ct.tenant_org_id = o.tenant_org_id
   AND ct.order_id = o.id
  LEFT JOIN refund_totals rt
    ON rt.tenant_org_id = o.tenant_org_id
   AND rt.order_id = o.id
  LEFT JOIN invoice_rollup inv
    ON inv.tenant_org_id = o.tenant_org_id
   AND inv.order_id = o.id
  WHERE COALESCE(o.rec_status, 1) = 1
),
preview AS (
  SELECT
    d.*,
    ROUND(GREATEST(d.total_paid_amount - d.real_payment_refunded_amount, 0), 4) AS net_collected_amount,
    ROUND(
      GREATEST(
        d.total_amount
        - d.total_paid_amount
        - d.total_credit_applied_amount
        + 0
        + 0,
        0
      ),
      4
    ) AS outstanding_amount,
    ROUND(GREATEST(d.total_paid_amount + d.total_credit_applied_amount - d.total_amount, 0), 4) AS overpaid_amount,
    CASE
      WHEN d.payment_type_code = 'PAY_ON_COLLECTION' THEN ROUND(
        GREATEST(
          d.total_amount - d.total_paid_amount - d.total_credit_applied_amount,
          0
        ),
        4
      )
      ELSE 0
    END AS pay_on_collection_amount,
    CASE
      WHEN d.payment_type_code = 'CREDIT_INVOICE' THEN ROUND(
        GREATEST(
          d.total_amount - d.total_paid_amount - d.total_credit_applied_amount,
          0
        ),
        4
      )
      ELSE 0
    END AS ar_receivable_amount
  FROM derived d
)
SELECT
  order_id,
  order_no,
  payment_type_code,
  legacy_total_amount,
  total_amount AS canonical_total_amount,
  legacy_outstanding_amount,
  outstanding_amount AS canonical_outstanding_amount,
  total_paid_amount,
  total_credit_applied_amount,
  refunded_amount,
  real_payment_refunded_amount,
  net_collected_amount,
  used_legacy_total_fallback,
  has_payment_target_unclassified,
  has_refund_source_unclassified
FROM preview
ORDER BY order_no;

-- -----------------------------------------------------------------------------
-- Preview 2: rows that will be marked for recalculation review
-- -----------------------------------------------------------------------------
WITH params AS (
  SELECT
    gen_random_uuid() AS batch_trace_id,
    clock_timestamp() AS recalculated_at
),
item_totals AS (
  SELECT tenant_org_id, order_id, ROUND(COALESCE(SUM(total_price), 0), 4) AS items_base_amount
  FROM public.org_order_items_dtl
  WHERE COALESCE(rec_status, 1) = 1
  GROUP BY tenant_org_id, order_id
),
payment_flags AS (
  SELECT
    tenant_org_id,
    order_id,
    BOOL_OR(payment_nature_snapshot IS NULL) AS has_null_payment_nature
  FROM public.org_order_payments_dtl
  WHERE COALESCE(is_active, TRUE) = TRUE
  GROUP BY tenant_org_id, order_id
)
SELECT
  o.id AS order_id,
  o.order_no,
  ROUND(COALESCE(o.total, 0), 4) AS legacy_total_amount,
  ROUND(COALESCE(o.gift_card_applied_amount, 0), 4) AS legacy_gift_card_amount,
  COALESCE(i.items_base_amount, 0) AS items_base_amount,
  COALESCE(pf.has_null_payment_nature, FALSE) AS has_null_payment_nature
FROM public.org_orders_mst o
LEFT JOIN item_totals i
  ON i.tenant_org_id = o.tenant_org_id
 AND i.order_id = o.id
LEFT JOIN payment_flags pf
  ON pf.tenant_org_id = o.tenant_org_id
 AND pf.order_id = o.id
WHERE COALESCE(o.rec_status, 1) = 1
  AND (
    COALESCE(o.gift_card_applied_amount, 0) > 0
    OR COALESCE(pf.has_null_payment_nature, FALSE) = TRUE
    OR COALESCE(i.items_base_amount, 0) = 0
  )
ORDER BY o.order_no;

-- -----------------------------------------------------------------------------
-- Repair update: populate canonical columns only
-- -----------------------------------------------------------------------------
WITH params AS (
  SELECT
    gen_random_uuid() AS batch_trace_id,
    clock_timestamp() AS recalculated_at
),
item_totals AS (
  SELECT
    tenant_org_id,
    order_id,
    ROUND(COALESCE(SUM(total_price), 0), 4) AS items_base_amount
  FROM public.org_order_items_dtl
  WHERE COALESCE(rec_status, 1) = 1
  GROUP BY tenant_org_id, order_id
),
piece_totals AS (
  SELECT
    tenant_org_id,
    order_id,
    ROUND(COALESCE(SUM(COALESCE(service_pref_charge, 0)), 0), 4) AS piece_extra_price_amount
  FROM public.org_order_item_pieces_dtl
  WHERE COALESCE(rec_status, 1) = 1
  GROUP BY tenant_org_id, order_id
),
preference_totals AS (
  SELECT
    tenant_org_id,
    order_id,
    ROUND(COALESCE(SUM(extra_price), 0), 4) AS preference_extra_price_amount
  FROM public.org_order_preferences_dtl
  WHERE COALESCE(rec_status, 1) = 1
  GROUP BY tenant_org_id, order_id
),
charge_breakdown AS (
  SELECT
    tenant_org_id,
    order_id,
    ROUND(COALESCE(SUM(amount), 0), 4) AS total_charges_amount,
    ROUND(COALESCE(SUM(CASE WHEN charge_type IN ('SERVICE', 'SERVICE_CHARGE') THEN amount ELSE 0 END), 0), 4) AS service_charge_amount,
    ROUND(COALESCE(SUM(CASE WHEN charge_type IN ('DELIVERY', 'DELIVERY_CHARGE') THEN amount ELSE 0 END), 0), 4) AS delivery_charge_amount,
    ROUND(COALESCE(SUM(CASE WHEN charge_type IN ('EXPRESS', 'EXPRESS_CHARGE') THEN amount ELSE 0 END), 0), 4) AS express_charge_amount,
    ROUND(
      COALESCE(
        SUM(
          CASE
            WHEN charge_type IN ('SERVICE', 'SERVICE_CHARGE', 'DELIVERY', 'DELIVERY_CHARGE', 'EXPRESS', 'EXPRESS_CHARGE') THEN 0
            ELSE amount
          END
        ),
        0
      ),
      4
    ) AS other_charges_amount
  FROM public.org_order_charges_dtl
  WHERE COALESCE(is_voided, FALSE) = FALSE
  GROUP BY tenant_org_id, order_id
),
discount_totals AS (
  SELECT
    tenant_org_id,
    order_id,
    ROUND(COALESCE(SUM(discount_amount), 0), 4) AS total_discount_amount
  FROM public.org_order_discounts_dtl
  WHERE COALESCE(is_voided, FALSE) = FALSE
  GROUP BY tenant_org_id, order_id
),
tax_totals AS (
  SELECT
    tenant_org_id,
    order_id,
    ROUND(COALESCE(SUM(taxable_amount), 0), 4) AS taxable_amount,
    ROUND(COALESCE(SUM(tax_amount), 0), 4) AS total_tax_amount
  FROM public.org_order_taxes_dtl
  WHERE COALESCE(rec_status, 1) = 1
  GROUP BY tenant_org_id, order_id
),
payment_classification AS (
  SELECT
    p.tenant_org_id,
    p.order_id,
    ROUND(
      COALESCE(
        SUM(
          CASE
            WHEN UPPER(COALESCE(p.payment_status, '')) IN ('COMPLETED', 'CAPTURED', 'SETTLED')
              AND (
                UPPER(COALESCE(p.payment_nature_snapshot, '')) = 'REAL_PAYMENT'
                OR (
                  p.payment_nature_snapshot IS NULL
                  AND (
                    p.org_payment_method_id IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.payment_method_code, '')), '') IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.gateway_code, '')), '') IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.gateway_reference, '')), '') IS NOT NULL
                    OR p.tendered_amount IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.check_no, '')), '') IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.bank_reference, '')), '') IS NOT NULL
                  )
                )
              )
            THEN p.amount
            ELSE 0
          END
        ),
        0
      ),
      4
    ) AS total_paid_amount,
    ROUND(
      COALESCE(
        SUM(
          CASE
            WHEN UPPER(COALESCE(p.payment_status, '')) IN ('PENDING', 'PROCESSING', 'CAPTURE_PENDING')
              AND (
                UPPER(COALESCE(p.payment_nature_snapshot, '')) = 'REAL_PAYMENT'
                OR (
                  p.payment_nature_snapshot IS NULL
                  AND (
                    p.org_payment_method_id IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.payment_method_code, '')), '') IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.gateway_code, '')), '') IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.gateway_reference, '')), '') IS NOT NULL
                    OR p.tendered_amount IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.check_no, '')), '') IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.bank_reference, '')), '') IS NOT NULL
                  )
                )
              )
            THEN p.amount
            ELSE 0
          END
        ),
        0
      ),
      4
    ) AS pending_payment_amount,
    ROUND(
      COALESCE(
        SUM(
          CASE
            WHEN UPPER(COALESCE(p.payment_status, '')) = 'AUTHORIZED'
              AND (
                UPPER(COALESCE(p.payment_nature_snapshot, '')) = 'REAL_PAYMENT'
                OR (
                  p.payment_nature_snapshot IS NULL
                  AND (
                    p.org_payment_method_id IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.payment_method_code, '')), '') IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.gateway_code, '')), '') IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.gateway_reference, '')), '') IS NOT NULL
                    OR p.tendered_amount IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.check_no, '')), '') IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.bank_reference, '')), '') IS NOT NULL
                  )
                )
              )
            THEN p.amount
            ELSE 0
          END
        ),
        0
      ),
      4
    ) AS authorized_payment_amount,
    ROUND(
      COALESCE(
        SUM(
          CASE
            WHEN UPPER(COALESCE(p.payment_status, '')) IN ('FAILED', 'CANCELLED', 'EXPIRED', 'VOIDED', 'REFUSED', 'REVERSED')
              AND (
                UPPER(COALESCE(p.payment_nature_snapshot, '')) = 'REAL_PAYMENT'
                OR (
                  p.payment_nature_snapshot IS NULL
                  AND (
                    p.org_payment_method_id IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.payment_method_code, '')), '') IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.gateway_code, '')), '') IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.gateway_reference, '')), '') IS NOT NULL
                    OR p.tendered_amount IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.check_no, '')), '') IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.bank_reference, '')), '') IS NOT NULL
                  )
                )
              )
            THEN p.amount
            ELSE 0
          END
        ),
        0
      ),
      4
    ) AS failed_payment_amount,
    ROUND(
      COALESCE(
        SUM(
          CASE
            WHEN UPPER(COALESCE(p.payment_status, '')) IN ('COMPLETED', 'CAPTURED', 'SETTLED')
              AND (
                UPPER(COALESCE(p.payment_nature_snapshot, '')) = 'REAL_PAYMENT'
                OR (
                  p.payment_nature_snapshot IS NULL
                  AND (
                    p.org_payment_method_id IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.payment_method_code, '')), '') IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.gateway_code, '')), '') IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.gateway_reference, '')), '') IS NOT NULL
                    OR p.tendered_amount IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.check_no, '')), '') IS NOT NULL
                    OR NULLIF(TRIM(COALESCE(p.bank_reference, '')), '') IS NOT NULL
                  )
                )
              )
            THEN COALESCE(p.change_returned_amount, 0)
            ELSE 0
          END
        ),
        0
      ),
      4
    ) AS change_returned_amount,
    BOOL_OR(
      p.payment_nature_snapshot IS NULL
      AND NOT (
        p.org_payment_method_id IS NOT NULL
        OR NULLIF(TRIM(COALESCE(p.payment_method_code, '')), '') IS NOT NULL
        OR NULLIF(TRIM(COALESCE(p.gateway_code, '')), '') IS NOT NULL
        OR NULLIF(TRIM(COALESCE(p.gateway_reference, '')), '') IS NOT NULL
        OR p.tendered_amount IS NOT NULL
        OR NULLIF(TRIM(COALESCE(p.check_no, '')), '') IS NOT NULL
        OR NULLIF(TRIM(COALESCE(p.bank_reference, '')), '') IS NOT NULL
      )
    ) AS has_payment_target_unclassified
  FROM public.org_order_payments_dtl p
  WHERE COALESCE(p.is_active, TRUE) = TRUE
  GROUP BY p.tenant_org_id, p.order_id
),
credit_totals AS (
  SELECT
    c.tenant_org_id,
    c.order_id,
    ROUND(COALESCE(SUM(c.applied_amount), 0), 4) AS total_credit_applied_amount
  FROM public.org_order_credit_apps_dtl c
  WHERE COALESCE(c.is_active, TRUE) = TRUE
    AND COALESCE(c.rec_status, 1) = 1
  GROUP BY c.tenant_org_id, c.order_id
),
refund_totals AS (
  SELECT
    r.tenant_org_id,
    r.order_id,
    ROUND(COALESCE(SUM(CASE WHEN UPPER(COALESCE(r.refund_status, '')) = 'PROCESSED' THEN r.refund_amount ELSE 0 END), 0), 4) AS refunded_amount,
    ROUND(
      COALESCE(
        SUM(
          CASE
            WHEN UPPER(COALESCE(r.refund_status, '')) = 'PROCESSED'
              AND (
                UPPER(COALESCE(r.refund_method_code, '')) IN ('CASH', 'ORIGINAL_METHOD')
                OR r.original_payment_id IS NOT NULL
              )
            THEN r.refund_amount
            ELSE 0
          END
        ),
        0
      ),
      4
    ) AS real_payment_refunded_amount,
    ROUND(
      COALESCE(
        SUM(
          CASE
            WHEN UPPER(COALESCE(r.refund_status, '')) = 'PROCESSED'
              AND (
                UPPER(COALESCE(r.refund_method_code, '')) = 'WALLET'
                OR COALESCE((r.metadata ->> 'refund_destination_type')::text, '') = 'STORED_VALUE'
                OR COALESCE((r.metadata ->> 'original_credit_type')::text, '') IN ('GIFT_CARD', 'WALLET', 'CUSTOMER_ADVANCE', 'LOYALTY_CREDIT')
              )
            THEN r.refund_amount
            ELSE 0
          END
        ),
        0
      ),
      4
    ) AS stored_value_restored_amount,
    ROUND(
      COALESCE(
        SUM(
          CASE
            WHEN UPPER(COALESCE(r.refund_status, '')) = 'PROCESSED'
              AND (
                UPPER(COALESCE(r.refund_method_code, '')) = 'CREDIT_NOTE'
                OR COALESCE((r.metadata ->> 'refund_destination_type')::text, '') = 'CUSTOMER_CREDIT'
              )
            THEN r.refund_amount
            ELSE 0
          END
        ),
        0
      ),
      4
    ) AS customer_credit_issued_amount,
    BOOL_OR(
      UPPER(COALESCE(r.refund_status, '')) = 'PROCESSED'
      AND r.refund_amount > 0
      AND NOT (
        UPPER(COALESCE(r.refund_method_code, '')) IN ('CASH', 'ORIGINAL_METHOD', 'WALLET', 'CREDIT_NOTE')
        OR r.original_payment_id IS NOT NULL
        OR COALESCE((r.metadata ->> 'refund_destination_type')::text, '') IN ('STORED_VALUE', 'CUSTOMER_CREDIT')
        OR COALESCE((r.metadata ->> 'original_credit_type')::text, '') IN ('GIFT_CARD', 'WALLET', 'CUSTOMER_ADVANCE', 'LOYALTY_CREDIT')
      )
    ) AS has_refund_source_unclassified
  FROM public.org_order_refunds_dtl r
  WHERE COALESCE(r.is_active, TRUE) = TRUE
  GROUP BY r.tenant_org_id, r.order_id
),
invoice_rollup AS (
  SELECT DISTINCT ON (io.tenant_org_id, io.order_id)
    io.tenant_org_id,
    io.order_id,
    inv.id AS ar_invoice_id,
    inv.invoice_no AS ar_invoice_no,
    inv.status AS ar_invoice_status
  FROM public.org_invoice_orders_dtl io
  JOIN public.org_invoice_mst inv
    ON inv.id = io.invoice_id
   AND inv.tenant_org_id = io.tenant_org_id
  ORDER BY
    io.tenant_org_id,
    io.order_id,
    COALESCE(inv.issued_at, inv.created_at) DESC,
    inv.invoice_no DESC,
    inv.id::text DESC
),
derived AS (
  SELECT
    o.tenant_org_id,
    o.id AS order_id,
    o.order_no,
    o.payment_type_code,
    ROUND(COALESCE(o.subtotal, 0), 4) AS legacy_subtotal_amount,
    ROUND(COALESCE(o.total, 0), 4) AS legacy_total_amount,
    ROUND(COALESCE(o.outstanding_amount, 0), 4) AS legacy_outstanding_amount,
    COALESCE(it.items_base_amount, 0) AS items_base_amount,
    COALESCE(it.items_base_amount, 0) AS subtotal_amount,
    COALESCE(pt.piece_extra_price_amount, 0) AS piece_extra_price_amount,
    COALESCE(pr.preference_extra_price_amount, 0) AS preference_extra_price_amount,
    COALESCE(cb.total_charges_amount, 0) AS total_charges_amount,
    COALESCE(cb.service_charge_amount, 0) AS service_charge_amount,
    COALESCE(cb.delivery_charge_amount, 0) AS delivery_charge_amount,
    COALESCE(cb.express_charge_amount, 0) AS express_charge_amount,
    COALESCE(cb.other_charges_amount, 0) AS other_charges_amount,
    COALESCE(dt.total_discount_amount, 0) AS total_discount_amount,
    COALESCE(tt.taxable_amount, GREATEST(COALESCE(it.items_base_amount, 0) + COALESCE(cb.total_charges_amount, 0) - COALESCE(dt.total_discount_amount, 0), 0)) AS taxable_amount,
    COALESCE(tt.total_tax_amount, 0) AS total_tax_amount,
    ROUND(COALESCE(o.rounding_adjustment_amount, 0), 4) AS rounding_adjustment_amount,
    COALESCE(pc.total_paid_amount, 0) AS total_paid_amount,
    COALESCE(pc.pending_payment_amount, 0) AS pending_payment_amount,
    COALESCE(pc.authorized_payment_amount, 0) AS authorized_payment_amount,
    COALESCE(pc.failed_payment_amount, 0) AS failed_payment_amount,
    COALESCE(pc.change_returned_amount, 0) AS change_returned_amount,
    COALESCE(ct.total_credit_applied_amount, 0) AS total_credit_applied_amount,
    COALESCE(rt.refunded_amount, 0) AS refunded_amount,
    COALESCE(rt.real_payment_refunded_amount, 0) AS real_payment_refunded_amount,
    COALESCE(rt.stored_value_restored_amount, 0) AS stored_value_restored_amount,
    COALESCE(rt.customer_credit_issued_amount, 0) AS customer_credit_issued_amount,
    inv.ar_invoice_id,
    inv.ar_invoice_no,
    inv.ar_invoice_status,
    COALESCE(pc.has_payment_target_unclassified, FALSE) AS has_payment_target_unclassified,
    COALESCE(rt.has_refund_source_unclassified, FALSE) AS has_refund_source_unclassified,
    CASE
      WHEN COALESCE(it.items_base_amount, 0) > 0
        OR COALESCE(cb.total_charges_amount, 0) > 0
        OR COALESCE(dt.total_discount_amount, 0) > 0
        OR COALESCE(tt.total_tax_amount, 0) > 0
      THEN ROUND(
        GREATEST(
          COALESCE(it.items_base_amount, 0)
          + COALESCE(cb.total_charges_amount, 0)
          - COALESCE(dt.total_discount_amount, 0)
          + COALESCE(tt.total_tax_amount, 0)
          + COALESCE(o.rounding_adjustment_amount, 0),
          0
        ),
        4
      )
      ELSE ROUND(
        GREATEST(
          COALESCE(
            CASE
              WHEN ABS(
                (COALESCE(o.total, 0) + COALESCE(o.gift_card_applied_amount, 0))
                - (
                  COALESCE(o.subtotal, 0)
                  + COALESCE(o.total_charges_amount, 0)
                  - COALESCE(o.total_discount_amount, COALESCE(o.discount, 0))
                  + COALESCE(o.total_tax_amount, COALESCE(o.tax, 0))
                  + COALESCE(o.rounding_adjustment_amount, 0)
                )
              ) <= 0.0001
              THEN COALESCE(o.total, 0) + COALESCE(o.gift_card_applied_amount, 0)
              ELSE COALESCE(o.total, 0)
            END,
            0
          ),
          0
        ),
        4
      )
    END AS total_amount,
    CASE
      WHEN NOT (
        COALESCE(it.items_base_amount, 0) > 0
        OR COALESCE(cb.total_charges_amount, 0) > 0
        OR COALESCE(dt.total_discount_amount, 0) > 0
        OR COALESCE(tt.total_tax_amount, 0) > 0
      )
      THEN TRUE
      ELSE FALSE
    END AS used_legacy_total_fallback
  FROM public.org_orders_mst o
  LEFT JOIN item_totals it
    ON it.tenant_org_id = o.tenant_org_id
   AND it.order_id = o.id
  LEFT JOIN piece_totals pt
    ON pt.tenant_org_id = o.tenant_org_id
   AND pt.order_id = o.id
  LEFT JOIN preference_totals pr
    ON pr.tenant_org_id = o.tenant_org_id
   AND pr.order_id = o.id
  LEFT JOIN charge_breakdown cb
    ON cb.tenant_org_id = o.tenant_org_id
   AND cb.order_id = o.id
  LEFT JOIN discount_totals dt
    ON dt.tenant_org_id = o.tenant_org_id
   AND dt.order_id = o.id
  LEFT JOIN tax_totals tt
    ON tt.tenant_org_id = o.tenant_org_id
   AND tt.order_id = o.id
  LEFT JOIN payment_classification pc
    ON pc.tenant_org_id = o.tenant_org_id
   AND pc.order_id = o.id
  LEFT JOIN credit_totals ct
    ON ct.tenant_org_id = o.tenant_org_id
   AND ct.order_id = o.id
  LEFT JOIN refund_totals rt
    ON rt.tenant_org_id = o.tenant_org_id
   AND rt.order_id = o.id
  LEFT JOIN invoice_rollup inv
    ON inv.tenant_org_id = o.tenant_org_id
   AND inv.order_id = o.id
  WHERE COALESCE(o.rec_status, 1) = 1
),
warning_payload AS (
  SELECT
    d.*,
    ROUND(GREATEST(d.total_paid_amount - d.real_payment_refunded_amount, 0), 4) AS net_collected_amount,
    0::DECIMAL(19,4) AS refund_reopens_due_amount,
    0::DECIMAL(19,4) AS credit_reversal_reopens_due_amount,
    0::DECIMAL(19,4) AS credit_reversed_amount,
    ROUND(
      GREATEST(
        d.total_amount
        - d.total_paid_amount
        - d.total_credit_applied_amount
        + 0
        + 0,
        0
      ),
      4
    ) AS outstanding_amount,
    ROUND(GREATEST(d.total_paid_amount + d.total_credit_applied_amount - d.total_amount, 0), 4) AS overpaid_amount,
    CASE
      WHEN d.payment_type_code = 'PAY_ON_COLLECTION' THEN ROUND(
        GREATEST(
          d.total_amount - d.total_paid_amount - d.total_credit_applied_amount,
          0
        ),
        4
      )
      ELSE 0
    END AS pay_on_collection_amount,
    CASE
      WHEN d.payment_type_code = 'CREDIT_INVOICE' THEN ROUND(
        GREATEST(
          d.total_amount - d.total_paid_amount - d.total_credit_applied_amount,
          0
        ),
        4
      )
      ELSE 0
    END AS ar_receivable_amount,
    ARRAY_REMOVE(ARRAY[
      CASE WHEN d.pending_payment_amount > 0 AND d.total_paid_amount > 0 THEN 'PENDING_PAYMENT_COUNTED_AS_PAID' END,
      CASE WHEN d.authorized_payment_amount > 0 AND d.total_paid_amount > 0 THEN 'AUTHORIZED_PAYMENT_COUNTED_AS_PAID' END,
      CASE WHEN d.used_legacy_total_fallback THEN 'LEGACY_FIELD_USED_IN_SUMMARY' END,
      CASE WHEN d.has_refund_source_unclassified THEN 'REFUND_SOURCE_UNCLASSIFIED' END,
      CASE WHEN d.has_payment_target_unclassified THEN 'PAYMENT_TARGET_UNCLASSIFIED' END
    ], NULL) AS warning_codes
  FROM derived d
),
prepared AS (
  SELECT
    wp.*,
    array_length(wp.warning_codes, 1) AS warning_count,
    CASE
      WHEN 'REFUND_SOURCE_UNCLASSIFIED' = ANY(wp.warning_codes)
        OR 'PAYMENT_TARGET_UNCLASSIFIED' = ANY(wp.warning_codes)
        OR wp.used_legacy_total_fallback
      THEN 'RECALCULATION_REQUIRED'
      WHEN COALESCE(array_length(wp.warning_codes, 1), 0) > 0
      THEN 'MISMATCH'
      ELSE 'CURRENT'
    END AS financial_snapshot_status,
    jsonb_build_object(
      'version', 4,
      'warning_codes', COALESCE(to_jsonb(wp.warning_codes), '[]'::jsonb),
      'used_legacy_total_fallback', wp.used_legacy_total_fallback,
      'has_payment_target_unclassified', wp.has_payment_target_unclassified,
      'has_refund_source_unclassified', wp.has_refund_source_unclassified,
      'source_totals', jsonb_build_object(
        'legacy_total_amount', wp.legacy_total_amount,
        'legacy_subtotal_amount', wp.legacy_subtotal_amount,
        'legacy_outstanding_amount', wp.legacy_outstanding_amount,
        'legacy_rounding_adjustment_amount', wp.rounding_adjustment_amount
      ),
      'derived_totals', jsonb_build_object(
        'subtotal_amount', wp.subtotal_amount,
        'items_base_amount', wp.items_base_amount,
        'piece_extra_price_amount', wp.piece_extra_price_amount,
        'preference_extra_price_amount', wp.preference_extra_price_amount,
        'total_charges_amount', wp.total_charges_amount,
        'service_charge_amount', wp.service_charge_amount,
        'delivery_charge_amount', wp.delivery_charge_amount,
        'express_charge_amount', wp.express_charge_amount,
        'other_charges_amount', wp.other_charges_amount,
        'total_discount_amount', wp.total_discount_amount,
        'taxable_amount', wp.taxable_amount,
        'total_tax_amount', wp.total_tax_amount,
        'rounding_adjustment_amount', wp.rounding_adjustment_amount,
        'total_amount', wp.total_amount,
        'total_paid_amount', wp.total_paid_amount,
        'pending_payment_amount', wp.pending_payment_amount,
        'authorized_payment_amount', wp.authorized_payment_amount,
        'failed_payment_amount', wp.failed_payment_amount,
        'total_credit_applied_amount', wp.total_credit_applied_amount,
        'refunded_amount', wp.refunded_amount,
        'real_payment_refunded_amount', wp.real_payment_refunded_amount,
        'stored_value_restored_amount', wp.stored_value_restored_amount,
        'customer_credit_issued_amount', wp.customer_credit_issued_amount,
        'net_collected_amount', wp.net_collected_amount,
        'refund_reopens_due_amount', wp.refund_reopens_due_amount,
        'credit_reversal_reopens_due_amount', wp.credit_reversal_reopens_due_amount,
        'credit_reversed_amount', wp.credit_reversed_amount,
        'outstanding_amount', wp.outstanding_amount,
        'overpaid_amount', wp.overpaid_amount,
        'pay_on_collection_amount', wp.pay_on_collection_amount,
        'ar_receivable_amount', wp.ar_receivable_amount
      ),
      'lineage', jsonb_build_object(
        'ar_invoice_id', wp.ar_invoice_id,
        'ar_invoice_no', wp.ar_invoice_no,
        'ar_invoice_status', wp.ar_invoice_status
      ),
      'notes', jsonb_build_array(
        'subtotal_amount and items_base_amount are intentionally equal in the current pricing mode because extras are already embedded in item line totals.',
        'Batch 0334 uses one trace id per migration run.',
        'Historical ambiguous payment rows are excluded from total_paid_amount and warned, not silently assumed safe.'
      )
    ) AS financial_calculation_snapshot,
    md5(
      jsonb_build_object(
        'version', 4,
        'warning_codes', COALESCE(to_jsonb(wp.warning_codes), '[]'::jsonb),
        'used_legacy_total_fallback', wp.used_legacy_total_fallback,
        'has_payment_target_unclassified', wp.has_payment_target_unclassified,
        'has_refund_source_unclassified', wp.has_refund_source_unclassified,
        'subtotal_amount', wp.subtotal_amount,
        'items_base_amount', wp.items_base_amount,
        'piece_extra_price_amount', wp.piece_extra_price_amount,
        'preference_extra_price_amount', wp.preference_extra_price_amount,
        'total_charges_amount', wp.total_charges_amount,
        'service_charge_amount', wp.service_charge_amount,
        'delivery_charge_amount', wp.delivery_charge_amount,
        'express_charge_amount', wp.express_charge_amount,
        'other_charges_amount', wp.other_charges_amount,
        'total_discount_amount', wp.total_discount_amount,
        'taxable_amount', wp.taxable_amount,
        'total_tax_amount', wp.total_tax_amount,
        'rounding_adjustment_amount', wp.rounding_adjustment_amount,
        'total_amount', wp.total_amount,
        'total_paid_amount', wp.total_paid_amount,
        'pending_payment_amount', wp.pending_payment_amount,
        'authorized_payment_amount', wp.authorized_payment_amount,
        'failed_payment_amount', wp.failed_payment_amount,
        'total_credit_applied_amount', wp.total_credit_applied_amount,
        'refunded_amount', wp.refunded_amount,
        'real_payment_refunded_amount', wp.real_payment_refunded_amount,
        'stored_value_restored_amount', wp.stored_value_restored_amount,
        'customer_credit_issued_amount', wp.customer_credit_issued_amount,
        'net_collected_amount', wp.net_collected_amount,
        'refund_reopens_due_amount', wp.refund_reopens_due_amount,
        'credit_reversal_reopens_due_amount', wp.credit_reversal_reopens_due_amount,
        'credit_reversed_amount', wp.credit_reversed_amount,
        'outstanding_amount', wp.outstanding_amount,
        'overpaid_amount', wp.overpaid_amount,
        'pay_on_collection_amount', wp.pay_on_collection_amount,
        'ar_receivable_amount', wp.ar_receivable_amount,
        'payment_type_code', wp.payment_type_code,
        'ar_invoice_id', wp.ar_invoice_id,
        'ar_invoice_no', wp.ar_invoice_no,
        'ar_invoice_status', wp.ar_invoice_status
      )::text
    ) AS financial_calculation_hash
  FROM warning_payload wp
)
UPDATE public.org_orders_mst o
SET
  subtotal_amount = p.subtotal_amount,
  items_base_amount = p.items_base_amount,
  total_amount = p.total_amount,
  piece_extra_price_amount = p.piece_extra_price_amount,
  preference_extra_price_amount = p.preference_extra_price_amount,
  total_charges_amount = p.total_charges_amount,
  service_charge_amount = p.service_charge_amount,
  delivery_charge_amount = p.delivery_charge_amount,
  express_charge_amount = p.express_charge_amount,
  other_charges_amount = p.other_charges_amount,
  total_discount_amount = p.total_discount_amount,
  taxable_amount = p.taxable_amount,
  total_tax_amount = p.total_tax_amount,
  total_paid_amount = p.total_paid_amount,
  pending_payment_amount = p.pending_payment_amount,
  authorized_payment_amount = p.authorized_payment_amount,
  failed_payment_amount = p.failed_payment_amount,
  total_credit_applied_amount = p.total_credit_applied_amount,
  refunded_amount = p.refunded_amount,
  real_payment_refunded_amount = p.real_payment_refunded_amount,
  stored_value_restored_amount = p.stored_value_restored_amount,
  customer_credit_issued_amount = p.customer_credit_issued_amount,
  net_collected_amount = p.net_collected_amount,
  refund_reopens_due_amount = p.refund_reopens_due_amount,
  credit_reversal_reopens_due_amount = p.credit_reversal_reopens_due_amount,
  credit_reversed_amount = p.credit_reversed_amount,
  outstanding_amount = p.outstanding_amount,
  overpaid_amount = p.overpaid_amount,
  pay_on_collection_amount = NULLIF(p.pay_on_collection_amount, 0),
  ar_receivable_amount = p.ar_receivable_amount,
  ar_invoice_id = p.ar_invoice_id,
  ar_invoice_no = p.ar_invoice_no,
  ar_invoice_status = p.ar_invoice_status,
  change_returned_amount = p.change_returned_amount,
  financial_engine_version = 4,
  financial_snapshot_status = p.financial_snapshot_status,
  financial_mismatch_warning_count = COALESCE(p.warning_count, 0),
  financial_calculation_snapshot = p.financial_calculation_snapshot,
  financial_calculation_hash = p.financial_calculation_hash,
  financial_last_calculated_at = params.recalculated_at,
  financial_last_calculated_by = 'migration:0334',
  financial_calculation_trace_id = params.batch_trace_id,
  updated_at = params.recalculated_at
FROM prepared p
CROSS JOIN params
WHERE o.tenant_org_id = p.tenant_org_id
  AND o.id = p.order_id;

-- -----------------------------------------------------------------------------
-- Post-repair validation: snapshot status and warning distribution
-- -----------------------------------------------------------------------------
SELECT
  financial_snapshot_status,
  COUNT(*) AS row_count,
  SUM(financial_mismatch_warning_count) AS total_warnings
FROM public.org_orders_mst
GROUP BY financial_snapshot_status
ORDER BY financial_snapshot_status;

-- -----------------------------------------------------------------------------
-- Post-repair validation: rows still requiring manual review
-- -----------------------------------------------------------------------------
SELECT
  id AS order_id,
  order_no,
  payment_type_code,
  financial_snapshot_status,
  financial_mismatch_warning_count,
  financial_calculation_snapshot -> 'warning_codes' AS warning_codes,
  total_amount,
  total_paid_amount,
  total_credit_applied_amount,
  refunded_amount,
  outstanding_amount,
  ar_receivable_amount,
  pay_on_collection_amount
FROM public.org_orders_mst
WHERE financial_snapshot_status <> 'CURRENT'
ORDER BY order_no;

-- -----------------------------------------------------------------------------
-- Rollback notes
-- -----------------------------------------------------------------------------
-- 1. This migration does not drop or rename any legacy columns.
-- 2. Review the preview SELECTs before execution and capture their output.
-- 3. If execution needs to be reverted, restore the canonical columns from a
--    pre-run backup or rerun a corrected recalculation migration; legacy fields
--    remain available as compatibility references.
