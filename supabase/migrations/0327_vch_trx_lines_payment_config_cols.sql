-- Migration: 0327_vch_trx_lines_payment_config_cols.sql
-- Purpose: Add payment-config linking columns to org_fin_voucher_trx_lines_dtl.
--          These columns are in the Prisma schema but were never added to the DB,
--          causing Prisma findMany() calls to fail with "column does not exist".
--
-- Columns added:
--   org_payment_method_id  — FK to org_payment_methods_cf (tenant payment method config)
--   payment_terminal_id    — FK to org_payment_terminals_cf (card terminal)
-- Note: payment_status already exists in the DB — not added here.

ALTER TABLE public.org_fin_voucher_trx_lines_dtl
  ADD COLUMN IF NOT EXISTS org_payment_method_id UUID,
  ADD COLUMN IF NOT EXISTS payment_terminal_id   UUID;

-- Sparse FK-like indexes (no CASCADE — voucher lines must survive config row deletion)
CREATE INDEX IF NOT EXISTS idx_vch_trx_line_pay_method
  ON public.org_fin_voucher_trx_lines_dtl (tenant_org_id, org_payment_method_id)
  WHERE org_payment_method_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vch_trx_line_terminal
  ON public.org_fin_voucher_trx_lines_dtl (payment_terminal_id)
  WHERE payment_terminal_id IS NOT NULL;

COMMENT ON COLUMN public.org_fin_voucher_trx_lines_dtl.org_payment_method_id IS
  'FK to org_payment_methods_cf — tenant payment method config used for this line.';

COMMENT ON COLUMN public.org_fin_voucher_trx_lines_dtl.payment_terminal_id IS
  'FK to org_payment_terminals_cf — card terminal used for this line (card payments only).';

COMMENT ON COLUMN public.org_fin_voucher_trx_lines_dtl.payment_status IS
  'D9 config-driven status: COMPLETED | PENDING | PROCESSING. Set at line creation; drives post-settlement status updates.';
  