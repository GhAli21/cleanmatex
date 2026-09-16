-- 0508_fin_voucher_ref_voucher_id.sql
-- Why: a voucher created because of another voucher (reversal, later generated
-- contra docs) must store that parent on the NEW row. reversed_by_voucher_id
-- only lives on the original. DROP ... RESTRICT only (no CASCADE).

BEGIN;

ALTER TABLE public.org_fin_vouchers_mst
  ADD COLUMN IF NOT EXISTS ref_voucher_id UUID NULL;

COMMENT ON COLUMN public.org_fin_vouchers_mst.ref_voucher_id IS
  'Parent voucher this row was created from (reversal of, generated contra). Null for independently created vouchers.';

ALTER TABLE public.org_fin_vouchers_mst
  DROP CONSTRAINT IF EXISTS fk_fin_vch_ref_voucher RESTRICT;

ALTER TABLE public.org_fin_vouchers_mst
  ADD CONSTRAINT fk_fin_vch_ref_voucher
  FOREIGN KEY (ref_voucher_id, tenant_org_id)
  REFERENCES public.org_fin_vouchers_mst (id, tenant_org_id)
  ON DELETE SET NULL
  ON UPDATE NO ACTION;

CREATE INDEX IF NOT EXISTS idx_fin_vch_ref_voucher
  ON public.org_fin_vouchers_mst (tenant_org_id, ref_voucher_id)
  WHERE ref_voucher_id IS NOT NULL;

-- Backfill: original.reversed_by_voucher_id already points at the reversal.
UPDATE public.org_fin_vouchers_mst AS reversal
SET ref_voucher_id = original.id
FROM public.org_fin_vouchers_mst AS original
WHERE original.reversed_by_voucher_id = reversal.id
  AND original.tenant_org_id = reversal.tenant_org_id
  AND reversal.ref_voucher_id IS NULL;

-- Fill blank reversal headers from the parent voucher so existing reverse
-- documents (e.g. RV-2026-000087) are not missing date/party/amounts.
UPDATE public.org_fin_vouchers_mst AS reversal
SET
  party_name = COALESCE(reversal.party_name, original.party_name),
  party_type = COALESCE(reversal.party_type, original.party_type),
  customer_id = COALESCE(reversal.customer_id, original.customer_id),
  order_id = COALESCE(reversal.order_id, original.order_id),
  invoice_id = COALESCE(reversal.invoice_id, original.invoice_id),
  branch_id = COALESCE(reversal.branch_id, original.branch_id),
  supplier_id = COALESCE(reversal.supplier_id, original.supplier_id),
  employee_id = COALESCE(reversal.employee_id, original.employee_id),
  source_module = COALESCE(reversal.source_module, original.source_module),
  source_ref_type = COALESCE(reversal.source_ref_type, original.source_ref_type),
  source_ref_id = COALESCE(reversal.source_ref_id, original.source_ref_id),
  currency_code = COALESCE(reversal.currency_code, original.currency_code),
  currency_ex_rate = COALESCE(reversal.currency_ex_rate, original.currency_ex_rate),
  voucher_date = COALESCE(reversal.voucher_date, (reversal.created_at)::date, original.voucher_date),
  voucher_datetime = COALESCE(reversal.voucher_datetime, reversal.created_at, original.voucher_datetime),
  issued_at = COALESCE(reversal.issued_at, reversal.created_at),
  paid_amount = COALESCE(reversal.paid_amount, original.paid_amount, original.total_amount),
  outstanding_amount = COALESCE(reversal.outstanding_amount, 0),
  notes = COALESCE(reversal.notes, original.notes),
  posting_status = CASE
    WHEN reversal.voucher_status = 'POSTED' AND reversal.posting_status = 'NOT_POSTED' THEN 'POSTED'
    ELSE reversal.posting_status
  END
FROM public.org_fin_vouchers_mst AS original
WHERE reversal.ref_voucher_id = original.id
  AND reversal.tenant_org_id = original.tenant_org_id;

UPDATE public.org_fin_voucher_trx_lines_dtl AS rev_line
SET party_name = COALESCE(rev_line.party_name, orig_line.party_name, original.party_name)
FROM public.org_fin_voucher_trx_lines_dtl AS orig_line
JOIN public.org_fin_vouchers_mst AS original
  ON original.id = orig_line.voucher_id
 AND original.tenant_org_id = orig_line.tenant_org_id
WHERE rev_line.reversed_line_id = orig_line.id
  AND rev_line.tenant_org_id = orig_line.tenant_org_id
  AND rev_line.party_name IS NULL;

COMMIT;
