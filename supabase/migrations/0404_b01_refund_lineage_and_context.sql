-- ==================================================================
-- 0404_b01_refund_lineage_and_context.sql
-- Purpose: Order Fin Remediation B01 — Refund Lineage and Reopen-Due.
--          Implements the approved D002 v2 (origin-only source registry),
--          D003 v2 (reopen-due rules), and D010 (lineage columns) database
--          surface on org_order_refunds_dtl.
--
-- Spec:    docs/features/Order_Fin/Remediation_Work_Packages/
--            B01_Refund_Lineage_And_Reopen_Due.md §9 (binding, v2)
--          + §1a actual-DB corrections (2026-07-17)
-- Decisions: D002/D003/D004/D005/D010 — APPROVED (Expert) 2026-07-16.
--
-- DATA PREMISE (verified 2026-07-17): org_order_refunds_dtl is EMPTY —
-- 0 rows locally (read-only check) and owner-confirmed empty in the
-- deployed database. Refunds were never successfully created in
-- maker-checker mode because the 0271 refund_status CHECK never allowed
-- 'PENDING_APPROVAL' (defect fixed in Step 6). Therefore NO legacy-row
-- tolerance is needed: all constraints below are UNCONDITIONAL (simpler
-- and stronger than the cutover-conditional pattern B01 §9.2 sketched
-- for the assumed-legacy case). If any environment unexpectedly holds
-- non-conforming rows, the ADD CONSTRAINT statements fail loudly and the
-- migration aborts — review the data, never weaken the constraint.
--
-- What this migration does:
--   1. Promotes `original_credit_app_id` from metadata JSON to a dedicated
--      UUID column (D010 invariant 6). A defensive copy-only backfill is
--      kept (no-op on the verified-empty table; evidence-preserving if an
--      environment surprises us — never classification guessing).
--   2. Adds `refund_context` TEXT NOT NULL (D002 v2 reason_context:
--      STANDARD | PRICE_ADJUSTMENT_GOODWILL | CANCELLATION_UNWIND |
--      REFUND_AND_REBILL | MANUAL_EXCEPTION).
--   3. Tenant-safe composite FKs:
--        (tenant_org_id, original_credit_app_id) → org_order_credit_apps_dtl
--        (tenant_org_id, original_payment_id)    → org_order_payments_dtl
--      (the payment FK replaces the old single-column FK — §9.3 alignment).
--   4. Unconditional CHECK constraints: v2 origin-only source registry,
--      reason_context registry, positive-reopen-requires-explicit-context
--      (D003 invariant 7), and source↔lineage consistency (XOR rule).
--   5. Replaces the retired 0340 source-type CHECK (its
--      CUSTOMER_CREDIT_ISSUE / CREDIT_NOTE_ISSUE values name destinations,
--      not origins — D002 v2 retires them as sources).
--   6. Widens the refund_status CHECK to include PENDING_APPROVAL — defect
--      fix: the maker-checker write path (order-refund.service.ts) inserts
--      refund_status = 'PENDING_APPROVAL' by default, but the 0271 CHECK
--      only allowed PENDING/APPROVED/PROCESSED/FAILED/CANCELLED. B01 §14
--      (initiate → approve → process) requires this fixed.
--
-- Deploy note: between applying this migration and deploying the B01
-- service write path, the pre-B01 service cannot insert refund rows
-- (refund_context NOT NULL fails loudly). That window exists only in
-- local dev — Preview/production receive migration + code in the same
-- package commit — and approval-required initiation was already failing
-- pre-B01 due to the status CHECK defect.
--
-- WHY this migration is safe:
--   • Additive and reversible — new columns, new indexes, new constraints;
--     no data rewritten (backfill is a guarded no-op on an empty table).
--   • The only drops are (a) the retired source-type CHECK, replaced in the
--     same transaction by the strictly-more-correct v2 registry CHECK, and
--     (b) the single-column payment FK, replaced by the tenant-composite FK
--     (strictly stronger). Recreates are in the ROLLBACK section below.
-- ==================================================================

BEGIN;

-- ──────────────────────────────────────────────────────────────────
-- Step 0 — Pre-flight: record the row count this migration ran against
-- ──────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_rows BIGINT;
BEGIN
  SELECT COUNT(*) INTO v_rows FROM public.org_order_refunds_dtl;
  IF v_rows = 0 THEN
    RAISE NOTICE 'B01 pre-flight: org_order_refunds_dtl is empty (expected).';
  ELSE
    RAISE NOTICE '⚠ B01 pre-flight: org_order_refunds_dtl holds % row(s) — expected 0. The unconditional constraints below will abort if any row does not conform; review the data before weakening anything.', v_rows;
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────
-- Step 1 — New columns
-- refund_context is NOT NULL: the table is empty and every new row gets
-- the value at initiation (D002 v2 makes reason_context mandatory).
-- original_credit_app_id stays nullable (lineage is forbidden for
-- GOODWILL_CONCESSION / MANUAL_EXCEPTION and absent for payment refunds).
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE public.org_order_refunds_dtl
  ADD COLUMN IF NOT EXISTS original_credit_app_id UUID NULL;

