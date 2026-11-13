-- =============================================================================
-- Migration: 0738_setup_health_registry_v2.sql
-- Purpose:   Setup Health plan 2 (docs/features/Setup_Health/PLAN_2_RUN_SCOPE_AND_QA_FIXES.md),
--            step 1. Four changes to the 0709 registry and runner:
--            (1) A check may need SEVERAL feature flags (all must be on):
--                feature_flag_key TEXT -> feature_flag_keys TEXT[]. QA T9: the
--                accounting check was shown while ERP-Lite itself was off,
--                because only erp_lite_readiness_enabled could be named.
--            (2) Every check gets a title for the passing state (ok_name /
--                ok_name2). QA: passing rows kept the failure title
--                ("Business hours are not set" + OK).
--            (3) SPEED_NO_RULES description no longer claims that only faster
--                speeds are missing (any active speed rule, e.g. Economy,
--                makes the check pass).
--            (4) Selective runs for HQ: fn_setup_health_run accepts a list of
--                check codes, and fn_setup_health_run_bulk runs chosen (or all
--                active) organizations x chosen (or all) checks in one call.
-- Affected:  sys_setup_health_check_cd (columns feature_flag_keys, ok_name,
--            ok_name2 added; feature_flag_key dropped; 11 rows updated),
--            fn_setup_health_run (replaced: new parameter + columns),
--            fn_setup_health_refresh_sum (rewritten on the helpers below),
--            fn_setup_health_flags_on, fn_setup_health_summarize,
--            fn_setup_health_store_sum, fn_setup_health_run_bulk (new).
-- Related:   0709 (registry, dispatcher), 0716, 0717 (stored counts), 0726 (TAX_*
--            checks). All must be applied BEFORE this file.
-- Contract for check authors (Tax M8 and later): unchanged fn_shc_<check>(uuid,uuid)
--            -> jsonb. A NEW registry row must now also set ok_name and ok_name2
--            (NOT NULL, no default) and names flags in feature_flag_keys.
-- Deploy:    the tenant app and HQ read the renamed/added result columns. Apply
--            this migration together with the matching app releases.
--
-- Rollback (forward-only, manual): restore the 0709 dispatcher definition,
--   re-add feature_flag_key TEXT (copy feature_flag_keys[1]), then drop the new
--   columns and functions. Not scripted: pre-launch, data is demo only.
-- =============================================================================

BEGIN;

SET LOCAL lock_timeout = '10s';

