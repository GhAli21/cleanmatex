-- ==================================================================
-- Migration: 0222_erp_lite_tpl_mat_lineage_wire.sql
-- Purpose: Wire org_fin_tpl_mat_tr row-level lineage into
--          apply_fin_tpl_for_tnt. Closes DELTA-TPL-001 runtime gap.
--
-- Background:
--   Migration 0220 created org_fin_tpl_mat_tr to record one row per
--   object (account, usage map, period, etc.) per apply run. However
--   the apply_fin_tpl_for_tnt function (last updated in 0210) was
--   NOT updated to write those rows — so the table stays empty after
--   every apply.
--
-- What this migration does:
--   Replaces apply_fin_tpl_for_tnt with a hardened version that:
--     1. Captures the apply_log_id after writing org_fin_tpl_apply_log
--     2. Inserts CREATED lineage rows into org_fin_tpl_mat_tr for:
--        - Every ACCOUNT inserted (root + child loop)
--        - Every ACCOUNT updated (REAPPLY_SYNC path)
--        - Every USAGE_MAP inserted
--        - Every PERIOD inserted
--     3. Inserts SKIPPED lineage rows for objects that already existed
--        and were not changed (idempotency reference)
--   All lineage writes are inside the same implicit PL/pgSQL transaction
--   as the object inserts — if the function raises, nothing is committed.
--
-- What is NOT changing:
--   - Function signature, arguments, return type (INTEGER)
--   - Core INSERT/UPDATE logic for org_fin_acct_mst, org_fin_usage_map_mst,
--     org_fin_period_mst, org_fin_cashbox_mst, org_fin_tpl_apply_log
--   - Validation and governance resolution (validate_fin_tpl_for_tnt,
--     resolve_fin_tpl_for_tnt) — unchanged
--
-- Do NOT apply automatically. User must review and apply manually.
-- ==================================================================

BEGIN;

-- ------------------------------------------------------------------
-- Replace apply_fin_tpl_for_tnt with lineage-wired version
-- ------------------------------------------------------------------

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
  v_tpl_pkg_id        UUID;
  v_tpl_pkg_code      VARCHAR(80);
  v_tpl_ver           INTEGER;
  v_match_mode        VARCHAR(20);
  v_total_inserted    INTEGER := 0;
  v_last_inserted     INTEGER := 0;
  v_blocker           TEXT;
  v_period_tpl_id     UUID;
  v_oper_row          RECORD;
  v_apply_log_id      UUID;
  v_account_row       RECORD;