ALTER TABLE public.org_order_refunds_dtl
  ADD COLUMN IF NOT EXISTS refund_context TEXT NOT NULL;

COMMENT ON COLUMN public.org_order_refunds_dtl.original_credit_app_id IS
  'B01/D010 lineage: the org_order_credit_apps_dtl row whose applied value this refund returns. Mandatory for *_RESTORE sources (chk_refund_lineage_v2); forbidden for REAL_PAYMENT_REFUND / GOODWILL_CONCESSION / MANUAL_EXCEPTION. Tenant-safe composite FK.';

COMMENT ON COLUMN public.org_order_refunds_dtl.refund_context IS
  'B01/D002 v2 reason_context: STANDARD | PRICE_ADJUSTMENT_GOODWILL | CANCELLATION_UNWIND | REFUND_AND_REBILL | MANUAL_EXCEPTION. Drives D003 v2 reopen rules — a positive reopens_due_amount requires REFUND_AND_REBILL or MANUAL_EXCEPTION (chk_refund_reopen_context_v2).';

-- ──────────────────────────────────────────────────────────────────
-- Step 2 — Defensive copy-only lineage backfill (B01 §9.3)
-- No-op on the verified-empty table. If rows exist, copies
-- metadata->>'original_credit_app_id' ONLY when it is a well-formed UUID
-- AND resolves to a credit application in the SAME tenant (guarantees the
-- composite FK holds). Anything else stays NULL with the metadata JSON
-- preserved as evidence. Never guesses a classification.
-- ──────────────────────────────────────────────────────────────────

UPDATE public.org_order_refunds_dtl r
SET original_credit_app_id = (r.metadata ->> 'original_credit_app_id')::uuid
WHERE r.original_credit_app_id IS NULL
  AND r.metadata ->> 'original_credit_app_id'
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  AND EXISTS (
    SELECT 1
    FROM public.org_order_credit_apps_dtl ca
    WHERE ca.tenant_org_id = r.tenant_org_id
      AND ca.id = (r.metadata ->> 'original_credit_app_id')::uuid
  );

-- ──────────────────────────────────────────────────────────────────
-- Step 3 — Unique target-pair indexes required by the composite FKs
-- (additive; PKs on id already guarantee pair uniqueness)
-- ──────────────────────────────────────────────────────────────────

