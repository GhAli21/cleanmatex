DROP INDEX IF EXISTS public.idx_org_ord_pay_dtl_target RESTRICT;
ALTER TABLE public.org_order_payments_dtl
     DROP CONSTRAINT IF EXISTS chk_org_order_payments_dtl_target_type RESTRICT,
     DROP COLUMN IF EXISTS payment_target_type RESTRICT;
