-- ============================================================================
-- 0313_ar_invoice_cleanup.sql
-- Purpose:
--   Normalize legacy invoice rows before AR Invoice v1 schema constraints.
-- Rules:
--   - additive only
--   - no destructive resets
--   - prepares current rows for canonical AR statuses/types
-- ============================================================================

BEGIN;

-- Backfill invoice_date from created_at when missing.
UPDATE public.org_invoice_mst
SET invoice_date = created_at::date
WHERE invoice_date IS NULL
  AND created_at IS NOT NULL;

-- Backfill currency_code from the linked order when possible.
UPDATE public.org_invoice_mst inv
SET currency_code = ord.currency_code
FROM public.org_orders_mst ord
WHERE inv.order_id = ord.id
  AND inv.tenant_org_id = ord.tenant_org_id
  AND (inv.currency_code IS NULL OR btrim(inv.currency_code) = '')
  AND ord.currency_code IS NOT NULL
  AND btrim(ord.currency_code) <> '';

-- Normalize invoice_type_cd to canonical AR meanings.
UPDATE public.org_invoice_mst
SET invoice_type_cd = CASE
  WHEN statement_id IS NOT NULL THEN 'B2B_STATEMENT'
  WHEN b2b_contract_id IS NOT NULL THEN 'B2B_ORDER'
  WHEN upper(coalesce(invoice_type_cd, '')) = 'B2B' THEN 'B2B_ORDER'
  WHEN upper(coalesce(invoice_type_cd, '')) = 'B2B_STATEMENT' THEN 'B2B_STATEMENT'
  WHEN upper(coalesce(invoice_type_cd, '')) = 'ORDER_CREDIT' THEN 'ORDER_CREDIT'
  WHEN upper(coalesce(invoice_type_cd, '')) = 'MANUAL_AR' THEN 'MANUAL_AR'
  WHEN upper(coalesce(invoice_type_cd, '')) = 'CREDIT_MEMO' THEN 'CREDIT_MEMO'
  WHEN upper(coalesce(invoice_type_cd, '')) = 'DEBIT_NOTE' THEN 'DEBIT_NOTE'
  WHEN upper(coalesce(invoice_type_cd, '')) = 'PROFORMA' THEN 'PROFORMA'
  WHEN order_id IS NOT NULL THEN 'ORDER_CREDIT'
  ELSE 'MANUAL_AR'
END
WHERE invoice_type_cd IS NULL
   OR upper(invoice_type_cd) NOT IN (
     'ORDER_CREDIT', 'B2B_ORDER', 'B2B_STATEMENT',
     'MANUAL_AR', 'CREDIT_MEMO', 'DEBIT_NOTE', 'PROFORMA'
   );

-- Normalize status values based on existing lifecycle data and balance facts.
UPDATE public.org_invoice_mst
SET status = CASE
  WHEN upper(coalesce(status, '')) IN ('VOID', 'VOIDED') THEN 'VOID'
  WHEN upper(coalesce(status, '')) IN ('CANCELLED', 'CANCELED') THEN 'CANCELLED'
  WHEN upper(coalesce(status, '')) = 'REFUNDED' THEN 'REFUNDED'
  WHEN upper(coalesce(status, '')) IN ('PARTIALLY_REFUNDED', 'PARTIAL_REFUNDED') THEN 'PARTIALLY_REFUNDED'
  WHEN upper(coalesce(status, '')) = 'WRITTEN_OFF' THEN 'WRITTEN_OFF'
  WHEN upper(coalesce(status, '')) = 'DISPUTED' THEN 'DISPUTED'
  WHEN coalesce(paid_amount, 0) >= coalesce(total, 0) AND coalesce(total, 0) > 0 THEN 'PAID'
  WHEN coalesce(paid_amount, 0) > 0 THEN 'PARTIALLY_PAID'
  WHEN due_date IS NOT NULL AND due_date < CURRENT_DATE THEN 'OVERDUE'
  WHEN upper(coalesce(status, '')) = 'DRAFT' THEN 'DRAFT'
  ELSE 'OPEN'
END
WHERE status IS NULL
   OR status IN ('pending', 'partial', 'paid', 'overdue', 'cancelled', 'refunded', 'draft')
   OR upper(status) IN (
     'VOIDED', 'CANCELED', 'PARTIAL_REFUNDED',
     'PARTIALLY_REFUNDED', 'WRITTEN_OFF', 'DISPUTED'
   );

COMMIT;