CREATE UNIQUE INDEX IF NOT EXISTS uq_ord_credit_apps_tenant_id
  ON public.org_order_credit_apps_dtl (tenant_org_id, id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_ord_payments_tenant_id
  ON public.org_order_payments_dtl (tenant_org_id, id);

-- ──────────────────────────────────────────────────────────────────
-- Step 4 — Tenant-safe composite lineage FKs; cap index
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE public.org_order_refunds_dtl
  DROP CONSTRAINT IF EXISTS fk_refund_original_credit_app RESTRICT;

ALTER TABLE public.org_order_refunds_dtl
  ADD CONSTRAINT fk_refund_original_credit_app
    FOREIGN KEY (tenant_org_id, original_credit_app_id)
    REFERENCES public.org_order_credit_apps_dtl (tenant_org_id, id)
    ON DELETE RESTRICT;

-- §9.3: align the payment lineage FK to the same tenant-composite pattern
-- (it was single-column: original_payment_id → payments.id).
ALTER TABLE public.org_order_refunds_dtl
  DROP CONSTRAINT IF EXISTS fk_refund_orig_payment_tenant RESTRICT;

ALTER TABLE public.org_order_refunds_dtl
  ADD CONSTRAINT fk_refund_orig_payment_tenant
    FOREIGN KEY (tenant_org_id, original_payment_id)
    REFERENCES public.org_order_payments_dtl (tenant_org_id, id)
    ON DELETE RESTRICT;

ALTER TABLE public.org_order_refunds_dtl
  DROP CONSTRAINT IF EXISTS fk_refund_original_payment RESTRICT;

-- Cumulative per-credit-app cap queries (B01 §6/§11: cap validation moves
-- from metadata-JSON iteration to indexed column sums).
CREATE INDEX IF NOT EXISTS idx_ord_refunds_credit_app
  ON public.org_order_refunds_dtl (tenant_org_id, original_credit_app_id)
  WHERE original_credit_app_id IS NOT NULL;

-- ──────────────────────────────────────────────────────────────────
-- Step 5 — Unconditional CHECK constraints (B01 §9.1, empty-table form)
-- ──────────────────────────────────────────────────────────────────

-- 5a. Source registry v2 (D002 v2 origin-only; replaces the retired
--     0340 CHECK whose CUSTOMER_CREDIT_ISSUE / CREDIT_NOTE_ISSUE named
--     destinations).
ALTER TABLE public.org_order_refunds_dtl
  DROP CONSTRAINT IF EXISTS chk_refund_source_type RESTRICT;

ALTER TABLE public.org_order_refunds_dtl
  DROP CONSTRAINT IF EXISTS chk_refund_source_type_v2 RESTRICT;

ALTER TABLE public.org_order_refunds_dtl
  ADD CONSTRAINT chk_refund_source_type_v2
    CHECK (refund_source_type IN (
      'REAL_PAYMENT_REFUND',
      'GIFT_CARD_RESTORE',
      'WALLET_RESTORE',
      'CUSTOMER_ADVANCE_RESTORE',
      'CUSTOMER_CREDIT_RESTORE',
      'GOODWILL_CONCESSION',
      'MANUAL_EXCEPTION'
    ));

-- 5b. reason_context registry (D002 v2; NOT NULL is on the column).
ALTER TABLE public.org_order_refunds_dtl
  DROP CONSTRAINT IF EXISTS chk_refund_context_v2 RESTRICT;

ALTER TABLE public.org_order_refunds_dtl
  ADD CONSTRAINT chk_refund_context_v2
    CHECK (refund_context IN (
      'STANDARD',
      'PRICE_ADJUSTMENT_GOODWILL',
      'CANCELLATION_UNWIND',
      'REFUND_AND_REBILL',
      'MANUAL_EXCEPTION'
    ));

-- 5c. D003 v2 invariant 7: a positive reopens_due_amount exists only on
--     explicit REFUND_AND_REBILL / MANUAL_EXCEPTION rows.
ALTER TABLE public.org_order_refunds_dtl
  DROP CONSTRAINT IF EXISTS chk_refund_reopen_context_v2 RESTRICT;

ALTER TABLE public.org_order_refunds_dtl
  ADD CONSTRAINT chk_refund_reopen_context_v2
    CHECK (
      reopens_due_amount = 0
      OR refund_context IN ('REFUND_AND_REBILL', 'MANUAL_EXCEPTION')
    );

-- 5d. Source ↔ lineage consistency (B01 §4 XOR rule: REAL_PAYMENT_REFUND
--     requires the payment leg, *_RESTORE requires the credit application,
--     GOODWILL/MANUAL forbid lineage).
ALTER TABLE public.org_order_refunds_dtl
  DROP CONSTRAINT IF EXISTS chk_refund_lineage_v2 RESTRICT;

ALTER TABLE public.org_order_refunds_dtl
  ADD CONSTRAINT chk_refund_lineage_v2
    CHECK (
      (
        refund_source_type = 'REAL_PAYMENT_REFUND'
        AND original_payment_id IS NOT NULL
        AND original_credit_app_id IS NULL
      )
      OR (
        refund_source_type IN (
          'GIFT_CARD_RESTORE',
          'WALLET_RESTORE',
          'CUSTOMER_ADVANCE_RESTORE',
          'CUSTOMER_CREDIT_RESTORE'
        )
        AND original_credit_app_id IS NOT NULL
        AND original_payment_id IS NULL
      )
      OR (
        refund_source_type IN ('GOODWILL_CONCESSION', 'MANUAL_EXCEPTION')
        AND original_payment_id IS NULL
        AND original_credit_app_id IS NULL
      )
    );

-- 5e. Reopen bounds (0 ≤ reopens_due_amount ≤ refund_amount) — already
--     created by 0340 as chk_reopens_due_lte_refund; ensured idempotently
--     for environment drift, never duplicated.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.org_order_refunds_dtl'::regclass
      AND conname = 'chk_reopens_due_lte_refund'
  ) THEN
    ALTER TABLE public.org_order_refunds_dtl
      ADD CONSTRAINT chk_reopens_due_lte_refund
        CHECK (reopens_due_amount >= 0 AND reopens_due_amount <= refund_amount);
  END IF;
END $$;

-- ──────────────────────────────────────────────────────────────────
-- Step 6 — refund_status CHECK defect fix (maker-checker support)
--
-- order-refund.service.ts writes 'PENDING_APPROVAL' when approval is
-- required (the default), but the 0271 CHECK never allowed it, so
-- approval-required initiation failed on a real database. Widen the
-- registry; all previously-allowed values remain valid.
-- ──────────────────────────────────────────────────────────────────

