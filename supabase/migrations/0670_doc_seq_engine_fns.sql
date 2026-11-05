--
-- Migration 0670_doc_seq_engine_fns.sql
-- Human-Friendly Codes, P1 (DB engine), migration 5 of 7.
--
-- Purpose: the shared document-number engine, plus S5 hardening of two existing DOMAIN generators.
--   fn_doc_seq_period_key(reset, at, tz, fy_start)        counter period ('' | YYYY | YYYYMM | YYYYMMDD | FY<year>)
--   fn_doc_seq_format_row(cfg, value, at, tz, fy_start)   prints a code from a config row already read (no table read)
--   fn_doc_seq_format(doc_type, value, at, tz, fy_start)  thin wrapper: reads the config row, then fn_doc_seq_format_row
--   fn_doc_seq_type_check(cfg, doc_type, scope)           internal: raises unless cfg is an active GENERAL type of scope
--   fn_doc_seq_type_get(doc_type, scope)                  internal: reads the config row, then fn_doc_seq_type_check
--   fn_doc_seq_caller_role()                              internal: JWT role of the caller; refuses anon / other roles
--   fn_doc_seq_next_by_row(tenant, cfg, at)               internal: the counter increment + format for a checked row
--   fn_doc_seq_next(tenant, doc_type, at)                 TENANT_ORG: atomic per-tenant counter (row lock to commit)
--   fn_sys_doc_seq_next(doc_type, at)                     SYS scope counter (HQ time zone / fiscal start)
--   fn_hq_doc_seq_next(doc_type, at)                      HQ scope counter (HQ time zone / fiscal start)
--   fn_doc_seq_assign_code()                              generic BEFORE INSERT trigger: fills an empty code column
--   fn_doc_seq_guard_immutable()                          generic BEFORE UPDATE OF <col> trigger: a set code never changes
-- Nothing is attached to a business table here; P2+ migrations attach triggers per doc type.
-- Time zone: tenant org_tenants_mst.timezone, falling back to hq_general_config.timezone when NULL/invalid.
-- Fiscal start: tenant fiscal_year_start_month, falling back to hq_general_config.
-- Caller check: a JWT role 'authenticated' may only number its own tenant; anon and other roles are refused.
--
-- Performance (revised before first apply, approved 2026-10-30; numbers in DEV_GUIDE_DOC_SEQ_ENGINE.md):
--   * One read of sys_doc_seq_type_cd per number (was 2 via the functions, 3 via the trigger): the next functions
--     pass the row from fn_doc_seq_type_get to fn_doc_seq_next_by_row / fn_doc_seq_format_row.
--   * One read of the tenant + hq_general_config per number (second hq read only when the tenant zone is invalid).
--   * The JWT claim is parsed once per number; current_tenant_id() runs only for role 'authenticated'.
--   * The counter row stays locked until the caller COMMITs. Keep numbering transactions short: no HTTP, queue
--     or other slow work inside them, and take the number as late as possible (just before the INSERT).
--
-- Generic triggers vs busy tables:
--   fn_doc_seq_assign_code / fn_doc_seq_guard_immutable are generic (TG_ARGV + one to_jsonb(NEW) and one
--   jsonb_populate_record per row). Fine for low-volume tables. For a busy table (orders, invoices, payments)
--   write a small typed trigger function that sets NEW.<col> directly, and attach the guard only when the code
--   really changes:
--     CREATE FUNCTION public.fn_<x>_no_assign() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
--       SET search_path = pg_catalog, public, pg_temp AS $f$
--     BEGIN
--       IF NEW.<col> IS NULL OR btrim(NEW.<col>) = '' THEN
--         NEW.<col> := public.fn_doc_seq_next(NEW.tenant_org_id, '<DOC_TYPE>', now());
--       END IF;
--       RETURN NEW;
--     END $f$;
--     REVOKE ALL ON FUNCTION public.fn_<x>_no_assign() FROM PUBLIC, anon, authenticated;
--     CREATE TRIGGER trg_<x>_no_assign BEFORE INSERT ON <table>
--       FOR EACH ROW EXECUTE FUNCTION public.fn_<x>_no_assign();
--     CREATE TRIGGER trg_<x>_no_guard BEFORE UPDATE OF <col> ON <table>
--       FOR EACH ROW WHEN (OLD.<col> IS DISTINCT FROM NEW.<col>)
--       EXECUTE FUNCTION public.fn_doc_seq_guard_immutable('<col>');
--   The WHEN clause is checked in C before any PL/pgSQL runs, so updates that do not change the code cost nothing.
--   Use the same WHEN clause with the generic guard on any table.
--
-- S5 hardening (INVENTORY S5, approved 2026-10-30), same signatures and behaviour:
--   fn_next_fin_doc_no(UUID, VARCHAR)   + SET search_path; LPAD no longer truncates numbers longer than the pad;
--                                       EXECUTE revoked from PUBLIC/anon/authenticated, granted to service_role.
--   generate_cash_drawer_sess_no(UUID)  + SET search_path; EXECUTE revoked from PUBLIC/anon/authenticated,
--                                       granted to service_role.
--   All callers are server-side Prisma $queryRaw (erp-lite-posting-engine, order-refund, ar-invoice,
--   cash-drawer-session services); the Prisma connection role owns the functions, so they are unaffected.
--
-- Affected: 12 new functions; 2 existing functions replaced (same signature).
-- Related:  0214 (fn_next_fin_doc_no), 0519 (generate_cash_drawer_sess_no); migrations doc_seq_type_config,
--           hq_general_config, doc_seq_counters.
-- Plan:     docs/features/Human_Friendly_Codes/IMPLEMENTATION_PLAN_Human_Friendly_Codes.md section 5.5.
-- APPLY ORDER: 5 of 7 in P1. Requires doc_seq_type_config, hq_general_config, doc_seq_counters. Pre-check: the
--              Prisma DATABASE_URL role owns fn_next_fin_doc_no (see DEV_GUIDE_DOC_SEQ_ENGINE.md, pre-apply Q-N1).
-- ROLLBACK PLAN (forward-only repo; write a new migration). Drop P2+ triggers first, then, RESTRICT:
--   DROP FUNCTION public.fn_doc_seq_guard_immutable(), public.fn_doc_seq_assign_code(),
--     public.fn_hq_doc_seq_next(text,timestamptz), public.fn_sys_doc_seq_next(text,timestamptz),
--     public.fn_doc_seq_next(uuid,text,timestamptz),
--     public.fn_doc_seq_next_by_row(uuid,public.sys_doc_seq_type_cd,timestamptz),
--     public.fn_doc_seq_caller_role(), public.fn_doc_seq_type_get(text,text),
--     public.fn_doc_seq_type_check(public.sys_doc_seq_type_cd,text,text),
--     public.fn_doc_seq_format(text,bigint,timestamptz,text,smallint),
--     public.fn_doc_seq_format_row(public.sys_doc_seq_type_cd,bigint,timestamptz,text,smallint),
--     public.fn_doc_seq_period_key(text,timestamptz,text,smallint) RESTRICT;
--   Re-create the 0214 / 0519 bodies of the two hardened functions and GRANT EXECUTE back to PUBLIC.
--
BEGIN;
SET LOCAL lock_timeout = '10s';

