-- ==================================================================
-- doc_seq_engine_p1.test.sql
-- Purpose: P1 checks for the document numbering engine (plan section 14.2 tests 2, 3, 7, 7a, 9, 11).
-- Dependencies: the 7 P1 migrations (scope_modules ... doc_seq_code_tables_registry).
-- Run (LOCAL database only, as the postgres/superuser role so SET ROLE works):
--   psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/doc_seq_engine_p1.test.sql
-- Needs at least 2 rows in org_tenants_mst. Uses a temporary GENERAL doc type ZZ_TEST_DOC and a
-- temporary table zz_doc_seq_test. Everything runs in one transaction and is ROLLED BACK at the end:
-- no data, counter or config change is kept.
-- Each test prints "PASS: ..." or stops with "FAIL: ...".
-- ==================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

-- ------------------------------------------------------------------
-- Fixture
-- ------------------------------------------------------------------
CREATE TEMP TABLE zz_ctx (k TEXT PRIMARY KEY, v TEXT) ON COMMIT DROP;
GRANT SELECT ON zz_ctx TO PUBLIC;

DO $$
DECLARE
  v_a UUID; v_b UUID; v_user UUID;
BEGIN
  -- Tenant A: prefer one that has an active membership, so the authenticated happy path can run.
  SELECT ou.tenant_org_id, ou.user_id INTO v_a, v_user
    FROM public.org_users_mst ou JOIN public.org_tenants_mst t ON t.id = ou.tenant_org_id
   WHERE ou.is_active AND ou.user_id IS NOT NULL
   LIMIT 1;
  IF v_a IS NULL THEN
    SELECT id INTO v_a FROM public.org_tenants_mst ORDER BY id LIMIT 1;
  END IF;
  SELECT id INTO v_b FROM public.org_tenants_mst WHERE id <> v_a ORDER BY id LIMIT 1;
  IF v_a IS NULL OR v_b IS NULL THEN
    RAISE EXCEPTION 'SETUP: need at least 2 tenants in org_tenants_mst';
  END IF;
  INSERT INTO zz_ctx VALUES ('a', v_a::text), ('b', v_b::text), ('user', v_user::text);
  RAISE NOTICE 'SETUP: tenant A %, tenant B %, member user of A %', v_a, v_b, COALESCE(v_user::text, '<none: happy path skipped>');
END $$;

CREATE TABLE public.zz_doc_seq_test (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  code_no       TEXT NOT NULL,
  note          TEXT,
  CONSTRAINT uq_zz_doc_seq_test_code UNIQUE (tenant_org_id, code_no)
);
GRANT SELECT, INSERT, UPDATE ON public.zz_doc_seq_test TO authenticated;

INSERT INTO public.sys_doc_seq_type_cd (
  doc_type_code, name, name2, scope_code, category_code, module_code, sub_system_code,
  target_table, target_column, is_unique, unique_with, prefix, type_prefix, separator,
  parts_format, seq_pad_length, reset_policy, manage_by_level, managed_by_object,
  implement_description, created_by, created_info
)
SELECT 'ZZ_TEST_DOC', 'Test document', 'مستند اختبار', 'TENANT_ORG', 'TRANSACTION', m.module_code, m.sub_system_code,
       'zz_doc_seq_test', 'code_no', true, ARRAY['tenant_org_id'], 'ZZTST', 'ZZTST', '-',
       'YYYYMMDD-SEQ', 4, 'DAILY', 'GENERAL', NULL,
       'Test only: fn_doc_seq_next(tenant, ''ZZ_TEST_DOC'') through trg_zz_no_assign.', 'test', 'doc_seq_engine_p1.test'
  FROM public.sys_doc_seq_type_cd m WHERE m.doc_type_code = 'ORDER';

CREATE TRIGGER trg_zz_no_assign BEFORE INSERT ON public.zz_doc_seq_test
  FOR EACH ROW EXECUTE FUNCTION public.fn_doc_seq_assign_code('ZZ_TEST_DOC', 'code_no');
CREATE TRIGGER trg_zz_no_guard BEFORE UPDATE OF code_no ON public.zz_doc_seq_test
  FOR EACH ROW EXECUTE FUNCTION public.fn_doc_seq_guard_immutable('code_no');

-- Known time zones for the test (restored by the final ROLLBACK).
UPDATE public.org_tenants_mst SET timezone = 'Asia/Muscat' WHERE id = (SELECT v::uuid FROM zz_ctx WHERE k = 'a');
UPDATE public.hq_general_config SET timezone = 'UTC' WHERE config_id;