ALTER TABLE public.org_order_refunds_dtl
  DROP CONSTRAINT IF EXISTS chk_org_order_refunds_status RESTRICT;

ALTER TABLE public.org_order_refunds_dtl
  ADD CONSTRAINT chk_org_order_refunds_status
    CHECK (refund_status IN (
      'PENDING',
      'PENDING_APPROVAL',
      'APPROVED',
      'PROCESSED',
      'FAILED',
      'CANCELLED'
    ));

-- ──────────────────────────────────────────────────────────────────
-- Step 7 — Post-migration verification
-- ──────────────────────────────────────────────────────────────────

DO $$
DECLARE
  v_missing TEXT := '';
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'org_order_refunds_dtl'
      AND column_name = 'original_credit_app_id'
  ) THEN v_missing := v_missing || ' original_credit_app_id'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'org_order_refunds_dtl'
      AND column_name = 'refund_context' AND is_nullable = 'NO'
  ) THEN v_missing := v_missing || ' refund_context(NOT NULL)'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.org_order_refunds_dtl'::regclass
      AND conname = 'fk_refund_orig_payment_tenant' AND convalidated
  ) THEN v_missing := v_missing || ' fk_refund_orig_payment_tenant'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.org_order_refunds_dtl'::regclass
      AND conname = 'fk_refund_original_credit_app' AND convalidated
  ) THEN v_missing := v_missing || ' fk_refund_original_credit_app'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.org_order_refunds_dtl'::regclass
      AND conname = 'chk_refund_source_type_v2'
  ) THEN v_missing := v_missing || ' chk_refund_source_type_v2'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.org_order_refunds_dtl'::regclass
      AND conname = 'chk_refund_lineage_v2'
  ) THEN v_missing := v_missing || ' chk_refund_lineage_v2'; END IF;

  IF v_missing <> '' THEN
    RAISE EXCEPTION 'B01 migration incomplete — missing:%', v_missing;
  END IF;

  RAISE NOTICE '✅ B01 refund lineage/context schema in place (unconditional v2 constraints; empty-table premise).';
END $$;

COMMIT;

-- ================================================================
-- ROLLBACK (manual, if ever needed — additive objects are inert
-- without the B01 service write path):
--
-- BEGIN;
-- ALTER TABLE public.org_order_refunds_dtl
--   DROP CONSTRAINT IF EXISTS chk_refund_lineage_v2 RESTRICT,
--   DROP CONSTRAINT IF EXISTS chk_refund_reopen_context_v2 RESTRICT,
--   DROP CONSTRAINT IF EXISTS chk_refund_context_v2 RESTRICT,
--   DROP CONSTRAINT IF EXISTS chk_refund_source_type_v2 RESTRICT,
--   DROP CONSTRAINT IF EXISTS fk_refund_original_credit_app RESTRICT,
--   DROP CONSTRAINT IF EXISTS fk_refund_orig_payment_tenant RESTRICT;
-- -- restore the 0340 source-type CHECK:
-- ALTER TABLE public.org_order_refunds_dtl
--   ADD CONSTRAINT chk_refund_source_type CHECK (refund_source_type IN (
--     'REAL_PAYMENT_REFUND','GIFT_CARD_RESTORE','WALLET_RESTORE',
--     'CUSTOMER_ADVANCE_RESTORE','CUSTOMER_CREDIT_ISSUE','CREDIT_NOTE_ISSUE',
--     'MANUAL_EXCEPTION'));
-- -- restore the 0271-era status CHECK (only if the service revert also lands):
-- -- ALTER TABLE public.org_order_refunds_dtl
-- --   ADD CONSTRAINT chk_org_order_refunds_status CHECK (refund_status IN
-- --     ('PENDING','APPROVED','PROCESSED','FAILED','CANCELLED'));
-- -- restore the single-column payment FK:
-- ALTER TABLE public.org_order_refunds_dtl
--   ADD CONSTRAINT fk_refund_original_payment
--     FOREIGN KEY (original_payment_id)
--     REFERENCES public.org_order_payments_dtl (id) ON DELETE RESTRICT;
-- DROP INDEX IF EXISTS public.idx_ord_refunds_credit_app;
-- DROP INDEX IF EXISTS public.uq_ord_credit_apps_tenant_id;
-- DROP INDEX IF EXISTS public.uq_ord_payments_tenant_id;
-- ALTER TABLE public.org_order_refunds_dtl
--   DROP COLUMN IF EXISTS refund_context,
--   DROP COLUMN IF EXISTS original_credit_app_id;
-- COMMIT;
-- ================================================================