-- 1. fn_doc_seq_period_key ---------------------------------------------------------------------------------
CREATE FUNCTION public.fn_doc_seq_period_key(
  p_reset    TEXT,
  p_at       TIMESTAMPTZ,
  p_tz       TEXT,
  p_fy_start SMALLINT
) RETURNS TEXT
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_local TIMESTAMP;
  v_fy    INT;
BEGIN
  IF p_at IS NULL OR p_tz IS NULL THEN
    RAISE EXCEPTION 'DOC_SEQ_BAD_ARGS: time and time zone are required' USING ERRCODE = '22023';
  END IF;
  v_local := p_at AT TIME ZONE p_tz;
  CASE p_reset
    WHEN 'NEVER'   THEN RETURN '';
    WHEN 'YEARLY'  THEN RETURN to_char(v_local, 'YYYY');
    WHEN 'MONTHLY' THEN RETURN to_char(v_local, 'YYYYMM');
    WHEN 'DAILY'   THEN RETURN to_char(v_local, 'YYYYMMDD');
    WHEN 'FISCAL_YEAR' THEN
      IF COALESCE(p_fy_start, 1) NOT BETWEEN 1 AND 12 THEN
        RAISE EXCEPTION 'DOC_SEQ_BAD_FY_START: %', p_fy_start USING ERRCODE = '22023';
      END IF;
      v_fy := extract(year FROM v_local)::INT
              - CASE WHEN extract(month FROM v_local) < COALESCE(p_fy_start, 1) THEN 1 ELSE 0 END;
      RETURN 'FY' || v_fy;
    ELSE
      RAISE EXCEPTION 'DOC_SEQ_BAD_RESET: %', COALESCE(p_reset, '<null>') USING ERRCODE = '22023';
  END CASE;
END $$;
COMMENT ON FUNCTION public.fn_doc_seq_period_key(TEXT, TIMESTAMPTZ, TEXT, SMALLINT) IS
  'Counter period for a reset policy at a moment in a time zone: NEVER -> empty, YEARLY -> YYYY, MONTHLY -> YYYYMM, DAILY -> YYYYMMDD, FISCAL_YEAR -> FY<year the fiscal year starts> (start month p_fy_start, default 1). PER_PARENT/unknown -> DOC_SEQ_BAD_RESET.';

