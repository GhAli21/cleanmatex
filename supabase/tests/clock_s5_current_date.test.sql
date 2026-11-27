-- ==================================================================
-- clock_s5_current_date.test.sql
-- Purpose: S5 checks for 0846_cmx_dt_replace_current_date.sql (MASTER_PLAN_v2 §7.1.3, T45, T67):
--          1 no rewritten object reads the session day; 2 fn_tenant_general_value('timezone') has no
--          HQ fallback for a tenant (G21); 3 numbering uses the organization zone day; 4 operational
--          readers fail closed without a zone; 5 health checks and views run with and without a zone;
--          6 credit-note expiry uses the ledger zone day and a missing zone gives ZONE_MISSING (G22);
--          7 speed-rule default dropped, unused unknown catalog zones inactive.
-- Dependencies: 0842, 0843, 0844, 0846.
-- Run (LOCAL database only, as postgres so the test clock works):
--   psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/clock_s5_current_date.test.sql
-- Needs 2 rows in org_tenants_mst. Section 6 needs a customer of tenant A (else it prints SKIP).
-- One transaction, ROLLED BACK at the end. Prints "PASS n: ..." or stops with "FAIL ...".
-- Test clock: 2026-03-01T11:00:00Z. Tenant A zone Pacific/Kiritimati (+14) -> civil day 2026-03-02,
-- while the UTC (session) day is 2026-03-01; so a result of 2026-03-02 proves the zone day is used.
-- ==================================================================

BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE TEMP TABLE zz_ctx (k TEXT PRIMARY KEY, v TEXT) ON COMMIT DROP;

CREATE FUNCTION pg_temp.zz_err(p_sql TEXT) RETURNS TEXT LANGUAGE plpgsql AS $$
BEGIN
  EXECUTE p_sql;
  RETURN NULL;
EXCEPTION WHEN OTHERS THEN
  RETURN SQLSTATE || ' ' || SQLERRM;
END $$;

DO $$
DECLARE
  v_a UUID; v_b UUID; v_err TEXT;
BEGIN
  SELECT ou.tenant_org_id INTO v_a
    FROM public.org_users_mst ou JOIN public.org_tenants_mst t ON t.id = ou.tenant_org_id
   WHERE ou.is_active AND ou.user_id IS NOT NULL LIMIT 1;
  IF v_a IS NULL THEN SELECT id INTO v_a FROM public.org_tenants_mst ORDER BY id LIMIT 1; END IF;
  SELECT id INTO v_b FROM public.org_tenants_mst WHERE id <> v_a ORDER BY id LIMIT 1;
  IF v_a IS NULL OR v_b IS NULL THEN RAISE EXCEPTION 'SETUP: need at least 2 tenants in org_tenants_mst'; END IF;
  UPDATE public.org_tenants_mst SET timezone = 'Pacific/Kiritimati', is_active = true, rec_status = 1 WHERE id = v_a;
  -- Tenant B without a zone (skip the no-zone cases when the column refuses NULL).
  v_err := pg_temp.zz_err(format('UPDATE public.org_tenants_mst SET timezone = NULL WHERE id = %L', v_b));
  INSERT INTO zz_ctx VALUES ('a', v_a::text), ('b', v_b::text), ('b_nozone', (v_err IS NULL)::text);
  UPDATE public.cmx_dt_env_cf SET env = 'test' WHERE config_id;
  PERFORM set_config('cmx.fake_now', '2026-03-01T11:00:00Z', true);
  IF public.fn_cmx_dt_today(v_a, 'ledger', NULL) <> DATE '2026-03-02' THEN
    RAISE EXCEPTION 'SETUP: test clock not active (needs the postgres role)';
  END IF;
  RAISE NOTICE 'SETUP: tenant A % (Pacific/Kiritimati), tenant B % (no zone: %)', v_a, v_b,
    CASE WHEN v_err IS NULL THEN 'yes' ELSE 'no, ' || v_err END;
END $$;

