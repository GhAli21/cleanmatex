-- Tenant document numbers and the express setup-health day no longer substitute another zone.
-- A missing or inactive organization zone fails the document issue.
-- SYS and HQ numbers still use hq_general_config.timezone.
-- The express check reports TIMEZONE_NOT_CONFIGURED instead of treating the day as UTC.

BEGIN;

CREATE OR REPLACE FUNCTION public.fn_doc_seq_next_by_row(
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
  v_fy    SMALLINT;
  v_key   TEXT;
  v_val   BIGINT;
  v_found BOOLEAN;
BEGIN
  p_at := COALESCE(p_at, pg_catalog.now());
  IF p_cfg.scope_code = 'TENANT_ORG' THEN
    SELECT COALESCE(t.fiscal_year_start_month, h.fiscal_year_start_month), true
      INTO v_fy, v_found
      FROM public.org_tenants_mst t
      CROSS JOIN public.hq_general_config h
     WHERE t.id = p_tenant AND h.config_id;
    IF NOT COALESCE(v_found, false) THEN
      RAISE EXCEPTION 'DOC_SEQ_TENANT_NOT_FOUND: %', p_tenant USING ERRCODE = 'P0002';
    END IF;
    -- Organization zone only. A branch is not an argument of this engine.
    v_tz := public.fn_ops_zone(p_tenant, 'accept_order', NULL);
    IF v_tz IS NULL THEN
      RAISE EXCEPTION 'DOC_SEQ_TIMEZONE_NOT_CONFIGURED: %', p_tenant USING ERRCODE = 'P0001';
    END IF;
    v_key := public.fn_doc_seq_period_key(p_cfg.reset_policy, p_at, v_tz, v_fy);
    INSERT INTO public.org_doc_seq_mst AS c (tenant_org_id, doc_type_code, period_key, last_value, created_by, created_info)
    VALUES (p_tenant, p_cfg.doc_type_code, v_key, 1, 'system', 'fn_doc_seq_next')
    ON CONFLICT (tenant_org_id, doc_type_code, period_key)
    DO UPDATE SET last_value = c.last_value + 1, updated_at = pg_catalog.now(), updated_by = 'system'
    RETURNING c.last_value INTO v_val;
  ELSIF p_cfg.scope_code IN ('SYS', 'HQ') THEN
    SELECT h.timezone, h.fiscal_year_start_month INTO v_tz, v_fy FROM public.hq_general_config h WHERE h.config_id;
    v_key := public.fn_doc_seq_period_key(p_cfg.reset_policy, p_at, v_tz, v_fy);
    IF p_cfg.scope_code = 'SYS' THEN
      INSERT INTO public.sys_doc_seq_mst AS c (doc_type_code, period_key, last_value, created_by, created_info)
      VALUES (p_cfg.doc_type_code, v_key, 1, 'system', 'fn_sys_doc_seq_next')
      ON CONFLICT (doc_type_code, period_key)
      DO UPDATE SET last_value = c.last_value + 1, updated_at = pg_catalog.now(), updated_by = 'system'
      RETURNING c.last_value INTO v_val;
    ELSE
      INSERT INTO public.hq_doc_seq_mst AS c (doc_type_code, period_key, last_value, created_by, created_info)
      VALUES (p_cfg.doc_type_code, v_key, 1, 'system', 'fn_hq_doc_seq_next')
      ON CONFLICT (doc_type_code, period_key)
      DO UPDATE SET last_value = c.last_value + 1, updated_at = pg_catalog.now(), updated_by = 'system'
      RETURNING c.last_value INTO v_val;
    END IF;
  ELSE
    RAISE EXCEPTION 'DOC_SEQ_SCOPE_MISMATCH: unknown scope % for %', p_cfg.scope_code, p_cfg.doc_type_code USING ERRCODE = 'P0001';
  END IF;
  RETURN public.fn_doc_seq_format_row(p_cfg, v_val, p_at, v_tz, v_fy);
END $$;

COMMENT ON FUNCTION public.fn_doc_seq_next_by_row(UUID, public.sys_doc_seq_type_cd, TIMESTAMPTZ) IS
  'Internal: increments the counter of an already checked config row and prints the code. A tenant number uses fn_ops_zone and fails with DOC_SEQ_TIMEZONE_NOT_CONFIGURED when that zone is missing. SYS and HQ numbers keep the HQ clock. Does not check the caller. Owner-only EXECUTE.';

CREATE OR REPLACE FUNCTION public.fn_shc_speed_no_express(p_tenant UUID, p_branch UUID)
RETURNS JSONB
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp
AS $$
DECLARE
  v_tz    TEXT;
  v_today DATE;
  v_any   INTEGER;
  v_wide  INTEGER;
BEGIN
  PERFORM public.fn_shc_guard_tenant(p_tenant);

  -- Organization day, matching the previous check. A missing zone is reported, not replaced with UTC.
  v_tz := public.fn_ops_zone(p_tenant, 'accept_order', NULL);
  IF v_tz IS NULL THEN
    RETURN jsonb_build_object(
      'status', 'FAIL',
      'count', 1,
      'sample_ids', '[]'::jsonb,
      'details', jsonb_build_object('reason', 'TIMEZONE_NOT_CONFIGURED', 'express_rules', 0, 'wide_rules', 0)
    );
  END IF;
  v_today := (pg_catalog.now() AT TIME ZONE v_tz)::date;

  SELECT count(*),
         count(*) FILTER (WHERE r.branch_id IS NULL AND r.product_id IS NULL AND r.service_category_code IS NULL)
    INTO v_any, v_wide
    FROM public.org_speed_price_rules_cf r
   WHERE r.tenant_org_id = p_tenant
     AND r.service_speed = 'EXPRESS'
     AND (p_branch IS NULL OR r.branch_id IS NULL OR r.branch_id = p_branch)
     AND r.is_active IS TRUE
     AND r.rec_status = 1
     AND r.effective_from <= v_today
     AND (r.effective_to IS NULL OR r.effective_to >= v_today);

  RETURN jsonb_build_object(
    'status',     CASE WHEN v_wide > 0 THEN 'OK' ELSE 'FAIL' END,
    'count',      CASE WHEN v_wide > 0 THEN 0 ELSE 1 END,
    'sample_ids', '[]'::jsonb,
    'details',    jsonb_build_object(
                    'reason',        CASE WHEN v_wide > 0 THEN NULL WHEN v_any = 0 THEN 'NONE' ELSE 'PARTIAL' END,
                    'express_rules', v_any,
                    'wide_rules',    v_wide)
  );
END;
$$;

COMMENT ON FUNCTION public.fn_shc_speed_no_express(UUID, UUID) IS
  'Setup Health SPEED_NO_EXPRESS. FAIL when the organization has no active organization-wide EXPRESS rule on the organization civil day. A missing operations zone returns reason TIMEZONE_NOT_CONFIGURED and does not use UTC. Tenant-filtered and read-only.';

REVOKE ALL ON FUNCTION public.fn_shc_speed_no_express(UUID, UUID) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.fn_shc_speed_no_express(UUID, UUID) TO authenticated, service_role;

COMMIT;
