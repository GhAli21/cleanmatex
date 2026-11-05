-- HFC P6 safety test for 0688 and 0689. LOCAL database only, after 0688 and 0689 are applied:
--   psql "$LOCAL_DB_URL" -v ON_ERROR_STOP=1 -f supabase/tests/hfc_p6_safety.test.sql
-- Read-only: it only runs SELECTs inside a transaction that is rolled back.
BEGIN;
DO $$
DECLARE n int; bad int;
BEGIN
  SELECT count(*) INTO n FROM public.hq_permissions
   WHERE permission_code IN ('hq_doc_seq:read','hq_general_config:read','hq_general_config:manage')
     AND is_active AND rec_status = 1;
  IF n <> 3 THEN RAISE EXCEPTION 'P6 FAIL: expected 3 active HFC HQ permissions, found %', n; END IF;

  SELECT count(*) INTO bad FROM public.hq_permissions
   WHERE permission_code IN ('hq_doc_seq:read','hq_general_config:read','hq_general_config:manage')
     AND (resource_code <> split_part(permission_code, ':', 1)
          OR action_code <> split_part(permission_code, ':', 2)
          OR permission_name_ar IS NULL OR permission_name_ar = '');
  IF bad <> 0 THEN RAISE EXCEPTION 'P6 FAIL: % permission rows have a wrong resource, action or Arabic name', bad; END IF;

  SELECT count(*) INTO n FROM public.hq_role_permissions
   WHERE role_code = 'SUPER_ADMIN' AND permission_code = '*';
  IF n = 0 THEN RAISE NOTICE 'P6 NOTE: SUPER_ADMIN has no * grant here; grant the 3 codes from HQ Roles.'; END IF;
  RAISE NOTICE 'P6 PASS: 3 HQ doc seq permissions present';
END $$;
ROLLBACK;

-- 0689: the two old label image columns carry the DEPRECATED comment and still exist.
BEGIN;
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n
    FROM pg_attribute a
   WHERE a.attrelid = 'public.org_orders_mst'::regclass
     AND a.attname IN ('qr_code','barcode') AND NOT a.attisdropped
     AND col_description(a.attrelid, a.attnum) LIKE 'DEPRECATED (HFC P6, 0689)%';
  IF n <> 2 THEN RAISE EXCEPTION 'P6 FAIL: expected 2 DEPRECATED label image columns, found %', n; END IF;
  RAISE NOTICE 'P6 PASS: qr_code and barcode kept and marked DEPRECATED';
END $$;
ROLLBACK;
