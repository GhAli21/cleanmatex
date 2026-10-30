-- ============================================================
-- Migration: 0649_rls_wrap_auth_helpers.sql
-- Purpose:   Make RLS auth helpers run once per statement instead of
--            potentially once per row. Every public policy expression that
--            calls current_tenant_id(), is_admin(), auth.uid(), auth.jwt() or
--            auth.role() directly is rewritten to (SELECT helper()), the
--            Supabase-recommended initPlan form. Measured on remote:
--            cmx_effective_permissions admin/own-row policy 40.6 ms -> 1.7 ms.
-- Semantics: unchanged. All five helpers are STABLE, take no arguments and
--            return one scalar, so per-statement evaluation yields the same
--            value as per-row evaluation. Policy names, tables, commands,
--            roles and permissive flags are untouched (ALTER POLICY only
--            replaces USING / WITH CHECK).
-- Approach:  Policies are transformed from each database's own catalog, not
--            hard-coded text, because local and remote deparse 25 policies
--            differently (org_users_mst.role is varchar remote, text local).
--            Idempotent: already-wrapped calls are skipped by a lookbehind.
-- Safety:    Single transaction with in-migration assertions; any failure
--            rolls back every change. lock_timeout makes it fail fast rather
--            than queue behind live traffic.
-- Affected:  319 policies on remote (all public policies using the helpers)
-- Related:   docs/features/Order_Fin/Performance_Enhance/RLS_InitPlan_Remediation_Plan.md
--            docs/features/Order_Fin/Performance_Enhance/technical_docs/rls_0649_policy_diff.md
-- ============================================================

SET LOCAL lock_timeout = '10s';

DO $migration$
DECLARE
  -- Unwrapped helper call: not preceded by "SELECT ", whole identifier, no args.
  c_re   CONSTANT TEXT := '(?<!SELECT )\m(auth\.(?:uid|jwt|role)|(?:public\.)?(?:current_tenant_id|is_admin))\(\)';
  -- Deparsed initPlan wrapper, e.g. "( SELECT auth.uid() AS uid)", normalized back to "auth.uid()".
  c_unwrap CONSTANT TEXT := '\(\s*SELECT\s+([a-z_.]+)\(\)(?:\s+AS\s+[a-z_]+)?\s*\)';
  c_note CONSTANT TEXT := '0649: auth helpers wrapped as (SELECT fn()) for once-per-statement evaluation; isolation logic unchanged.';
  r          RECORD;
  v_qual     TEXT;
  v_check    TEXT;
  v_sql      TEXT;
  v_comment  TEXT;
  v_changed  INTEGER := 0;
  v_bad      INTEGER;
BEGIN
  -- Snapshot of every public policy before any change; drives both the rewrite and the assertions.
  CREATE TEMP TABLE tmp_0649_pol ON COMMIT DROP AS
  SELECT p.oid, c.relname AS tablename, p.polname, p.polcmd, p.polroles, p.polpermissive,
         pg_get_expr(p.polqual, p.polrelid)      AS qual,
         pg_get_expr(p.polwithcheck, p.polrelid) AS with_check
  FROM pg_policy p
  JOIN pg_class c ON c.oid = p.polrelid
  WHERE c.relnamespace = 'public'::regnamespace;

  FOR r IN SELECT * FROM tmp_0649_pol ORDER BY tablename, polname LOOP
    v_qual  := regexp_replace(r.qual,       c_re, '(SELECT \1())', 'g');
    v_check := regexp_replace(r.with_check, c_re, '(SELECT \1())', 'g');

    CONTINUE WHEN v_qual IS NOT DISTINCT FROM r.qual AND v_check IS NOT DISTINCT FROM r.with_check;

    v_sql := format('ALTER POLICY %I ON public.%I', r.polname, r.tablename);
    IF r.qual IS NOT NULL THEN
      v_sql := v_sql || format(' USING (%s)', v_qual);
    END IF;
    IF r.with_check IS NOT NULL THEN
      v_sql := v_sql || format(' WITH CHECK (%s)', v_check);
    END IF;
    EXECUTE v_sql;

    -- Keep any existing policy comment; append the 0649 note (repository documentation rule).
    v_comment := obj_description(r.oid, 'pg_policy');
    EXECUTE format('COMMENT ON POLICY %I ON public.%I IS %L',
                   r.polname, r.tablename,
                   CASE WHEN v_comment IS NULL OR v_comment = '' THEN c_note ELSE v_comment || ' | ' || c_note END);

    v_changed := v_changed + 1;
  END LOOP;

  -- Assertion 1: no policy added or removed, and identity/command/roles/permissive unchanged.
  SELECT count(*) INTO v_bad
  FROM tmp_0649_pol s
  FULL JOIN (
    SELECT p.oid, c.relname AS tablename, p.polname, p.polcmd, p.polroles, p.polpermissive
    FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
    WHERE c.relnamespace = 'public'::regnamespace
  ) n ON n.oid = s.oid
  WHERE s.oid IS NULL OR n.oid IS NULL
     OR (s.tablename, s.polname, s.polcmd, s.polroles, s.polpermissive)
        IS DISTINCT FROM (n.tablename, n.polname, n.polcmd, n.polroles, n.polpermissive);
  IF v_bad > 0 THEN
    RAISE EXCEPTION '0649: % policies changed identity/command/roles/permissive', v_bad;
  END IF;

  -- Assertion 2: no unwrapped helper call remains.
  SELECT count(*) INTO v_bad
  FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
  WHERE c.relnamespace = 'public'::regnamespace
    AND (coalesce(pg_get_expr(p.polqual, p.polrelid), '') ~ c_re
      OR coalesce(pg_get_expr(p.polwithcheck, p.polrelid), '') ~ c_re);
  IF v_bad > 0 THEN
    RAISE EXCEPTION '0649: % policies still contain unwrapped auth helpers', v_bad;
  END IF;

  -- Assertion 3: removing the wrappers gives back the original expression exactly,
  -- so nothing but the wrapping changed.
  SELECT count(*) INTO v_bad
  FROM tmp_0649_pol s
  JOIN pg_policy p ON p.oid = s.oid
  WHERE regexp_replace(coalesce(pg_get_expr(p.polqual, p.polrelid), ''), c_unwrap, '\1()', 'g') <> coalesce(s.qual, '')
     OR regexp_replace(coalesce(pg_get_expr(p.polwithcheck, p.polrelid), ''), c_unwrap, '\1()', 'g') <> coalesce(s.with_check, '');
  IF v_bad > 0 THEN
    RAISE EXCEPTION '0649: % policies differ from the original beyond the helper wrapping', v_bad;
  END IF;

  RAISE NOTICE '0649: wrapped auth helpers in % policies', v_changed;
END
$migration$;
