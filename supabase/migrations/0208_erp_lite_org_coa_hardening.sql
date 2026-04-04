-- ==================================================================
-- Migration: 0208_erp_lite_org_coa_hardening.sql
-- Purpose: Harden tenant ERP-Lite COA runtime rows for template lineage,
--          locked seeded governance, and hierarchy depth tracking
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Notes:
--   - Preserves existing tenant accounts
--   - Backfills account_level from the current parent chain
--   - Does NOT change tenant account codes in-place
-- ==================================================================

BEGIN;

ALTER TABLE public.org_fin_acct_mst
  ADD COLUMN IF NOT EXISTS account_level SMALLINT,
  ADD COLUMN IF NOT EXISTS is_system_seeded BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS source_tpl_pkg_id UUID,
  ADD COLUMN IF NOT EXISTS source_tpl_line_id UUID,
  ADD COLUMN IF NOT EXISTS allow_tenant_children BOOLEAN NOT NULL DEFAULT false;

WITH RECURSIVE acct_tree AS (
  SELECT
    a.id,
    1::smallint AS lvl
  FROM public.org_fin_acct_mst a
  WHERE a.parent_account_id IS NULL

  UNION ALL

  SELECT
    c.id,
    (p.lvl + 1)::smallint
  FROM public.org_fin_acct_mst c
  JOIN acct_tree p
    ON p.id = c.parent_account_id
)
UPDATE public.org_fin_acct_mst a
SET account_level = t.lvl
FROM acct_tree t
WHERE a.id = t.id
  AND a.account_level IS DISTINCT FROM t.lvl;

UPDATE public.org_fin_acct_mst
SET account_level = 1
WHERE account_level IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_ofa_tplpkg'
  ) THEN
    ALTER TABLE public.org_fin_acct_mst
      ADD CONSTRAINT fk_ofa_tplpkg FOREIGN KEY (source_tpl_pkg_id)
      REFERENCES public.sys_fin_tpl_pkg_mst(tpl_pkg_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_ofa_tplline'
  ) THEN
    ALTER TABLE public.org_fin_acct_mst
      ADD CONSTRAINT fk_ofa_tplline FOREIGN KEY (source_tpl_line_id)
      REFERENCES public.sys_fin_coa_tpl_dtl(coa_tpl_line_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_ofa_tplsrc'
  ) THEN
    ALTER TABLE public.org_fin_acct_mst
      ADD CONSTRAINT chk_ofa_tplsrc CHECK (
        (source_tpl_line_id IS NULL AND source_tpl_pkg_id IS NULL)
        OR (source_tpl_line_id IS NOT NULL AND source_tpl_pkg_id IS NOT NULL)
      );
  END IF;
END
$$;

ALTER TABLE public.org_fin_acct_mst
  ALTER COLUMN account_level SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS uq_ofa_tplline
  ON public.org_fin_acct_mst(tenant_org_id, source_tpl_line_id)
  WHERE source_tpl_line_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ofa_lvl
  ON public.org_fin_acct_mst(tenant_org_id, account_level, account_code);

CREATE INDEX IF NOT EXISTS idx_ofa_seed
  ON public.org_fin_acct_mst(tenant_org_id, is_system_seeded, is_locked, is_active);

CREATE INDEX IF NOT EXISTS idx_ofa_tplpkg
  ON public.org_fin_acct_mst(tenant_org_id, source_tpl_pkg_id)
  WHERE source_tpl_pkg_id IS NOT NULL;

COMMENT ON COLUMN public.org_fin_acct_mst.account_level IS
  'Derived hierarchy depth for the tenant COA tree. Existing rows are backfilled from parent relationships.';
COMMENT ON COLUMN public.org_fin_acct_mst.is_system_seeded IS
  'True marks accounts materialized from a published HQ template or guarded default seed.';
COMMENT ON COLUMN public.org_fin_acct_mst.is_locked IS
  'True marks a protected tenant account that requires governed workflows for structural changes.';
COMMENT ON COLUMN public.org_fin_acct_mst.source_tpl_pkg_id IS
  'Published HQ template package that originally materialized the tenant account.';
COMMENT ON COLUMN public.org_fin_acct_mst.source_tpl_line_id IS
  'Exact HQ template COA line that originally materialized the tenant account.';
COMMENT ON COLUMN public.org_fin_acct_mst.allow_tenant_children IS
  'True allows tenant-defined descendants under this account when tree and posting rules permit it.';

COMMIT;
