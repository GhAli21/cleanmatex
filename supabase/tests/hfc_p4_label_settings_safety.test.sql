-- ==================================================================
-- hfc_p4_label_settings_safety.test.sql
-- Purpose: user-run safety test for Human-Friendly Codes P4 label printing config (migration 0685).
--   Part A checks the tables, the 3 system default rows, RLS, the resolver and the Settings > Labels nav row,
--          and that nothing depends on the `label_printing` flag.
--   Part B resolves one tenant (tenant-wide) and lists its overrides; every effective value must be valid.
--   Part C writes tenant + branch overrides (rolled back) and checks the override order branch -> tenant ->
--          system, the CHECK constraints, and the receipt-barcode ceiling (human_codes_scan_labels).
-- Dependencies: migrations 0684 and 0685_add_settings_label_printing applied.
-- Run with psql as the postgres role (LOCAL first; on remote it is also safe):
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/hfc_p4_label_settings_safety.test.sql
--   psql "$DB_URL" -v ON_ERROR_STOP=1 -v tenant_id=<uuid> -f supabase/tests/hfc_p4_label_settings_safety.test.sql
-- Without tenant_id it picks the first active tenant (by id).
-- SAFE: one transaction, ROLLED BACK at the end; nothing is kept.
-- Output: "PASS ..." notices, or the run stops at the first "FAIL ...".
-- ==================================================================

\if :{?tenant_id}
\else
\set tenant_id ''
\endif

BEGIN;
SET LOCAL lock_timeout = '5s';
SELECT set_config('zz.tenant', :'tenant_id', true) AS tenant_param;

-- ------------------------------------------------------------------
-- Part A: structure, seeds, security, nav
-- ------------------------------------------------------------------
DO $$
DECLARE
  v_bad TEXT;
  v_n   INTEGER;
BEGIN
  IF to_regclass('public.sys_label_printing_cf') IS NULL OR to_regclass('public.org_label_printing_cf') IS NULL THEN
    RAISE EXCEPTION 'FAIL A1: sys_label_printing_cf / org_label_printing_cf missing (apply 0685)';
  END IF;
  RAISE NOTICE 'PASS A1: both config tables exist';

  SELECT string_agg(e.lt, ', ') INTO v_bad
  FROM (VALUES
    ('ORDER_LABEL', '4x6in',   true,  true,  NULL::boolean, 1::smallint),
    ('PIECE_TAG',   '58x30mm', false, NULL,  NULL,          1::smallint),
    ('RECEIPT',     NULL,      NULL,  NULL,  true,          NULL)
  ) AS e(lt, sz, qr, cust, bc, cp)
  LEFT JOIN public.sys_label_printing_cf s ON s.label_type = e.lt
  WHERE s.label_type IS NULL OR NOT s.is_active OR s.rec_status <> 1;
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'FAIL A2: system default row missing or inactive: %', v_bad; END IF;
  RAISE NOTICE 'PASS A2: 3 system default rows active (values may have been edited by HQ)';

  SELECT count(*) INTO v_n FROM pg_class
  WHERE oid IN ('public.sys_label_printing_cf'::regclass, 'public.org_label_printing_cf'::regclass) AND relrowsecurity;
  IF v_n <> 2 THEN RAISE EXCEPTION 'FAIL A3: RLS not enabled on both tables'; END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'org_label_printing_cf'
                 AND policyname = 'pol_org_label_printing_cf_tenant') THEN
    RAISE EXCEPTION 'FAIL A3: tenant policy missing on org_label_printing_cf';
  END IF;
  IF has_table_privilege('anon', 'public.org_label_printing_cf', 'SELECT')
     OR has_table_privilege('anon', 'public.sys_label_printing_cf', 'SELECT')
     OR has_table_privilege('authenticated', 'public.sys_label_printing_cf', 'UPDATE') THEN
    RAISE EXCEPTION 'FAIL A3: unexpected grant (anon read or authenticated write on sys)';
  END IF;
  IF has_function_privilege('anon', 'public.fn_label_printing_resolve(uuid,uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'FAIL A3: anon can execute fn_label_printing_resolve';
  END IF;
  RAISE NOTICE 'PASS A3: RLS, policies and grants';

  IF NOT EXISTS (SELECT 1 FROM public.sys_components_cd
                 WHERE comp_code = 'settings_labels' AND comp_path = '/dashboard/settings/labels'
                   AND parent_comp_code = 'config_settings' AND is_active) THEN
    RAISE EXCEPTION 'FAIL A4: nav row settings_labels missing';
  END IF;
  RAISE NOTICE 'PASS A4: nav row settings_labels';

  -- No label_printing dependency (A-47): neither the resolver nor the nav row mention it.
  IF pg_get_functiondef('public.fn_label_printing_resolve(uuid,uuid)'::regprocedure) ~ '''label_printing''' THEN
    RAISE EXCEPTION 'FAIL A5: resolver still checks label_printing';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sys_components_cd WHERE comp_code = 'settings_labels' AND feature_flag::text LIKE '%label_printing%') THEN
    RAISE EXCEPTION 'FAIL A5: nav row gated by label_printing';
  END IF;
  RAISE NOTICE 'PASS A5: no label_printing gating';