-- 1. No rewritten object reads the session day; each one uses the SQL time API.
DO $$
DECLARE v_bad TEXT;
BEGIN
  SELECT string_agg(n, ', ') INTO v_bad
    FROM unnest(ARRAY[
    'get_order_number_prefix',
    'sys_bill_generate_invoice_number',
    'sys_bill_update_invoice_amount_due',
    'seed_tenant_erp_lite_defaults',
    'resolve_fin_tpl_for_tnt',
    'apply_fin_tpl_for_tnt',
    'fn_expire_credit_notes',
    'generate_cash_drawer_sess_no',
    'generate_cash_drawer_trx_no',
    'seed_product_speed_rules',
    'fn_shc_speed_no_rules',
    'fn_shc_cal_holidays_estimated',
    'fn_shc_cal_holidays_missing',
    'fn_shc_tax_doc_type_no_rule',
    'fn_shc_tax_exemption_expired',
    'fn_shc_tax_kit_update_pending',
    'fn_tax_kit_apply',
    'fn_tax_kit_update',
    'fn_tax_kit_update_all',
    'fn_tax_kit_version_publish',
    'fn_tax_kit_version_clone',
    'get_product_price',
    'vw_fin_missing_required_usage',
    'vw_fin_coa_explorer',
    'fn_fin_credit_note_expire_one',
    'fn_fin_credit_note_expiry_run',
    'fn_tenant_general_value']) AS n
   WHERE NOT EXISTS (
           SELECT 1 FROM pg_catalog.pg_proc p
            WHERE p.pronamespace = 'public'::regnamespace AND p.proname = n
              AND pg_catalog.pg_get_functiondef(p.oid) !~* '\mcurrent_date\M|now\(\)\s*::\s*date|fn_ops_zone\s*\('  -- CLOCK-OK: test pattern
              AND (n = 'fn_tenant_general_value' OR pg_catalog.pg_get_functiondef(p.oid) ~ 'fn_cmx_dt_'))
     AND NOT EXISTS (
           SELECT 1 FROM pg_catalog.pg_class c
            WHERE c.relnamespace = 'public'::regnamespace AND c.relname = n AND c.relkind = 'v'
              AND pg_catalog.pg_get_viewdef(c.oid, false) !~* '\mcurrent_date\M'  -- CLOCK-OK: test pattern
              AND pg_catalog.pg_get_viewdef(c.oid, false) ~ 'fn_cmx_dt_today_or_null');
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'FAIL 1: still on the session day or missing: %', v_bad; END IF;
  RAISE NOTICE 'PASS 1: 27 objects read the day through fn_cmx_dt_*';
END $$;

-- 2. G21: fn_tenant_general_value('timezone') = the tenant value only.
DO $$
DECLARE v_a UUID := (SELECT v FROM zz_ctx WHERE k = 'a'); v_b UUID := (SELECT v FROM zz_ctx WHERE k = 'b');
BEGIN
  IF public.fn_tenant_general_value(v_a, 'timezone') IS DISTINCT FROM 'Pacific/Kiritimati' THEN RAISE EXCEPTION 'FAIL 2a: tenant value'; END IF;
  IF public.fn_tenant_general_value(NULL, 'timezone') IS DISTINCT FROM (SELECT timezone FROM public.hq_general_config WHERE config_id) THEN
    RAISE EXCEPTION 'FAIL 2b: platform call must return the HQ zone';
  END IF;
  IF (SELECT v FROM zz_ctx WHERE k = 'b_nozone') = 'true' AND public.fn_tenant_general_value(v_b, 'timezone') IS NOT NULL THEN
    RAISE EXCEPTION 'FAIL 2c: tenant without a zone got the HQ zone';
  END IF;
  IF public.fn_tenant_general_value(v_a, 'date_format') IS NULL THEN RAISE EXCEPTION 'FAIL 2d: other keys keep the HQ fallback'; END IF;
  RAISE NOTICE 'PASS 2: G21 timezone has no HQ fallback for a tenant';
END $$;

-- 3. Numbering uses the organization day (2026-03-02 in Kiritimati, not the UTC 2026-03-01).
DO $$
DECLARE v_a UUID := (SELECT v FROM zz_ctx WHERE k = 'a'); v_b UUID := (SELECT v FROM zz_ctx WHERE k = 'b'); v_err TEXT;
BEGIN
  IF public.generate_cash_drawer_trx_no(v_a) NOT LIKE 'CDT-20260302-%' THEN RAISE EXCEPTION 'FAIL 3a: trx no %', public.generate_cash_drawer_trx_no(v_a); END IF;
  IF public.generate_cash_drawer_sess_no(v_a) NOT LIKE 'SES-20260302-%' THEN RAISE EXCEPTION 'FAIL 3b: session no'; END IF;
  IF (SELECT v FROM zz_ctx WHERE k = 'b_nozone') = 'true' THEN
    v_err := pg_temp.zz_err(format('SELECT public.generate_cash_drawer_trx_no(%L)', v_b));
    IF v_err IS NULL OR v_err NOT LIKE '%TIMEZONE_NOT_CONFIGURED%' THEN RAISE EXCEPTION 'FAIL 3c: no zone must fail closed, got %', v_err; END IF;
  END IF;
  RAISE NOTICE 'PASS 3: cash-drawer numbers use the pos_session zone day';
