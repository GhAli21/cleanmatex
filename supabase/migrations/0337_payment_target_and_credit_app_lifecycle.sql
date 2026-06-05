-- =============================================================================
-- 0337_payment_target_and_credit_app_lifecycle.sql
-- =============================================================================
-- Purpose
--   Two related schema additions required by Order Fin v1.1 §6 (payment target
--   classification) and §10.x (credit-application lifecycle):
--
--     1. org_order_payments_dtl + payment_target_type
--          Discriminates which target a payment row settles. Only rows with
--          payment_target_type = 'ORDER' may contribute to total_paid_amount on
--          org_orders_mst. The wider enum (AR_INVOICE, CUSTOMER_ADVANCE,
--          GIFT_CARD_TOPUP, WALLET_TOPUP, SUPPLIER_PAYMENT, EXPENSE) reserves
--          the namespace for the BVM-broad future where outgoing vouchers land
--          on the same payment fact table.
--
--     2. org_order_credit_apps_dtl + application_status
--          Adds an explicit lifecycle column. Today only is_active / rec_status
--          gate inclusion in total_credit_applied_amount; that signal cannot
--          distinguish PENDING / RESERVED / PROCESSING / APPLIED / FAILED /
--          CANCELLED / REVERSED / EXPIRED. The canonical rule is:
--            Only APPLIED reduces outstanding_amount.
--            PENDING + RESERVED + PROCESSING → pending_credit_application_amount.
--            FAILED + CANCELLED + EXPIRED   → failed_credit_application_amount.
--            REVERSED                        → credit_reversed_amount (may
--                                               trigger credit_reversal_reopens_due_amount).
--
--     3. org_orders_mst snapshot columns
--          pending_credit_application_amount + failed_credit_application_amount
--          surface the new lifecycle buckets on the header snapshot.
--
-- Plan reference
--   docs/features/Order_Fin/Fix_29_05_2026/order-fin-v1_1-full-alignment-implementation-plan.md
--   §Phase 3 — payment_target_type + Credit Application Lifecycle
--
-- Backfill strategy
--   - payment_target_type defaults to 'ORDER' (the only target the existing
--     payment-write flow produces today). No row-level guessing.
--   - application_status: rows where (is_active = TRUE AND rec_status = 1)
--     are treated as APPLIED (the canonical state for all rows the prior
--     write path produced). Rows where (is_active = FALSE OR rec_status <> 1)
--     are treated as CANCELLED (the conservative interpretation of a
--     soft-deleted historical row — never silently classified as APPLIED).
--
-- Important
--   Create-only for review. Do NOT run automatically.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- 1. org_order_payments_dtl.payment_target_type
-- -----------------------------------------------------------------------------
ALTER TABLE public.org_order_payments_dtl
  ADD COLUMN IF NOT EXISTS payment_target_type TEXT NOT NULL DEFAULT 'ORDER';

-- Add CHECK constraint guarding the enum. Use a separate idempotent DO block
-- so the migration is re-runnable.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'chk_org_order_payments_dtl_target_type'
  ) THEN
    ALTER TABLE public.org_order_payments_dtl
      ADD CONSTRAINT chk_org_order_payments_dtl_target_type
      CHECK (payment_target_type IN (
        'ORDER',
        'AR_INVOICE',
        'CUSTOMER_ADVANCE',
        'GIFT_CARD_TOPUP',
        'WALLET_TOPUP',
        'SUPPLIER_PAYMENT',
        'EXPENSE'
      ));
  END IF;
END $$;

COMMENT ON COLUMN public.org_order_payments_dtl.payment_target_type IS
  'Discriminator: which target this payment row settles. Only ''ORDER'' rows feed total_paid_amount on org_orders_mst. AR_INVOICE rows settle linked AR invoices; CUSTOMER_ADVANCE/GIFT_CARD_TOPUP/WALLET_TOPUP rows are stored-value top-ups that create liability (not order settlement); SUPPLIER_PAYMENT/EXPENSE reserve the namespace for outgoing voucher flows. See Order Fin v1.1 §6.';

-- Tenant-scoped index that lets the recalculation service filter by target type
-- efficiently when summing payment lifecycle buckets per order.
CREATE INDEX IF NOT EXISTS idx_org_ord_pay_dtl_target
  ON public.org_order_payments_dtl (tenant_org_id, payment_target_type, order_id);

