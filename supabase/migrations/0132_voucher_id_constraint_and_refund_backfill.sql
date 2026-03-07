-- ==================================================================
-- 0132_voucher_id_constraint_and_refund_backfill.sql
-- Purpose: Enforce voucher_id for completed/refunded payments; backfill refund rows
-- Plan: cancel_and_return_order, payment_cancel_refund_and_audit_plan
-- Rule: No payment transaction without voucher master in org_fin_vouchers_mst
-- ==================================================================

BEGIN;

-- ==================================================================
-- Step 1: Backfill refund rows (paid_amount < 0, voucher_id IS NULL)
-- ==================================================================

DO $$
DECLARE
  r RECORD;
  v_voucher_id UUID;
  v_voucher_no VARCHAR(50);
  v_seq INTEGER;
  v_tenant UUID;
  v_year TEXT;
BEGIN
  FOR r IN (
    SELECT p.id, p.tenant_org_id, p.branch_id, p.invoice_id, p.order_id, p.customer_id,
           ABS(COALESCE(p.paid_amount, 0)) AS refund_amount,
           COALESCE(p.currency_code, 'OMR') AS currency_code,
           p.paid_at, p.created_at, p.created_by
    FROM org_payments_dtl_tr p
    WHERE p.voucher_id IS NULL
      AND COALESCE(p.paid_amount, 0) < 0
      AND p.status IN ('refunded', 'completed', 'paid', 'success')
    ORDER BY p.tenant_org_id, p.created_at
  )
  LOOP
    v_tenant := r.tenant_org_id;
    v_year := TO_CHAR(COALESCE(r.paid_at, r.created_at)::DATE, 'YYYY');
    SELECT COALESCE(MAX(
      NULLIF(REGEXP_REPLACE(voucher_no, '^REF-' || v_year || '-(\d+)$', '\1'), '')::INTEGER
    ), 0) + 1 INTO v_seq
    FROM org_fin_vouchers_mst
    WHERE tenant_org_id = v_tenant AND voucher_no LIKE 'REF-' || v_year || '-%';
    v_voucher_no := 'REF-' || v_year || '-' || LPAD(v_seq::TEXT, 5, '0');

    INSERT INTO org_fin_vouchers_mst (
      tenant_org_id, branch_id, voucher_no, voucher_category, voucher_subtype, voucher_type,
      invoice_id, order_id, customer_id, total_amount, currency_code,
      status, issued_at, reason_code, created_at, created_by
    ) VALUES (
      r.tenant_org_id, r.branch_id, v_voucher_no, 'CASH_OUT', 'REFUND', 'PAYMENT',
      r.invoice_id, r.order_id, r.customer_id, r.refund_amount, r.currency_code,
      'issued', COALESCE(r.paid_at, r.created_at), 'REFUND', r.created_at, r.created_by
    )
    RETURNING id INTO v_voucher_id;

    UPDATE org_payments_dtl_tr SET voucher_id = v_voucher_id WHERE id = r.id;
  END LOOP;
END $$;

-- ==================================================================
-- Step 2: Add CHECK constraint for voucher_id on completed/refunded
-- ==================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'chk_payments_voucher_required' AND table_name = 'org_payments_dtl_tr'
  ) THEN
    ALTER TABLE org_payments_dtl_tr DROP CONSTRAINT chk_payments_voucher_required;
  END IF;
END $$;

ALTER TABLE org_payments_dtl_tr
  ADD CONSTRAINT chk_payments_voucher_required
  CHECK (
    (status NOT IN ('completed', 'refunded', 'paid', 'success'))
    OR (COALESCE(paid_amount, 0) = 0)
    OR (voucher_id IS NOT NULL)
  );

COMMENT ON CONSTRAINT chk_payments_voucher_required ON org_payments_dtl_tr IS
  'Completed/refunded payments with non-zero amount must have voucher_id (no payment without voucher)';

COMMIT;