END $$;

-- 4. Operational readers fail closed without a zone; an explicit date still works.
DO $$
DECLARE v_a UUID := (SELECT v FROM zz_ctx WHERE k = 'a'); v_b UUID := (SELECT v FROM zz_ctx WHERE k = 'b'); v_err TEXT;
BEGIN
  v_err := pg_temp.zz_err(format('SELECT count(*) FROM public.resolve_fin_tpl_for_tnt(%L)', v_a));
  IF v_err IS NOT NULL THEN RAISE EXCEPTION 'FAIL 4a: resolve_fin_tpl_for_tnt with a zone: %', v_err; END IF;
  v_err := pg_temp.zz_err(format('SELECT public.get_product_price(%L, gen_random_uuid(), ''standard'', 1, DATE ''2026-03-01'')', v_b));
  IF v_err IS NOT NULL THEN RAISE EXCEPTION 'FAIL 4b: explicit date must not need a zone: %', v_err; END IF;
  IF (SELECT v FROM zz_ctx WHERE k = 'b_nozone') = 'true' THEN
    v_err := pg_temp.zz_err(format('SELECT count(*) FROM public.resolve_fin_tpl_for_tnt(%L)', v_b));
    IF v_err NOT LIKE '%TIMEZONE_NOT_CONFIGURED%' THEN RAISE EXCEPTION 'FAIL 4c: resolve_fin_tpl_for_tnt without a zone: %', v_err; END IF;
    v_err := pg_temp.zz_err(format('SELECT public.get_product_price(%L, gen_random_uuid())', v_b));
    IF v_err NOT LIKE '%TIMEZONE_NOT_CONFIGURED%' THEN RAISE EXCEPTION 'FAIL 4d: get_product_price default day without a zone: %', v_err; END IF;
  END IF;
  RAISE NOTICE 'PASS 4: operational day readers fail closed (TIMEZONE_NOT_CONFIGURED); explicit dates work';
END $$;

-- 5. Health checks and views run with and without a zone.
DO $$
DECLARE v_t UUID; v_err TEXT; v_fn TEXT;
BEGIN
  FOREACH v_t IN ARRAY ARRAY[(SELECT v FROM zz_ctx WHERE k = 'a')::uuid, (SELECT v FROM zz_ctx WHERE k = 'b')::uuid] LOOP
    FOREACH v_fn IN ARRAY ARRAY['fn_shc_speed_no_rules', 'fn_shc_cal_holidays_estimated', 'fn_shc_cal_holidays_missing',
                               'fn_shc_tax_doc_type_no_rule', 'fn_shc_tax_exemption_expired', 'fn_shc_tax_kit_update_pending'] LOOP
      v_err := pg_temp.zz_err(format('SELECT public.%I(%L, NULL) ->> ''status''', v_fn, v_t));
      IF v_err IS NOT NULL THEN RAISE EXCEPTION 'FAIL 5a: % for %: %', v_fn, v_t, v_err; END IF;
    END LOOP;
  END LOOP;
  v_err := pg_temp.zz_err('SELECT count(*) FROM public.vw_fin_coa_explorer');
  IF v_err IS NOT NULL THEN RAISE EXCEPTION 'FAIL 5b: vw_fin_coa_explorer: %', v_err; END IF;
  v_err := pg_temp.zz_err('SELECT count(*) FROM public.vw_fin_missing_required_usage');
  IF v_err IS NOT NULL THEN RAISE EXCEPTION 'FAIL 5c: vw_fin_missing_required_usage: %', v_err; END IF;
  RAISE NOTICE 'PASS 5: rewritten health checks and views run with and without a zone';
END $$;

-- 6. G22 credit-note expiry.
DO $$
DECLARE
  v_a UUID := (SELECT v FROM zz_ctx WHERE k = 'a'); v_cust UUID; v_cur TEXT; v_n1 UUID; v_n2 UUID; v_err TEXT; v_out TEXT; v_run JSONB;
