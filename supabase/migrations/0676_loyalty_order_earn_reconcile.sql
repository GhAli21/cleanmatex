-- =============================================================================
-- 0676_loyalty_order_earn_reconcile.sql
-- Reusable Order Fin View P1B-15 (D27, closes LE-01) — loyalty earn follows
-- the order on every path that settles, edits, refunds or cancels it.
--
-- Purpose:
--   Points earned for an order are reconciled to a target
--   (floor(earn base x rate)) instead of being posted once at checkout.
--   The reconciliation posts only the delta: an EARN row for a positive delta,
--   a negative ADJUST row for a clawback. Two facts are missing on the ledger:
--
--   1. earn_rate — the program rate used for the order's first EARN row.
--      Later deltas for the same order reuse it, so a program rate change
--      never re-prices points already earned on an existing order.
--   2. unreversed_points — on a clawback ADJUST row, the points that could
--      not be taken back because the customer had already spent them. The
--      balance never goes below zero; this column keeps the shortfall for
--      audit and lets the reconciliation treat it as settled.
--
--   No new transaction type: a clawback is a negative ADJUST row carrying
--   order_id (manual admin adjustments never carry order_id).
-- =============================================================================

BEGIN;

-- Rate recorded at the order's first earn; read back for every later delta.
ALTER TABLE public.org_loyalty_txn_dtl
  ADD COLUMN IF NOT EXISTS earn_rate NUMERIC(10, 4) NULL;

COMMENT ON COLUMN public.org_loyalty_txn_dtl.earn_rate IS
  'P1B-15 (D27) — points per currency unit used to compute this EARN row (copy of org_loyalty_programs_cf.earn_rate_per_unit at the order''s first earn). Later reconciliation deltas for the same order reuse the first recorded rate. NULL on rows not produced by order earn reconciliation.';

-- Clawback shortfall: points owed back that the balance could not cover.
ALTER TABLE public.org_loyalty_txn_dtl
  ADD COLUMN IF NOT EXISTS unreversed_points INTEGER NULL;

ALTER TABLE public.org_loyalty_txn_dtl
  ADD CONSTRAINT chk_oltd_unreversed_points CHECK (
    unreversed_points IS NULL OR unreversed_points >= 0
  );

COMMENT ON COLUMN public.org_loyalty_txn_dtl.unreversed_points IS
  'P1B-15 (D27) — on an order clawback ADJUST row: points that should have been reversed but were not, because the account balance was lower (already redeemed or expired). The balance never goes below zero. Points earned for an order = SUM(points) - SUM(unreversed_points) over its EARN and ADJUST rows.';

COMMENT ON CONSTRAINT chk_oltd_unreversed_points ON public.org_loyalty_txn_dtl IS
  'P1B-15 — the clawback shortfall is a count of points, never negative.';

COMMIT;
