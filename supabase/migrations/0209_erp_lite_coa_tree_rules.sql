-- ==================================================================
-- Migration: 0209_erp_lite_coa_tree_rules.sql
-- Purpose: Enforce ERP-Lite COA tree integrity for both template and
--          tenant runtime tables while keeping legacy numeric rows valid
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Notes:
--   - Canonical target is 6-digit hierarchical numeric coding
--   - Legacy 4-digit numeric rows remain accepted during transition
--   - Accounting meaning still comes from type/group/mapping catalogs
-- ==================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_fin_code_lvl(
  p_code VARCHAR
)
RETURNS SMALLINT
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_code TEXT := btrim(COALESCE(p_code, ''));
BEGIN
  IF v_code ~ '^[0-9]{6}$' THEN
    IF RIGHT(v_code, 5) = '00000' THEN
      RETURN 1;
    ELSIF RIGHT(v_code, 4) = '0000' THEN
      RETURN 2;
    ELSIF RIGHT(v_code, 3) = '000' THEN
      RETURN 3;
    ELSE
      RETURN 4;
    END IF;
  ELSIF v_code ~ '^[0-9]{4}$' THEN
    IF RIGHT(v_code, 3) = '000' THEN
      RETURN 1;
    ELSE
      RETURN 2;
    END IF;
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_fin_prnt_code(
  p_code VARCHAR
)
RETURNS VARCHAR
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  v_code TEXT := btrim(COALESCE(p_code, ''));
  v_lvl SMALLINT;
BEGIN
  v_lvl := public.fn_fin_code_lvl(v_code);

  IF v_lvl IS NULL OR v_lvl = 1 THEN
    RETURN NULL;
  END IF;

  IF LENGTH(v_code) = 6 THEN
    CASE v_lvl
      WHEN 2 THEN RETURN SUBSTRING(v_code, 1, 1) || '00000';
      WHEN 3 THEN RETURN SUBSTRING(v_code, 1, 2) || '0000';
      WHEN 4 THEN RETURN SUBSTRING(v_code, 1, 3) || '000';
      ELSE RETURN NULL;
    END CASE;
  END IF;

  IF LENGTH(v_code) = 4 THEN
    RETURN SUBSTRING(v_code, 1, 1) || '000';
  END IF;

  RETURN NULL;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_fin_chk_tpl_line()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent public.sys_fin_coa_tpl_dtl%ROWTYPE;
  v_expected_parent VARCHAR(40);
  v_child_ct INTEGER := 0;
  v_cycle_found BOOLEAN := false;