-- ------------------------------------------------------------------
-- TEST 3: day key uses the tenant time zone; fallback to hq_general_config
-- ------------------------------------------------------------------
DO $$
DECLARE
  v_a UUID := (SELECT v::uuid FROM zz_ctx WHERE k = 'a');
  v_b UUID := (SELECT v::uuid FROM zz_ctx WHERE k = 'b');
  v_code TEXT;
  v_null_ok BOOLEAN := true;
BEGIN
  v_code := public.fn_doc_seq_next(v_a, 'ZZ_TEST_DOC', '2026-10-30 20:30Z');
  IF v_code <> 'ZZTST-20261031-0001' THEN RAISE EXCEPTION 'FAIL 3a: expected ZZTST-20261031-0001, got %', v_code; END IF;
  v_code := public.fn_doc_seq_next(v_a, 'ZZ_TEST_DOC', '2026-10-30 20:31Z');
  IF v_code <> 'ZZTST-20261031-0002' THEN RAISE EXCEPTION 'FAIL 3b: expected ZZTST-20261031-0002, got %', v_code; END IF;
  RAISE NOTICE 'PASS 3a/3b: 20:30Z is 31 Oct 00:30 in Asia/Muscat; counter continues';

  -- Tenant B with no time zone falls back to hq_general_config (set to UTC above) => still 30 Oct.
  BEGIN
    UPDATE public.org_tenants_mst SET timezone = NULL WHERE id = v_b;
  EXCEPTION WHEN not_null_violation OR check_violation THEN
    v_null_ok := false;
  END;
  IF v_null_ok THEN
    v_code := public.fn_doc_seq_next(v_b, 'ZZ_TEST_DOC', '2026-10-30 20:30Z');
    IF v_code <> 'ZZTST-20261030-0001' THEN RAISE EXCEPTION 'FAIL 3c: expected ZZTST-20261030-0001 (HQ UTC fallback), got %', v_code; END IF;
    RAISE NOTICE 'PASS 3c: NULL tenant time zone falls back to hq_general_config';
  ELSE
    RAISE NOTICE 'SKIP 3c: org_tenants_mst.timezone cannot be NULL here';
  END IF;

  -- Pad grows, never truncates.
  UPDATE public.org_doc_seq_mst SET last_value = 9999
   WHERE tenant_org_id = v_a AND doc_type_code = 'ZZ_TEST_DOC' AND period_key = '20261031';
  v_code := public.fn_doc_seq_next(v_a, 'ZZ_TEST_DOC', '2026-10-30 20:32Z');
  IF v_code <> 'ZZTST-20261031-10000' THEN RAISE EXCEPTION 'FAIL 3d: expected ZZTST-20261031-10000, got %', v_code; END IF;
  RAISE NOTICE 'PASS 3d: 10000 prints in full (no truncation)';
END $$;

-- ------------------------------------------------------------------
-- TEST 2: a rolled-back transaction gives its number back
-- (the increment is in the caller transaction; gaps come only from separate transactions or later deletes)
-- ------------------------------------------------------------------
DO $$
DECLARE
  v_a UUID := (SELECT v::uuid FROM zz_ctx WHERE k = 'a');
  v_first TEXT; v_again TEXT;
BEGIN
  BEGIN
    v_first := public.fn_doc_seq_next(v_a, 'ZZ_TEST_DOC', '2026-11-05 08:00Z');
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'zz_rollback';
  EXCEPTION WHEN raise_exception THEN
    NULL;  -- the subtransaction (and its counter change) is rolled back
  END;
  v_again := public.fn_doc_seq_next(v_a, 'ZZ_TEST_DOC', '2026-11-05 08:00Z');
  IF v_again <> 'ZZTST-20261105-0001' THEN
    RAISE EXCEPTION 'FAIL 2: after rollback expected ZZTST-20261105-0001 again, got %', v_again;
  END IF;
  RAISE NOTICE 'PASS 2: rolled-back call (%) did not consume a number', v_first;
END $$;

-- ------------------------------------------------------------------
-- TEST 7: the trigger assigns the code; the code cannot change
-- ------------------------------------------------------------------
DO $$
DECLARE
  v_a UUID := (SELECT v::uuid FROM zz_ctx WHERE k = 'a');
  v_id UUID; v_code TEXT; v_raised BOOLEAN := false;
