-- ==================================================================
-- Migration: 0207_erp_lite_coa_tpl_hardening.sql
-- Purpose: Harden ERP-Lite COA template tables for hierarchical coding
--          and safer usage-to-template binding
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Notes:
--   - Keeps legacy template rows compatible during transition
--   - Adds governance fields needed for safe tenant materialization
--   - Does NOT execute tenant provisioning
-- ==================================================================

BEGIN;

ALTER TABLE public.sys_fin_coa_tpl_dtl
  ADD COLUMN IF NOT EXISTS account_level SMALLINT,
  ADD COLUMN IF NOT EXISTS is_system_seeded BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_rename BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_code_change BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_tenant_children BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS effective_from DATE,
  ADD COLUMN IF NOT EXISTS effective_to DATE;

ALTER TABLE public.sys_fin_usage_tpl_dtl
  ADD COLUMN IF NOT EXISTS coa_tpl_line_id UUID,
  ADD COLUMN IF NOT EXISTS effective_from DATE,
  ADD COLUMN IF NOT EXISTS effective_to DATE;

WITH RECURSIVE tpl_tree AS (
  SELECT
    d.coa_tpl_line_id,
    1::smallint AS lvl
  FROM public.sys_fin_coa_tpl_dtl d
  WHERE d.parent_tpl_line_id IS NULL

  UNION ALL

  SELECT
    c.coa_tpl_line_id,
    (p.lvl + 1)::smallint
  FROM public.sys_fin_coa_tpl_dtl c
  JOIN tpl_tree p
    ON p.coa_tpl_line_id = c.parent_tpl_line_id
)
UPDATE public.sys_fin_coa_tpl_dtl d
SET account_level = t.lvl
FROM tpl_tree t
WHERE d.coa_tpl_line_id = t.coa_tpl_line_id
  AND d.account_level IS DISTINCT FROM t.lvl;

UPDATE public.sys_fin_coa_tpl_dtl
SET account_level = 1
WHERE account_level IS NULL;

UPDATE public.sys_fin_usage_tpl_dtl u
SET coa_tpl_line_id = d.coa_tpl_line_id
FROM public.sys_fin_coa_tpl_mst h
JOIN public.sys_fin_coa_tpl_dtl d
  ON d.coa_tpl_id = h.coa_tpl_id
WHERE h.tpl_pkg_id = u.tpl_pkg_id
  AND d.account_code = u.target_account_code
  AND u.coa_tpl_line_id IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'fk_sfutd_line'
  ) THEN
    ALTER TABLE public.sys_fin_usage_tpl_dtl
      ADD CONSTRAINT fk_sfutd_line FOREIGN KEY (coa_tpl_line_id)
      REFERENCES public.sys_fin_coa_tpl_dtl(coa_tpl_line_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_sfcd_eff'
  ) THEN
    ALTER TABLE public.sys_fin_coa_tpl_dtl
      ADD CONSTRAINT chk_sfcd_eff CHECK (
        effective_to IS NULL
        OR effective_from IS NULL
        OR effective_to >= effective_from
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'chk_sfutd_eff'
  ) THEN
    ALTER TABLE public.sys_fin_usage_tpl_dtl
      ADD CONSTRAINT chk_sfutd_eff CHECK (
        effective_to IS NULL
        OR effective_from IS NULL
        OR effective_to >= effective_from
      );
  END IF;
END
$$;

ALTER TABLE public.sys_fin_coa_tpl_dtl
  ALTER COLUMN account_level SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sfcd_lvl
  ON public.sys_fin_coa_tpl_dtl(coa_tpl_id, account_level, account_code);

CREATE INDEX IF NOT EXISTS idx_sfcd_lock
  ON public.sys_fin_coa_tpl_dtl(coa_tpl_id, is_locked, is_postable, is_active);

CREATE INDEX IF NOT EXISTS idx_sfutd_line
  ON public.sys_fin_usage_tpl_dtl(coa_tpl_line_id)
  WHERE coa_tpl_line_id IS NOT NULL;

COMMENT ON COLUMN public.sys_fin_coa_tpl_dtl.account_level IS
  'Derived hierarchy depth for the template COA tree. Legacy rows are backfilled from existing parent links.';
COMMENT ON COLUMN public.sys_fin_coa_tpl_dtl.is_system_seeded IS
  'True marks canonical HQ-authored lines that should materialize as seeded tenant accounts.';
COMMENT ON COLUMN public.sys_fin_coa_tpl_dtl.is_locked IS
  'True marks template lines that should materialize as protected tenant accounts.';
COMMENT ON COLUMN public.sys_fin_coa_tpl_dtl.allow_tenant_children IS
  'True allows tenant-local child accounts under the materialized account when runtime rules permit it.';
COMMENT ON COLUMN public.sys_fin_usage_tpl_dtl.coa_tpl_line_id IS
  'Authoritative binding from usage mapping template row to one template COA line. target_account_code remains as a transition aid.';

COMMIT;