-- -----------------------------------------------------------------------------
-- 2. org_order_credit_apps_dtl.application_status
-- -----------------------------------------------------------------------------
ALTER TABLE public.org_order_credit_apps_dtl
  ADD COLUMN IF NOT EXISTS application_status TEXT NOT NULL DEFAULT 'APPLIED';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'chk_org_order_credit_apps_dtl_status'
  ) THEN
    ALTER TABLE public.org_order_credit_apps_dtl
      ADD CONSTRAINT chk_org_order_credit_apps_dtl_status
      CHECK (application_status IN (
        'PENDING',
        'RESERVED',
        'PROCESSING',
        'APPLIED',
        'FAILED',
        'CANCELLED',
        'REVERSED',
        'EXPIRED'
      ));
  END IF;
END $$;

-- Backfill historical rows from the existing soft-delete signal. Rows that
-- were already counted by the prior recalculation path (is_active = TRUE
-- AND rec_status = 1) become APPLIED; everything else is conservatively
-- CANCELLED — we never invent an APPLIED row out of an inactive one.
UPDATE public.org_order_credit_apps_dtl
   SET application_status = 'APPLIED'
 WHERE application_status = 'APPLIED'
   AND is_active = TRUE
   AND COALESCE(rec_status, 1) = 1;

UPDATE public.org_order_credit_apps_dtl
   SET application_status = 'CANCELLED'
 WHERE (is_active = FALSE OR COALESCE(rec_status, 1) <> 1)
   AND application_status = 'APPLIED';

COMMENT ON COLUMN public.org_order_credit_apps_dtl.application_status IS
  'Credit application lifecycle. Only ''APPLIED'' reduces outstanding_amount. PENDING/RESERVED/PROCESSING feed pending_credit_application_amount; FAILED/CANCELLED/EXPIRED feed failed_credit_application_amount; REVERSED feeds credit_reversed_amount (and may trigger credit_reversal_reopens_due_amount). See Order Fin v1.1 §10.x.';

CREATE INDEX IF NOT EXISTS idx_org_order_credit_apps_status
  ON public.org_order_credit_apps_dtl (tenant_org_id, application_status, order_id);

-- -----------------------------------------------------------------------------
-- 3. org_orders_mst lifecycle snapshot columns
-- -----------------------------------------------------------------------------
ALTER TABLE public.org_orders_mst
  ADD COLUMN IF NOT EXISTS pending_credit_application_amount DECIMAL(19,4) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS failed_credit_application_amount  DECIMAL(19,4) NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.org_orders_mst.pending_credit_application_amount IS
  'Sum of credit-application amounts in PENDING / RESERVED / PROCESSING status. Tracked for audit/UI; does NOT reduce outstanding_amount. See Order Fin v1.1 §10.x.';
COMMENT ON COLUMN public.org_orders_mst.failed_credit_application_amount IS
  'Sum of credit-application amounts in FAILED / CANCELLED / EXPIRED status. Tracked for audit; does NOT reduce outstanding_amount. See Order Fin v1.1 §10.x.';

--- No need for payment_target_type in org_order_payments_dtl because this table for order payments only 

DROP INDEX IF EXISTS public.idx_org_ord_pay_dtl_target RESTRICT;
ALTER TABLE public.org_order_payments_dtl
     DROP CONSTRAINT IF EXISTS chk_org_order_payments_dtl_target_type RESTRICT,
     DROP COLUMN IF EXISTS payment_target_type RESTRICT;

COMMIT;

-- -----------------------------------------------------------------------------
-- Rollback notes (RESTRICT only, per project policy — no CASCADE)
-- -----------------------------------------------------------------------------
-- BEGIN;
--   DROP INDEX IF EXISTS public.idx_org_ord_pay_dtl_target RESTRICT;
--   DROP INDEX IF EXISTS public.idx_org_order_credit_apps_status RESTRICT;
--
--   ALTER TABLE public.org_order_payments_dtl
--     DROP CONSTRAINT IF EXISTS chk_org_order_payments_dtl_target_type RESTRICT,
--     DROP COLUMN IF EXISTS payment_target_type RESTRICT;
--
--   ALTER TABLE public.org_order_credit_apps_dtl
--     DROP CONSTRAINT IF EXISTS chk_org_order_credit_apps_dtl_status RESTRICT,
--     DROP COLUMN IF EXISTS application_status RESTRICT;
--
--   ALTER TABLE public.org_orders_mst
--     DROP COLUMN IF EXISTS pending_credit_application_amount RESTRICT,
--     DROP COLUMN IF EXISTS failed_credit_application_amount  RESTRICT;
-- COMMIT;
--
-- Before rolling back, confirm no application code reads these column names
-- (grep across web-admin/lib and web-admin/src for payment_target_type,
-- application_status, pending_credit_application_amount,
-- failed_credit_application_amount).
-- =============================================================================