BEGIN
  INSERT INTO public.zz_doc_seq_test (tenant_org_id) VALUES (v_a) RETURNING id, code_no INTO v_id, v_code;
  IF v_code !~ '^ZZTST-[0-9]{8}-[0-9]{4,}$' THEN RAISE EXCEPTION 'FAIL 7a: trigger gave %', v_code; END IF;
  UPDATE public.zz_doc_seq_test SET note = 'other column' WHERE id = v_id;
  BEGIN
    UPDATE public.zz_doc_seq_test SET code_no = 'ZZTST-HACK' WHERE id = v_id;
  EXCEPTION WHEN raise_exception THEN
    v_raised := SQLERRM LIKE 'DOC_SEQ_CODE_IMMUTABLE%';
  END;
  IF NOT v_raised THEN RAISE EXCEPTION 'FAIL 7b: code change was not blocked'; END IF;
  RAISE NOTICE 'PASS 7: trigger assigned %, other columns update, code change raises DOC_SEQ_CODE_IMMUTABLE', v_code;
END $$;

-- ------------------------------------------------------------------
-- TEST 7a: every active doc type explains how it works
-- ------------------------------------------------------------------
DO $$
DECLARE v_n INT;
BEGIN
  SELECT count(*) INTO v_n FROM public.sys_doc_seq_type_cd
   WHERE is_active AND COALESCE(btrim(implement_description), '') = '';
  IF v_n <> 0 THEN RAISE EXCEPTION 'FAIL 7a-desc: % active doc types without implement_description', v_n; END IF;
  SELECT count(*) INTO v_n FROM public.sys_doc_seq_type_cd WHERE type_prefix IS NULL;
  IF v_n <> 0 THEN RAISE EXCEPTION 'FAIL 7a-prefix: % doc types without type_prefix', v_n; END IF;
  RAISE NOTICE 'PASS 7a: all active doc types have implement_description and type_prefix';
END $$;

-- ------------------------------------------------------------------
-- TEST 9: security
-- ------------------------------------------------------------------
DO $$
DECLARE
  v_a UUID := (SELECT v::uuid FROM zz_ctx WHERE k = 'a');
  v_b UUID := (SELECT v::uuid FROM zz_ctx WHERE k = 'b');
  v_user TEXT := (SELECT v FROM zz_ctx WHERE k = 'user');
  v_ok BOOLEAN; v_code TEXT;
BEGIN
  -- 9a anon cannot call the engine.
  v_ok := false;
  SET LOCAL ROLE anon;
  BEGIN
    PERFORM public.fn_doc_seq_next(v_a, 'ZZ_TEST_DOC', now());
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
  END;
  RESET ROLE;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL 9a: anon could call fn_doc_seq_next'; END IF;

  -- 9b authenticated cannot call the engine directly or read counters.
  PERFORM set_config('request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', COALESCE(v_user, '00000000-0000-0000-0000-00000000dead'))::text, true);
  SET LOCAL ROLE authenticated;
  v_ok := false;
  BEGIN
    PERFORM public.fn_doc_seq_next(v_a, 'ZZ_TEST_DOC', now());
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
  END;
  IF NOT v_ok THEN RESET ROLE; RAISE EXCEPTION 'FAIL 9b: authenticated could call fn_doc_seq_next'; END IF;
  v_ok := false;
  BEGIN
    PERFORM 1 FROM public.org_doc_seq_mst LIMIT 1;
  EXCEPTION WHEN insufficient_privilege THEN v_ok := true;
  END;
  IF NOT v_ok THEN RESET ROLE; RAISE EXCEPTION 'FAIL 9c: authenticated could read org_doc_seq_mst'; END IF;

  -- 9d inserting a row for another tenant through the trigger raises DOC_SEQ_TENANT_MISMATCH.
  v_ok := false;
  BEGIN
    INSERT INTO public.zz_doc_seq_test (tenant_org_id) VALUES (v_b);
  EXCEPTION WHEN insufficient_privilege THEN v_ok := SQLERRM LIKE 'DOC_SEQ_TENANT_MISMATCH%';
  END;
  IF NOT v_ok THEN RESET ROLE; RAISE EXCEPTION 'FAIL 9d: cross-tenant insert was not blocked'; END IF;

  -- 9e own tenant works (only when a member user of tenant A exists).
  IF v_user IS NOT NULL THEN
    INSERT INTO public.zz_doc_seq_test (tenant_org_id) VALUES (v_a) RETURNING code_no INTO v_code;
    IF v_code !~ '^ZZTST-' THEN RESET ROLE; RAISE EXCEPTION 'FAIL 9e: own-tenant insert gave %', v_code; END IF;
  END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  RAISE NOTICE 'PASS 9: anon denied, authenticated cannot call engine or read counters, cross-tenant blocked%',
    CASE WHEN v_user IS NULL THEN ' (own-tenant path skipped: no member user)' ELSE ', own tenant OK' END;
END $$;

-- ------------------------------------------------------------------
-- TEST 11: consistency view and data check
-- ------------------------------------------------------------------
DO $$
DECLARE
  v_a UUID := (SELECT v::uuid FROM zz_ctx WHERE k = 'a');
  v_n INT; v_behind BOOLEAN; v_list TEXT;
