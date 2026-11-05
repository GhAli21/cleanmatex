-- ==================================================================
-- ord_order_no_engine_p2.test.sql
-- Purpose: P2 checks for the ORDER numbering cutover (plan section 14.2 tests T2.1-T2.3, T2.5-T2.8).
-- Dependencies: P1 migrations 0666-0672 and P2 migration 0674_ord_order_no_engine (T2.6c also covers P2.1 0677).
-- Run (LOCAL database only, as the postgres/superuser role so SET ROLE works):
--   psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/ord_order_no_engine_p2.test.sql
-- Needs 2 rows in org_tenants_mst; tenant A should have one existing order (its customer_id is reused for the
-- test rows) and an active member user (for the authenticated checks). Missing pieces are reported as SKIP.
-- Everything runs in one transaction and is ROLLED BACK at the end: no order, counter or config change is kept.
-- Each test prints "PASS ..." or stops with "FAIL ...". Concurrency (T2.4) is a pgbench run, see DEV_GUIDE section 14.
-- ==================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TEMP TABLE zz_ctx (k TEXT PRIMARY KEY, v TEXT) ON COMMIT DROP;
GRANT SELECT ON zz_ctx TO PUBLIC;

-- ------------------------------------------------------------------
-- Fixture
-- ------------------------------------------------------------------
DO $$
DECLARE
  v_a UUID; v_b UUID; v_user UUID; v_cust UUID; v_has_order BOOLEAN;
BEGIN
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
  SELECT o.customer_id, true INTO v_cust, v_has_order
    FROM public.org_orders_mst o WHERE o.tenant_org_id = v_a LIMIT 1;
  INSERT INTO zz_ctx VALUES ('a', v_a::text), ('b', v_b::text), ('user', v_user::text), ('cust', v_cust::text),
                            ('rows', CASE WHEN COALESCE(v_has_order, false) THEN '1' ELSE '0' END);
  RAISE NOTICE 'SETUP: tenant A %, tenant B %, member user %, insert tests %', v_a, v_b,
    COALESCE(v_user::text, '<none>'), CASE WHEN COALESCE(v_has_order, false) THEN 'ON' ELSE 'SKIPPED (no order in A)' END;
END $$;

-- Helper: insert one test order for tenant A (customer reused from an existing order) and return id + number.
CREATE OR REPLACE FUNCTION pg_temp.zz_ins(p_no TEXT, p_parent UUID DEFAULT NULL)
RETURNS TABLE (id UUID, order_no TEXT) LANGUAGE plpgsql AS $f$
DECLARE v_a UUID := (SELECT v::uuid FROM zz_ctx WHERE k = 'a');
        v_c UUID := (SELECT v::uuid FROM zz_ctx WHERE k = 'cust');
BEGIN
  RETURN QUERY
  INSERT INTO public.org_orders_mst AS o (tenant_org_id, customer_id, order_no, parent_order_id)
  VALUES (v_a, v_c, p_no, p_parent)
  RETURNING o.id, o.order_no::TEXT;
END $f$;

-- ------------------------------------------------------------------
-- T2.1 config + consistency
-- ------------------------------------------------------------------
DO $$
DECLARE v_lvl TEXT; v_err INT;
BEGIN
  SELECT manage_by_level INTO v_lvl FROM public.sys_doc_seq_type_cd WHERE doc_type_code = 'ORDER';
  IF v_lvl IS DISTINCT FROM 'GENERAL' THEN RAISE EXCEPTION 'FAIL T2.1a: ORDER row is %, expected GENERAL', v_lvl; END IF;
  SELECT count(*) INTO v_err FROM public.vw_doc_seq_consistency WHERE doc_type_code = 'ORDER' AND severity = 'ERROR';
  IF v_err <> 0 THEN RAISE EXCEPTION 'FAIL T2.1b: % ERROR rows for ORDER in vw_doc_seq_consistency', v_err; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.org_orders_mst'::regclass AND tgname = 'trg_ord_no_assign')
     OR NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid = 'public.org_orders_mst'::regclass AND tgname = 'trg_ord_no_guard') THEN
    RAISE EXCEPTION 'FAIL T2.1c: trg_ord_no_assign / trg_ord_no_guard missing';
  END IF;
  IF (SELECT provolatile FROM pg_proc WHERE oid = 'public.get_order_number_prefix()'::regprocedure) <> 's' THEN
    RAISE EXCEPTION 'FAIL T2.1d: get_order_number_prefix is not STABLE';
  END IF;
  RAISE NOTICE 'PASS T2.1: ORDER is GENERAL, 0 ERROR rows, triggers present, prefix helper STABLE';
