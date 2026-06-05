-- =============================================================================
-- 0338_order_fin_base_currency_snapshot.sql
-- =============================================================================
-- Purpose
--   Add the Order Fin v1.1 base-currency reporting snapshot fields to
--   public.org_orders_mst:
--
--     base_cur_currency_code
--     base_cur_total_amount
--     base_cur_tax_amount
--     base_cur_paid_amount
--     base_cur_credit_applied_amount
--     base_cur_outstanding_amount
--     base_cur_ar_receivable_amount
--
--   Order transaction currency remains authoritative. These new columns are
--   reporting snapshots only, as locked by ADR-039:
--     docs/features/Order_Fin/ADR/ADR-039-Multi-Currency-Snapshots.md
--
-- Formula
--   Order Fin v1.1 §4.4 defines:
--     base_cur_amount = transaction_amount * currency_ex_rate
--
-- Important design constraint
--   The tenant/base currency source-of-truth is HQ-managed settings consumed
--   by cleanmatex via HQ API. Per project rules, this migration must NOT
--   query sys_stng_* directly and cannot call the HQ API. Therefore:
--
--   - base_cur_currency_code is added as NULLABLE in SQL
--   - numeric base_cur_* columns are safely backfilled from stored historical
--     currency_ex_rate
--   - application code in Phase 4 will resolve and persist base_cur_currency_code
--     from HQ-managed tenant settings during recalculation/write paths
--
-- Rollout
--   - Create-only for review. Do NOT run automatically.
--   - Safe re-run via ADD COLUMN IF NOT EXISTS.
--   - Existing rows receive numeric base_cur_* projections immediately using the
--     stored exchange rate already captured on the order.
--   - Existing rows may still have base_cur_currency_code = NULL until Phase 4
--     application code rewrites them with the HQ-resolved tenant currency.
-- =============================================================================

BEGIN;

ALTER TABLE public.org_orders_mst
  ADD COLUMN IF NOT EXISTS base_cur_currency_code           TEXT,
  ADD COLUMN IF NOT EXISTS base_cur_total_amount            DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_cur_tax_amount              DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_cur_paid_amount             DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_cur_credit_applied_amount   DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_cur_outstanding_amount      DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS base_cur_ar_receivable_amount    DECIMAL(19,4) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.org_orders_mst.base_cur_currency_code IS
  'HQ-managed tenant base/reporting currency code for the order financial snapshot. Nullable in SQL because the source-of-truth lives outside this database (HQ API), then persisted by Phase 4 application recalculation.';
COMMENT ON COLUMN public.org_orders_mst.base_cur_total_amount IS
  'Order Fin v1.1 base-currency reporting snapshot: total_amount * currency_ex_rate. Transaction currency remains authoritative.';
COMMENT ON COLUMN public.org_orders_mst.base_cur_tax_amount IS
  'Order Fin v1.1 base-currency reporting snapshot: total_tax_amount * currency_ex_rate. Transaction currency remains authoritative.';
COMMENT ON COLUMN public.org_orders_mst.base_cur_paid_amount IS
  'Order Fin v1.1 base-currency reporting snapshot: total_paid_amount * currency_ex_rate. Transaction currency remains authoritative.';
COMMENT ON COLUMN public.org_orders_mst.base_cur_credit_applied_amount IS
  'Order Fin v1.1 base-currency reporting snapshot: total_credit_applied_amount * currency_ex_rate. Transaction currency remains authoritative.';
COMMENT ON COLUMN public.org_orders_mst.base_cur_outstanding_amount IS
  'Order Fin v1.1 base-currency reporting snapshot: outstanding_amount * currency_ex_rate. Transaction currency remains authoritative.';
COMMENT ON COLUMN public.org_orders_mst.base_cur_ar_receivable_amount IS
  'Order Fin v1.1 base-currency reporting snapshot: ar_receivable_amount * currency_ex_rate. Transaction currency remains authoritative.';

UPDATE public.org_orders_mst
SET
  base_cur_total_amount = ROUND((COALESCE(total_amount, 0) * currency_ex_rate)::numeric, 4),
  base_cur_tax_amount = ROUND((COALESCE(total_tax_amount, 0) * currency_ex_rate)::numeric, 4),
  base_cur_paid_amount = ROUND((COALESCE(total_paid_amount, 0) * currency_ex_rate)::numeric, 4),
  base_cur_credit_applied_amount = ROUND((COALESCE(total_credit_applied_amount, 0) * currency_ex_rate)::numeric, 4),
  base_cur_outstanding_amount = ROUND((COALESCE(outstanding_amount, 0) * currency_ex_rate)::numeric, 4),
  base_cur_ar_receivable_amount = ROUND((COALESCE(ar_receivable_amount, 0) * currency_ex_rate)::numeric, 4)
WHERE COALESCE(currency_ex_rate, 0) > 0;

COMMIT;

-- -----------------------------------------------------------------------------
-- Rollback notes
-- -----------------------------------------------------------------------------
-- These columns are additive only. Remove with RESTRICT (no CASCADE):
--
--   ALTER TABLE public.org_orders_mst
--     DROP COLUMN IF EXISTS base_cur_currency_code        RESTRICT,
--     DROP COLUMN IF EXISTS base_cur_total_amount         RESTRICT,
--     DROP COLUMN IF EXISTS base_cur_tax_amount           RESTRICT,
--     DROP COLUMN IF EXISTS base_cur_paid_amount          RESTRICT,
--     DROP COLUMN IF EXISTS base_cur_credit_applied_amount RESTRICT,
--     DROP COLUMN IF EXISTS base_cur_outstanding_amount    RESTRICT,
--     DROP COLUMN IF EXISTS base_cur_ar_receivable_amount  RESTRICT;
--
-- Before rollback, ensure no application code or reports read these columns.
-- =============================================================================
