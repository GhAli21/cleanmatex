-- ============================================================================
-- 0395 — Drop the deprecated payment ledger `org_payments_dtl_tr`
--         (+ its audit satellite `org_payment_audit_log`
--          + the orphaned AR allocation reference column
--            `org_invoice_payments_dtl.payment_id`)
-- ============================================================================
-- Context : ADR-002 (2026-05-30) deprecated `org_payments_dtl_tr`; the
--           canonical ledgers are `org_order_payments_dtl` + voucher trx
--           lines + AR/receipt tables. Order-Fin remediation 2026-07 Phases
--           1–5 removed every reader and writer from the codebase
--           (docs/features/Order_Fin/Order_Fin_Remediation_2026-07/PLAN.md).
--           This migration removes the tables themselves.
--
-- Dropped objects (manifest):
--   1. FK  org_payment_audit_log.fk_payment_audit_payment  → org_payments_dtl_tr(id)   (0097)
--   2. TBL org_payment_audit_log                            (0097; audited only _tr rows;
--          writer payment-audit.service retired; indexes/policies drop with it)
--   3. FK  org_invoice_payments_dtl.fk_oip_pay              → org_payments_dtl_tr(id)   (0314)
--   4. COL org_invoice_payments_dtl.payment_id              (0314; AR allocations are
--          voucher-referenced; column was the last _tr linkage and is all-NULL)
--   5. TBL org_payments_dtl_tr                              (archive/0001 + 0091/0096/
--          0100/0106/0132/0257/0271/0283/0306; CHECKs incl.
--          chk_payments_voucher_required, indexes, and RLS policies (0081)
--          drop with the table)
--   Note: org_order_refunds_dtl.original_payment_id was ALREADY repointed to
--         org_order_payments_dtl by 0283 — untouched here.
--
-- Safety  : DROP ... RESTRICT only (dependencies removed explicitly first —
--           no CASCADE anywhere). Hard ABORT guards verify the empty-table /
--           all-NULL premise before any destructive statement (Phase-0
--           pre-flight could not run: local stack down, remote MCP unauth).
-- Rollback: restore structure from migration history (0097 / 0314 / 0091…)
--           — there is no data to restore (guards prove the tables are empty).
-- ============================================================================

DO $$
DECLARE
  v_count bigint;
BEGIN
  -- Guard 1: the deprecated ledger must be empty.
  SELECT count(*) INTO v_count FROM public.org_payments_dtl_tr;
  IF v_count > 0 THEN
    RAISE EXCEPTION '0395 ABORTED: org_payments_dtl_tr has % row(s) — expected 0. Investigate before dropping.', v_count;
  END IF;

  -- Guard 2: its audit satellite must be empty.
  SELECT count(*) INTO v_count FROM public.org_payment_audit_log;
  IF v_count > 0 THEN
    RAISE EXCEPTION '0395 ABORTED: org_payment_audit_log has % row(s) — expected 0. Investigate before dropping.', v_count;
  END IF;

  -- Guard 3: no AR allocation may still reference the ledger.
  SELECT count(*) INTO v_count
  FROM public.org_invoice_payments_dtl
  WHERE payment_id IS NOT NULL;
  IF v_count > 0 THEN
    RAISE EXCEPTION '0395 ABORTED: org_invoice_payments_dtl.payment_id is non-NULL on % row(s) — expected 0. Investigate before dropping.', v_count;
  END IF;
END $$;

-- 1–2. Audit satellite (FK first, then table — RESTRICT, no CASCADE).
ALTER TABLE public.org_payment_audit_log
  DROP CONSTRAINT IF EXISTS fk_payment_audit_payment;
DROP TABLE public.org_payment_audit_log RESTRICT;

-- 3–4. Orphaned AR allocation reference (guard 3 proved all-NULL).
ALTER TABLE public.org_invoice_payments_dtl
  DROP CONSTRAINT IF EXISTS fk_oip_pay;
ALTER TABLE public.org_invoice_payments_dtl
  DROP COLUMN payment_id RESTRICT;

-- 5. The deprecated ledger itself.
DROP TABLE public.org_payments_dtl_tr RESTRICT;

-- Verification:
--   SELECT to_regclass('public.org_payments_dtl_tr');      -- expect NULL
--   SELECT to_regclass('public.org_payment_audit_log');    -- expect NULL
--   SELECT count(*) FROM information_schema.columns
--   WHERE table_name = 'org_invoice_payments_dtl' AND column_name = 'payment_id';  -- expect 0
