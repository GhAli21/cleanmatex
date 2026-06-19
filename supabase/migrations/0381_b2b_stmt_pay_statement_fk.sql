-- ==================================================================
-- Migration: 0381_b2b_stmt_pay_statement_fk.sql
-- Purpose : Add the statement FK that 0380's guarded DO block correctly
--           SKIPPED, using a COMPOSITE (tenant-scoped) FK per project
--           convention (defense-in-depth tenant isolation).
--
--           org_b2b_statements_mst is keyed PRIMARY KEY (id) — single
--           column (verified 2026-06-19), so a composite FK to
--           (id, tenant_org_id) is not possible until that pair is unique.
--           This migration therefore:
--             1. Adds UNIQUE (id, tenant_org_id) on org_b2b_statements_mst
--                (trivially satisfied — id is already PK/unique — and it
--                 enables the composite FK below).
--             2. Adds the composite FK on the detail table:
--                org_b2b_statement_payments_dtl(statement_id, tenant_org_id)
--                  -> org_b2b_statements_mst(id, tenant_org_id).
--
-- Safe    : additive; org_b2b_statement_payments_dtl is newly created (0380)
--           and empty (no orphan rows); UNIQUE (id, tenant_org_id) cannot
--           fail because id is already unique. RESTRICT only (no CASCADE).
--           Idempotent / re-runnable. The UNIQUE is added before the FK in
--           the same transaction so the FK can reference it.
-- Do NOT apply via agent — user reviews and runs migrations manually.
-- ==================================================================

BEGIN;

-- 1. Enable the composite tenant key on the referenced master table.
DO $add_uq$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'uq_b2b_statements_id_tenant'
      AND conrelid = 'public.org_b2b_statements_mst'::regclass
  ) THEN
    ALTER TABLE public.org_b2b_statements_mst
      ADD CONSTRAINT uq_b2b_statements_id_tenant UNIQUE (id, tenant_org_id);
    RAISE NOTICE '0381: uq_b2b_statements_id_tenant added on org_b2b_statements_mst.';
  ELSE
    RAISE NOTICE '0381: uq_b2b_statements_id_tenant already present — skipped.';
  END IF;
END
$add_uq$;

-- 2. Composite tenant-scoped FK on the detail table.
DO $add_fk$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'fk_b2b_stmt_pay_statement'
      AND conrelid = 'public.org_b2b_statement_payments_dtl'::regclass
  ) THEN
    ALTER TABLE public.org_b2b_statement_payments_dtl
      ADD CONSTRAINT fk_b2b_stmt_pay_statement
      FOREIGN KEY (statement_id, tenant_org_id)
      REFERENCES public.org_b2b_statements_mst (id, tenant_org_id)
      ON UPDATE RESTRICT
      ON DELETE RESTRICT;
    RAISE NOTICE '0381: fk_b2b_stmt_pay_statement added (composite).';
  ELSE
    RAISE NOTICE '0381: fk_b2b_stmt_pay_statement already present — skipped.';
  END IF;
END
$add_fk$;

COMMENT ON CONSTRAINT fk_b2b_stmt_pay_statement ON public.org_b2b_statement_payments_dtl IS
  'Composite tenant-scoped FK: (statement_id, tenant_org_id) -> org_b2b_statements_mst(id, tenant_org_id). Enabled by uq_b2b_statements_id_tenant (0381).';

COMMIT;

-- ------------------------------------------------------------------
-- Rollback (RESTRICT only — no CASCADE):
--   BEGIN;
--     ALTER TABLE public.org_b2b_statement_payments_dtl
--       DROP CONSTRAINT IF EXISTS fk_b2b_stmt_pay_statement RESTRICT;
--     ALTER TABLE public.org_b2b_statements_mst
--       DROP CONSTRAINT IF EXISTS uq_b2b_statements_id_tenant RESTRICT;
--   COMMIT;
-- Note: drop the FK before the UNIQUE (the FK depends on it).
-- ==================================================================