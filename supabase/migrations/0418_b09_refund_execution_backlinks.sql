-- =============================================================================
-- 0418_b09_refund_execution_backlinks.sql
-- B9 — Refund Execution Parity (Order Fin Remediation, Remediation_Work_Packages)
--
-- Purpose: add dedicated lineage backlink columns to org_order_refunds_dtl so a
-- CASH/ORIGINAL_METHOD refund's REFUND_VOUCHER and (for CASH) cash-drawer
-- CASH_OUT movement are unambiguously linked to the specific refund row that
-- caused them (D010: "immutable lineage in dedicated columns, never metadata
-- JSON"). Mirrors the exact pattern migration 0303 already established for
-- org_order_payments_dtl / org_cash_drawer_movements_dtl / org_wallet_txn_dtl /
-- org_advance_txn_dtl / org_gift_card_txn_dtl / org_credit_note_txn_dtl: plain
-- UUID columns + sparse UNIQUE indexes, no FK constraint (consistent with every
-- other fin_voucher_id/fin_voucher_trx_line_id backlink in this codebase).
--
-- Without these columns, the only way to associate a refund with its voucher
-- is a reverse pointer (org_fin_vouchers_mst.order_id + voucher_type =
-- REFUND_VOUCHER), which cannot disambiguate multiple refunds on the same
-- order (see ar-checks.ts's checkRefundLink doc comment, which explicitly
-- flags this as "pencilled in for Phase 6 schema-debt cleanup" — this
-- migration closes that debt as part of B9).
--
-- Authoritative report: §8, §34, §40. Work package:
-- docs/features/Order_Fin/Remediation_Work_Packages/B09_Refund_Execution_Parity.md
--
-- WHY this migration is safe:
--   • All three columns are nullable, additive — no backfill, no existing-row impact.
--   • Sparse unique indexes only apply WHERE the column IS NOT NULL — legacy
--     record-only refund rows (NULL in all three) are unaffected.
-- =============================================================================

BEGIN;

ALTER TABLE public.org_order_refunds_dtl
  ADD COLUMN IF NOT EXISTS fin_voucher_id           UUID NULL,
  ADD COLUMN IF NOT EXISTS fin_voucher_trx_line_id  UUID NULL,
  ADD COLUMN IF NOT EXISTS cash_drawer_movement_id  UUID NULL;

COMMENT ON COLUMN public.org_order_refunds_dtl.fin_voucher_id IS
  'B9 — REFUND_VOUCHER (org_fin_vouchers_mst) created for this refund''s execution, when order_fin_refund_execution is enabled. NULL for record-only refunds (flag off, or WALLET/CREDIT_NOTE destinations which use their own stored-value ledger backlinks).';
COMMENT ON COLUMN public.org_order_refunds_dtl.fin_voucher_trx_line_id IS
  'B9 — the specific ORDER_REFUND voucher line (org_fin_voucher_trx_lines_dtl) for this refund. Sparse-unique: one refund row owns at most one voucher line.';
COMMENT ON COLUMN public.org_order_refunds_dtl.cash_drawer_movement_id IS
  'B9 — the CASH_OUT org_cash_drawer_movements_dtl row wired to this refund''s voucher line, when refund_method_code = CASH. NULL for non-cash destinations.';

CREATE UNIQUE INDEX IF NOT EXISTS uq_ord_refund_vch_line
  ON public.org_order_refunds_dtl (fin_voucher_trx_line_id)
  WHERE fin_voucher_trx_line_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ord_refund_fin_voucher
  ON public.org_order_refunds_dtl (fin_voucher_id)
  WHERE fin_voucher_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ord_refund_cash_mvt
  ON public.org_order_refunds_dtl (cash_drawer_movement_id)
  WHERE cash_drawer_movement_id IS NOT NULL;

-- -----------------------------------------------------------------------------
-- Validation
-- -----------------------------------------------------------------------------

DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM information_schema.columns
  WHERE table_name = 'org_order_refunds_dtl'
    AND column_name IN ('fin_voucher_id', 'fin_voucher_trx_line_id', 'cash_drawer_movement_id');
  IF v_count <> 3 THEN
    RAISE EXCEPTION 'B9 backlink columns not fully created on org_order_refunds_dtl (found % of 3)', v_count;
  END IF;

  RAISE NOTICE '✓ Migration 0418 validation passed — org_order_refunds_dtl backlink columns created';
END $$;

COMMIT;

-- =============================================================================
-- POST-MIGRATION NOTES
-- =============================================================================
-- 1. Prisma schema.prisma must be hand-updated to mirror the 3 new columns on
--    org_order_refunds_dtl (this project maintains schema.prisma by hand), then
--    `npx prisma generate` re-run.
-- 2. New wiring handler: lib/services/wiring/order-refund-cash-drawer-wiring.handler.ts
--    (registered in voucher-wiring.service.ts's WIRING_HANDLERS array).
-- 3. processRefund() in lib/services/order-refund.service.ts writes these
--    columns after postAndWireBizVoucher() completes, behind the
--    order_fin_refund_execution feature flag (default OFF — flag-off keeps the
--    exact pre-B9 record-only behavior, all three columns stay NULL).
-- 4. To rollback: drop the 3 indexes, drop the 3 columns (all additive/nullable
--    — safe to drop; no other object depends on them).
-- =============================================================================
