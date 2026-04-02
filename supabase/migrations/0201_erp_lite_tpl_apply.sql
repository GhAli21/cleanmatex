-- ==================================================================
-- Migration: 0201_erp_lite_tpl_apply.sql
-- Purpose: Create ERP-Lite tenant template apply log and materializers
-- Project: cleanmatex (source of truth for shared DB migrations)
-- Notes:
--   - Resolves published template by explicit tenant or business type
--   - Materializes template data into tenant org_* runtime rows
--   - Falls back to existing hardcoded seed function if no template resolves
--   - Replaces the old tenant auto-seed trigger with template-first logic
--   - Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.org_fin_tpl_apply_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_org_id UUID NOT NULL,
  tpl_pkg_id UUID,
  tpl_pkg_code VARCHAR(80),
  tpl_pkg_version INTEGER,
  apply_mode_code VARCHAR(20) NOT NULL,
  applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  applied_by VARCHAR(120),
  apply_result_code VARCHAR(20) NOT NULL,
  notes TEXT,
  notes2 TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by VARCHAR(120),
  created_info TEXT,
  updated_at TIMESTAMP,
  updated_by VARCHAR(120),
  updated_info TEXT,
  rec_status SMALLINT NOT NULL DEFAULT 1,
  rec_order INTEGER,
  rec_notes VARCHAR(200),
  is_active BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT fk_oftal_tnt FOREIGN KEY (tenant_org_id)
    REFERENCES public.org_tenants_mst(id) ON DELETE CASCADE,
  CONSTRAINT fk_oftal_pkg FOREIGN KEY (tpl_pkg_id)
    REFERENCES public.sys_fin_tpl_pkg_mst(tpl_pkg_id),
  CONSTRAINT chk_oftal_mode CHECK (
    apply_mode_code IN ('AUTO_INIT', 'ERP_ENABLE', 'MANUAL', 'FALLBACK')
  ),
  CONSTRAINT chk_oftal_rslt CHECK (
    apply_result_code IN ('APPLIED', 'NOOP', 'FALLBACK', 'FAILED')
  )
);

CREATE INDEX IF NOT EXISTS idx_oftal_tnt
  ON public.org_fin_tpl_apply_log(tenant_org_id, applied_at DESC);

CREATE INDEX IF NOT EXISTS idx_oftal_pkg
  ON public.org_fin_tpl_apply_log(tpl_pkg_id, applied_at DESC)
  WHERE tpl_pkg_id IS NOT NULL;

ALTER TABLE public.org_fin_tpl_apply_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS tenant_isolation_oftal ON public.org_fin_tpl_apply_log;
CREATE POLICY tenant_isolation_oftal ON public.org_fin_tpl_apply_log
  FOR ALL
  USING (tenant_org_id = current_tenant_id())
  WITH CHECK (tenant_org_id = current_tenant_id());