BEGIN
  NEW.account_code := btrim(COALESCE(NEW.account_code, ''));

  IF public.fn_fin_code_lvl(NEW.account_code) IS NULL THEN
    RAISE EXCEPTION 'Template account code % must be numeric with 4 or 6 digits', NEW.account_code;
  END IF;

  NEW.account_level := public.fn_fin_code_lvl(NEW.account_code);

  IF NEW.effective_to IS NOT NULL
     AND NEW.effective_from IS NOT NULL
     AND NEW.effective_to < NEW.effective_from THEN
    RAISE EXCEPTION 'Template effective_to must be >= effective_from';
  END IF;

  IF NEW.parent_tpl_line_id IS NULL THEN
    IF NEW.account_level <> 1 THEN
      RAISE EXCEPTION 'Root template account % must use a root-level code', NEW.account_code;
    END IF;
  ELSE
    SELECT *
    INTO v_parent
    FROM public.sys_fin_coa_tpl_dtl
    WHERE coa_tpl_line_id = NEW.parent_tpl_line_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Template parent line % was not found', NEW.parent_tpl_line_id;
    END IF;

    IF v_parent.coa_tpl_id <> NEW.coa_tpl_id THEN
      RAISE EXCEPTION 'Template parent line must belong to the same COA template';
    END IF;

    IF v_parent.is_postable THEN
      RAISE EXCEPTION 'Template parent account % cannot be postable', v_parent.account_code;
    END IF;

    IF v_parent.acc_type_id <> NEW.acc_type_id THEN
      RAISE EXCEPTION 'Template child account type must match parent account type';
    END IF;

    v_expected_parent := public.fn_fin_prnt_code(NEW.account_code);

    IF v_expected_parent IS NOT NULL AND v_parent.account_code <> v_expected_parent THEN
      RAISE EXCEPTION 'Template account code % requires parent code %, but found %',
        NEW.account_code, v_expected_parent, v_parent.account_code;
    END IF;

    IF NEW.account_level <> (v_parent.account_level + 1) THEN
      RAISE EXCEPTION 'Template child depth must be exactly one level below its parent';
    END IF;

    IF TG_OP = 'UPDATE' THEN
      WITH RECURSIVE anc AS (
        SELECT coa_tpl_line_id, parent_tpl_line_id
        FROM public.sys_fin_coa_tpl_dtl
        WHERE coa_tpl_line_id = NEW.parent_tpl_line_id

        UNION ALL

        SELECT p.coa_tpl_line_id, p.parent_tpl_line_id
        FROM public.sys_fin_coa_tpl_dtl p
        JOIN anc a
          ON a.parent_tpl_line_id = p.coa_tpl_line_id
      )
      SELECT EXISTS (
        SELECT 1
        FROM anc
        WHERE coa_tpl_line_id = NEW.coa_tpl_line_id
      )
      INTO v_cycle_found;

      IF v_cycle_found THEN
        RAISE EXCEPTION 'Template hierarchy cycle detected for line %', NEW.coa_tpl_line_id;
      END IF;
    END IF;
  END IF;

  IF NEW.acc_group_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.sys_fin_acc_group_cd g
    WHERE g.acc_group_id = NEW.acc_group_id
      AND g.acc_type_id = NEW.acc_type_id
      AND g.is_active = true
      AND g.rec_status = 1
  ) THEN
    RAISE EXCEPTION 'Template account group must belong to the selected account type';
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.is_postable THEN
    SELECT COUNT(*)
    INTO v_child_ct
    FROM public.sys_fin_coa_tpl_dtl c
    WHERE c.parent_tpl_line_id = NEW.coa_tpl_line_id
      AND c.is_active = true
      AND c.rec_status = 1;

    IF v_child_ct > 0 THEN
      RAISE EXCEPTION 'Template account % cannot be postable while it has child rows', NEW.account_code;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_fin_chk_org_acct()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_parent public.org_fin_acct_mst%ROWTYPE;
  v_expected_parent VARCHAR(40);
  v_child_ct INTEGER := 0;
  v_cycle_found BOOLEAN := false;
  v_line_pkg UUID;
