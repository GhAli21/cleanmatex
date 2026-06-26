-- ==================================================================
-- 0386_einvoice_status_column.sql
-- Purpose: F-05 (ADR-052 / D-02) — E-invoicing status persistence.
--          Adds e_invoice_status to org_tax_documents_mst so a tax
--          document can carry its e-invoice lifecycle state, distinct
--          from the existing `status` (tax-doc lifecycle) column.
--          Mirrors the TypeScript E_INVOICE_STATUS catalog
--          (lib/constants/e-invoice.ts):
--            NOT_APPLICABLE | PENDING | GENERATED | REPORTED
--            | CLEARED | FAILED | CANCELLED
--          Initial value rule (set in the tax-doc write path):
--            isEInvoiceActive(order) ? PENDING : NOT_APPLICABLE
-- ADR: docs/features/Order_Fin/ADR/ADR-052-E-Invoicing-Launch-Scope.md
-- ==================================================================
-- WHY this migration is safe:
--   • Purely additive; no data rewrite.
--   • DEFAULT 'NOT_APPLICABLE' → every existing tax document keeps the
--     current (non-e-invoice) semantics; no behavior change.
--   • The CHECK holds immediately for all existing rows (they default to
--     'NOT_APPLICABLE', a member of the allowed set) → no NOT VALID step.
--   • DB-mirror rule: the CHECK value set is the EXACT E_INVOICE_STATUS
--     catalog string set (same case, same spelling).
-- ==================================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────────
-- Step 1 — e_invoice_status column (defaults to NOT_APPLICABLE)
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE public.org_tax_documents_mst
  ADD COLUMN IF NOT EXISTS e_invoice_status text NOT NULL DEFAULT 'NOT_APPLICABLE';

-- ──────────────────────────────────────────────────────────────────
-- Step 2 — Guard CHECK: value must be a canonical E_INVOICE_STATUS code
-- ──────────────────────────────────────────────────────────────────
ALTER TABLE public.org_tax_documents_mst
  DROP CONSTRAINT IF EXISTS chk_tax_doc_einv_status RESTRICT;

ALTER TABLE public.org_tax_documents_mst
  ADD CONSTRAINT chk_tax_doc_einv_status
    CHECK (e_invoice_status IN (
      'NOT_APPLICABLE', 'PENDING', 'GENERATED', 'REPORTED',
      'CLEARED', 'FAILED', 'CANCELLED'
    ));

COMMENT ON COLUMN public.org_tax_documents_mst.e_invoice_status IS
  'F-05/ADR-052: e-invoice lifecycle status (NOT_APPLICABLE/PENDING/GENERATED/REPORTED/CLEARED/FAILED/CANCELLED). Distinct from the tax-doc `status` column. NOT_APPLICABLE when e-invoicing is not active for the order; PENDING when active and the e-invoice document has not yet been generated/submitted. Mirrors E_INVOICE_STATUS in lib/constants/e-invoice.ts.';

-- ──────────────────────────────────────────────────────────────────
-- Step 3 — Verify the column + constraint landed
-- ──────────────────────────────────────────────────────────────────
DO $$
DECLARE
  v_cols INTEGER;
  v_con  INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'org_tax_documents_mst'
    AND column_name = 'e_invoice_status';
  IF v_cols <> 1 THEN
    RAISE EXCEPTION '❌ 0386: e_invoice_status column missing on org_tax_documents_mst';
  END IF;

  SELECT COUNT(*) INTO v_con
  FROM pg_constraint
  WHERE conrelid = 'public.org_tax_documents_mst'::regclass
    AND conname = 'chk_tax_doc_einv_status';
  IF v_con <> 1 THEN
    RAISE EXCEPTION '❌ 0386: CHECK chk_tax_doc_einv_status is missing';
  END IF;

  RAISE NOTICE '✅ 0386: org_tax_documents_mst.e_invoice_status column + CHECK verified';
END $$;

COMMIT;

-- ================================================================
-- ROLLBACK (run manually if needed)
-- ================================================================
-- ALTER TABLE public.org_tax_documents_mst DROP CONSTRAINT IF EXISTS chk_tax_doc_einv_status RESTRICT;
-- ALTER TABLE public.org_tax_documents_mst DROP COLUMN IF EXISTS e_invoice_status;