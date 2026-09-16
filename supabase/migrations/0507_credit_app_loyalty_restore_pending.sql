-- 0507_credit_app_loyalty_restore_pending.sql
-- D006: LOYALTY_RESTORE_PENDING is a governed credit-application status used
-- when automatic loyalty restore cannot complete. Recreate the CHECK with the
-- extra value. DROP ... RESTRICT only (no CASCADE).

BEGIN;

ALTER TABLE public.org_order_credit_apps_dtl
  DROP CONSTRAINT IF EXISTS chk_org_order_credit_apps_dtl_status RESTRICT;

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
    'EXPIRED',
    'LOYALTY_RESTORE_PENDING'
  ));

COMMENT ON COLUMN public.org_order_credit_apps_dtl.application_status IS
  'Credit application lifecycle. Only APPLIED reduces outstanding_amount. PENDING/RESERVED/PROCESSING feed pending_credit_application_amount; FAILED/CANCELLED/EXPIRED feed failed_credit_application_amount; REVERSED feeds credit_reversed_amount; LOYALTY_RESTORE_PENDING (D006) is a governed exception until loyalty points are restored.';

COMMIT;