-- -----------------------------------------------------------------------------
-- 1. Registry columns
-- -----------------------------------------------------------------------------
ALTER TABLE public.sys_setup_health_check_cd
  ADD COLUMN feature_flag_keys TEXT[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN ok_name  TEXT,
  ADD COLUMN ok_name2 TEXT;

COMMENT ON COLUMN public.sys_setup_health_check_cd.feature_flag_keys IS
  'Feature flag keys (hq_ff_feature_flags_mst.flag_key); the check is shown only when EVERY listed flag is on for the organization. Empty array = always shown.';
COMMENT ON COLUMN public.sys_setup_health_check_cd.ok_name IS
  'English title shown when the check passes (status OK), e.g. "Business hours are set". name is the problem title and is used for every other status.';
COMMENT ON COLUMN public.sys_setup_health_check_cd.ok_name2 IS
  'Arabic title shown when the check passes; Arabic counterpart of ok_name.';

-- (1) Single flag -> list of flags; ERP-Lite readiness needs both flags.
UPDATE public.sys_setup_health_check_cd
   SET feature_flag_keys = ARRAY[feature_flag_key]
 WHERE feature_flag_key IS NOT NULL;

UPDATE public.sys_setup_health_check_cd
   SET feature_flag_keys = ARRAY['erp_lite_enabled', 'erp_lite_readiness_enabled'],
       updated_by = 'system_admin', updated_info = '0738 setup health registry v2'
 WHERE check_code = 'ERP_LITE_NOT_READY';

ALTER TABLE public.sys_setup_health_check_cd DROP COLUMN feature_flag_key RESTRICT;

-- (2) Passing-state titles for every check.
UPDATE public.sys_setup_health_check_cd c
   SET ok_name = v.ok_name, ok_name2 = v.ok_name2,
       updated_by = 'system_admin', updated_info = '0738 setup health registry v2'
  FROM (VALUES
    ('CAL_NO_BUSINESS_HOURS',   'Business hours are set',               'ساعات العمل محددة'),
    ('CAL_HOLIDAYS_ESTIMATED',  'Public holiday dates are confirmed',   'مواعيد العطل الرسمية مؤكدة'),
    ('ERP_LITE_NOT_READY',      'Accounting is ready',                  'المحاسبة جاهزة'),
    ('SPEED_NO_RULES',          'Other speeds are offered',             'سرعات أخرى متاحة'),
    ('TAX_SETUP_NOT_CONFIRMED', 'Tax setup is confirmed',               'إعداد الضريبة مؤكد'),
    ('TAX_REG_NO_MISSING',      'Tax registration number is set',       'رقم التسجيل الضريبي موجود'),
    ('TAX_PRODUCTS_NO_CLASS',   'All products have a tax class',        'لكل المنتجات فئة ضريبية'),
    ('TAX_DOC_TYPE_NO_RULE',    'All documents have a tax rule',        'لكل المستندات قاعدة ضريبية'),
    ('TAX_EXEMPTION_EXPIRED',   'No expired tax exemptions',            'لا توجد إعفاءات ضريبية منتهية'),
    ('TAX_KIT_UPDATE_PENDING',  'Tax setup is up to date',              'إعداد الضريبة محدَّث'),
    ('TAX_KIT_FACT_UNVERIFIED', 'Tax kit facts are verified',           'معلومات الإعداد الضريبي موثّقة')
  ) AS v(check_code, ok_name, ok_name2)
 WHERE c.check_code = v.check_code;

-- A check row added by another session after the list above gets its problem
-- title as a placeholder rather than failing this migration; replace it later.
DO $$
DECLARE
  v_codes TEXT;
BEGIN
  SELECT string_agg(check_code, ', ') INTO v_codes
    FROM public.sys_setup_health_check_cd WHERE ok_name IS NULL OR ok_name2 IS NULL;
  IF v_codes IS NOT NULL THEN
    RAISE NOTICE '0738: checks without a passing-state title, using the problem title for now: %', v_codes;
    UPDATE public.sys_setup_health_check_cd
       SET ok_name = COALESCE(ok_name, name), ok_name2 = COALESCE(ok_name2, name2)
     WHERE ok_name IS NULL OR ok_name2 IS NULL;
  END IF;
END $$;

ALTER TABLE public.sys_setup_health_check_cd
  ALTER COLUMN ok_name  SET NOT NULL,
  ALTER COLUMN ok_name2 SET NOT NULL,
  ADD CONSTRAINT chk_shc_ok_name  CHECK (btrim(ok_name)  <> '' AND btrim(ok_name2) <> ''),
  ADD CONSTRAINT chk_shc_flag_keys CHECK (array_position(feature_flag_keys, NULL) IS NULL);

COMMENT ON CONSTRAINT chk_shc_ok_name ON public.sys_setup_health_check_cd IS
  'Both passing-state titles must be non-blank.';
COMMENT ON CONSTRAINT chk_shc_flag_keys ON public.sys_setup_health_check_cd IS
  'feature_flag_keys must not contain NULL elements (a NULL key would never match a flag).';

-- (3) Speed check wording: any active speed rule passes the check.
UPDATE public.sys_setup_health_check_cd
   SET description  = 'No speed pricing rule is active, so customers can only choose Standard. Add a speed rule (for example Express, Next day or Economy) to offer more choices and charge for them.',
       description2 = 'لا توجد قاعدة تسعير سرعة فعّالة، لذلك لا يستطيع العملاء سوى اختيار السرعة العادية. أضف قاعدة سرعة (مثل المستعجل أو اليوم التالي أو الاقتصادي) لتقديم خيارات أكثر وتحصيل رسومها.',
       updated_by = 'system_admin', updated_info = '0738 setup health registry v2'
 WHERE check_code = 'SPEED_NO_RULES';

-- -----------------------------------------------------------------------------
-- 2. Flag rule (one definition for every SQL caller)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.fn_setup_health_flags_on(p_flags JSONB, p_keys TEXT[])
RETURNS BOOLEAN
LANGUAGE sql
IMMUTABLE
SET search_path = public
AS $$
  -- A flag is on when present and not false / null / 0 / "" (same rule as the HQ module's Boolean()).
  SELECT NOT EXISTS (
    SELECT 1
      FROM unnest(COALESCE(p_keys, '{}'::text[])) AS k
     WHERE COALESCE(p_flags -> k, 'null'::jsonb) IN ('false'::jsonb, 'null'::jsonb, '0'::jsonb, '""'::jsonb)
  );
$$;

COMMENT ON FUNCTION public.fn_setup_health_flags_on(JSONB, TEXT[]) IS
  'True when every key in p_keys is on in p_flags (a hq_ff_get_effective_values_batch result). Empty or NULL key list = true. Pure: no table access.';

REVOKE ALL ON FUNCTION public.fn_setup_health_flags_on(JSONB, TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_setup_health_flags_on(JSONB, TEXT[]) TO service_role;

-- -----------------------------------------------------------------------------
-- 3. Dispatcher: optional check list, array flags, passing-state titles
-- -----------------------------------------------------------------------------
-- Return type changes, so the old function is dropped (RESTRICT: nothing in the
-- database depends on it; PL/pgSQL callers are replaced below in this migration).
DROP FUNCTION public.fn_setup_health_run(UUID, UUID, TEXT) RESTRICT;

CREATE FUNCTION public.fn_setup_health_run(
  p_tenant UUID,
  p_branch UUID,
  p_domain TEXT,
  p_checks TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  check_code        TEXT,
  domain_code       TEXT,
  severity          TEXT,
  status            TEXT,
  issue_count       INTEGER,
  sample_ids        JSONB,
  details           JSONB,
  name              TEXT,
  name2             TEXT,
  ok_name           TEXT,
  ok_name2          TEXT,
  description       TEXT,
  description2      TEXT,
  fix_route         TEXT,
  hq_fix_route      TEXT,
  fix_permission    TEXT,
  feature_flag_keys TEXT[],
  shows_banner      BOOLEAN,
  is_hq_only        BOOLEAN,
  domain_order      INTEGER,
  display_order     INTEGER
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  c        RECORD;
  v_result JSONB;
BEGIN
  PERFORM public.fn_shc_guard_tenant(p_tenant);
  IF p_tenant IS NULL THEN
    RAISE EXCEPTION 'fn_setup_health_run: p_tenant is required' USING ERRCODE = '22004';
  END IF;

  FOR c IN
    SELECT k.*, d.display_order AS d_order
    FROM sys_setup_health_check_cd k
    JOIN sys_setup_health_domain_cd d ON d.domain_code = k.domain_code
    WHERE k.is_active AND k.rec_status = 1
      AND d.is_active AND d.rec_status = 1
      AND (p_domain IS NULL OR k.domain_code = p_domain)
      -- NULL = every active check; a list = only those codes (unknown codes match nothing).
      AND (p_checks IS NULL OR k.check_code = ANY (p_checks))
    ORDER BY d.display_order, k.display_order, k.check_code
  LOOP
    BEGIN
      EXECUTE format('SELECT public.%I($1, $2)', c.fn_name) INTO v_result USING p_tenant, p_branch;
      IF v_result IS NULL OR NOT (v_result ->> 'status') IN ('OK', 'FAIL', 'NA') THEN
        v_result := jsonb_build_object('status', 'ERROR', 'count', 0, 'sample_ids', '[]'::jsonb,
                                       'details', jsonb_build_object('message', 'invalid check result'));
      END IF;
    EXCEPTION WHEN OTHERS THEN
      -- One broken check must not hide the others.
      v_result := jsonb_build_object('status', 'ERROR', 'count', 0, 'sample_ids', '[]'::jsonb,
                                     'details', jsonb_build_object('sqlstate', SQLSTATE, 'message', SQLERRM));
    END;

    check_code        := c.check_code;
    domain_code       := c.domain_code;
    severity          := c.severity;
    status            := v_result ->> 'status';
    issue_count       := COALESCE((v_result ->> 'count')::INTEGER, 0);
    sample_ids        := COALESCE(v_result -> 'sample_ids', '[]'::jsonb);
    details           := COALESCE(v_result -> 'details', '{}'::jsonb);
    name              := c.name;
    name2             := c.name2;
    ok_name           := c.ok_name;
    ok_name2          := c.ok_name2;
    description       := c.description;
    description2      := c.description2;
    fix_route         := c.fix_route;
    hq_fix_route      := c.hq_fix_route;
    fix_permission    := c.fix_permission;
    feature_flag_keys := c.feature_flag_keys;
    shows_banner      := c.shows_banner;
    is_hq_only        := c.is_hq_only;
    domain_order      := c.d_order;
    display_order     := c.display_order;
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.fn_setup_health_run(UUID, UUID, TEXT, TEXT[]) IS
  'Setup Health runner: one row per active check for one organization (optionally one branch, one domain, a list of check codes; NULL = no limit). Calls fn_shc_guard_tenant first. Callers filter by feature_flag_keys / is_hq_only / permission. A broken check returns status ERROR instead of failing the run.';

REVOKE ALL ON FUNCTION public.fn_setup_health_run(UUID, UUID, TEXT, TEXT[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_setup_health_run(UUID, UUID, TEXT, TEXT[]) TO authenticated, service_role;

-- -----------------------------------------------------------------------------
-- 4. Summary helpers (HQ view: flag-off checks left out, HQ-only checks counted)
-- -----------------------------------------------------------------------------
CREATE FUNCTION public.fn_setup_health_summarize(p_tenant UUID, p_checks TEXT[] DEFAULT NULL)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_keys    TEXT[];
  v_flags   JSONB := '{}'::jsonb;
  v_b INTEGER; v_w INTEGER; v_i INTEGER; v_e INTEGER;
  v_failing JSONB;
BEGIN
  -- One flag lookup for every check in scope.
  SELECT array_agg(DISTINCT f)
    INTO v_keys
    FROM public.sys_setup_health_check_cd c
   CROSS JOIN LATERAL unnest(c.feature_flag_keys) AS f
   WHERE c.is_active AND c.rec_status = 1
     AND (p_checks IS NULL OR c.check_code = ANY (p_checks));

  IF v_keys IS NOT NULL THEN
    v_flags := COALESCE(public.hq_ff_get_effective_values_batch(p_tenant, v_keys), '{}'::jsonb);
  END IF;

  WITH r AS (
    SELECT x.*
      FROM public.fn_setup_health_run(p_tenant, NULL, NULL, p_checks) x
     WHERE public.fn_setup_health_flags_on(v_flags, x.feature_flag_keys)
  )
  SELECT count(*) FILTER (WHERE r.status = 'FAIL' AND r.severity = 'BLOCKER'),
         count(*) FILTER (WHERE r.status = 'FAIL' AND r.severity = 'WARNING'),
         count(*) FILTER (WHERE r.status = 'FAIL' AND r.severity = 'INFO'),
         count(*) FILTER (WHERE r.status = 'ERROR'),
         COALESCE(jsonb_agg(jsonb_build_object(
                    'check_code',  r.check_code,
                    'severity',    r.severity,
                    'status',      r.status,
                    'issue_count', r.issue_count)
                  ORDER BY r.domain_order, r.display_order)
                  FILTER (WHERE r.status IN ('FAIL', 'ERROR')), '[]'::jsonb)
    INTO v_b, v_w, v_i, v_e, v_failing
    FROM r;

  RETURN jsonb_build_object('blockers', v_b, 'warnings', v_w, 'infos', v_i, 'errors', v_e, 'failing', v_failing);
END;
$$;

COMMENT ON FUNCTION public.fn_setup_health_summarize(UUID, TEXT[]) IS
  'Runs the checks (all, or the listed codes) for one organization and returns counts plus the failing checks as jsonb {blockers, warnings, infos, errors, failing:[{check_code, severity, status, issue_count}]}. Writes nothing. Checks whose feature flags are not all on are left out.';

REVOKE ALL ON FUNCTION public.fn_setup_health_summarize(UUID, TEXT[]) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_setup_health_summarize(UUID, TEXT[]) TO service_role;

CREATE FUNCTION public.fn_setup_health_store_sum(p_tenant UUID, p_sum JSONB)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Only a result of ALL checks may be stored: the list column and its filter show these counts.
  INSERT INTO public.org_setup_health_sum_tr AS s
    (tenant_org_id, blocker_count, warning_count, info_count, error_count, checked_at, created_by, created_info)
  VALUES (p_tenant,
          (p_sum ->> 'blockers')::INTEGER, (p_sum ->> 'warnings')::INTEGER,
          (p_sum ->> 'infos')::INTEGER,    (p_sum ->> 'errors')::INTEGER,
          now(), 'system', 'fn_setup_health_store_sum')
  ON CONFLICT (tenant_org_id) DO UPDATE
  SET blocker_count = EXCLUDED.blocker_count, warning_count = EXCLUDED.warning_count,
      info_count = EXCLUDED.info_count, error_count = EXCLUDED.error_count,
      checked_at = EXCLUDED.checked_at, updated_by = 'system', updated_info = 'fn_setup_health_store_sum';
END;
$$;

COMMENT ON FUNCTION public.fn_setup_health_store_sum(UUID, JSONB) IS
  'Upserts the stored Setup Health counts (org_setup_health_sum_tr) for one organization from a fn_setup_health_summarize result of ALL checks.';

REVOKE ALL ON FUNCTION public.fn_setup_health_store_sum(UUID, JSONB) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_setup_health_store_sum(UUID, JSONB) TO service_role;

-- 0717 function, same signature and same return keys, now on the helpers.
CREATE OR REPLACE FUNCTION public.fn_setup_health_refresh_sum(p_tenant UUID)
RETURNS JSONB
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  v_sum JSONB;
BEGIN
  v_sum := public.fn_setup_health_summarize(p_tenant, NULL);
  PERFORM public.fn_setup_health_store_sum(p_tenant, v_sum);
  RETURN v_sum;
END;
$$;

COMMENT ON FUNCTION public.fn_setup_health_refresh_sum(UUID) IS
  'Reruns ALL checks for one organization and stores the counts (HQ view). Returns the fn_setup_health_summarize result.';

-- -----------------------------------------------------------------------------
-- 5. Bulk run for HQ: organizations x checks
-- -----------------------------------------------------------------------------
CREATE FUNCTION public.fn_setup_health_run_bulk(
  p_tenants UUID[]  DEFAULT NULL,
  p_checks  TEXT[]  DEFAULT NULL,
  p_store   BOOLEAN DEFAULT FALSE
)
RETURNS TABLE (
  tenant_id     UUID,
  tenant_name   TEXT,
  tenant_name2  TEXT,
  tenant_slug   TEXT,
  run_status    TEXT,
  blockers      INTEGER,
  warnings      INTEGER,
  infos         INTEGER,
  errors        INTEGER,
  failing       JSONB,
  error_message TEXT
)
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  t RECORD;
  v JSONB;
BEGIN
  IF p_store AND p_checks IS NOT NULL THEN
    -- A partial run would overwrite the list counts with numbers that leave checks out.
    RAISE EXCEPTION 'fn_setup_health_run_bulk: p_store requires all checks (p_checks must be NULL)' USING ERRCODE = '22023';
  END IF;
  IF p_tenants IS NOT NULL AND (cardinality(p_tenants) = 0 OR cardinality(p_tenants) > 500) THEN
    RAISE EXCEPTION 'fn_setup_health_run_bulk: p_tenants must hold 1 to 500 ids (NULL = all active)' USING ERRCODE = '22023';
  END IF;
  IF p_checks IS NOT NULL AND cardinality(p_checks) = 0 THEN
    RAISE EXCEPTION 'fn_setup_health_run_bulk: p_checks must not be empty (NULL = all checks)' USING ERRCODE = '22023';
  END IF;

  FOR t IN
    SELECT req.id AS tid, o.name AS tname, o.name2 AS tname2, o.slug AS tslug, (o.id IS NOT NULL) AS is_known
      FROM (
        SELECT DISTINCT u AS id FROM unnest(p_tenants) AS u
        UNION
        SELECT m.id FROM public.org_tenants_mst m
         WHERE p_tenants IS NULL AND m.is_active AND m.rec_status = 1
      ) req
      LEFT JOIN public.org_tenants_mst o ON o.id = req.id
     ORDER BY o.name NULLS LAST, req.id
  LOOP
    tenant_id := t.tid; tenant_name := t.tname; tenant_name2 := t.tname2; tenant_slug := t.tslug;
    blockers := 0; warnings := 0; infos := 0; errors := 0; failing := '[]'::jsonb; error_message := NULL;

    IF NOT t.is_known THEN
      run_status := 'NOT_FOUND';
      RETURN NEXT;
      CONTINUE;
    END IF;

    BEGIN
      v := public.fn_setup_health_summarize(t.tid, p_checks);
      IF p_store THEN
        PERFORM public.fn_setup_health_store_sum(t.tid, v);
      END IF;
      run_status := 'OK';
      blockers := (v ->> 'blockers')::INTEGER; warnings := (v ->> 'warnings')::INTEGER;
      infos    := (v ->> 'infos')::INTEGER;    errors   := (v ->> 'errors')::INTEGER;
      failing  := v -> 'failing';
    EXCEPTION WHEN OTHERS THEN
      -- One failing organization must not stop the run.
      RAISE LOG 'fn_setup_health_run_bulk: tenant % failed: [%] %', t.tid, SQLSTATE, SQLERRM;
      run_status := 'ERROR';
      blockers := 0; warnings := 0; infos := 0; errors := 0; failing := '[]'::jsonb;
      error_message := SQLSTATE || ': ' || SQLERRM;
    END;
    RETURN NEXT;
  END LOOP;
END;
$$;

COMMENT ON FUNCTION public.fn_setup_health_run_bulk(UUID[], TEXT[], BOOLEAN) IS
  'HQ bulk run: one row per organization (p_tenants, 1-500 ids; NULL = every active organization) with counts and failing checks for the chosen checks (p_checks; NULL = all). run_status OK | NOT_FOUND | ERROR. p_store = true also stores the counts shown in the HQ list and is allowed only for all checks. Service role only.';

REVOKE ALL ON FUNCTION public.fn_setup_health_run_bulk(UUID[], TEXT[], BOOLEAN) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.fn_setup_health_run_bulk(UUID[], TEXT[], BOOLEAN) TO service_role;

-- -----------------------------------------------------------------------------
-- 6. Self-check (fails the migration, rolling everything back)
-- -----------------------------------------------------------------------------
DO $$
DECLARE
  v_tenant UUID;
  v_rows   INTEGER;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
              WHERE table_schema = 'public' AND table_name = 'sys_setup_health_check_cd' AND column_name = 'feature_flag_key') THEN
    RAISE EXCEPTION '0738 self-check: feature_flag_key still exists';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sys_setup_health_check_cd
                  WHERE check_code = 'ERP_LITE_NOT_READY'
                    AND feature_flag_keys = ARRAY['erp_lite_enabled', 'erp_lite_readiness_enabled']) THEN
    RAISE EXCEPTION '0738 self-check: ERP_LITE_NOT_READY flags not set';
  END IF;
  IF public.fn_setup_health_flags_on('{"a":true,"b":false}'::jsonb, ARRAY['a', 'b'])
     OR NOT public.fn_setup_health_flags_on('{"a":true,"b":1}'::jsonb, ARRAY['a', 'b'])
     OR NOT public.fn_setup_health_flags_on('{}'::jsonb, '{}'::text[]) THEN
    RAISE EXCEPTION '0738 self-check: fn_setup_health_flags_on rule';
  END IF;

  -- A partial run must refuse to store.
  BEGIN
    PERFORM * FROM public.fn_setup_health_run_bulk(NULL, ARRAY['CAL_NO_BUSINESS_HOURS'], TRUE);
    RAISE EXCEPTION '0738 self-check: partial store was allowed';
  EXCEPTION WHEN SQLSTATE '22023' THEN
    NULL;
  END;

  SELECT m.id INTO v_tenant FROM public.org_tenants_mst m WHERE m.is_active AND m.rec_status = 1 ORDER BY m.id LIMIT 1;
  IF v_tenant IS NOT NULL THEN
    SELECT count(*) INTO v_rows
      FROM public.fn_setup_health_run_bulk(ARRAY[v_tenant], ARRAY['CAL_NO_BUSINESS_HOURS'], FALSE) b
     WHERE b.run_status = 'OK' AND b.errors = 0;
    IF v_rows <> 1 THEN
      RAISE EXCEPTION '0738 self-check: bulk run for % did not return one OK row', v_tenant;
    END IF;
    SELECT count(*) INTO v_rows FROM public.fn_setup_health_run(v_tenant, NULL, NULL, ARRAY['CAL_NO_BUSINESS_HOURS']);
    IF v_rows <> 1 THEN
      RAISE EXCEPTION '0738 self-check: run with one check code returned % rows', v_rows;
    END IF;
  END IF;
END $$;

COMMIT;