END $$;

-- ------------------------------------------------------------------
-- T2.2 wrapper: format, +1, rollback gives the number back
-- ------------------------------------------------------------------
DO $$
DECLARE v_a UUID := (SELECT v::uuid FROM zz_ctx WHERE k = 'a');
        n1 TEXT; n2 TEXT; n3 TEXT; n4 TEXT;
BEGIN
  n1 := public.generate_order_number(v_a);
  n2 := public.generate_order_number(v_a);
  IF n1 !~ '^ORD-[0-9]{8}-[0-9]{4,}$' THEN RAISE EXCEPTION 'FAIL T2.2a: bad format %', n1; END IF;
  IF public.extract_order_sequence(n2) <> public.extract_order_sequence(n1) + 1
     OR split_part(n1, '-', 2) <> split_part(n2, '-', 2) THEN
    RAISE EXCEPTION 'FAIL T2.2b: % then % is not +1', n1, n2;
  END IF;
  BEGIN
    n3 := public.generate_order_number(v_a);
    RAISE EXCEPTION 'zz_rollback';
  EXCEPTION WHEN raise_exception THEN NULL;
  END;
  n4 := public.generate_order_number(v_a);
  IF n4 <> n3 THEN RAISE EXCEPTION 'FAIL T2.2c: rolled-back number % not reused (got %)', n3, n4; END IF;
  INSERT INTO zz_ctx VALUES ('last', n4);
  RAISE NOTICE 'PASS T2.2: % -> % (+1), rolled-back % reused', n1, n2, n3;
END $$;

-- ------------------------------------------------------------------
-- T2.3 trigger fills empty, keeps supplied; guard
-- ------------------------------------------------------------------
DO $$
DECLARE v_last TEXT := (SELECT v FROM zz_ctx WHERE k = 'last');
        r1 RECORD; r2 RECORD; r3 RECORD; v_ok BOOLEAN := false;
BEGIN
  IF (SELECT v FROM zz_ctx WHERE k = 'rows') = '0' THEN RAISE NOTICE 'SKIP T2.3: no order in tenant A'; RETURN; END IF;
  SELECT * INTO r1 FROM pg_temp.zz_ins(NULL);
  SELECT * INTO r2 FROM pg_temp.zz_ins('');
  IF public.extract_order_sequence(r1.order_no) <> public.extract_order_sequence(v_last) + 1
     OR public.extract_order_sequence(r2.order_no) <> public.extract_order_sequence(v_last) + 2 THEN
    RAISE EXCEPTION 'FAIL T2.3a: trigger gave % / % after %', r1.order_no, r2.order_no, v_last;
  END IF;
  SELECT * INTO r3 FROM pg_temp.zz_ins(public.generate_order_number((SELECT v::uuid FROM zz_ctx WHERE k = 'a')));
  IF public.extract_order_sequence(r3.order_no) <> public.extract_order_sequence(v_last) + 3 THEN
    RAISE EXCEPTION 'FAIL T2.3b: supplied number not kept (%)', r3.order_no;
  END IF;
  UPDATE public.org_orders_mst SET order_no = order_no WHERE id = r1.id;           -- unchanged: WHEN skips the guard
  BEGIN
    UPDATE public.org_orders_mst SET order_no = r1.order_no || 'X' WHERE id = r1.id;
  EXCEPTION WHEN raise_exception THEN v_ok := SQLERRM LIKE 'DOC_SEQ_CODE_IMMUTABLE%';
  END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL T2.3c: order_no change was not blocked'; END IF;
  INSERT INTO zz_ctx VALUES ('root', r1.id::text), ('root_no', r1.order_no), ('root2', r2.id::text);
  RAISE NOTICE 'PASS T2.3: trigger assigned % and %, supplied % kept, guard blocks changes', r1.order_no, r2.order_no, r3.order_no;
END $$;

-- ------------------------------------------------------------------
-- T2.5 sub-orders: <root>-S<n>, numbered under the root, legacy suffixes ignored, soft-deleted counted
-- ------------------------------------------------------------------
DO $$
DECLARE v_a UUID := (SELECT v::uuid FROM zz_ctx WHERE k = 'a');
        v_root UUID; v_root_no TEXT; s TEXT; c1 RECORD; c2 RECORD; c3 RECORD; x RECORD;