BEGIN
  SELECT count(*), string_agg(check_code || ':' || doc_type_code, ', ') INTO v_n, v_list
    FROM public.vw_doc_seq_consistency WHERE severity = 'ERROR';
  IF v_n <> 0 THEN RAISE EXCEPTION 'FAIL 11a: % ERROR rows: %', v_n, v_list; END IF;

  SELECT counter_behind INTO v_behind FROM public.fn_doc_seq_consistency_data() WHERE doc_type_code = 'ZZ_TEST_DOC';
  IF v_behind IS DISTINCT FROM false THEN RAISE EXCEPTION 'FAIL 11b: counter_behind = % on clean data', v_behind; END IF;

  -- A supplied code above the counter is reported.
  INSERT INTO public.zz_doc_seq_test (tenant_org_id, code_no) VALUES (v_a, 'ZZTST-20261105-0900');
  SELECT counter_behind INTO v_behind FROM public.fn_doc_seq_consistency_data() WHERE doc_type_code = 'ZZ_TEST_DOC';
  IF v_behind IS DISTINCT FROM true THEN RAISE EXCEPTION 'FAIL 11c: counter_behind not reported (%)', v_behind; END IF;

  -- Dropping the assign trigger is reported (undone by the exception block).
  BEGIN
    DROP TRIGGER trg_zz_no_assign ON public.zz_doc_seq_test;
    SELECT count(*) INTO v_n FROM public.vw_doc_seq_consistency
     WHERE check_code = 'GEN_NO_TRIGGER' AND doc_type_code = 'ZZ_TEST_DOC';
    RAISE EXCEPTION USING ERRCODE = 'P0001', MESSAGE = 'zz_undo';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
  IF v_n <> 1 THEN RAISE EXCEPTION 'FAIL 11d: GEN_NO_TRIGGER not reported after dropping the trigger'; END IF;
  RAISE NOTICE 'PASS 11: 0 ERROR rows, counter_behind works, GEN_NO_TRIGGER reported';
END $$;

-- 11b. Busy-table pattern: a typed assign trigger satisfies GEN_NO_TRIGGER; one for another type does not.
DROP TRIGGER trg_zz_no_assign ON public.zz_doc_seq_test;
CREATE FUNCTION public.fn_zz_no_assign() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
  SET search_path = pg_catalog, public, pg_temp AS $f$
BEGIN
  IF NEW.code_no IS NULL OR btrim(NEW.code_no) = '' THEN
    NEW.code_no := public.fn_doc_seq_next(NEW.tenant_org_id, 'ZZ_OTHER_DOC', now());
  END IF;
  RETURN NEW;
END $f$;
CREATE TRIGGER trg_zz_no_assign BEFORE INSERT ON public.zz_doc_seq_test
  FOR EACH ROW EXECUTE FUNCTION public.fn_zz_no_assign();
DO $$
DECLARE v_a UUID := (SELECT v::uuid FROM zz_ctx WHERE k = 'a'); v_code TEXT;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.vw_doc_seq_consistency
                  WHERE check_code = 'GEN_NO_TRIGGER' AND doc_type_code = 'ZZ_TEST_DOC') THEN
    RAISE EXCEPTION 'FAIL 11b: typed trigger for another doc type was accepted';
  END IF;
  CREATE OR REPLACE FUNCTION public.fn_zz_no_assign() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
    SET search_path = pg_catalog, public, pg_temp AS $f$
  BEGIN
    IF NEW.code_no IS NULL OR btrim(NEW.code_no) = '' THEN
      NEW.code_no := public.fn_doc_seq_next(NEW.tenant_org_id, 'ZZ_TEST_DOC', now());
    END IF;
    RETURN NEW;
  END $f$;
  IF EXISTS (SELECT 1 FROM public.vw_doc_seq_consistency
              WHERE check_code = 'GEN_NO_TRIGGER' AND doc_type_code = 'ZZ_TEST_DOC') THEN
    RAISE EXCEPTION 'FAIL 11b: typed trigger not accepted by GEN_NO_TRIGGER';
  END IF;
  INSERT INTO public.zz_doc_seq_test (tenant_org_id, note) VALUES (v_a, '11b') RETURNING code_no INTO v_code;
  IF v_code IS NULL OR v_code NOT LIKE 'ZZTST-%' THEN
    RAISE EXCEPTION 'FAIL 11b: typed trigger did not assign a code (%)', v_code;
  END IF;
  RAISE NOTICE 'PASS 11b: typed assign trigger accepted (wrong type rejected), assigned %', v_code;
END $$;

ROLLBACK;
