-- ==================================================================
-- hfc_p5_scn_safety.test.sql
-- Purpose: P5 checks for the store credit note numbering cutover (plan section 5.11, T5.1, test plan item 10, QA S12).
-- Dependencies: P1 migrations 0666-0672 and P5 migration 0687_fin_store_credit_note_scn.
-- Run (LOCAL database only, as the postgres/superuser role):
--   psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/hfc_p5_scn_safety.test.sql
-- Needs one tenant with at least one customer (org_customers_mst); insert tests are reported as SKIP otherwise.
-- Everything runs in one transaction and is ROLLED BACK at the end: no credit note, counter or config change is kept.
-- Each test prints "PASS ..." or stops with "FAIL ...". Concurrency (20 parallel issues): DEV_GUIDE section 20.
-- ==================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TEMP TABLE zz_ctx (k TEXT PRIMARY KEY, v TEXT) ON COMMIT DROP;

-- Fixture -------------------------------------------------------------------------------------------------------
DO $$
DECLARE v_a UUID; v_cust UUID; v_legacy BIGINT;
BEGIN
  SELECT c.tenant_org_id, c.id INTO v_a, v_cust
    FROM public.org_customers_mst c JOIN public.org_tenants_mst t ON t.id = c.tenant_org_id
   ORDER BY c.tenant_org_id LIMIT 1;
  SELECT count(*) INTO v_legacy FROM public.org_credit_notes_mst;
  INSERT INTO zz_ctx VALUES ('a', v_a::text), ('cust', v_cust::text), ('legacy', v_legacy::text),
    ('legacy_md5', (SELECT md5(COALESCE(string_agg(id::text || credit_note_no, ',' ORDER BY id), '')) FROM public.org_credit_notes_mst));
  RAISE NOTICE 'SETUP: tenant %, customer %, existing credit notes %', COALESCE(v_a::text, '<none>'),
    COALESCE(v_cust::text, '<none>'), v_legacy;
END $$;

CREATE OR REPLACE FUNCTION pg_temp.zz_ins(p_no TEXT)
RETURNS TEXT LANGUAGE plpgsql AS $f$
DECLARE v_no TEXT;
BEGIN
  INSERT INTO public.org_credit_notes_mst (tenant_org_id, customer_id, credit_note_no, original_amount, remaining_balance, currency_code, reason)
  VALUES ((SELECT v::uuid FROM zz_ctx WHERE k = 'a'), (SELECT v::uuid FROM zz_ctx WHERE k = 'cust'), p_no, 1, 1, 'OMR', 'hfc_p5 test')
  RETURNING credit_note_no INTO v_no;
  RETURN v_no;
END $f$;

-- T5.1a config, catalog, consistency ----------------------------------------------------------------------------
DO $$
DECLARE r public.sys_doc_seq_type_cd%ROWTYPE; v_err INT;
BEGIN
  SELECT * INTO r FROM public.sys_doc_seq_type_cd WHERE doc_type_code = 'STORE_CREDIT_NOTE';
  IF r.manage_by_level IS DISTINCT FROM 'GENERAL' OR r.prefix IS DISTINCT FROM 'SCN' OR r.parts_format IS DISTINCT FROM 'YYYY-SEQ'
     OR r.seq_pad_length <> 6 OR r.reset_policy IS DISTINCT FROM 'YEARLY' THEN
    RAISE EXCEPTION 'FAIL T5.1a: STORE_CREDIT_NOTE row is % % % % %', r.manage_by_level, r.prefix, r.parts_format, r.seq_pad_length, r.reset_policy;
  END IF;
  SELECT count(*) INTO v_err FROM public.vw_doc_seq_consistency WHERE severity = 'ERROR';
  IF v_err <> 0 THEN RAISE EXCEPTION 'FAIL T5.1a: % ERROR rows in vw_doc_seq_consistency', v_err; END IF;
  IF (SELECT count(*) FROM pg_trigger WHERE tgrelid = 'public.org_credit_notes_mst'::regclass
        AND tgname IN ('trg_fin_cn_no_assign', 'trg_fin_cn_no_guard') AND NOT tgisinternal) <> 2 THEN
    RAISE EXCEPTION 'FAIL T5.1a: trg_fin_cn_no_assign / trg_fin_cn_no_guard missing';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conrelid = 'public.org_credit_notes_mst'::regclass AND conname = 'ck_fin_cn_no_set') THEN
    RAISE EXCEPTION 'FAIL T5.1a: ck_fin_cn_no_set missing';
  END IF;
  IF (SELECT pg_get_expr(d.adbin, d.adrelid) FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
       WHERE d.adrelid = 'public.org_credit_notes_mst'::regclass AND a.attname = 'credit_note_no') IS DISTINCT FROM '''''::text' THEN
    RAISE EXCEPTION 'FAIL T5.1a: credit_note_no default is not ''''';
  END IF;
  RAISE NOTICE 'PASS T5.1a config GENERAL SCN YYYY-SEQ/6 YEARLY, triggers, CHECK, default, 0 consistency errors';