BEGIN
  IF (SELECT v FROM zz_ctx WHERE k = 'rows') = '0' THEN RAISE NOTICE 'SKIP T2.5: no order in tenant A'; RETURN; END IF;
  v_root := (SELECT v::uuid FROM zz_ctx WHERE k = 'root');
  v_root_no := (SELECT v FROM zz_ctx WHERE k = 'root_no');
  s := public.fn_ord_next_sub_order_no(v_a, v_root);
  IF s <> v_root_no || '-S1' THEN RAISE EXCEPTION 'FAIL T2.5a: first sub-order %', s; END IF;
  SELECT * INTO c1 FROM pg_temp.zz_ins(s, v_root);
  s := public.fn_ord_next_sub_order_no(v_a, c1.id);                     -- split of a sub-order -> under the root
  IF s <> v_root_no || '-S2' THEN RAISE EXCEPTION 'FAIL T2.5b: split of S1 gave %', s; END IF;
  SELECT * INTO c2 FROM pg_temp.zz_ins(s, c1.id);
  PERFORM pg_temp.zz_ins(v_root_no || '-S482914', v_root);              -- legacy timestamp suffix: ignored
  PERFORM pg_temp.zz_ins(v_root_no || '-S07', v_root);                  -- leading zero: ignored
  PERFORM pg_temp.zz_ins(NULL, v_root);                                 -- fresh main number as a child: ignored
  s := public.fn_ord_next_sub_order_no(v_a, c2.id);
  IF s <> v_root_no || '-S3' THEN RAISE EXCEPTION 'FAIL T2.5c: expected -S3, got %', s; END IF;
  SELECT * INTO c3 FROM pg_temp.zz_ins(s, c2.id);
  UPDATE public.org_orders_mst SET rec_status = 0 WHERE id = c3.id AND tenant_org_id = v_a;   -- soft-deleted still counts
  s := public.fn_ord_next_sub_order_no(v_a, v_root);
  IF s <> v_root_no || '-S4' THEN RAISE EXCEPTION 'FAIL T2.5d: soft-deleted -S3 reused (%)', s; END IF;
  RAISE NOTICE 'PASS T2.5: S1, S2 (from S1), S3 (from S2, legacy/odd suffixes ignored), S4 after soft delete';
END $$;

-- ------------------------------------------------------------------
-- T2.6 sub-order errors: other tenant, unknown parent, cycle / depth
-- ------------------------------------------------------------------
DO $$
DECLARE v_a UUID := (SELECT v::uuid FROM zz_ctx WHERE k = 'a');
        v_b UUID := (SELECT v::uuid FROM zz_ctx WHERE k = 'b');
        v_root UUID; v_root2 UUID; v_ok BOOLEAN;
BEGIN
  IF (SELECT v FROM zz_ctx WHERE k = 'rows') = '0' THEN RAISE NOTICE 'SKIP T2.6: no order in tenant A'; RETURN; END IF;
  v_root := (SELECT v::uuid FROM zz_ctx WHERE k = 'root');
  v_root2 := (SELECT v::uuid FROM zz_ctx WHERE k = 'root2');
  v_ok := false;
  BEGIN PERFORM public.fn_ord_next_sub_order_no(v_b, v_root);
  EXCEPTION WHEN no_data_found THEN v_ok := SQLERRM LIKE 'ORD_PARENT_NOT_FOUND%'; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL T2.6a: tenant B could number under a tenant A order'; END IF;
  v_ok := false;
  BEGIN PERFORM public.fn_ord_next_sub_order_no(v_a, gen_random_uuid());
  EXCEPTION WHEN no_data_found THEN v_ok := SQLERRM LIKE 'ORD_PARENT_NOT_FOUND%'; END;
  IF NOT v_ok THEN RAISE EXCEPTION 'FAIL T2.6b: unknown parent not reported'; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'org_orders_mst' AND column_name = 'root_order_id') THEN
    -- After 0677 (P2.1): a root cannot be moved under another root, so a cycle cannot be built at all.
    v_ok := false;
    BEGIN UPDATE public.org_orders_mst SET parent_order_id = v_root WHERE id = v_root2 AND tenant_org_id = v_a;
    EXCEPTION WHEN check_violation THEN v_ok := SQLERRM LIKE 'ORD_ROOT_MISMATCH%'; END;
    IF NOT v_ok THEN RAISE EXCEPTION 'FAIL T2.6c: a root order could be re-parented (cycle possible)'; END IF;
    RAISE NOTICE 'PASS T2.6: cross-tenant and unknown parent -> ORD_PARENT_NOT_FOUND, re-parenting a root -> ORD_ROOT_MISMATCH (0677)';
  ELSE
    -- P2 only (0674): a cycle (bad data) must stop at the depth bound instead of looping.
    UPDATE public.org_orders_mst SET parent_order_id = v_root WHERE id = v_root2 AND tenant_org_id = v_a;
    UPDATE public.org_orders_mst SET parent_order_id = v_root2 WHERE id = v_root AND tenant_org_id = v_a;
    v_ok := false;
    BEGIN PERFORM public.fn_ord_next_sub_order_no(v_a, v_root);
    EXCEPTION WHEN invalid_parameter_value THEN v_ok := SQLERRM LIKE 'ORD_SPLIT_DEPTH_EXCEEDED%'; END;
    IF NOT v_ok THEN RAISE EXCEPTION 'FAIL T2.6c: cycle not stopped by the depth bound'; END IF;
    UPDATE public.org_orders_mst SET parent_order_id = NULL WHERE id IN (v_root, v_root2) AND tenant_org_id = v_a;
    RAISE NOTICE 'PASS T2.6: cross-tenant and unknown parent -> ORD_PARENT_NOT_FOUND, cycle -> ORD_SPLIT_DEPTH_EXCEEDED';
  END IF;