-- 2. fn_doc_seq_format_row / fn_doc_seq_format -----------------------------------------------------------------
CREATE FUNCTION public.fn_doc_seq_format_row(
  p_cfg      public.sys_doc_seq_type_cd,
  p_value    BIGINT,
  p_at       TIMESTAMPTZ,
  p_tz       TEXT,
  p_fy_start SMALLINT
) RETURNS TEXT
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_local TIMESTAMP;
  v_fy    INT;
  v_tok   TEXT;
  v_seq   TEXT;
  v_parts TEXT[] := ARRAY[]::TEXT[];
BEGIN
  IF p_value IS NULL OR p_value < 1 THEN
    RAISE EXCEPTION 'DOC_SEQ_BAD_VALUE: %', p_value USING ERRCODE = '22023';
  END IF;
  IF p_at IS NULL OR p_tz IS NULL THEN
    RAISE EXCEPTION 'DOC_SEQ_BAD_ARGS: time and time zone are required' USING ERRCODE = '22023';
  END IF;
  IF p_cfg.doc_type_code IS NULL THEN
    RAISE EXCEPTION 'DOC_SEQ_TYPE_NOT_FOUND: <null>' USING ERRCODE = 'P0002';
  END IF;
  v_local := p_at AT TIME ZONE p_tz;
  v_fy := extract(year FROM v_local)::INT
          - CASE WHEN p_cfg.reset_policy = 'FISCAL_YEAR' AND extract(month FROM v_local) < COALESCE(p_fy_start, 1) THEN 1 ELSE 0 END;
  v_seq := p_value::TEXT;
  IF length(v_seq) < p_cfg.seq_pad_length THEN
    v_seq := lpad(v_seq, p_cfg.seq_pad_length, '0');   -- pads only; a longer number is printed in full
  END IF;
  FOREACH v_tok IN ARRAY string_to_array(p_cfg.parts_format, '-') LOOP
    v_parts := v_parts || CASE v_tok
      WHEN 'SEQ'      THEN v_seq
      WHEN 'YYYY'     THEN CASE WHEN p_cfg.reset_policy = 'FISCAL_YEAR' THEN v_fy::TEXT ELSE to_char(v_local, 'YYYY') END
      WHEN 'YY'       THEN CASE WHEN p_cfg.reset_policy = 'FISCAL_YEAR' THEN right(v_fy::TEXT, 2) ELSE to_char(v_local, 'YY') END
      WHEN 'YYYYMM'   THEN to_char(v_local, 'YYYYMM')
      WHEN 'YYMM'     THEN to_char(v_local, 'YYMM')
      WHEN 'YYYYMMDD' THEN to_char(v_local, 'YYYYMMDD')
      ELSE NULL
    END;
    IF v_parts[array_length(v_parts, 1)] IS NULL THEN
      RAISE EXCEPTION 'DOC_SEQ_TOKEN_NOT_ENABLED: % in %', v_tok, p_cfg.doc_type_code USING ERRCODE = '0A000';
    END IF;
  END LOOP;
  RETURN CASE WHEN COALESCE(p_cfg.prefix, '') = '' THEN '' ELSE p_cfg.prefix || p_cfg.separator END
         || array_to_string(v_parts, p_cfg.separator);
END $$;
COMMENT ON FUNCTION public.fn_doc_seq_format_row(public.sys_doc_seq_type_cd, BIGINT, TIMESTAMPTZ, TEXT, SMALLINT) IS
  'Prints a code from a sys_doc_seq_type_cd row the caller already read (no table access): prefix + separator + parts joined by the separator. SEQ is left-padded to seq_pad_length and never truncated. YYYY/YY print the fiscal year when the reset policy is FISCAL_YEAR. BR, PARENT and RAND raise DOC_SEQ_TOKEN_NOT_ENABLED. Used by the engine; fn_doc_seq_format is the by-code wrapper.';

CREATE FUNCTION public.fn_doc_seq_format(
  p_doc_type TEXT,
  p_value    BIGINT,
  p_at       TIMESTAMPTZ,
  p_tz       TEXT,
  p_fy_start SMALLINT
) RETURNS TEXT
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  r public.sys_doc_seq_type_cd%ROWTYPE;
BEGIN
  IF p_value IS NULL OR p_value < 1 THEN
    RAISE EXCEPTION 'DOC_SEQ_BAD_VALUE: %', p_value USING ERRCODE = '22023';
  END IF;
  IF p_at IS NULL OR p_tz IS NULL THEN
    RAISE EXCEPTION 'DOC_SEQ_BAD_ARGS: time and time zone are required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO r FROM public.sys_doc_seq_type_cd WHERE doc_type_code = p_doc_type;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'DOC_SEQ_TYPE_NOT_FOUND: %', p_doc_type USING ERRCODE = 'P0002';
  END IF;
  RETURN public.fn_doc_seq_format_row(r, p_value, p_at, p_tz, p_fy_start);
