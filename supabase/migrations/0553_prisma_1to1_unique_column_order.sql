-- ============================================================
-- Migration: 0553_prisma_1to1_unique_column_order.sql
-- Purpose:   Align composite unique column order with the matching
--            composite FKs so Prisma 6 can introspect true 1:1
--            relations without P1012. Uniqueness semantics stay
--            the same; only column order (plus one implied unique)
--            change.
-- Affected:  org_fin_bank_acct_mst, org_fin_post_snapshot_tr,
--            org_sv_funding_tenders_dtl
-- Related:   0135 (same Prisma 1:1 unique-order class),
--            0189 (uq_ofba_acct), 0213 (uq_ofps_log),
--            0412 (uq_svft_vch_line)
-- ============================================================
-- Prisma 6 requires @@unique([fk_col, tenant_org_id]) to match
-- @relation(fields: [fk_col, tenant_org_id]). Postgres UNIQUE (a,b)
-- and UNIQUE (b,a) are equivalent; Prisma is not. After this
-- migration, `npx prisma db pull` should emit valid 1:1 models for
-- these three tables. cmx_effective_permissions stays @@ignore
-- (expression unique index is not Prisma-usable).
--
-- DROP uses RESTRICT. No other FK depends on these uniques.
-- Idempotent: skip when columns are already in the target order.
-- Do not apply this file from the agent; operator review first.

BEGIN;

-- ------------------------------------------------------------
-- org_fin_bank_acct_mst.uq_ofba_acct
-- Why drop/recreate: Prisma maps fk_ofba_acct
--   FOREIGN KEY (account_id, tenant_org_id)
-- but the unique was created as (tenant_org_id, account_id).
-- Same pair uniqueness; required order is the FK order.
-- ------------------------------------------------------------
DO $$
DECLARE
  v_cols TEXT[];
BEGIN
  SELECT array_agg(a.attname ORDER BY u.ord)
    INTO v_cols
  FROM pg_constraint c
  JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS u(attnum, ord) ON TRUE
  JOIN pg_attribute a
    ON a.attrelid = c.conrelid
   AND a.attnum = u.attnum
  WHERE c.conname = 'uq_ofba_acct'
    AND c.conrelid = 'public.org_fin_bank_acct_mst'::regclass
    AND c.contype = 'u';

  IF v_cols IS NULL THEN
    -- Constraint missing (unexpected); recreate in Prisma-legal order.
    ALTER TABLE public.org_fin_bank_acct_mst
      ADD CONSTRAINT uq_ofba_acct UNIQUE (account_id, tenant_org_id);
  ELSIF v_cols <> ARRAY['account_id', 'tenant_org_id']::TEXT[] THEN
    -- Removing only to rebuild the same uniqueness with FK column order.
    ALTER TABLE public.org_fin_bank_acct_mst
      DROP CONSTRAINT uq_ofba_acct RESTRICT;
    ALTER TABLE public.org_fin_bank_acct_mst
      ADD CONSTRAINT uq_ofba_acct UNIQUE (account_id, tenant_org_id);
  END IF;
END $$;

-- One GL account maps to at most one bank-account master row per tenant.
COMMENT ON CONSTRAINT uq_ofba_acct ON public.org_fin_bank_acct_mst IS
  'One bank-account row per GL account in a tenant. Column order matches fk_ofba_acct (account_id, tenant_org_id) so Prisma can introspect a valid 1:1.';

-- ------------------------------------------------------------
-- org_fin_post_snapshot_tr.uq_ofps_log
-- Why drop/recreate: Prisma maps fk_ofps_log
--   FOREIGN KEY (posting_log_id, tenant_org_id)
-- but the unique was created as (tenant_org_id, posting_log_id).
-- ------------------------------------------------------------
DO $$
DECLARE
  v_cols TEXT[];
BEGIN
  SELECT array_agg(a.attname ORDER BY u.ord)
    INTO v_cols
  FROM pg_constraint c
  JOIN LATERAL unnest(c.conkey) WITH ORDINALITY AS u(attnum, ord) ON TRUE
  JOIN pg_attribute a
    ON a.attrelid = c.conrelid
   AND a.attnum = u.attnum
  WHERE c.conname = 'uq_ofps_log'
    AND c.conrelid = 'public.org_fin_post_snapshot_tr'::regclass
    AND c.contype = 'u';

  IF v_cols IS NULL THEN
    ALTER TABLE public.org_fin_post_snapshot_tr
      ADD CONSTRAINT uq_ofps_log UNIQUE (posting_log_id, tenant_org_id);
  ELSIF v_cols <> ARRAY['posting_log_id', 'tenant_org_id']::TEXT[] THEN
    -- Removing only to rebuild the same uniqueness with FK column order.
    ALTER TABLE public.org_fin_post_snapshot_tr
      DROP CONSTRAINT uq_ofps_log RESTRICT;
    ALTER TABLE public.org_fin_post_snapshot_tr
      ADD CONSTRAINT uq_ofps_log UNIQUE (posting_log_id, tenant_org_id);
  END IF;
END $$;

-- One immutable audit snapshot per posting-log attempt.
COMMENT ON CONSTRAINT uq_ofps_log ON public.org_fin_post_snapshot_tr IS
  'One snapshot row per posting log in a tenant. Column order matches fk_ofps_log (posting_log_id, tenant_org_id) so Prisma can introspect a valid 1:1.';

-- ------------------------------------------------------------
-- org_sv_funding_tenders_dtl.uq_svft_vch_line_tenant
-- Why add: fk_svft_vch_line is
--   FOREIGN KEY (fin_voucher_trx_line_id, tenant_org_id)
-- while uq_svft_vch_line is UNIQUE (fin_voucher_trx_line_id) only.
-- Prisma 1:1 needs a unique covering every relation field, in order.
-- The new unique is implied by uq_svft_vch_line (line id is already
-- globally unique); keep both. Name is 22 chars (limit 30).
-- ------------------------------------------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    WHERE c.conname = 'uq_svft_vch_line_tenant'
      AND c.conrelid = 'public.org_sv_funding_tenders_dtl'::regclass
      AND c.contype = 'u'
  ) THEN
    ALTER TABLE public.org_sv_funding_tenders_dtl
      ADD CONSTRAINT uq_svft_vch_line_tenant
      UNIQUE (fin_voucher_trx_line_id, tenant_org_id);
  END IF;
END $$;

-- Prisma-visible composite unique for the voucher-line 1:1; implied by uq_svft_vch_line.
COMMENT ON CONSTRAINT uq_svft_vch_line_tenant ON public.org_sv_funding_tenders_dtl IS
  'One funding-tender row per voucher line in a tenant. Exists so Prisma 1:1 can use fields (fin_voucher_trx_line_id, tenant_org_id); uq_svft_vch_line remains the stronger global unique on the line id.';

COMMIT;
