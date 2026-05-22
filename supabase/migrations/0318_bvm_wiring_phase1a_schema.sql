-- =============================================================================
-- 0318_bvm_wiring_phase1a_schema.sql
-- BVM Wiring Phase 1A — Schema prerequisites
--
-- 1. Adds credit_application_type column to org_fin_voucher_trx_lines_dtl
--    so the wiring handler can map the correct credit_type to org_order_credit_apps_dtl.
--
-- 2. Adds fin_voucher_id + fin_voucher_trx_line_id to org_order_credit_apps_dtl
--    (mirrors migration 0303 pattern for other operational tables).
--    Sparse unique index prevents double-wiring.
--
-- 3. Extends chk_vch_trx_ln_role on org_fin_voucher_trx_lines_dtl to include
--    ORDER_CREDIT_APPLICATION (previously missing, blocking line creation).
--    PostgreSQL requires DROP + re-ADD for CHECK constraints.
-- =============================================================================

BEGIN;

-- ── 1. Add credit_application_type to voucher transaction lines ───────────────
-- Needed so the ORDER_CREDIT_APPLICATION wiring handler knows which stored-value
-- sub-type to record on org_order_credit_apps_dtl (WALLET, GIFT_CARD, etc.).
ALTER TABLE public.org_fin_voucher_trx_lines_dtl
  ADD COLUMN IF NOT EXISTS credit_application_type TEXT;

COMMENT ON COLUMN public.org_fin_voucher_trx_lines_dtl.credit_application_type IS
  'For ORDER_CREDIT_APPLICATION lines: WALLET, GIFT_CARD, CUSTOMER_ADVANCE, CREDIT_NOTE, LOYALTY_CREDIT. Maps to org_order_credit_apps_dtl.credit_type.';

-- ── 2. Add BVM back-link columns to org_order_credit_apps_dtl ────────────────
-- Mirrors the pattern in migration 0303 for org_order_payments_dtl and
-- org_cash_drawer_movements_dtl. NULL for legacy rows created before wiring.
ALTER TABLE public.org_order_credit_apps_dtl
  ADD COLUMN IF NOT EXISTS fin_voucher_id          UUID,
  ADD COLUMN IF NOT EXISTS fin_voucher_trx_line_id UUID;

-- Sparse unique: enforces one credit-app row per voucher line (idempotency).
-- Does not break legacy rows where both columns are NULL.
CREATE UNIQUE INDEX IF NOT EXISTS uq_credit_app_vch_line
  ON public.org_order_credit_apps_dtl (fin_voucher_trx_line_id)
  WHERE fin_voucher_trx_line_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_credit_app_fin_voucher
  ON public.org_order_credit_apps_dtl (fin_voucher_id)
  WHERE fin_voucher_id IS NOT NULL;

COMMENT ON COLUMN public.org_order_credit_apps_dtl.fin_voucher_id IS
  'BVM back-link: voucher that produced this credit application. NULL for legacy rows.';
COMMENT ON COLUMN public.org_order_credit_apps_dtl.fin_voucher_trx_line_id IS
  'BVM back-link: specific voucher line that produced this row. Sparse unique — prevents double-wiring.';

-- ── 3. Extend chk_vch_trx_ln_role to include ORDER_CREDIT_APPLICATION ─────────
-- PostgreSQL does not support ALTER CONSTRAINT — constraint must be dropped and
-- re-added with the full updated list. The new value ORDER_CREDIT_APPLICATION
-- was missing from the original constraint in migration 0301, making it impossible
-- to INSERT voucher lines with this role.
ALTER TABLE public.org_fin_voucher_trx_lines_dtl
  DROP CONSTRAINT IF EXISTS chk_vch_trx_ln_role;

ALTER TABLE public.org_fin_voucher_trx_lines_dtl
  ADD CONSTRAINT chk_vch_trx_ln_role
  CHECK (line_role IN (
    'ORDER_PAYMENT',
    'INVOICE_PAYMENT',
    'WALLET_TOPUP',
    'GIFT_CARD_SALE',
    'CUSTOMER_CREDIT_RECEIPT',
    'CUSTOMER_ADVANCE_RECEIPT',
    'SUPPLIER_PAYMENT',
    'EXPENSE_PAYMENT',
    'SHOP_RENT_PAYMENT',
    'UTILITY_PAYMENT',
    'EMPLOYEE_ADVANCE_PAYMENT',
    'PETTY_CASH_ISSUE',
    'CUSTOMER_REFUND',
    'ORDER_REFUND',
    'INVOICE_REFUND',
    'PETTY_CASH_RETURN',
    'WALLET_REFUND',
    'GIFT_CARD_REFUND',
    'INTERNAL_TRANSFER',
    'ORDER_CREDIT_APPLICATION'
  ));

COMMIT;