BEGIN
  NEW.account_code := btrim(COALESCE(NEW.account_code, ''));

  IF public.fn_fin_code_lvl(NEW.account_code) IS NULL THEN
    RAISE EXCEPTION 'Tenant account code % must be numeric with 4 or 6 digits', NEW.account_code;
  END IF;

  NEW.account_level := public.fn_fin_code_lvl(NEW.account_code);

  IF NEW.effective_to IS NOT NULL
     AND NEW.effective_from IS NOT NULL
     AND NEW.effective_to < NEW.effective_from THEN
    RAISE EXCEPTION 'Tenant effective_to must be >= effective_from';
  END IF;

  IF NEW.parent_account_id IS NULL THEN
    IF NEW.account_level <> 1 THEN
      RAISE EXCEPTION 'Root tenant account % must use a root-level code', NEW.account_code;
    END IF;
  ELSE
    SELECT *
    INTO v_parent
    FROM public.org_fin_acct_mst
    WHERE id = NEW.parent_account_id
      AND tenant_org_id = NEW.tenant_org_id;

    IF NOT FOUND THEN
      RAISE EXCEPTION 'Tenant parent account % was not found', NEW.parent_account_id;
    END IF;

    IF v_parent.is_postable THEN
      RAISE EXCEPTION 'Tenant parent account % cannot be postable', v_parent.account_code;
    END IF;

    IF v_parent.acc_type_id <> NEW.acc_type_id THEN
      RAISE EXCEPTION 'Tenant child account type must match parent account type';
    END IF;

    v_expected_parent := public.fn_fin_prnt_code(NEW.account_code);

    IF v_expected_parent IS NOT NULL AND v_parent.account_code <> v_expected_parent THEN
      RAISE EXCEPTION 'Tenant account code % requires parent code %, but found %',
        NEW.account_code, v_expected_parent, v_parent.account_code;
    END IF;

    IF NEW.account_level <> (v_parent.account_level + 1) THEN
      RAISE EXCEPTION 'Tenant child depth must be exactly one level below its parent';
    END IF;

    IF TG_OP = 'UPDATE' THEN
      WITH RECURSIVE anc AS (
        SELECT id, parent_account_id
        FROM public.org_fin_acct_mst
        WHERE id = NEW.parent_account_id
          AND tenant_org_id = NEW.tenant_org_id

        UNION ALL

        SELECT p.id, p.parent_account_id
        FROM public.org_fin_acct_mst p
        JOIN anc a
          ON a.parent_account_id = p.id
        WHERE p.tenant_org_id = NEW.tenant_org_id
      )
      SELECT EXISTS (
        SELECT 1
        FROM anc
        WHERE id = NEW.id
      )
      INTO v_cycle_found;

      IF v_cycle_found THEN
        RAISE EXCEPTION 'Tenant hierarchy cycle detected for account %', NEW.id;
      END IF;
    END IF;
  END IF;

  IF NEW.acc_group_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM public.sys_fin_acc_group_cd g
    WHERE g.acc_group_id = NEW.acc_group_id
      AND g.acc_type_id = NEW.acc_type_id
      AND g.is_active = true
      AND g.rec_status = 1
  ) THEN
    RAISE EXCEPTION 'Tenant account group must belong to the selected account type';
  END IF;

  IF NEW.source_tpl_line_id IS NOT NULL THEN
    SELECT h.tpl_pkg_id
    INTO v_line_pkg
    FROM public.sys_fin_coa_tpl_dtl d
    JOIN public.sys_fin_coa_tpl_mst h
      ON h.coa_tpl_id = d.coa_tpl_id
    WHERE d.coa_tpl_line_id = NEW.source_tpl_line_id;

    IF v_line_pkg IS NULL THEN
      RAISE EXCEPTION 'Tenant source template line % was not found', NEW.source_tpl_line_id;
    END IF;

    IF NEW.source_tpl_pkg_id IS DISTINCT FROM v_line_pkg THEN
      RAISE EXCEPTION 'Tenant source template package does not match the source template line';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND NEW.is_postable THEN
    SELECT COUNT(*)
    INTO v_child_ct
    FROM public.org_fin_acct_mst c
    WHERE c.tenant_org_id = NEW.tenant_org_id
      AND c.parent_account_id = NEW.id
      AND c.is_active = true
      AND c.rec_status = 1;

    IF v_child_ct > 0 THEN
      RAISE EXCEPTION 'Tenant account % cannot be postable while it has child rows', NEW.account_code;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.fn_fin_guard_org_acct()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_has_posted BOOLEAN := false;
  v_has_map BOOLEAN := false;
  v_has_bank BOOLEAN := false;
  v_has_cashbox BOOLEAN := false;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.is_system_seeded AND OLD.is_locked THEN
      RAISE EXCEPTION 'Protected seeded account % cannot be deleted', OLD.account_code;
    END IF;
    RETURN OLD;
  END IF;

  IF (
    NEW.account_code IS DISTINCT FROM OLD.account_code
    OR NEW.parent_account_id IS DISTINCT FROM OLD.parent_account_id
    OR NEW.acc_type_id IS DISTINCT FROM OLD.acc_type_id
  ) THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.org_fin_journal_dtl d
      JOIN public.org_fin_journal_mst h
        ON h.id = d.journal_id
       AND h.tenant_org_id = d.tenant_org_id
      WHERE d.tenant_org_id = OLD.tenant_org_id
        AND d.account_id = OLD.id
        AND d.is_active = true
        AND d.rec_status = 1
        AND h.status_code = 'POSTED'
        AND h.is_active = true
        AND h.rec_status = 1
    )
    INTO v_has_posted;

    SELECT EXISTS (
      SELECT 1
      FROM public.org_fin_usage_map_mst m
      WHERE m.tenant_org_id = OLD.tenant_org_id
        AND m.account_id = OLD.id
        AND m.status_code = 'ACTIVE'
        AND m.is_active = true
        AND m.rec_status = 1
    )
    INTO v_has_map;

    SELECT EXISTS (
      SELECT 1
      FROM public.org_fin_bank_acct_mst b
      WHERE b.tenant_org_id = OLD.tenant_org_id
        AND b.account_id = OLD.id
        AND b.is_active = true
        AND b.rec_status = 1
    )
    INTO v_has_bank;

    SELECT EXISTS (
      SELECT 1
      FROM public.org_fin_cashbox_mst c
      WHERE c.tenant_org_id = OLD.tenant_org_id
        AND c.account_id = OLD.id
        AND c.is_active = true
        AND c.rec_status = 1
    )
    INTO v_has_cashbox;

    IF (OLD.is_system_seeded AND OLD.is_locked)
       OR v_has_posted
       OR v_has_map
       OR v_has_bank
       OR v_has_cashbox THEN
      RAISE EXCEPTION 'Account % cannot change code, parent, or type after protected runtime use', OLD.account_code;
    END IF;
  END IF;

  IF OLD.is_active = true AND NEW.is_active = false THEN
    IF OLD.is_system_seeded AND OLD.is_locked THEN
      RAISE EXCEPTION 'Protected seeded account % cannot be deactivated', OLD.account_code;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_sfcd_lvlrng'
  ) THEN
    ALTER TABLE public.sys_fin_coa_tpl_dtl
      ADD CONSTRAINT chk_sfcd_lvlrng CHECK (account_level BETWEEN 1 AND 4);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_sfcd_codefm'
  ) THEN
    ALTER TABLE public.sys_fin_coa_tpl_dtl
      ADD CONSTRAINT chk_sfcd_codefm CHECK (account_code ~ '^[0-9]{4}$|^[0-9]{6}$');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_ofa_lvlrng'
  ) THEN
    ALTER TABLE public.org_fin_acct_mst
      ADD CONSTRAINT chk_ofa_lvlrng CHECK (account_level BETWEEN 1 AND 4);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_ofa_codefm'
  ) THEN
    ALTER TABLE public.org_fin_acct_mst
      ADD CONSTRAINT chk_ofa_codefm CHECK (account_code ~ '^[0-9]{4}$|^[0-9]{6}$');
  END IF;