END $$;
COMMENT ON FUNCTION public.fn_doc_seq_format(TEXT, BIGINT, TIMESTAMPTZ, TEXT, SMALLINT) IS
  'Prints a code for a doc type code: reads its sys_doc_seq_type_cd row, then fn_doc_seq_format_row. SEQ is left-padded to seq_pad_length and never truncated. YYYY/YY print the fiscal year when the reset policy is FISCAL_YEAR. BR, PARENT and RAND raise DOC_SEQ_TOKEN_NOT_ENABLED (not engine tokens yet). Used by HQ preview.';

-- 3. fn_doc_seq_type_check / fn_doc_seq_type_get (internal) ------------------------------------------------
CREATE FUNCTION public.fn_doc_seq_type_check(p_cfg public.sys_doc_seq_type_cd, p_doc_type TEXT, p_scope TEXT)
RETURNS VOID
LANGUAGE plpgsql
IMMUTABLE
PARALLEL SAFE
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF p_cfg.doc_type_code IS NULL THEN
    RAISE EXCEPTION 'DOC_SEQ_TYPE_NOT_FOUND: %', p_doc_type USING ERRCODE = 'P0002';
  END IF;
  IF NOT p_cfg.is_active OR p_cfg.rec_status <> 1 THEN
    RAISE EXCEPTION 'DOC_SEQ_TYPE_INACTIVE: %', p_doc_type USING ERRCODE = 'P0001';
  END IF;
  IF p_cfg.manage_by_level <> 'GENERAL' THEN
    RAISE EXCEPTION 'DOC_SEQ_NOT_GENERAL: % is %', p_doc_type, p_cfg.manage_by_level USING ERRCODE = 'P0001';
  END IF;
  IF p_cfg.scope_code <> p_scope THEN
    RAISE EXCEPTION 'DOC_SEQ_SCOPE_MISMATCH: % is %, called as %', p_doc_type, p_cfg.scope_code, p_scope USING ERRCODE = 'P0001';
  END IF;
END $$;
COMMENT ON FUNCTION public.fn_doc_seq_type_check(public.sys_doc_seq_type_cd, TEXT, TEXT) IS
  'Internal: raises DOC_SEQ_TYPE_NOT_FOUND (NULL row) / DOC_SEQ_TYPE_INACTIVE / DOC_SEQ_NOT_GENERAL / DOC_SEQ_SCOPE_MISMATCH unless the row is an active GENERAL doc type of the scope. No table access.';

CREATE FUNCTION public.fn_doc_seq_type_get(p_doc_type TEXT, p_scope TEXT)
RETURNS public.sys_doc_seq_type_cd
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  r public.sys_doc_seq_type_cd%ROWTYPE;
BEGIN
  SELECT * INTO r FROM public.sys_doc_seq_type_cd WHERE doc_type_code = p_doc_type;
  PERFORM public.fn_doc_seq_type_check(r, p_doc_type, p_scope);
  RETURN r;
END $$;
COMMENT ON FUNCTION public.fn_doc_seq_type_get(TEXT, TEXT) IS
  'Internal: returns the config row of an active GENERAL doc type in the expected scope, or raises DOC_SEQ_TYPE_NOT_FOUND / DOC_SEQ_TYPE_INACTIVE / DOC_SEQ_NOT_GENERAL / DOC_SEQ_SCOPE_MISMATCH (fn_doc_seq_type_check).';

-- 4. Caller check (internal) --------------------------------------------------------------------------------
CREATE FUNCTION public.fn_doc_seq_caller_role()
RETURNS TEXT
LANGUAGE plpgsql
STABLE
PARALLEL SAFE
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_role TEXT := COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
BEGIN
  IF v_role NOT IN ('', 'authenticated', 'service_role') THEN
    RAISE EXCEPTION 'DOC_SEQ_TENANT_MISMATCH: role % may not issue numbers', v_role USING ERRCODE = '42501';
  END IF;
  RETURN v_role;
