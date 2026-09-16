-- 0509_fin_voucher_reverse_ref_backfill.sql
-- Why: 0508 backfilled ref_voucher_id from original.reversed_by_voucher_id.
-- Preview reverse RV-2026-000087 never received that pointer, so header copy
-- did not run. Reversal lines already store reversed_line_id — use that.
-- DROP ... RESTRICT only (no CASCADE). Owner apply; do not run from agents.

BEGIN;

-- 1) Parent pointer on the child voucher (created because of another voucher).
UPDATE public.org_fin_vouchers_mst AS reversal
SET ref_voucher_id = src.original_id
FROM (
  SELECT DISTINCT ON (rl.voucher_id, rl.tenant_org_id)
    rl.voucher_id,
    rl.tenant_org_id,
    ol.voucher_id AS original_id
  FROM public.org_fin_voucher_trx_lines_dtl rl
  JOIN public.org_fin_voucher_trx_lines_dtl ol
    ON ol.id = rl.reversed_line_id
   AND ol.tenant_org_id = rl.tenant_org_id
  WHERE rl.reversed_line_id IS NOT NULL
    AND ol.voucher_id <> rl.voucher_id
  ORDER BY rl.voucher_id, rl.tenant_org_id, rl.line_no
) AS src
WHERE reversal.id = src.voucher_id
  AND reversal.tenant_org_id = src.tenant_org_id
  AND reversal.ref_voucher_id IS NULL;

-- 2) Original → reversal pointer when status is already REVERSED.
UPDATE public.org_fin_vouchers_mst AS original
SET reversed_by_voucher_id = reversal.id
FROM public.org_fin_vouchers_mst AS reversal
WHERE reversal.ref_voucher_id = original.id
  AND reversal.tenant_org_id = original.tenant_org_id
  AND original.reversed_by_voucher_id IS NULL
  AND original.voucher_status = 'REVERSED';

-- 3) Copy operational header facts the old reverse path left blank.
UPDATE public.org_fin_vouchers_mst AS reversal
SET
  party_type = COALESCE(reversal.party_type, original.party_type),
  customer_id = COALESCE(reversal.customer_id, original.customer_id),
  order_id = COALESCE(reversal.order_id, original.order_id),
  invoice_id = COALESCE(reversal.invoice_id, original.invoice_id),
  branch_id = COALESCE(reversal.branch_id, original.branch_id),
  supplier_id = COALESCE(reversal.supplier_id, original.supplier_id),
  employee_id = COALESCE(reversal.employee_id, original.employee_id),
  direction = COALESCE(reversal.direction, original.direction),
  voucher_subtype = COALESCE(reversal.voucher_subtype, original.voucher_subtype),
  source_module = COALESCE(reversal.source_module, original.source_module),
  source_ref_type = COALESCE(reversal.source_ref_type, original.source_ref_type),
  source_ref_id = COALESCE(reversal.source_ref_id, original.source_ref_id),
  currency_code = COALESCE(reversal.currency_code, original.currency_code),
  currency_ex_rate = COALESCE(reversal.currency_ex_rate, original.currency_ex_rate),
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

-- 4) Dates on the reverse pair (original receipts often never stored voucher_date).
UPDATE public.org_fin_vouchers_mst AS v
SET
  voucher_date = COALESCE(v.voucher_date, (v.created_at)::date),
  voucher_datetime = COALESCE(v.voucher_datetime, v.created_at),
  issued_at = COALESCE(v.issued_at, v.created_at)
WHERE (v.ref_voucher_id IS NOT NULL OR v.reversed_by_voucher_id IS NOT NULL)
  AND (v.voucher_date IS NULL OR v.voucher_datetime IS NULL OR v.issued_at IS NULL);

-- 5) Party label from the customer when the header never stored one.
UPDATE public.org_fin_vouchers_mst AS v
SET party_name = src.party_name
FROM (
  SELECT
    c.id,
    c.tenant_org_id,
    NULLIF(BTRIM(COALESCE(
      NULLIF(BTRIM(c.display_name), ''),
      NULLIF(BTRIM(c.name), ''),
      NULLIF(BTRIM(c.name2), ''),
      NULLIF(BTRIM(CONCAT_WS(' ', c.first_name, c.last_name)), '')
    )), '') AS party_name
  FROM public.org_customers_mst c
) AS src
WHERE v.customer_id = src.id
  AND v.tenant_org_id = src.tenant_org_id
  AND v.party_name IS NULL
  AND src.party_name IS NOT NULL
  AND (v.ref_voucher_id IS NOT NULL OR v.reversed_by_voucher_id IS NOT NULL);

-- 6) Reversal line party from original line or header.
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