END $$;

-- ------------------------------------------------------------------
-- Part B: one tenant's effective values and overrides
-- ------------------------------------------------------------------
DO $$
DECLARE
  v_t   UUID := NULLIF(current_setting('zz.tenant', true), '')::UUID;
  v_bad TEXT;
  r     RECORD;
BEGIN
  IF v_t IS NULL THEN
    SELECT id INTO v_t FROM public.org_tenants_mst WHERE COALESCE(is_active, true) ORDER BY id LIMIT 1;
  END IF;
  IF v_t IS NULL THEN RAISE EXCEPTION 'FAIL B0: no tenant found'; END IF;
  PERFORM set_config('zz.tenant', v_t::text, true);

  SELECT string_agg(x.label_type, ', ') INTO v_bad
  FROM public.fn_label_printing_resolve(v_t) x
  WHERE (x.label_type = 'ORDER_LABEL' AND (x.size_code NOT IN ('4x6in','80mm','58mm','A6') OR x.show_qr IS NULL
          OR x.show_customer_name IS NULL OR x.copies NOT BETWEEN 1 AND 10))
     OR (x.label_type = 'PIECE_TAG' AND (x.size_code NOT IN ('58x30mm','50x25mm','80x40mm') OR x.show_qr IS NULL
          OR x.copies NOT BETWEEN 1 AND 10))
     OR (x.label_type = 'RECEIPT' AND x.show_order_barcode IS NULL);
  IF v_bad IS NOT NULL THEN RAISE EXCEPTION 'FAIL B1: invalid effective value for %', v_bad; END IF;
  IF (SELECT count(*) FROM public.fn_label_printing_resolve(v_t)) <> 3 THEN
    RAISE EXCEPTION 'FAIL B1: resolver did not return 3 label types';
  END IF;
  RAISE NOTICE 'PASS B1: tenant % resolves 3 valid label types', v_t;

  FOR r IN SELECT x.label_type, x.size_code, x.show_qr, x.show_customer_name, x.show_order_barcode, x.copies, x.value_sources
           FROM public.fn_label_printing_resolve(v_t) x LOOP
    RAISE NOTICE 'INFO B2: % size=% qr=% customer=% barcode=% copies=% sources=%',
      r.label_type, r.size_code, r.show_qr, r.show_customer_name, r.show_order_barcode, r.copies, r.value_sources;
  END LOOP;
  FOR r IN SELECT o.label_type, o.branch_id, o.size_code, o.show_qr, o.show_customer_name, o.show_order_barcode, o.copies
           FROM public.org_label_printing_cf o WHERE o.tenant_org_id = v_t ORDER BY o.label_type, o.branch_id NULLS FIRST LOOP
    RAISE NOTICE 'INFO B3: override % branch=% size=% qr=% customer=% barcode=% copies=%',
      r.label_type, COALESCE(r.branch_id::text, 'TENANT'), r.size_code, r.show_qr, r.show_customer_name, r.show_order_barcode, r.copies;
  END LOOP;
END $$;

-- ------------------------------------------------------------------
-- Part C: override order, constraints, barcode ceiling (all rolled back)
-- ------------------------------------------------------------------
DO $$
DECLARE
  v_t      UUID := current_setting('zz.tenant')::UUID;
  v_b      UUID;
  v_flag   JSONB;
  v_on     BOOLEAN;
  v_size   TEXT;
  v_src    JSONB;
  v_bc     BOOLEAN;
  v_failed BOOLEAN;