END $$;
COMMENT ON FUNCTION public.fn_doc_seq_caller_role() IS
  'Internal: JWT role of the caller ('''' = server connection without JWT). Raises DOC_SEQ_TENANT_MISMATCH (42501) for anon or any other role.';

-- 5. fn_doc_seq_next_by_row (internal) -----------------------------------------------------------------------
-- No caller check here: every caller (fn_doc_seq_next, fn_sys_doc_seq_next, fn_hq_doc_seq_next,
-- fn_doc_seq_assign_code) checks the caller and the config row first. EXECUTE stays with the owner only.
CREATE FUNCTION public.fn_doc_seq_next_by_row(
  p_tenant UUID,
  p_cfg    public.sys_doc_seq_type_cd,
  p_at     TIMESTAMPTZ
) RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_tz    TEXT;
  v_hq_tz TEXT;
  v_fy    SMALLINT;
  v_key   TEXT;
  v_val   BIGINT;
  v_local TIMESTAMP;
  v_found BOOLEAN;
BEGIN
  p_at := COALESCE(p_at, now());
  IF p_cfg.scope_code = 'TENANT_ORG' THEN
    SELECT t.timezone, h.timezone, COALESCE(t.fiscal_year_start_month, h.fiscal_year_start_month), true
      INTO v_tz, v_hq_tz, v_fy, v_found
      FROM public.org_tenants_mst t
      CROSS JOIN public.hq_general_config h
     WHERE t.id = p_tenant AND h.config_id;
    IF NOT COALESCE(v_found, false) THEN
      RAISE EXCEPTION 'DOC_SEQ_TENANT_NOT_FOUND: %', p_tenant USING ERRCODE = 'P0002';
    END IF;
    BEGIN
      IF v_tz IS NULL OR btrim(v_tz) = '' THEN
        RAISE invalid_parameter_value;
      END IF;
      v_local := p_at AT TIME ZONE v_tz;   -- cheap validity test (no pg_timezone_names scan)
    EXCEPTION WHEN invalid_parameter_value THEN
      v_tz := v_hq_tz;
    END;
    v_key := public.fn_doc_seq_period_key(p_cfg.reset_policy, p_at, v_tz, v_fy);
    INSERT INTO public.org_doc_seq_mst AS c (tenant_org_id, doc_type_code, period_key, last_value, created_by, created_info)
    VALUES (p_tenant, p_cfg.doc_type_code, v_key, 1, 'system', 'fn_doc_seq_next')
    ON CONFLICT (tenant_org_id, doc_type_code, period_key)
    DO UPDATE SET last_value = c.last_value + 1, updated_at = now(), updated_by = 'system'
    RETURNING c.last_value INTO v_val;
  ELSIF p_cfg.scope_code IN ('SYS', 'HQ') THEN
    SELECT h.timezone, h.fiscal_year_start_month INTO v_tz, v_fy FROM public.hq_general_config h WHERE h.config_id;
    v_key := public.fn_doc_seq_period_key(p_cfg.reset_policy, p_at, v_tz, v_fy);
    IF p_cfg.scope_code = 'SYS' THEN
      INSERT INTO public.sys_doc_seq_mst AS c (doc_type_code, period_key, last_value, created_by, created_info)
      VALUES (p_cfg.doc_type_code, v_key, 1, 'system', 'fn_sys_doc_seq_next')
      ON CONFLICT (doc_type_code, period_key)
      DO UPDATE SET last_value = c.last_value + 1, updated_at = now(), updated_by = 'system'
      RETURNING c.last_value INTO v_val;
    ELSE
      INSERT INTO public.hq_doc_seq_mst AS c (doc_type_code, period_key, last_value, created_by, created_info)
      VALUES (p_cfg.doc_type_code, v_key, 1, 'system', 'fn_hq_doc_seq_next')
      ON CONFLICT (doc_type_code, period_key)
      DO UPDATE SET last_value = c.last_value + 1, updated_at = now(), updated_by = 'system'
      RETURNING c.last_value INTO v_val;
    END IF;
  ELSE
    RAISE EXCEPTION 'DOC_SEQ_SCOPE_MISMATCH: unknown scope % for %', p_cfg.scope_code, p_cfg.doc_type_code USING ERRCODE = 'P0001';
  END IF;
  RETURN public.fn_doc_seq_format_row(p_cfg, v_val, p_at, v_tz, v_fy);
END $$;
COMMENT ON FUNCTION public.fn_doc_seq_next_by_row(UUID, public.sys_doc_seq_type_cd, TIMESTAMPTZ) IS
  'Internal: increments the counter of an already checked config row (scope from the row: TENANT_ORG org_doc_seq_mst, SYS sys_doc_seq_mst, HQ hq_doc_seq_mst) and prints the code. Does NOT check the caller; only the engine functions call it. Owner-only EXECUTE.';

-- 6. fn_doc_seq_next / fn_sys_doc_seq_next / fn_hq_doc_seq_next -------------------------------------------
CREATE FUNCTION public.fn_doc_seq_next(
  p_tenant   UUID,
  p_doc_type TEXT,
  p_at       TIMESTAMPTZ DEFAULT now()
) RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  IF p_tenant IS NULL THEN
    RAISE EXCEPTION 'DOC_SEQ_TENANT_REQUIRED: %', p_doc_type USING ERRCODE = '22023';
  END IF;
  IF public.fn_doc_seq_caller_role() = 'authenticated'
     AND p_tenant IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'DOC_SEQ_TENANT_MISMATCH' USING ERRCODE = '42501';
  END IF;
  RETURN public.fn_doc_seq_next_by_row(p_tenant, public.fn_doc_seq_type_get(p_doc_type, 'TENANT_ORG'), p_at);
END $$;
COMMENT ON FUNCTION public.fn_doc_seq_next(UUID, TEXT, TIMESTAMPTZ) IS
  'Next code for a TENANT_ORG GENERAL doc type. Atomic INSERT ... ON CONFLICT DO UPDATE on org_doc_seq_mst (row lock held to commit; no MAX, no retry; keep the transaction short). Period from the tenant time zone (fallback hq_general_config) and fiscal start month. The increment is part of the caller transaction: a rollback undoes it and the number is reused; gaps appear only when the number is taken in a separate transaction or the document is deleted later. Errors: DOC_SEQ_TENANT_REQUIRED, DOC_SEQ_TENANT_MISMATCH (42501), DOC_SEQ_TENANT_NOT_FOUND, DOC_SEQ_TYPE_NOT_FOUND, DOC_SEQ_TYPE_INACTIVE, DOC_SEQ_NOT_GENERAL, DOC_SEQ_SCOPE_MISMATCH.';

CREATE FUNCTION public.fn_sys_doc_seq_next(
  p_doc_type TEXT,
  p_at       TIMESTAMPTZ DEFAULT now()
) RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  PERFORM public.fn_doc_seq_caller_role();
  RETURN public.fn_doc_seq_next_by_row(NULL, public.fn_doc_seq_type_get(p_doc_type, 'SYS'), p_at);
END $$;
COMMENT ON FUNCTION public.fn_sys_doc_seq_next(TEXT, TIMESTAMPTZ) IS
  'Next code for a SYS-scope GENERAL doc type (platform-wide counter in sys_doc_seq_mst). Time zone and fiscal start from hq_general_config. Same atomic increment and errors as fn_doc_seq_next.';

CREATE FUNCTION public.fn_hq_doc_seq_next(
  p_doc_type TEXT,
  p_at       TIMESTAMPTZ DEFAULT now()
) RETURNS TEXT
LANGUAGE plpgsql
VOLATILE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
BEGIN
  PERFORM public.fn_doc_seq_caller_role();
  RETURN public.fn_doc_seq_next_by_row(NULL, public.fn_doc_seq_type_get(p_doc_type, 'HQ'), p_at);
END $$;
COMMENT ON FUNCTION public.fn_hq_doc_seq_next(TEXT, TIMESTAMPTZ) IS
  'Next code for an HQ-scope GENERAL doc type (counter in hq_doc_seq_mst). Time zone and fiscal start from hq_general_config. Same atomic increment and errors as fn_doc_seq_next.';

-- 7. Generic trigger functions (low-volume tables; busy tables use a typed trigger, see the header) ----------
-- Usage (P2+):  CREATE TRIGGER trg_<x>_no_assign BEFORE INSERT ON <table>
--                 FOR EACH ROW EXECUTE FUNCTION public.fn_doc_seq_assign_code('<DOC_TYPE>', '<column>');
--               CREATE TRIGGER trg_<x>_no_guard BEFORE UPDATE OF <column> ON <table>
--                 FOR EACH ROW WHEN (OLD.<column> IS DISTINCT FROM NEW.<column>)
--                 EXECUTE FUNCTION public.fn_doc_seq_guard_immutable('<column>');
CREATE FUNCTION public.fn_doc_seq_assign_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_type   TEXT := TG_ARGV[0];
  v_col    TEXT := TG_ARGV[1];
  r        public.sys_doc_seq_type_cd%ROWTYPE;
  v_row    JSONB;
  v_cur    TEXT;
  v_tenant UUID;
BEGIN
  IF TG_OP <> 'INSERT' OR TG_LEVEL <> 'ROW' OR TG_WHEN <> 'BEFORE' OR TG_NARGS <> 2 THEN
    RAISE EXCEPTION 'DOC_SEQ_TRIGGER_MISCONFIG: % on %.% must be BEFORE INSERT FOR EACH ROW with (doc_type, column)',
      TG_NAME, TG_TABLE_SCHEMA, TG_TABLE_NAME USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO r FROM public.sys_doc_seq_type_cd WHERE doc_type_code = v_type;   -- the only config read
  IF NOT FOUND OR r.target_table <> TG_TABLE_NAME OR r.target_column <> v_col THEN
    RAISE EXCEPTION 'DOC_SEQ_TRIGGER_MISCONFIG: % on % does not match config for %', TG_NAME, TG_TABLE_NAME, v_type
      USING ERRCODE = 'P0001';
  END IF;
  v_row := to_jsonb(NEW);                    -- one serialisation of the row
  IF NOT (v_row ? v_col) THEN
    RAISE EXCEPTION 'DOC_SEQ_TRIGGER_MISCONFIG: column % not on %', v_col, TG_TABLE_NAME USING ERRCODE = 'P0001';
  END IF;
  v_cur := v_row ->> v_col;
  IF v_cur IS NOT NULL AND btrim(v_cur) <> '' THEN
    RETURN NEW;                              -- supplied value kept; the UNIQUE index enforces it
  END IF;
  -- Same checks, in the same order, as the public next functions.
  IF r.scope_code = 'TENANT_ORG' THEN
    v_tenant := (v_row ->> 'tenant_org_id')::UUID;
    IF v_tenant IS NULL THEN
      RAISE EXCEPTION 'DOC_SEQ_TENANT_REQUIRED: %', v_type USING ERRCODE = '22023';
    END IF;
    IF public.fn_doc_seq_caller_role() = 'authenticated'
       AND v_tenant IS DISTINCT FROM public.current_tenant_id() THEN
      RAISE EXCEPTION 'DOC_SEQ_TENANT_MISMATCH' USING ERRCODE = '42501';
    END IF;
  ELSIF r.scope_code IN ('SYS', 'HQ') THEN
    PERFORM public.fn_doc_seq_caller_role();
  ELSE
    RAISE EXCEPTION 'DOC_SEQ_SCOPE_MISMATCH: unknown scope % for %', r.scope_code, v_type USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.fn_doc_seq_type_check(r, v_type, r.scope_code);
  NEW := jsonb_populate_record(NEW, jsonb_build_object(v_col, public.fn_doc_seq_next_by_row(v_tenant, r, now())));
  RETURN NEW;
END $$;
COMMENT ON FUNCTION public.fn_doc_seq_assign_code() IS
  'Generic BEFORE INSERT row trigger, args (doc_type, column), for low-volume tables. When the column is NULL or blank it is set from the engine for the doc type scope (TENANT_ORG uses NEW.tenant_org_id); one config read, one to_jsonb and one jsonb_populate_record per row. A supplied value is kept. Raises DOC_SEQ_TRIGGER_MISCONFIG when the trigger does not match its config row. Busy tables: use a typed trigger that sets NEW.<col> directly (see migration header).';

CREATE FUNCTION public.fn_doc_seq_guard_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_col TEXT := TG_ARGV[0];
  v_old TEXT;
  v_new TEXT;
BEGIN
  IF TG_OP <> 'UPDATE' OR TG_NARGS <> 1 THEN
    RAISE EXCEPTION 'DOC_SEQ_TRIGGER_MISCONFIG: % must be BEFORE UPDATE OF <column> with (column)', TG_NAME USING ERRCODE = 'P0001';
  END IF;
  v_old := to_jsonb(OLD) ->> v_col;
  IF v_old IS NULL OR btrim(v_old) = '' THEN
    RETURN NEW;                              -- an empty code may be filled once; NEW is not serialised
  END IF;
  v_new := to_jsonb(NEW) ->> v_col;
  IF v_new IS DISTINCT FROM v_old THEN
    RAISE EXCEPTION 'DOC_SEQ_CODE_IMMUTABLE: %.% cannot change (% -> %)', TG_TABLE_NAME, v_col, v_old, v_new
      USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END $$;
COMMENT ON FUNCTION public.fn_doc_seq_guard_immutable() IS
  'BEFORE UPDATE OF <column> row trigger, arg (column). A non-empty code never changes (DOC_SEQ_CODE_IMMUTABLE, P0001); an empty one may be filled once (backfills). Attach with WHEN (OLD.<column> IS DISTINCT FROM NEW.<column>) so unchanged updates skip it.';

-- 8. S5 hardening of existing DOMAIN generators (same signature and behaviour) ------------------------------
CREATE OR REPLACE FUNCTION public.fn_next_fin_doc_no(
  p_tenant_org_id UUID,
  p_doc_type_code VARCHAR
)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_prefix      VARCHAR(20);
  v_last_no     BIGINT;
  v_padding_len SMALLINT;
  v_next_no     BIGINT;
  v_formatted   TEXT;
BEGIN
  -- Lock the sequence row; insert default if missing
  INSERT INTO public.org_fin_doc_seq_mst (
    tenant_org_id, doc_type_code, prefix, last_no, padding_len,
    created_by, created_info
  ) VALUES (
    p_tenant_org_id, p_doc_type_code, NULL, 0, 6,
    'system', 'auto-created by fn_next_fin_doc_no'
  )
  ON CONFLICT (tenant_org_id, doc_type_code) DO NOTHING;

  SELECT prefix, last_no, padding_len
  INTO   v_prefix, v_last_no, v_padding_len
  FROM   public.org_fin_doc_seq_mst
  WHERE  tenant_org_id = p_tenant_org_id
    AND  doc_type_code = p_doc_type_code
    AND  is_active = true
    AND  rec_status = 1
  FOR UPDATE;                          -- row-level lock prevents concurrent races

  IF NOT FOUND THEN
    RAISE EXCEPTION 'fn_next_fin_doc_no: no active sequence for tenant % doc_type %',
      p_tenant_org_id, p_doc_type_code;
  END IF;

  v_next_no := v_last_no + 1;

  UPDATE public.org_fin_doc_seq_mst
  SET    last_no    = v_next_no,
         updated_at = CURRENT_TIMESTAMP,
         updated_by = 'system'
  WHERE  tenant_org_id = p_tenant_org_id
    AND  doc_type_code = p_doc_type_code;

  -- Format: optional prefix + zero-padded number. Pads only: a number longer than the pad is printed in full
  -- (0214 used plain LPAD, which truncated it and could repeat numbers).
  v_formatted := COALESCE(v_prefix, '') ||
                 CASE WHEN length(v_next_no::TEXT) >= v_padding_len THEN v_next_no::TEXT
                      ELSE LPAD(v_next_no::TEXT, v_padding_len, '0') END;

  RETURN v_formatted;
END;
$$;
COMMENT ON FUNCTION public.fn_next_fin_doc_no(UUID, VARCHAR) IS
  'DOMAIN generator for ERP/finance documents (JOURNAL, AR_INV, REFUND ...): locks org_fin_doc_seq_mst(tenant, doc type) FOR UPDATE, increments last_no and returns prefix + number padded to padding_len (never truncated since doc_seq_engine_fns). Auto-creates a missing row with an empty prefix. Server-only: EXECUTE for service_role and the owner (Prisma). Hardened in migration doc_seq_engine_fns (search_path, grants, no truncation).';
REVOKE ALL ON FUNCTION public.fn_next_fin_doc_no(UUID, VARCHAR) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_next_fin_doc_no(UUID, VARCHAR) TO service_role;

ALTER FUNCTION public.generate_cash_drawer_sess_no(UUID) SET search_path = pg_catalog, public, pg_temp;
COMMENT ON FUNCTION public.generate_cash_drawer_sess_no(UUID) IS
  'Cash drawer session number generator: SES-YYYYMMDD-NNNN, sequence reset daily per tenant. Takes a transaction-scoped advisory lock on hashtext(tenant || date) and MUST be called inside the same transaction as the session INSERT. Caller: lib/services/cash-drawer-session.service.ts ($queryRaw). Fixed in 0519 (parse position, lock); hardened in migration doc_seq_engine_fns (search_path; EXECUTE for service_role and the owner only).';
REVOKE ALL ON FUNCTION public.generate_cash_drawer_sess_no(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.generate_cash_drawer_sess_no(UUID) TO service_role;

-- 9. Grants on the engine ----------------------------------------------------------------------------------
-- Pure helpers (no table access or read-only preview): authenticated + service_role, like before.
-- Internal functions that skip the caller check (fn_doc_seq_next_by_row) or trust a passed row: owner only.
REVOKE ALL ON FUNCTION public.fn_doc_seq_period_key(TEXT, TIMESTAMPTZ, TEXT, SMALLINT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_doc_seq_format_row(public.sys_doc_seq_type_cd, BIGINT, TIMESTAMPTZ, TEXT, SMALLINT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_doc_seq_format(TEXT, BIGINT, TIMESTAMPTZ, TEXT, SMALLINT) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.fn_doc_seq_type_check(public.sys_doc_seq_type_cd, TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_doc_seq_type_get(TEXT, TEXT) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_doc_seq_caller_role() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_doc_seq_next_by_row(UUID, public.sys_doc_seq_type_cd, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated, service_role;
REVOKE ALL ON FUNCTION public.fn_doc_seq_next(UUID, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_sys_doc_seq_next(TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_hq_doc_seq_next(TEXT, TIMESTAMPTZ) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_doc_seq_assign_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.fn_doc_seq_guard_immutable() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_doc_seq_period_key(TEXT, TIMESTAMPTZ, TEXT, SMALLINT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_doc_seq_format_row(public.sys_doc_seq_type_cd, BIGINT, TIMESTAMPTZ, TEXT, SMALLINT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_doc_seq_format(TEXT, BIGINT, TIMESTAMPTZ, TEXT, SMALLINT) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.fn_doc_seq_next(UUID, TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_sys_doc_seq_next(TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_hq_doc_seq_next(TEXT, TIMESTAMPTZ) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_doc_seq_type_get(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.fn_doc_seq_type_check(public.sys_doc_seq_type_cd, TEXT, TEXT) TO service_role;

COMMIT;
