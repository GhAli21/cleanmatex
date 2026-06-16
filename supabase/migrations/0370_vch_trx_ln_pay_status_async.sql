-- =============================================================================
-- Migration 0370: Allow async gateway payment_status on voucher lines
--
-- submit-order writes planner resolvedPaymentStatus (PROCESSING for gateway
-- legs) onto org_fin_voucher_trx_lines_dtl. chk_vch_trx_ln_pay_status (0301)
-- only allowed PENDING/COMPLETED/FAILED/REFUNDED/PARTIALLY_REFUNDED, causing
-- 23514 on MOBILE_PAYMENT and other gateway methods.
-- =============================================================================

BEGIN;

ALTER TABLE public.org_fin_voucher_trx_lines_dtl
  DROP CONSTRAINT IF EXISTS chk_vch_trx_ln_pay_status;

ALTER TABLE public.org_fin_voucher_trx_lines_dtl
  ADD CONSTRAINT chk_vch_trx_ln_pay_status
  CHECK (
    payment_status IS NULL
    OR payment_status IN (
      'PENDING',
      'COMPLETED',
      'FAILED',
      'REFUNDED',
      'PARTIALLY_REFUNDED',
      'PROCESSING',
      'CAPTURE_PENDING'
    )
  );

COMMIT;