BEGIN
  SELECT id INTO v_b FROM public.org_branches_mst WHERE tenant_org_id = v_t ORDER BY id LIMIT 1;

  DELETE FROM public.org_label_printing_cf WHERE tenant_org_id = v_t AND label_type IN ('ORDER_LABEL', 'RECEIPT');
  INSERT INTO public.org_label_printing_cf (tenant_org_id, label_type, branch_id, size_code, copies, created_by, created_info)
  VALUES (v_t, 'ORDER_LABEL', NULL, 'A6', 2, 'hfc_p4_safety_test', 'rolled back');

  SELECT x.size_code, x.value_sources INTO v_size, v_src FROM public.fn_label_printing_resolve(v_t) x WHERE x.label_type = 'ORDER_LABEL';
  IF v_size <> 'A6' OR v_src ->> 'size_code' <> 'TENANT' THEN
    RAISE EXCEPTION 'FAIL C1: tenant override not used (got % from %)', v_size, v_src;
  END IF;
  RAISE NOTICE 'PASS C1: tenant override wins over system';

  IF v_b IS NULL THEN
    RAISE NOTICE 'SKIP C2: tenant has no branch';
  ELSE
    INSERT INTO public.org_label_printing_cf (tenant_org_id, label_type, branch_id, size_code, created_by, created_info)
    VALUES (v_t, 'ORDER_LABEL', v_b, '58mm', 'hfc_p4_safety_test', 'rolled back');
    SELECT x.size_code, x.value_sources INTO v_size, v_src FROM public.fn_label_printing_resolve(v_t, v_b) x WHERE x.label_type = 'ORDER_LABEL';
    IF v_size <> '58mm' OR v_src ->> 'size_code' <> 'BRANCH' OR v_src ->> 'copies' <> 'TENANT' THEN
      RAISE EXCEPTION 'FAIL C2: branch override order wrong (got % / %)', v_size, v_src;
    END IF;
    RAISE NOTICE 'PASS C2: branch -> tenant -> system per column';
  END IF;

  v_failed := false;
  BEGIN
    INSERT INTO public.org_label_printing_cf (tenant_org_id, label_type, size_code) VALUES (v_t, 'PIECE_TAG', '4x6in');
  EXCEPTION WHEN check_violation THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'FAIL C3: order-label size accepted on PIECE_TAG'; END IF;
  v_failed := false;
  BEGIN
    INSERT INTO public.org_label_printing_cf (tenant_org_id, label_type, copies) VALUES (v_t, 'PIECE_TAG', 11);
  EXCEPTION WHEN check_violation THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'FAIL C3: copies 11 accepted'; END IF;
  v_failed := false;
  BEGIN
    INSERT INTO public.org_label_printing_cf (tenant_org_id, label_type, branch_id) VALUES (v_t, 'ORDER_LABEL', NULL);
  EXCEPTION WHEN unique_violation THEN v_failed := true;
  END;
  IF NOT v_failed THEN RAISE EXCEPTION 'FAIL C3: second tenant-wide ORDER_LABEL row accepted'; END IF;
  RAISE NOTICE 'PASS C3: CHECK and unique constraints';

  BEGIN
    SELECT f.value INTO v_flag FROM public.hq_ff_get_effective_value(v_t, 'human_codes_scan_labels') f LIMIT 1;
  EXCEPTION WHEN OTHERS THEN v_flag := NULL;
  END;
  v_on := NOT (v_flag IS NULL OR v_flag::text IN ('false', '0', '""', 'null'));
  INSERT INTO public.org_label_printing_cf (tenant_org_id, label_type, show_order_barcode, created_by, created_info)
  VALUES (v_t, 'RECEIPT', true, 'hfc_p4_safety_test', 'rolled back');
  SELECT x.show_order_barcode INTO v_bc FROM public.fn_label_printing_resolve(v_t) x WHERE x.label_type = 'RECEIPT';
  IF v_bc IS DISTINCT FROM v_on THEN
    RAISE EXCEPTION 'FAIL C4: receipt barcode % but human_codes_scan_labels is %', v_bc, v_on;
  END IF;
  RAISE NOTICE 'PASS C4: human_codes_scan_labels is %, receipt barcode resolves to %',
    CASE WHEN v_on THEN 'on' ELSE 'off' END, v_bc;
END $$;

ROLLBACK;