END
$$;

DROP TRIGGER IF EXISTS trg_sfcd_tree_ck ON public.sys_fin_coa_tpl_dtl;
CREATE TRIGGER trg_sfcd_tree_ck
  BEFORE INSERT OR UPDATE
  ON public.sys_fin_coa_tpl_dtl
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_fin_chk_tpl_line();

DROP TRIGGER IF EXISTS trg_ofa_tree_ck ON public.org_fin_acct_mst;
CREATE TRIGGER trg_ofa_tree_ck
  BEFORE INSERT OR UPDATE
  ON public.org_fin_acct_mst
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_fin_chk_org_acct();

DROP TRIGGER IF EXISTS trg_ofa_guard_ck ON public.org_fin_acct_mst;
CREATE TRIGGER trg_ofa_guard_ck
  BEFORE UPDATE OR DELETE
  ON public.org_fin_acct_mst
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_fin_guard_org_acct();

COMMENT ON FUNCTION public.fn_fin_code_lvl(VARCHAR) IS
  'Returns derived COA depth for ERP-Lite account codes. Supports legacy 4-digit numeric rows and canonical 6-digit numeric rows.';
COMMENT ON FUNCTION public.fn_fin_prnt_code(VARCHAR) IS
  'Returns the expected parent account code for ERP-Lite numeric account codes.';
COMMENT ON FUNCTION public.fn_fin_chk_tpl_line() IS
  'Enforces template COA tree integrity, type alignment, parent code discipline, and non-postable parent rules.';
COMMENT ON FUNCTION public.fn_fin_chk_org_acct() IS
  'Enforces tenant COA tree integrity and template lineage consistency while preserving tenant isolation.';
COMMENT ON FUNCTION public.fn_fin_guard_org_acct() IS
  'Blocks unsafe structural changes to protected, mapped, or posted tenant accounts.';

COMMIT;