END $$;

-- T5.1b-g inserts ---------------------------------------------------------------------------------------------
DO $$
DECLARE v1 TEXT; v2 TEXT; v3 TEXT; v4 TEXT; v_last BIGINT; v_a UUID := (SELECT v::uuid FROM zz_ctx WHERE k = 'a');
BEGIN
  IF v_a IS NULL OR (SELECT v FROM zz_ctx WHERE k = 'cust') IS NULL THEN
    RAISE NOTICE 'SKIP T5.1b-g: no tenant with a customer'; RETURN;
  END IF;
  -- b: empty -> SCN-YYYY-NNNNNN, next is +1
  v1 := pg_temp.zz_ins('');
  v2 := pg_temp.zz_ins('');
  IF v1 !~ '^SCN-[0-9]{4}-[0-9]{6,}$' OR v2 !~ '^SCN-[0-9]{4}-[0-9]{6,}$'
     OR split_part(v2, '-', 3)::BIGINT <> split_part(v1, '-', 3)::BIGINT + 1 THEN
    RAISE EXCEPTION 'FAIL T5.1b: got % then %', v1, v2;
  END IF;
  SELECT last_value INTO v_last FROM public.org_doc_seq_mst
   WHERE tenant_org_id = v_a AND doc_type_code = 'STORE_CREDIT_NOTE' AND period_key = split_part(v2, '-', 2);
  IF v_last IS DISTINCT FROM split_part(v2, '-', 3)::BIGINT THEN
    RAISE EXCEPTION 'FAIL T5.1b: counter % does not match %', v_last, v2;
  END IF;
  RAISE NOTICE 'PASS T5.1b empty -> % then %', v1, v2;
  -- c: column omitted (DEFAULT '') and blank -> assigned
  INSERT INTO public.org_credit_notes_mst (tenant_org_id, customer_id, original_amount, remaining_balance, currency_code, reason)
  VALUES (v_a, (SELECT v::uuid FROM zz_ctx WHERE k = 'cust'), 1, 1, 'OMR', 'hfc_p5 test') RETURNING credit_note_no INTO v3;
  v4 := pg_temp.zz_ins('   ');
  IF v3 !~ '^SCN-' OR v4 !~ '^SCN-' THEN RAISE EXCEPTION 'FAIL T5.1c: default/blank gave % / %', v3, v4; END IF;
  RAISE NOTICE 'PASS T5.1c default -> %, blank -> %', v3, v4;
  -- d: supplied value kept (old app code during the deploy window)
  v3 := pg_temp.zz_ins('CN-ZZTEST00-99999');
  IF v3 <> 'CN-ZZTEST00-99999' THEN RAISE EXCEPTION 'FAIL T5.1d: supplied value replaced by %', v3; END IF;
  RAISE NOTICE 'PASS T5.1d supplied value kept';
  -- e: guard
  BEGIN
    UPDATE public.org_credit_notes_mst SET credit_note_no = 'SCN-1999-000001' WHERE tenant_org_id = v_a AND credit_note_no = v1;
    RAISE EXCEPTION 'FAIL T5.1e: credit_note_no changed';
  EXCEPTION WHEN raise_exception THEN
    IF SQLERRM NOT LIKE 'DOC_SEQ_CODE_IMMUTABLE%' THEN RAISE; END IF;
  END;
  UPDATE public.org_credit_notes_mst SET remaining_balance = 0 WHERE tenant_org_id = v_a AND credit_note_no = v1;
  RAISE NOTICE 'PASS T5.1e number immutable, other columns still update';
  -- f: duplicate supplied value rejected by the unique index
  BEGIN
    PERFORM pg_temp.zz_ins(v1);
    RAISE EXCEPTION 'FAIL T5.1f: duplicate accepted';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
  RAISE NOTICE 'PASS T5.1f duplicate number rejected';
  -- g: caller gate (anon JWT may not issue numbers)
  BEGIN
    PERFORM set_config('request.jwt.claims', '{"role":"anon"}', true);
    PERFORM pg_temp.zz_ins('');
    RAISE EXCEPTION 'FAIL T5.1g: anon issued a number';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  PERFORM set_config('request.jwt.claims', '', true);
  RAISE NOTICE 'PASS T5.1g anon caller refused (DOC_SEQ_TENANT_MISMATCH)';
END $$;

-- T5.1h legacy rows untouched -------------------------------------------------------------------------------
DO $$
BEGIN
  IF (SELECT md5(COALESCE(string_agg(id::text || credit_note_no, ',' ORDER BY id), '')) FROM public.org_credit_notes_mst
       WHERE reason IS DISTINCT FROM 'hfc_p5 test') <> (SELECT v FROM zz_ctx WHERE k = 'legacy_md5') THEN
    RAISE EXCEPTION 'FAIL T5.1h: existing credit note numbers changed';
  END IF;
  RAISE NOTICE 'PASS T5.1h % existing credit notes unchanged', (SELECT v FROM zz_ctx WHERE k = 'legacy');
END $$;

ROLLBACK;
