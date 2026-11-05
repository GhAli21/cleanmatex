--
-- Migration 0671_doc_seq_consistency.sql
-- Human-Friendly Codes, P1 (DB engine), migration 6 of 7.
--
-- Purpose: self-checks for the document-number setup. Run after every phase; expected result is 0 ERROR rows.
--   vw_doc_seq_consistency           schema checks (config vs triggers, columns, indexes, owners). Cheap.
--   fn_doc_seq_consistency_data()    data checks per doc type (NULL / empty / duplicate codes, counter behind data).
--                                    Scans target tables: run off-peak on large tenants.
--                                    Cost per type: one count scan; the duplicate scan is skipped when a total
--                                    unique index on unique_with + code already proves there are none; GENERAL
--                                    types add one scan that runs the code regex once per row (OFFSET 0 fence).
--                                    Callers should SET LOCAL statement_timeout for big tenants.
-- Both are service_role only (HQ API, scripts). Neither changes data.
--
-- View checks (check_code, severity):
--   TRG_NO_CONFIG          ERROR  an fn_doc_seq_assign_code trigger with no config row, or a different table/column
--   TRG_GUARD_MISSING      ERROR  GENERAL row without its BEFORE UPDATE guard trigger (fn_doc_seq_guard_immutable)
--   GEN_NO_TRIGGER         ERROR  GENERAL row without its assign trigger: the generic fn_doc_seq_assign_code(type, column),
--                                 or a typed BEFORE INSERT FOR EACH ROW trigger (busy tables, see doc_seq_engine_fns)
--                                 whose function text has the type literal ('ORDER'), NEW.<column> and a *doc_seq_next( call
--   CFG_TARGET_MISSING     ERROR  target_table / target_column does not exist
--   SCOPE_MISMATCH         ERROR for GENERAL, WARN otherwise: TENANT_ORG target without tenant_org_id, or SYS/HQ with it
--   DOMAIN_OBJ_MISSING     ERROR  DOMAIN/MANUAL managed_by_object is not a function, table or app:<path>
--   APP_OBJ_UNVERIFIED     INFO   managed_by_object is app:<path> (code, not checkable in SQL)
--   FORMAT_RESET_MISMATCH  ERROR  GENERAL format and reset policy disagree (double check of ck_doc_seq_general_shape)
--   TOKEN_NOT_ENABLED      ERROR  GENERAL format uses BR (not an engine token yet)
--   NO_UNIQUE_INDEX        ERROR for GENERAL, WARN otherwise: no unique index on unique_with + target_column
--   NOT_NULL_MISSING       ERROR for GENERAL, WARN otherwise: target column is nullable
--   PREFIX_SHARED          WARN   the same printed prefix + separator is used by more than one type in a scope
--
-- Affected: vw_doc_seq_consistency, fn_doc_seq_consistency_data() (new).
-- Related:  migrations doc_seq_type_config, doc_seq_counters, doc_seq_engine_fns.
-- Plan:     docs/features/Human_Friendly_Codes/IMPLEMENTATION_PLAN_Human_Friendly_Codes.md section 5.6.
-- APPLY ORDER: 6 of 7 in P1. Next: doc_seq_code_tables_registry.
-- ROLLBACK PLAN (forward-only repo; write a new migration):
--   DROP FUNCTION public.fn_doc_seq_consistency_data() RESTRICT; DROP VIEW public.vw_doc_seq_consistency RESTRICT;
--
BEGIN;
SET LOCAL lock_timeout = '10s';

CREATE VIEW public.vw_doc_seq_consistency
WITH (security_invoker = true)
AS
WITH cfg AS (
  SELECT c.*, to_regclass('public.' || quote_ident(c.target_table)) AS rel,
         (c.manage_by_level = 'GENERAL') AS is_general
    FROM public.sys_doc_seq_type_cd c
   WHERE c.is_active AND c.rec_status = 1
),
rels AS (
  SELECT DISTINCT cfg.rel FROM cfg WHERE cfg.rel IS NOT NULL
),
-- cols / uidx read only the configured target tables (not the whole catalog).
cols AS (
  SELECT a.attrelid AS rel, a.attname::TEXT AS col, a.attnotnull AS notnull
    FROM pg_catalog.pg_attribute a
   WHERE a.attrelid IN (SELECT rels.rel FROM rels)
     AND a.attnum > 0 AND NOT a.attisdropped
),
trg AS (
  SELECT t.tgrelid AS rel, cl.relname::TEXT AS table_name, t.tgname::TEXT AS trigger_name,
         p.proname::TEXT AS fn_name,
         (string_to_array(rtrim(encode(t.tgargs, 'escape'), '\000'), '\000')) AS args
    FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_proc p ON p.oid = t.tgfoid
    JOIN pg_catalog.pg_namespace pn ON pn.oid = p.pronamespace AND pn.nspname = 'public'
    JOIN pg_catalog.pg_class cl ON cl.oid = t.tgrelid
   WHERE NOT t.tgisinternal
     AND p.proname IN ('fn_doc_seq_assign_code', 'fn_doc_seq_guard_immutable')
),
-- Typed assign triggers (busy tables): BEFORE INSERT FOR EACH ROW (tgtype bits ROW 1 + BEFORE 2 + INSERT 4).
ttrg AS (
  SELECT t.tgrelid AS rel, lower(p.prosrc) AS src_l, p.prosrc AS src
    FROM pg_catalog.pg_trigger t
    JOIN pg_catalog.pg_proc p ON p.oid = t.tgfoid
   WHERE t.tgrelid IN (SELECT rels.rel FROM rels)
     AND NOT t.tgisinternal AND (t.tgtype & 7) = 7
     AND p.proname <> 'fn_doc_seq_assign_code'
     AND lower(p.prosrc) LIKE '%doc_seq_next(%'
),
uidx AS (
  SELECT i.indrelid AS rel,
         ARRAY(SELECT a.attname::TEXT FROM unnest(i.indkey) WITH ORDINALITY k(attnum, ord)
                 JOIN pg_catalog.pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum
                ORDER BY a.attname) AS cols,
         i.indpred IS NULL AS is_total
    FROM pg_catalog.pg_index i
   WHERE i.indrelid IN (SELECT rels.rel FROM rels)
     AND i.indisunique AND i.indisvalid AND 0 <> ALL (i.indkey)
)
-- TRG_NO_CONFIG
SELECT 'TRG_NO_CONFIG'::TEXT AS check_code, 'ERROR'::TEXT AS severity, trg.args[1] AS doc_type_code,
       trg.table_name || '.' || trg.trigger_name AS object_name,
       'assign trigger args (' || array_to_string(trg.args, ', ') || ') have no matching active config row' AS detail
  FROM trg
 WHERE trg.fn_name = 'fn_doc_seq_assign_code'
   AND NOT EXISTS (SELECT 1 FROM cfg
                    WHERE cfg.doc_type_code = trg.args[1] AND cfg.target_table = trg.table_name
                      AND cfg.target_column = trg.args[2] AND cfg.is_general)
UNION ALL
-- GEN_NO_TRIGGER
SELECT 'GEN_NO_TRIGGER', 'ERROR', cfg.doc_type_code, cfg.target_table || '.' || cfg.target_column,
       'GENERAL type has no fn_doc_seq_assign_code(''' || cfg.doc_type_code || ''', ''' || cfg.target_column
         || ''') trigger and no typed BEFORE INSERT trigger that sets NEW.' || cfg.target_column || ' for '''
         || cfg.doc_type_code || ''''
  FROM cfg
 WHERE cfg.is_general AND cfg.rel IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM trg WHERE trg.rel = cfg.rel AND trg.fn_name = 'fn_doc_seq_assign_code'
                      AND trg.args[1] = cfg.doc_type_code AND trg.args[2] = cfg.target_column)
   AND NOT EXISTS (SELECT 1 FROM ttrg WHERE ttrg.rel = cfg.rel
                      AND strpos(ttrg.src, quote_literal(cfg.doc_type_code)) > 0
                      AND strpos(ttrg.src_l, 'new.' || lower(cfg.target_column)) > 0)
UNION ALL
-- TRG_GUARD_MISSING
SELECT 'TRG_GUARD_MISSING', 'ERROR', cfg.doc_type_code, cfg.target_table || '.' || cfg.target_column,
       'GENERAL type has no fn_doc_seq_guard_immutable(''' || cfg.target_column || ''') trigger'
  FROM cfg
 WHERE cfg.is_general AND cfg.rel IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM trg WHERE trg.rel = cfg.rel AND trg.fn_name = 'fn_doc_seq_guard_immutable'
                      AND trg.args[1] = cfg.target_column)
UNION ALL
-- CFG_TARGET_MISSING
SELECT 'CFG_TARGET_MISSING', 'ERROR', cfg.doc_type_code, cfg.target_table || '.' || cfg.target_column,
       CASE WHEN cfg.rel IS NULL THEN 'table public.' || cfg.target_table || ' does not exist'
            ELSE 'column ' || cfg.target_column || ' does not exist' END
  FROM cfg
 WHERE cfg.rel IS NULL
    OR NOT EXISTS (SELECT 1 FROM cols WHERE cols.rel = cfg.rel AND cols.col = cfg.target_column)
UNION ALL
-- SCOPE_MISMATCH
SELECT 'SCOPE_MISMATCH', CASE WHEN cfg.is_general THEN 'ERROR' ELSE 'WARN' END, cfg.doc_type_code, cfg.target_table,
       CASE WHEN cfg.scope_code = 'TENANT_ORG' THEN 'TENANT_ORG type on a table without tenant_org_id'
            ELSE cfg.scope_code || ' type on a table with tenant_org_id' END
  FROM cfg
 WHERE cfg.rel IS NOT NULL
   AND (cfg.scope_code = 'TENANT_ORG') <> EXISTS (SELECT 1 FROM cols WHERE cols.rel = cfg.rel AND cols.col = 'tenant_org_id')
UNION ALL
-- DOMAIN_OBJ_MISSING / APP_OBJ_UNVERIFIED
SELECT CASE WHEN cfg.managed_by_object LIKE 'app:%' THEN 'APP_OBJ_UNVERIFIED' ELSE 'DOMAIN_OBJ_MISSING' END,
       CASE WHEN cfg.managed_by_object LIKE 'app:%' THEN 'INFO' ELSE 'ERROR' END,
       cfg.doc_type_code, cfg.managed_by_object,
       CASE WHEN cfg.managed_by_object LIKE 'app:%' THEN 'application code owner; verify in the repo'
            ELSE 'not a function signature, function name or table in the database' END
  FROM cfg
 WHERE NOT cfg.is_general AND cfg.manage_by_level <> 'NONE'
   AND cfg.managed_by_object IS NOT NULL
   AND (cfg.managed_by_object LIKE 'app:%'
        OR (pg_catalog.to_regprocedure(cfg.managed_by_object) IS NULL
            AND (cfg.managed_by_object LIKE '%(%' OR pg_catalog.to_regproc(cfg.managed_by_object) IS NULL)
            AND pg_catalog.to_regclass(cfg.managed_by_object) IS NULL))
UNION ALL
-- FORMAT_RESET_MISMATCH
SELECT 'FORMAT_RESET_MISMATCH', 'ERROR', cfg.doc_type_code, cfg.parts_format || ' / ' || COALESCE(cfg.reset_policy, '<null>'),
       'format and reset policy disagree (a period counter needs the matching date token in the code)'
  FROM cfg
 WHERE cfg.is_general
   AND NOT CASE cfg.reset_policy
         WHEN 'NEVER'       THEN cfg.parts_format !~ '(YYYY|YY|YYMM|YYYYMM|YYYYMMDD)'
         WHEN 'YEARLY'      THEN cfg.parts_format ~ '(^|-)(YYYY|YY)(-|$)'
         WHEN 'FISCAL_YEAR' THEN cfg.parts_format ~ '(^|-)(YYYY|YY)(-|$)'
         WHEN 'MONTHLY'     THEN cfg.parts_format ~ '(^|-)(YYYYMM|YYMM)(-|$)'
         WHEN 'DAILY'       THEN cfg.parts_format ~ '(^|-)YYYYMMDD(-|$)'
         ELSE false
       END
UNION ALL
-- TOKEN_NOT_ENABLED
SELECT 'TOKEN_NOT_ENABLED', 'ERROR', cfg.doc_type_code, cfg.parts_format,
       'GENERAL format uses BR, which the engine does not print yet'
  FROM cfg
 WHERE cfg.is_general AND cfg.parts_format ~ '(^|-)BR(-|$)'
UNION ALL
-- NO_UNIQUE_INDEX
SELECT 'NO_UNIQUE_INDEX', CASE WHEN cfg.is_general THEN 'ERROR' ELSE 'WARN' END, cfg.doc_type_code,
       cfg.target_table || '(' || array_to_string(COALESCE(cfg.unique_with, '{}') || cfg.target_column, ', ') || ')',
       'no valid, non-partial unique index on exactly these columns'
  FROM cfg
 WHERE cfg.is_unique AND cfg.rel IS NOT NULL
   AND EXISTS (SELECT 1 FROM cols WHERE cols.rel = cfg.rel AND cols.col = cfg.target_column)
   AND NOT EXISTS (SELECT 1 FROM uidx
                    WHERE uidx.rel = cfg.rel AND uidx.is_total
                      AND uidx.cols = ARRAY(SELECT x FROM unnest(COALESCE(cfg.unique_with, '{}') || cfg.target_column) x ORDER BY x))
UNION ALL
-- NOT_NULL_MISSING
SELECT 'NOT_NULL_MISSING', CASE WHEN cfg.is_general THEN 'ERROR' ELSE 'WARN' END, cfg.doc_type_code,
       cfg.target_table || '.' || cfg.target_column, 'target column is nullable'
  FROM cfg JOIN cols ON cols.rel = cfg.rel AND cols.col = cfg.target_column
 WHERE NOT cols.notnull
UNION ALL
-- PREFIX_SHARED
SELECT 'PREFIX_SHARED', 'WARN', string_agg(cfg.doc_type_code, ', ' ORDER BY cfg.doc_type_code),
       cfg.scope_code || ':' || cfg.prefix || cfg.separator,
       'printed prefix shared by several types; use type_prefix in scan payloads to tell them apart'
  FROM cfg
 WHERE cfg.prefix IS NOT NULL
 GROUP BY cfg.scope_code, cfg.prefix, cfg.separator
HAVING count(*) > 1;

COMMENT ON VIEW public.vw_doc_seq_consistency IS
  'Schema self-checks for document numbering (check_code, severity ERROR|WARN|INFO, doc_type_code, object_name, detail). Expected: 0 ERROR rows after every phase. Reads only the catalog and sys_doc_seq_type_cd. service_role only.';
COMMENT ON COLUMN public.vw_doc_seq_consistency.check_code IS 'Check id, see the migration header for the list.';
COMMENT ON COLUMN public.vw_doc_seq_consistency.severity IS 'ERROR (must fix before release), WARN (review), INFO (for the record).';
COMMENT ON COLUMN public.vw_doc_seq_consistency.doc_type_code IS 'Doc type(s) the finding is about.';
COMMENT ON COLUMN public.vw_doc_seq_consistency.object_name IS 'Table, column, trigger, format or owner the finding is about.';
COMMENT ON COLUMN public.vw_doc_seq_consistency.detail IS 'Plain-language description of the finding.';
REVOKE ALL ON TABLE public.vw_doc_seq_consistency FROM PUBLIC, anon, authenticated;
GRANT SELECT ON TABLE public.vw_doc_seq_consistency TO service_role;

-- Data checks -------------------------------------------------------------------------------------------------
CREATE FUNCTION public.fn_doc_seq_consistency_data()
RETURNS TABLE (
  doc_type_code  TEXT,
  target         TEXT,
  row_count      BIGINT,
  null_count     BIGINT,
  empty_count    BIGINT,
  dup_count      BIGINT,
  counter_behind BOOLEAN,
  detail         TEXT
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  c        RECORD;
  v_tbl    TEXT;
  v_col    TEXT;
  v_grp    TEXT;
  v_rx     TEXT;
  v_tok    TEXT;
  v_gi     INT;
  v_seq_g  INT;
  v_per_g  INT;
  v_per_t  TEXT;
  v_perexp TEXT;
  v_tcol   TEXT;
  v_ctab   TEXT;
  v_join   TEXT;
  v_rel    REGCLASS;
BEGIN
  FOR c IN
    SELECT t.* FROM public.sys_doc_seq_type_cd t
     WHERE t.is_active AND t.rec_status = 1
       AND to_regclass('public.' || quote_ident(t.target_table)) IS NOT NULL
       AND EXISTS (SELECT 1 FROM pg_catalog.pg_attribute a
                    WHERE a.attrelid = to_regclass('public.' || quote_ident(t.target_table))
                      AND a.attname = t.target_column AND a.attnum > 0 AND NOT a.attisdropped)
     ORDER BY t.display_order, t.doc_type_code
  LOOP
    v_tbl := 'public.' || quote_ident(c.target_table);
    v_col := quote_ident(c.target_column);
    SELECT COALESCE(string_agg(quote_ident(u), ', '), '') INTO v_grp FROM unnest(c.unique_with) u;

    doc_type_code := c.doc_type_code;
    target := c.target_table || '.' || c.target_column;
    counter_behind := NULL;
    detail := NULL;

    EXECUTE format('SELECT count(*), count(*) FILTER (WHERE %1$s IS NULL), count(*) FILTER (WHERE btrim(%1$s::text) = %3$L) FROM %2$s',
                   v_col, v_tbl, '')
       INTO row_count, null_count, empty_count;

    v_rel := to_regclass(v_tbl);
    IF c.is_unique AND EXISTS (
         -- A valid, non-partial unique index on exactly unique_with + target_column already rules out
         -- duplicates when NULLs cannot slip through it (every unique_with column NOT NULL, or NULLS NOT DISTINCT).
         SELECT 1 FROM pg_catalog.pg_index i
          WHERE i.indrelid = v_rel AND i.indisunique AND i.indisvalid AND i.indpred IS NULL AND 0 <> ALL (i.indkey)
            AND ARRAY(SELECT a.attname::TEXT FROM unnest(i.indkey) k(attnum)
                        JOIN pg_catalog.pg_attribute a ON a.attrelid = i.indrelid AND a.attnum = k.attnum ORDER BY 1)
                = ARRAY(SELECT x FROM unnest(COALESCE(c.unique_with, '{}') || c.target_column) x ORDER BY 1)
            AND (i.indnullsnotdistinct
                 OR NOT EXISTS (SELECT 1 FROM unnest(c.unique_with) u
                                  JOIN pg_catalog.pg_attribute a ON a.attrelid = v_rel AND a.attname = u
                                 WHERE NOT a.attnotnull))) THEN
      dup_count := 0;
    ELSIF c.is_unique THEN
      EXECUTE format('SELECT COALESCE(sum(n - 1), 0) FROM (SELECT count(*) AS n FROM %1$s WHERE %2$s IS NOT NULL AND btrim(%2$s::text) <> %4$L GROUP BY %3$s%2$s HAVING count(*) > 1) d',
                     v_tbl, v_col, CASE WHEN v_grp = '' THEN '' ELSE v_grp || ', ' END, '')
         INTO dup_count;
    ELSE
      dup_count := 0;
    END IF;

    IF c.manage_by_level = 'GENERAL' THEN
      -- Build a regex from the format: prefix, separator, fixed-width date tokens, SEQ (last, variable width).
      v_rx := '^' || CASE WHEN COALESCE(c.prefix, '') = '' THEN ''
                          ELSE regexp_replace(c.prefix || c.separator, '([^A-Za-z0-9])', '\\\1', 'g') END;
      v_gi := 0; v_seq_g := NULL; v_per_g := NULL; v_per_t := NULL;
      FOREACH v_tok IN ARRAY string_to_array(c.parts_format, '-') LOOP
        IF v_gi > 0 THEN
          v_rx := v_rx || regexp_replace(c.separator, '([^A-Za-z0-9])', '\\\1', 'g');
        END IF;
        v_gi := v_gi + 1;
        v_rx := v_rx || CASE v_tok
          WHEN 'YYYY' THEN '([0-9]{4})' WHEN 'YY' THEN '([0-9]{2})' WHEN 'YYYYMM' THEN '([0-9]{6})'
          WHEN 'YYMM' THEN '([0-9]{4})' WHEN 'YYYYMMDD' THEN '([0-9]{8})' WHEN 'SEQ' THEN '([0-9]+)'
          ELSE '(.+?)' END;
        IF v_tok = 'SEQ' THEN v_seq_g := v_gi; END IF;
        IF (c.reset_policy IN ('YEARLY','FISCAL_YEAR') AND v_tok IN ('YYYY','YY'))
           OR (c.reset_policy = 'MONTHLY' AND v_tok IN ('YYYYMM','YYMM'))
           OR (c.reset_policy = 'DAILY' AND v_tok = 'YYYYMMDD') THEN
          v_per_g := v_gi; v_per_t := v_tok;
        END IF;
      END LOOP;
      v_rx := v_rx || '$';
      v_perexp := CASE
        WHEN c.reset_policy = 'NEVER' THEN quote_literal('')
        WHEN v_per_g IS NULL THEN NULL
        ELSE CASE WHEN c.reset_policy = 'FISCAL_YEAR' THEN '''FY'' || ' ELSE '' END
             || CASE WHEN v_per_t IN ('YY','YYMM') THEN '''20'' || ' ELSE '' END
             || format('d.m[%s]', v_per_g)
      END;
      IF v_perexp IS NULL OR v_seq_g IS NULL THEN
        detail := 'cannot derive the period from the format';
      ELSE
        IF c.scope_code = 'TENANT_ORG' THEN
          v_tcol := 'd.tenant_org_id, '; v_ctab := 'public.org_doc_seq_mst';
          v_join := 'k.tenant_org_id = d.tenant_org_id AND ';
        ELSE
          v_tcol := ''; v_ctab := CASE c.scope_code WHEN 'SYS' THEN 'public.sys_doc_seq_mst' ELSE 'public.hq_doc_seq_mst' END;
          v_join := '';
        END IF;
        EXECUTE format(
          'SELECT EXISTS (SELECT 1 FROM (SELECT %1$s%2$s AS period_key, max(d.m[%5$s]::numeric) AS mx
                                          FROM (SELECT %1$sregexp_match(%3$s, %4$L) AS m FROM %6$s d OFFSET 0) d
                                         WHERE d.m IS NOT NULL GROUP BY %10$s) d
                           LEFT JOIN %7$s k ON %8$s k.doc_type_code = %9$L AND k.period_key = d.period_key
                          WHERE k.last_value IS NULL OR k.last_value < d.mx)',
          v_tcol, v_perexp, 'd.' || v_col, v_rx, v_seq_g, v_tbl, v_ctab, v_join, c.doc_type_code,
          CASE WHEN c.scope_code = 'TENANT_ORG' THEN '1, 2' ELSE '1' END)
          INTO counter_behind;
      END IF;
    END IF;
    RETURN NEXT;
  END LOOP;
END $$;
COMMENT ON FUNCTION public.fn_doc_seq_consistency_data() IS
  'Data self-checks per active doc type whose target exists: row_count, null_count, empty_count, dup_count (extra rows per unique_with + code), and for GENERAL types counter_behind = true when a code in the data has a sequence above its counter (next insert could collide). Dynamic SQL is built only from config rows with quote_ident / %L. Full scans: run off-peak. service_role only.';
REVOKE ALL ON FUNCTION public.fn_doc_seq_consistency_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_doc_seq_consistency_data() TO service_role;

COMMIT;