END $$;

-- ------------------------------------------------------------------
-- T2.7 grants and caller checks
-- ------------------------------------------------------------------
DO $$
DECLARE v_a UUID := (SELECT v::uuid FROM zz_ctx WHERE k = 'a');
        v_b UUID := (SELECT v::uuid FROM zz_ctx WHERE k = 'b');
        v_user UUID := NULLIF((SELECT v FROM zz_ctx WHERE k = 'user'), '')::uuid;
        v_root UUID := NULLIF((SELECT v FROM zz_ctx WHERE k = 'root'), '')::uuid;
        v_ok BOOLEAN; v_no TEXT;
BEGIN
  IF has_function_privilege('anon', 'public.generate_order_number(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.fn_ord_next_sub_order_no(uuid,uuid)', 'EXECUTE')
     OR has_function_privilege('authenticated', 'public.fn_ord_no_assign()', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL T2.7a: anon can execute the order number functions (or authenticated the trigger fn)';
  END IF;
  IF NOT has_function_privilege('authenticated', 'public.generate_order_number(uuid)', 'EXECUTE')
     OR NOT has_function_privilege('service_role', 'public.fn_ord_next_sub_order_no(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL T2.7b: authenticated / service_role lost EXECUTE';
  END IF;
  PERFORM set_config('request.jwt.claims',
    json_build_object('role', 'authenticated', 'sub', COALESCE(v_user, '00000000-0000-0000-0000-00000000dead'))::text, true);
  SET LOCAL ROLE authenticated;
  v_ok := false;
  BEGIN PERFORM public.generate_order_number(v_b);
  EXCEPTION WHEN insufficient_privilege THEN v_ok := SQLERRM LIKE 'DOC_SEQ_TENANT_MISMATCH%'; END;
  IF NOT v_ok THEN RESET ROLE; RAISE EXCEPTION 'FAIL T2.7c: authenticated numbered another tenant'; END IF;
  v_ok := false;
  BEGIN PERFORM public.fn_ord_next_sub_order_no(v_b, COALESCE(v_root, gen_random_uuid()));
  EXCEPTION WHEN insufficient_privilege THEN v_ok := SQLERRM LIKE 'DOC_SEQ_TENANT_MISMATCH%'; END;
  IF NOT v_ok THEN RESET ROLE; RAISE EXCEPTION 'FAIL T2.7d: authenticated sub-numbered another tenant'; END IF;
  IF v_user IS NOT NULL THEN
    v_no := public.generate_order_number(v_a);
    IF v_no !~ '^ORD-' THEN RESET ROLE; RAISE EXCEPTION 'FAIL T2.7e: own tenant gave %', v_no; END IF;
  END IF;
  RESET ROLE;
  PERFORM set_config('request.jwt.claims', '', true);
  RAISE NOTICE 'PASS T2.7: anon denied, cross-tenant -> DOC_SEQ_TENANT_MISMATCH, own tenant %',
    COALESCE(v_no, '<skipped: no member user>');
END $$;

-- ------------------------------------------------------------------
-- T2.8 grandfathered helpers
-- ------------------------------------------------------------------
DO $$
BEGIN
  IF public.extract_order_sequence('ORD-20261030-0042') IS DISTINCT FROM 42
     OR public.extract_order_sequence('ORD-20261030-12345') IS DISTINCT FROM 12345
     OR public.extract_order_sequence('ORD-20261030-0007-S3') IS DISTINCT FROM 7
     OR public.extract_order_sequence('X-1') IS NOT NULL
     OR public.extract_order_sequence(NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL T2.8: extract_order_sequence parse';
  END IF;
  RAISE NOTICE 'PASS T2.8: extract_order_sequence parses 4/5-digit and sub-order numbers, NULL otherwise';
END $$;

ROLLBACK;