CREATE OR REPLACE FUNCTION public.resolve_fin_tpl_for_tnt(
  p_tenant_id UUID
)
RETURNS TABLE (
  tpl_pkg_id UUID,
  tpl_pkg_code VARCHAR,
  version_no INTEGER,
  match_mode VARCHAR
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH tnt AS (
    SELECT
      t.id AS tenant_org_id,
      t.business_type_code,
      t.country_code,
      t.s_current_plan
    FROM public.org_tenants_mst t
    WHERE t.id = p_tenant_id
  ),
  ranked AS (
    SELECT
      p.tpl_pkg_id,
      p.tpl_pkg_code,
      p.version_no,
      a.assignment_mode AS match_mode,
      CASE
        WHEN a.assignment_mode = 'TENANT' THEN 1
        WHEN a.assignment_mode = 'BTYPE_CTRY_PLAN' THEN 2
        WHEN a.assignment_mode = 'BTYPE_COUNTRY' THEN 3
        WHEN a.assignment_mode = 'BTYPE_PLAN' THEN 4
        WHEN a.assignment_mode = 'BTYPE' THEN 5
        WHEN a.assignment_mode = 'FALLBACK' THEN 9
        ELSE 99
      END AS rank_no,
      a.priority_no
    FROM tnt
    JOIN public.sys_fin_tpl_assign_mst a
      ON a.status_code = 'ACTIVE'
     AND a.is_active = true
     AND a.rec_status = 1
    JOIN public.sys_fin_tpl_pkg_mst p
      ON p.tpl_pkg_id = a.tpl_pkg_id
     AND p.status_code = 'PUBLISHED'
     AND p.is_active = true
     AND p.rec_status = 1
     AND (p.effective_from IS NULL OR p.effective_from <= CURRENT_DATE)
     AND (p.effective_to IS NULL OR p.effective_to >= CURRENT_DATE)
    WHERE (
      a.assignment_mode = 'TENANT'
      AND a.tenant_org_id = tnt.tenant_org_id
    ) OR (
      a.assignment_mode = 'BTYPE_CTRY_PLAN'
      AND a.main_business_type_code = tnt.business_type_code
      AND a.country_code = tnt.country_code
      AND a.plan_code = tnt.s_current_plan
    ) OR (
      a.assignment_mode = 'BTYPE_COUNTRY'
      AND a.main_business_type_code = tnt.business_type_code
      AND a.country_code = tnt.country_code
    ) OR (
      a.assignment_mode = 'BTYPE_PLAN'
      AND a.main_business_type_code = tnt.business_type_code
      AND a.plan_code = tnt.s_current_plan
    ) OR (
      a.assignment_mode = 'BTYPE'
      AND a.main_business_type_code = tnt.business_type_code
    ) OR (
      a.assignment_mode = 'FALLBACK'
      AND a.is_default_fallback = true
    )
  )
  SELECT
    r.tpl_pkg_id,
    r.tpl_pkg_code,
    r.version_no,
    r.match_mode
  FROM ranked r
  ORDER BY r.rank_no, r.priority_no, r.tpl_pkg_code
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.resolve_fin_tpl_for_tnt(UUID) IS
  'Resolve the effective published ERP-Lite template package for a tenant using explicit assignment, sys_main_business_type_cd, and fallback rules.';

CREATE OR REPLACE FUNCTION public.apply_fin_tpl_for_tnt(
  p_tenant_id UUID,
  p_tpl_pkg_id UUID DEFAULT NULL,
  p_apply_mode VARCHAR DEFAULT 'MANUAL'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tpl_pkg_id UUID;
  v_tpl_pkg_code VARCHAR(80);
  v_tpl_ver INTEGER;
  v_match_mode VARCHAR(20);
  v_total_inserted INTEGER := 0;
  v_last_inserted INTEGER := 0;
  v_period_tpl_id UUID;
  v_oper_row RECORD;
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.org_tenants_mst t
    WHERE t.id = p_tenant_id
      AND COALESCE(t.is_active, true) = true
      AND COALESCE(t.rec_status, 1) = 1
  ) THEN
    RAISE EXCEPTION 'Tenant % not found or inactive', p_tenant_id;
  END IF;

  IF p_tpl_pkg_id IS NULL THEN
    SELECT r.tpl_pkg_id, r.tpl_pkg_code, r.version_no, r.match_mode
    INTO v_tpl_pkg_id, v_tpl_pkg_code, v_tpl_ver, v_match_mode
    FROM public.resolve_fin_tpl_for_tnt(p_tenant_id) r;
  ELSE
    SELECT p.tpl_pkg_id, p.tpl_pkg_code, p.version_no, 'MANUAL'
    INTO v_tpl_pkg_id, v_tpl_pkg_code, v_tpl_ver, v_match_mode
    FROM public.sys_fin_tpl_pkg_mst p
    WHERE p.tpl_pkg_id = p_tpl_pkg_id
      AND p.status_code = 'PUBLISHED'
      AND p.is_active = true
      AND p.rec_status = 1;
  END IF;

  IF v_tpl_pkg_id IS NULL THEN
    IF to_regprocedure('public.seed_tenant_erp_lite_defaults(uuid)') IS NOT NULL THEN
      PERFORM public.seed_tenant_erp_lite_defaults(p_tenant_id);

      INSERT INTO public.org_fin_tpl_apply_log (
        tenant_org_id,
        apply_mode_code,
        applied_by,
        apply_result_code,
        notes,
        created_by,
        created_info,
        rec_status,
        is_active
      ) VALUES (
        p_tenant_id,
        'FALLBACK',
        'system_seed',
        'FALLBACK',
        'No published ERP-Lite template resolved; used legacy hardcoded fallback seed.',
        'system_seed',
        'Migration 0201',
        1,
        true
      );

      RETURN 0;
    END IF;

    RAISE EXCEPTION 'No published ERP-Lite template resolved for tenant %', p_tenant_id;
  END IF;

  INSERT INTO public.org_fin_acct_mst (
    tenant_org_id,
    parent_account_id,
    branch_id,
    acc_type_id,
    acc_group_id,
    account_code,
    name,
    name2,
    description,
    description2,
    is_postable,
    is_control_account,
    is_system_linked,
    manual_post_allowed,
    created_by,
    created_info,
    rec_status,
    rec_order,
    is_active
  )
  SELECT
    p_tenant_id,
    NULL,
    NULL,
    d.acc_type_id,
    d.acc_group_id,
    d.account_code,
    d.name,
    d.name2,
    d.description,
    d.description2,
    d.is_postable,
    d.is_control_account,
    d.is_system_linked,
    d.manual_post_allowed,
    'system_seed',
    'Migration 0201 - ERP-Lite template apply root lines',
    1,
    d.rec_order,
    true
  FROM public.sys_fin_coa_tpl_mst h
  JOIN public.sys_fin_coa_tpl_dtl d
    ON d.coa_tpl_id = h.coa_tpl_id
   AND d.parent_tpl_line_id IS NULL
   AND d.is_active = true
   AND d.rec_status = 1
  WHERE h.tpl_pkg_id = v_tpl_pkg_id
    AND NOT EXISTS (
      SELECT 1
      FROM public.org_fin_acct_mst a
      WHERE a.tenant_org_id = p_tenant_id
        AND a.account_code = d.account_code
    );

  GET DIAGNOSTICS v_last_inserted = ROW_COUNT;
  v_total_inserted := v_total_inserted + v_last_inserted;

  LOOP
    INSERT INTO public.org_fin_acct_mst (
      tenant_org_id,
      parent_account_id,
      branch_id,
      acc_type_id,
      acc_group_id,
      account_code,
      name,
      name2,
      description,
      description2,
      is_postable,
      is_control_account,
      is_system_linked,
      manual_post_allowed,
      created_by,
      created_info,
      rec_status,
      rec_order,
      is_active
    )
    SELECT
      p_tenant_id,
      parent.id,
      NULL,
      d.acc_type_id,
      d.acc_group_id,
      d.account_code,
      d.name,
      d.name2,
      d.description,
      d.description2,
      d.is_postable,
      d.is_control_account,
      d.is_system_linked,
      d.manual_post_allowed,
      'system_seed',
      'Migration 0201 - ERP-Lite template apply child lines',
      1,
      d.rec_order,
      true
    FROM public.sys_fin_coa_tpl_mst h
    JOIN public.sys_fin_coa_tpl_dtl d
      ON d.coa_tpl_id = h.coa_tpl_id
     AND d.parent_tpl_line_id IS NOT NULL
     AND d.is_active = true
     AND d.rec_status = 1
    JOIN public.sys_fin_coa_tpl_dtl pd
      ON pd.coa_tpl_line_id = d.parent_tpl_line_id
    JOIN public.org_fin_acct_mst parent
      ON parent.tenant_org_id = p_tenant_id
     AND parent.account_code = pd.account_code
     AND parent.is_active = true
     AND parent.rec_status = 1
    WHERE h.tpl_pkg_id = v_tpl_pkg_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.org_fin_acct_mst a
        WHERE a.tenant_org_id = p_tenant_id
          AND a.account_code = d.account_code
      );

    GET DIAGNOSTICS v_last_inserted = ROW_COUNT;
    EXIT WHEN v_last_inserted = 0;
    v_total_inserted := v_total_inserted + v_last_inserted;
  END LOOP;

  INSERT INTO public.org_fin_usage_map_mst (
    tenant_org_id,
    branch_id,
    usage_code_id,
    account_id,
    status_code,
    effective_from,
    created_by,
    created_info,
    rec_status,
    rec_order,
    is_active
  )
  SELECT
    p_tenant_id,
    NULL,
    u.usage_code_id,
    a.id,
    'ACTIVE',
    CURRENT_DATE,
    'system_seed',
    'Migration 0201 - ERP-Lite template apply usage mappings',
    1,
    u.rec_order,
    true
  FROM public.sys_fin_usage_tpl_dtl u
  JOIN public.org_fin_acct_mst a
    ON a.tenant_org_id = p_tenant_id
   AND a.account_code = u.target_account_code
   AND a.is_active = true
   AND a.rec_status = 1
  WHERE u.tpl_pkg_id = v_tpl_pkg_id
    AND u.branch_scope_code = 'GLOBAL'
    AND u.is_active = true
    AND u.rec_status = 1
    AND NOT EXISTS (
      SELECT 1
      FROM public.org_fin_usage_map_mst m
      WHERE m.tenant_org_id = p_tenant_id
        AND m.branch_id IS NULL
        AND m.usage_code_id = u.usage_code_id
        AND m.status_code = 'ACTIVE'
        AND m.is_active = true
        AND m.rec_status = 1
    );

  GET DIAGNOSTICS v_last_inserted = ROW_COUNT;
  v_total_inserted := v_total_inserted + v_last_inserted;

  SELECT p.period_tpl_id
  INTO v_period_tpl_id
  FROM public.sys_fin_period_tpl_mst p
  WHERE p.tpl_pkg_id = v_tpl_pkg_id
    AND p.is_active = true
    AND p.rec_status = 1;

  IF v_period_tpl_id IS NOT NULL THEN
    INSERT INTO public.org_fin_period_mst (
      tenant_org_id,
      period_code,
      name,
      name2,
      description,
      description2,
      start_date,
      end_date,
      status_code,
      created_by,
      created_info,
      rec_status,
      rec_order,
      is_active
    )
    SELECT
      p_tenant_id,
      TO_CHAR(gs.period_start, 'YYYY-MM'),
      TO_CHAR(gs.period_start, 'Mon YYYY'),
      TO_CHAR(gs.period_start, 'YYYY/MM'),
      'ERP-Lite template generated period',
      'فترة مولدة من قالب ERP-Lite',
      gs.period_start,
      (gs.period_start + INTERVAL '1 month - 1 day')::date,
      p.default_open_status,
      'system_seed',
      'Migration 0201 - ERP-Lite template apply periods',
      1,
      ROW_NUMBER() OVER (ORDER BY gs.period_start),
      true
    FROM public.sys_fin_period_tpl_mst p
    CROSS JOIN generate_series(
      make_date(EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER, p.fiscal_start_month, 1),
      (
        make_date(EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER, p.fiscal_start_month, 1)
        + ((p.seed_horizon_months - 1) || ' month')::interval
      )::date,
      INTERVAL '1 month'
    ) AS gs(period_start)
    WHERE p.period_tpl_id = v_period_tpl_id
    ON CONFLICT (tenant_org_id, period_code) DO NOTHING;

    GET DIAGNOSTICS v_last_inserted = ROW_COUNT;
    v_total_inserted := v_total_inserted + v_last_inserted;
  END IF;

  FOR v_oper_row IN
    SELECT *
    FROM public.sys_fin_oper_tpl_dtl o
    WHERE o.tpl_pkg_id = v_tpl_pkg_id
      AND o.oper_code = 'PETTY_CASH_DEFAULT'
      AND o.status_code = 'ACTIVE'
      AND o.is_active = true
      AND o.rec_status = 1
  LOOP
    INSERT INTO public.org_fin_cashbox_mst (
      tenant_org_id,
      branch_id,
      account_id,
      cashbox_code,
      name,
      name2,
      description,
      description2,
      currency_code,
      opening_date,
      opening_balance,
      is_default,
      created_by,
      created_info,
      rec_status,
      rec_order,
      is_active
    )
    SELECT
      t.id,
      NULL,
      a.id,
      COALESCE(v_oper_row.config_json->>'cashbox_code', 'PETTY-MAIN'),
      COALESCE(v_oper_row.config_json->>'cashbox_name', 'Main Petty Cash'),
      COALESCE(v_oper_row.config_json->>'cashbox_name2', 'العهدة النقدية الرئيسية'),
      'ERP-Lite template-generated petty cash box',
      'صندوق عهدة نقدية مولد من قالب ERP-Lite',
      t.currency,
      CURRENT_DATE,
      COALESCE((v_oper_row.config_json->>'opening_balance')::numeric, 0),
      COALESCE((v_oper_row.config_json->>'is_default')::boolean, true),
      'system_seed',
      'Migration 0201 - ERP-Lite template apply petty cash',
      1,
      v_oper_row.rec_order,
      true
    FROM public.org_tenants_mst t
    JOIN public.org_fin_acct_mst a
      ON a.tenant_org_id = t.id
     AND a.account_code = v_oper_row.target_account_code
     AND a.is_active = true
     AND a.rec_status = 1
    WHERE t.id = p_tenant_id
      AND t.currency IS NOT NULL
      AND NOT EXISTS (
        SELECT 1
        FROM public.org_fin_cashbox_mst c
        WHERE c.tenant_org_id = p_tenant_id
          AND c.is_default = true
          AND c.is_active = true
          AND c.rec_status = 1
      );

    GET DIAGNOSTICS v_last_inserted = ROW_COUNT;
    v_total_inserted := v_total_inserted + v_last_inserted;
  END LOOP;

  INSERT INTO public.org_fin_tpl_apply_log (
    tenant_org_id,
    tpl_pkg_id,
    tpl_pkg_code,
    tpl_pkg_version,
    apply_mode_code,
    applied_at,
    applied_by,
    apply_result_code,
    notes,
    created_by,
    created_info,
    rec_status,
    is_active
  ) VALUES (
    p_tenant_id,
    v_tpl_pkg_id,
    v_tpl_pkg_code,
    v_tpl_ver,
    COALESCE(p_apply_mode, 'MANUAL'),
    CURRENT_TIMESTAMP,
    'system_seed',
    CASE WHEN v_total_inserted > 0 THEN 'APPLIED' ELSE 'NOOP' END,
    'ERP-Lite template applied via ' || COALESCE(v_match_mode, 'MANUAL'),
    'system_seed',
    'Migration 0201',
    1,
    true
  );

  RETURN v_total_inserted;
END;
$$;

COMMENT ON FUNCTION public.apply_fin_tpl_for_tnt(UUID, UUID, VARCHAR) IS
  'Materialize a published ERP-Lite template package into tenant runtime rows with template-first and hardcoded-fallback behavior.';

CREATE OR REPLACE FUNCTION public.fn_seed_fin_tpl_tnt()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF COALESCE(NEW.is_active, true) = true
     AND COALESCE(NEW.rec_status, 1) = 1 THEN
    PERFORM public.apply_fin_tpl_for_tnt(NEW.id, NULL, 'AUTO_INIT');
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.fn_seed_fin_tpl_tnt() IS
  'After-insert tenant trigger that resolves and applies the default ERP-Lite template for the new tenant.';

DROP TRIGGER IF EXISTS trg_seed_erp_lite_tnt ON public.org_tenants_mst;
DROP TRIGGER IF EXISTS trg_seed_fin_tpl_tnt ON public.org_tenants_mst;

CREATE TRIGGER trg_seed_fin_tpl_tnt
  AFTER INSERT ON public.org_tenants_mst
  FOR EACH ROW
  EXECUTE FUNCTION public.fn_seed_fin_tpl_tnt();

COMMIT;