BEGIN
  SELECT c.id INTO v_cust FROM public.org_customers_mst c WHERE c.tenant_org_id = v_a LIMIT 1;
  SELECT n.currency_code INTO v_cur FROM public.org_credit_notes_mst n WHERE n.tenant_org_id = v_a LIMIT 1;
  v_cur := coalesce(v_cur, (SELECT code FROM public.sys_currency_cd ORDER BY code LIMIT 1));
  IF v_cust IS NULL THEN RAISE NOTICE 'SKIP 6: tenant A has no customer'; RETURN; END IF;
  BEGIN
    INSERT INTO public.org_credit_notes_mst (tenant_org_id, customer_id, original_amount, remaining_balance, currency_code, reason, expires_at, status)
    VALUES (v_a, v_cust, 1, 0, v_cur, 'S5 test', DATE '2026-03-01', 'ACTIVE') RETURNING id INTO v_n1;
    INSERT INTO public.org_credit_notes_mst (tenant_org_id, customer_id, original_amount, remaining_balance, currency_code, reason, expires_at, status)
    VALUES (v_a, v_cust, 1, 0, v_cur, 'S5 test', DATE '2026-03-01', 'ACTIVE') RETURNING id INTO v_n2;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'SKIP 6: could not insert a test credit note (%)', SQLERRM; RETURN;
  END;
  -- Kiritimati day 2026-03-02: a note dated 2026-03-01 is due (on the UTC day it would not be).
  v_out := public.fn_fin_credit_note_expire_one(v_a, v_n1, true, 'system/s5-test');
  IF v_out <> 'EXPIRED' THEN RAISE EXCEPTION 'FAIL 6a: expected EXPIRED, got %', v_out; END IF;
  -- No ledger zone: not expired, outcome ZONE_MISSING, run skips and counts it.
  v_err := pg_temp.zz_err(format('UPDATE public.org_tenants_mst SET timezone = NULL WHERE id = %L', v_a));
  IF v_err IS NOT NULL THEN RAISE NOTICE 'SKIP 6b: timezone cannot be NULL (%)', v_err; RETURN; END IF;
  v_out := public.fn_fin_credit_note_expire_one(v_a, v_n2, true, 'system/s5-test');
  IF v_out <> 'ZONE_MISSING' THEN RAISE EXCEPTION 'FAIL 6b: expected ZONE_MISSING, got %', v_out; END IF;
  v_run := public.fn_fin_credit_note_expiry_run();
  IF coalesce((v_run ->> 'zone_missing')::int, 0) < 1 THEN RAISE EXCEPTION 'FAIL 6c: run did not count the zone-less organization: %', v_run; END IF;
  IF (SELECT status FROM public.org_credit_notes_mst WHERE id = v_n2) <> 'ACTIVE' THEN RAISE EXCEPTION 'FAIL 6d: note expired without a zone'; END IF;
  -- Without p_only_if_due (manual expiry) the zone is not needed.
  v_out := public.fn_fin_credit_note_expire_one(v_a, v_n2, false, 'system/s5-test');
  IF v_out <> 'EXPIRED' THEN RAISE EXCEPTION 'FAIL 6e: manual expiry got %', v_out; END IF;
  UPDATE public.org_tenants_mst SET timezone = 'Pacific/Kiritimati' WHERE id = v_a;
  RAISE NOTICE 'PASS 6: credit-note expiry on the ledger zone day; missing zone -> ZONE_MISSING, skipped and counted';
END $$;

-- 7. Speed-rule default and catalog.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'org_speed_price_rules_cf' AND column_name = 'effective_from' AND column_default IS NOT NULL) THEN
    RAISE EXCEPTION 'FAIL 7a: effective_from still has a default';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sys_timezone_cd z
              WHERE z.is_canonical AND z.is_active IS TRUE
                AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_timezone_names n WHERE n.name = z.iana_name)
                AND NOT EXISTS (SELECT 1 FROM public.org_tenants_mst t WHERE t.timezone = z.code)
                AND NOT EXISTS (SELECT 1 FROM public.org_branches_mst b WHERE b.timezone_code = z.code)) THEN
    RAISE EXCEPTION 'FAIL 7b: an unused zone unknown to this server is still active';
  END IF;
  RAISE NOTICE 'PASS 7: speed-rule default dropped; unknown unused zones inactive';
END $$;

ROLLBACK;