BEGIN
  -- ----------------------------------------------------------------
  -- 1. Validation gate — hard fail on any BLOCKER
  -- ----------------------------------------------------------------
  SELECT issue_text
  INTO v_blocker
  FROM public.validate_fin_tpl_for_tnt(p_tenant_id, p_tpl_pkg_id)
  WHERE severity_code = 'BLOCKER'
  ORDER BY issue_code
  LIMIT 1;

  IF v_blocker IS NOT NULL THEN
    RAISE EXCEPTION '%', v_blocker;
  END IF;

  -- ----------------------------------------------------------------
  -- 2. Resolve template package
  -- ----------------------------------------------------------------
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

  -- ----------------------------------------------------------------
  -- 3. Insert root COA lines (accounts with no parent)
  -- ----------------------------------------------------------------
  INSERT INTO public.org_fin_acct_mst (
    tenant_org_id, parent_account_id, branch_id,
    acc_type_id, acc_group_id, account_code,
    name, name2, description, description2,
    is_postable, is_control_account, is_system_linked,
    manual_post_allowed, account_level,
    is_system_seeded, is_locked, source_tpl_pkg_id, source_tpl_line_id,
    allow_tenant_children,
    created_by, created_info, rec_status, rec_order, is_active
  )
  SELECT
    p_tenant_id, NULL, NULL,
    d.acc_type_id, d.acc_group_id, d.account_code,
    d.name, d.name2, d.description, d.description2,
    d.is_postable, d.is_control_account, d.is_system_linked,
    d.manual_post_allowed, d.account_level,
    d.is_system_seeded, d.is_locked, v_tpl_pkg_id, d.coa_tpl_line_id,
    d.allow_tenant_children,
    'system_seed', 'Migration 0222 - ERP-Lite template apply root lines',
    1, d.rec_order, true
  FROM public.sys_fin_coa_tpl_mst h
  JOIN public.sys_fin_coa_tpl_dtl d
    ON d.coa_tpl_id = h.coa_tpl_id
   AND d.parent_tpl_line_id IS NULL
   AND d.is_active = true
   AND d.rec_status = 1
  WHERE h.tpl_pkg_id = v_tpl_pkg_id
    AND NOT EXISTS (
      SELECT 1 FROM public.org_fin_acct_mst a
      WHERE a.tenant_org_id = p_tenant_id
        AND (
          a.source_tpl_line_id = d.coa_tpl_line_id
          OR a.account_code = d.account_code
        )
    );

  GET DIAGNOSTICS v_last_inserted = ROW_COUNT;
  v_total_inserted := v_total_inserted + v_last_inserted;

  -- ----------------------------------------------------------------
  -- 4. Insert child COA lines (iterative — children of children)
  -- ----------------------------------------------------------------
  LOOP
    INSERT INTO public.org_fin_acct_mst (
      tenant_org_id, parent_account_id, branch_id,
      acc_type_id, acc_group_id, account_code,
      name, name2, description, description2,
      is_postable, is_control_account, is_system_linked,
      manual_post_allowed, account_level,
      is_system_seeded, is_locked, source_tpl_pkg_id, source_tpl_line_id,
      allow_tenant_children,
      created_by, created_info, rec_status, rec_order, is_active
    )
    SELECT
      p_tenant_id, parent.id, NULL,
      d.acc_type_id, d.acc_group_id, d.account_code,
      d.name, d.name2, d.description, d.description2,
      d.is_postable, d.is_control_account, d.is_system_linked,
      d.manual_post_allowed, d.account_level,
      d.is_system_seeded, d.is_locked, v_tpl_pkg_id, d.coa_tpl_line_id,
      d.allow_tenant_children,
      'system_seed', 'Migration 0222 - ERP-Lite template apply child lines',
      1, d.rec_order, true
    FROM public.sys_fin_coa_tpl_mst h
    JOIN public.sys_fin_coa_tpl_dtl d
      ON d.coa_tpl_id = h.coa_tpl_id
     AND d.parent_tpl_line_id IS NOT NULL
     AND d.is_active = true
     AND d.rec_status = 1
    JOIN public.org_fin_acct_mst parent
      ON parent.tenant_org_id = p_tenant_id
     AND parent.source_tpl_line_id = d.parent_tpl_line_id
    WHERE h.tpl_pkg_id = v_tpl_pkg_id
      AND NOT EXISTS (
        SELECT 1 FROM public.org_fin_acct_mst a
        WHERE a.tenant_org_id = p_tenant_id
          AND (
            a.source_tpl_line_id = d.coa_tpl_line_id
            OR a.account_code = d.account_code
          )
      );

    GET DIAGNOSTICS v_last_inserted = ROW_COUNT;
    EXIT WHEN v_last_inserted = 0;
    v_total_inserted := v_total_inserted + v_last_inserted;
  END LOOP;

  -- ----------------------------------------------------------------
  -- 5. REAPPLY_SYNC: update non-posted accounts from template
  -- ----------------------------------------------------------------
  IF COALESCE(p_apply_mode, 'MANUAL') IN ('REAPPLY_SYNC', 'REAPPLY_FULL') THEN
    UPDATE public.org_fin_acct_mst a
    SET
      acc_group_id           = d.acc_group_id,
      name                   = d.name,
      name2                  = d.name2,
      description            = d.description,
      description2           = d.description2,
      is_control_account     = d.is_control_account,
      is_system_linked       = d.is_system_linked,
      manual_post_allowed    = d.manual_post_allowed,
      is_locked              = d.is_locked,
      allow_tenant_children  = d.allow_tenant_children,
      updated_at             = CURRENT_TIMESTAMP,
      updated_by             = 'system_seed',
      updated_info           = 'Migration 0222 - ERP-Lite template metadata sync'
    FROM public.sys_fin_coa_tpl_dtl d
    WHERE a.tenant_org_id = p_tenant_id
      AND a.source_tpl_line_id = d.coa_tpl_line_id
      AND a.source_tpl_pkg_id  = v_tpl_pkg_id
      AND NOT EXISTS (
        SELECT 1
        FROM public.org_fin_journal_dtl jd
        JOIN public.org_fin_journal_mst jh
          ON jh.id = jd.journal_id
         AND jh.tenant_org_id = jd.tenant_org_id
        WHERE jd.tenant_org_id = a.tenant_org_id
          AND jd.account_id    = a.id
          AND jd.is_active     = true
          AND jd.rec_status    = 1
          AND jh.status_code   = 'POSTED'
          AND jh.is_active     = true
          AND jh.rec_status    = 1
      );
  END IF;

  -- ----------------------------------------------------------------
  -- 6. Insert usage mappings
  -- ----------------------------------------------------------------
  INSERT INTO public.org_fin_usage_map_mst (
    tenant_org_id, branch_id, usage_code_id, account_id,
    status_code, effective_from,
    created_by, created_info, rec_status, rec_order, is_active
  )
  SELECT
    p_tenant_id, NULL, u.usage_code_id, a.id,
    'ACTIVE', COALESCE(u.effective_from, CURRENT_DATE),
    'system_seed', 'Migration 0222 - ERP-Lite template apply usage mappings',
    1, u.rec_order, true
  FROM public.sys_fin_usage_tpl_dtl u
  JOIN public.org_fin_acct_mst a
    ON a.tenant_org_id = p_tenant_id
   AND (
     a.source_tpl_line_id = u.coa_tpl_line_id
     OR (u.coa_tpl_line_id IS NULL AND a.account_code = u.target_account_code)
   )
   AND a.is_active  = true
   AND a.rec_status = 1
  WHERE u.tpl_pkg_id         = v_tpl_pkg_id
    AND u.branch_scope_code  = 'GLOBAL'
    AND u.is_active          = true
    AND u.rec_status         = 1
    AND NOT EXISTS (
      SELECT 1 FROM public.org_fin_usage_map_mst m
      WHERE m.tenant_org_id = p_tenant_id
        AND m.branch_id     IS NULL
        AND m.usage_code_id = u.usage_code_id
        AND m.status_code   = 'ACTIVE'
        AND m.is_active     = true
        AND m.rec_status    = 1
    );

  GET DIAGNOSTICS v_last_inserted = ROW_COUNT;
  v_total_inserted := v_total_inserted + v_last_inserted;

  -- ----------------------------------------------------------------
  -- 7. Insert periods from period template
  -- ----------------------------------------------------------------
  SELECT p.period_tpl_id
  INTO v_period_tpl_id
  FROM public.sys_fin_period_tpl_mst p
  WHERE p.tpl_pkg_id = v_tpl_pkg_id
    AND p.is_active  = true
    AND p.rec_status = 1;

  IF v_period_tpl_id IS NOT NULL THEN
    INSERT INTO public.org_fin_period_mst (
      tenant_org_id, period_code, name, name2,
      description, description2,
      start_date, end_date, status_code,
      created_by, created_info, rec_status, rec_order, is_active
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
      'Migration 0222 - ERP-Lite template apply periods',
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

  -- ----------------------------------------------------------------
  -- 8. Apply petty cash operational defaults
  -- ----------------------------------------------------------------
  FOR v_oper_row IN
    SELECT *
    FROM public.sys_fin_oper_tpl_dtl o
    WHERE o.tpl_pkg_id   = v_tpl_pkg_id
      AND o.oper_code    = 'PETTY_CASH_DEFAULT'
      AND o.status_code  = 'ACTIVE'
      AND o.is_active    = true
      AND o.rec_status   = 1
  LOOP
    INSERT INTO public.org_fin_cashbox_mst (
      tenant_org_id, branch_id, account_id,
      cashbox_code, name, name2, description, description2,
      currency_code, opening_date, opening_balance, is_default,
      created_by, created_info, rec_status, rec_order, is_active
    )
    SELECT
      t.id, NULL, a.id,
      COALESCE(v_oper_row.config_json->>'cashbox_code', 'PETTY-MAIN'),
      COALESCE(v_oper_row.config_json->>'cashbox_name',  'Main Petty Cash'),
      COALESCE(v_oper_row.config_json->>'cashbox_name2', 'العهدة النقدية الرئيسية'),
      'ERP-Lite template-generated petty cash box',
      'صندوق عهدة نقدية مولد من قالب ERP-Lite',
      t.currency,
      CURRENT_DATE,
      COALESCE((v_oper_row.config_json->>'opening_balance')::numeric, 0),
      COALESCE((v_oper_row.config_json->>'is_default')::boolean, true),
      'system_seed', 'Migration 0222 - ERP-Lite template apply petty cash',
      1, v_oper_row.rec_order, true
    FROM public.org_tenants_mst t
    JOIN public.org_fin_acct_mst a
      ON a.tenant_org_id   = t.id
     AND a.account_code    = v_oper_row.target_account_code
     AND a.is_active       = true
     AND a.rec_status      = 1
    WHERE t.id = p_tenant_id
      AND t.currency IS NOT NULL
      AND NOT EXISTS (
        SELECT 1 FROM public.org_fin_cashbox_mst c
        WHERE c.tenant_org_id = p_tenant_id
          AND c.is_default    = true
          AND c.is_active     = true
          AND c.rec_status    = 1
      );

    GET DIAGNOSTICS v_last_inserted = ROW_COUNT;
    v_total_inserted := v_total_inserted + v_last_inserted;
  END LOOP;

  -- ----------------------------------------------------------------
  -- 9. Write apply log header — capture ID for lineage rows
  -- ----------------------------------------------------------------
  INSERT INTO public.org_fin_tpl_apply_log (
    tenant_org_id,
    tpl_pkg_id, tpl_pkg_code, tpl_pkg_version,
    apply_mode_code, applied_at, applied_by,
    apply_result_code, notes,
    created_by, created_info, rec_status, is_active
  ) VALUES (
    p_tenant_id,
    v_tpl_pkg_id, v_tpl_pkg_code, v_tpl_ver,
    COALESCE(p_apply_mode, 'MANUAL'),
    CURRENT_TIMESTAMP,
    'system_seed',
    CASE WHEN v_total_inserted > 0 THEN 'APPLIED' ELSE 'NOOP' END,
    'ERP-Lite template applied via ' || COALESCE(v_match_mode, 'MANUAL'),
    'system_seed', 'Migration 0222',
    1, true
  )
  RETURNING id INTO v_apply_log_id;

  -- ----------------------------------------------------------------
  -- 10. Write row-level lineage into org_fin_tpl_mat_tr
  --     For every ACCOUNT that was created/updated/skipped this run.
  -- ----------------------------------------------------------------

  -- CREATED accounts: source_tpl_pkg_id matches + created_info contains 0222
  INSERT INTO public.org_fin_tpl_mat_tr (
    tenant_org_id, apply_log_id,
    object_type, object_id,
    source_tpl_line_id, source_tpl_pkg_id,
    action_code, change_summary,
    created_by, created_info, rec_status, is_active
  )
  SELECT
    p_tenant_id, v_apply_log_id,
    'ACCOUNT', a.id,
    a.source_tpl_line_id, a.source_tpl_pkg_id,
    'CREATED',
    'Account ' || a.account_code || ' created from template ' || v_tpl_pkg_code,
    'system_seed', 'Migration 0222 - lineage wire', 1, true
  FROM public.org_fin_acct_mst a
  WHERE a.tenant_org_id      = p_tenant_id
    AND a.source_tpl_pkg_id  = v_tpl_pkg_id
    AND a.created_info        LIKE 'Migration 0222%'
    AND a.rec_status          = 1
  ON CONFLICT (apply_log_id, object_type, object_id) DO NOTHING;

  -- UPDATED accounts: re-apply path (updated_info contains 0222)
  IF COALESCE(p_apply_mode, 'MANUAL') IN ('REAPPLY_SYNC', 'REAPPLY_FULL') THEN
    INSERT INTO public.org_fin_tpl_mat_tr (
      tenant_org_id, apply_log_id,
      object_type, object_id,
      source_tpl_line_id, source_tpl_pkg_id,
      action_code, change_summary,
      created_by, created_info, rec_status, is_active
    )
    SELECT
      p_tenant_id, v_apply_log_id,
      'ACCOUNT', a.id,
      a.source_tpl_line_id, a.source_tpl_pkg_id,
      'UPDATED',
      'Account ' || a.account_code || ' metadata synced from template ' || v_tpl_pkg_code,
      'system_seed', 'Migration 0222 - lineage wire reapply', 1, true
    FROM public.org_fin_acct_mst a
    WHERE a.tenant_org_id      = p_tenant_id
      AND a.source_tpl_pkg_id  = v_tpl_pkg_id
      AND a.updated_info        LIKE 'Migration 0222%'
      AND a.rec_status          = 1
    ON CONFLICT (apply_log_id, object_type, object_id) DO NOTHING;
  END IF;

  -- SKIPPED accounts: matched template but not in CREATED/UPDATED set
  INSERT INTO public.org_fin_tpl_mat_tr (
    tenant_org_id, apply_log_id,
    object_type, object_id,
    source_tpl_line_id, source_tpl_pkg_id,
    action_code, change_summary,
    created_by, created_info, rec_status, is_active
  )
  SELECT
    p_tenant_id, v_apply_log_id,
    'ACCOUNT', a.id,
    a.source_tpl_line_id, a.source_tpl_pkg_id,
    'SKIPPED',
    'Account ' || a.account_code || ' already exists; no change',
    'system_seed', 'Migration 0222 - lineage wire skip', 1, true
  FROM public.org_fin_acct_mst a
  WHERE a.tenant_org_id     = p_tenant_id
    AND a.source_tpl_pkg_id = v_tpl_pkg_id
    AND a.rec_status        = 1
  ON CONFLICT (apply_log_id, object_type, object_id) DO NOTHING;

  -- CREATED usage maps: created in this run
  INSERT INTO public.org_fin_tpl_mat_tr (
    tenant_org_id, apply_log_id,
    object_type, object_id,
    source_tpl_line_id, source_tpl_pkg_id,
    action_code, change_summary,
    created_by, created_info, rec_status, is_active
  )
  SELECT
    p_tenant_id, v_apply_log_id,
    'USAGE_MAP', m.id,
    NULL, v_tpl_pkg_id,
    'CREATED',
    'Usage mapping for usage_code_id ' || m.usage_code_id::text || ' created',
    'system_seed', 'Migration 0222 - lineage wire usage', 1, true
  FROM public.org_fin_usage_map_mst m
  WHERE m.tenant_org_id = p_tenant_id
    AND m.created_info   LIKE 'Migration 0222%'
    AND m.rec_status     = 1
  ON CONFLICT (apply_log_id, object_type, object_id) DO NOTHING;

  -- CREATED periods: inserted in this run
  INSERT INTO public.org_fin_tpl_mat_tr (
    tenant_org_id, apply_log_id,
    object_type, object_id,
    source_tpl_line_id, source_tpl_pkg_id,
    action_code, change_summary,
    created_by, created_info, rec_status, is_active
  )
  SELECT
    p_tenant_id, v_apply_log_id,
    'PERIOD', p.id,
    NULL, v_tpl_pkg_id,
    'CREATED',
    'Period ' || p.period_code || ' created from template ' || v_tpl_pkg_code,
    'system_seed', 'Migration 0222 - lineage wire period', 1, true
  FROM public.org_fin_period_mst p
  WHERE p.tenant_org_id = p_tenant_id
    AND p.created_info   LIKE 'Migration 0222%'
    AND p.rec_status     = 1
  ON CONFLICT (apply_log_id, object_type, object_id) DO NOTHING;

  RETURN v_total_inserted;
END;
$$;

COMMENT ON FUNCTION public.apply_fin_tpl_for_tnt(UUID, UUID, VARCHAR) IS
  'Explicit HQ-invoked ERP-Lite template materialization function. '
  'Writes COA accounts, usage mappings, periods, petty cash defaults, '
  'and the apply log. Since migration 0222, also writes row-level lineage '
  'rows to org_fin_tpl_mat_tr (CREATED / UPDATED / SKIPPED per object).';

COMMIT;
