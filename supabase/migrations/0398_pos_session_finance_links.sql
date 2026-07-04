-- =============================================================================
-- 0398_pos_session_finance_links.sql
-- POS Session Management v1 — adds nullable operational lineage links to the
-- active finance tables only. Legacy org_payments_dtl_tr is intentionally
-- untouched.
-- =============================================================================

BEGIN;

ALTER TABLE public.org_order_payments_dtl
  ADD COLUMN IF NOT EXISTS pos_session_id UUID;

ALTER TABLE public.org_order_refunds_dtl
  ADD COLUMN IF NOT EXISTS pos_session_id UUID;

ALTER TABLE public.org_fin_voucher_trx_lines_dtl
  ADD COLUMN IF NOT EXISTS pos_session_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_ordpay_possess'
      AND conrelid = 'public.org_order_payments_dtl'::regclass
  ) THEN
    ALTER TABLE public.org_order_payments_dtl
      ADD CONSTRAINT fk_ordpay_possess
      FOREIGN KEY (tenant_org_id, pos_session_id)
      REFERENCES public.org_pos_sessions_mst (tenant_org_id, id)
      ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_ordref_possess'
      AND conrelid = 'public.org_order_refunds_dtl'::regclass
  ) THEN
    ALTER TABLE public.org_order_refunds_dtl
      ADD CONSTRAINT fk_ordref_possess
      FOREIGN KEY (tenant_org_id, pos_session_id)
      REFERENCES public.org_pos_sessions_mst (tenant_org_id, id)
      ON DELETE RESTRICT;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_vtl_possess'
      AND conrelid = 'public.org_fin_voucher_trx_lines_dtl'::regclass
  ) THEN
    ALTER TABLE public.org_fin_voucher_trx_lines_dtl
      ADD CONSTRAINT fk_vtl_possess
      FOREIGN KEY (tenant_org_id, pos_session_id)
      REFERENCES public.org_pos_sessions_mst (tenant_org_id, id)
      ON DELETE RESTRICT;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_ordpay_possess
  ON public.org_order_payments_dtl (tenant_org_id, pos_session_id)
  WHERE pos_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ordref_possess
  ON public.org_order_refunds_dtl (tenant_org_id, pos_session_id)
  WHERE pos_session_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_vtl_possess
  ON public.org_fin_voucher_trx_lines_dtl (tenant_org_id, pos_session_id)
  WHERE pos_session_id IS NOT NULL;

COMMIT;
