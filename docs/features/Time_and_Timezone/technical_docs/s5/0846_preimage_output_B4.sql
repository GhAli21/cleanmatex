"?column?"
"CREATE OR REPLACE FUNCTION public.apply_fin_tpl_for_tnt(p_tenant_id uuid, p_tpl_pkg_id uuid DEFAULT NULL::uuid, p_apply_mode character varying DEFAULT 'MANUAL'::character varying)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
$function$
;"
"CREATE OR REPLACE FUNCTION public.fn_expire_credit_notes()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_count integer;
BEGIN
  UPDATE org_credit_notes_mst
  SET    status     = 'EXPIRED',
         updated_at = NOW()
  WHERE  status     = 'ACTIVE'
    AND  expires_at IS NOT NULL
    AND  expires_at < NOW()::date;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$function$
;"
"CREATE OR REPLACE FUNCTION public.fn_fin_credit_note_expire_one(p_tenant_org_id uuid, p_credit_note_id uuid, p_only_if_due boolean DEFAULT true, p_actor text DEFAULT 'system/credit-note-expiry'::text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_key     TEXT := 'cn-expiry-' || p_credit_note_id::text;
  v_actor   TEXT := left(COALESCE(NULLIF(btrim(p_actor), ''), 'system/credit-note-expiry'), 120);
  v_note    RECORD;
  v_has_txn BOOLEAN;
BEGIN
  SELECT n.id, n.status, n.remaining_balance, n.currency_code, n.customer_id,
         (n.expires_at IS NOT NULL AND n.expires_at < (now() AT TIME ZONE public.fn_ops_zone(p_tenant_org_id, 'ledger', NULL))::date) AS is_due
    INTO v_note
    FROM public.org_credit_notes_mst n
   WHERE n.tenant_org_id = p_tenant_org_id
     AND n.id = p_credit_note_id
   FOR UPDATE;
  IF NOT FOUND THEN
    RETURN 'NOT_FOUND';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.org_credit_note_txn_dtl t
     WHERE t.tenant_org_id = p_tenant_org_id AND t.idempotency_key = v_key
  ) INTO v_has_txn;

  IF v_note.status = 'EXPIRED' OR v_has_txn THEN
    IF v_note.status <> 'EXPIRED' THEN
      UPDATE public.org_credit_notes_mst
         SET status = 'EXPIRED', remaining_balance = 0, updated_at = now(), updated_by = v_actor
       WHERE tenant_org_id = p_tenant_org_id AND id = p_credit_note_id;
    END IF;
    RETURN 'ALREADY_EXPIRED';
  END IF;

  IF v_note.status <> 'ACTIVE' THEN
    RETURN 'NOT_ACTIVE';
  END IF;
  IF p_only_if_due AND NOT v_note.is_due THEN
    RETURN 'NOT_DUE';
  END IF;

  UPDATE public.org_credit_notes_mst
     SET status = 'EXPIRED', remaining_balance = 0, updated_at = now(), updated_by = v_actor
   WHERE tenant_org_id = p_tenant_org_id AND id = p_credit_note_id;

  IF v_note.remaining_balance > 0 THEN
    INSERT INTO public.org_credit_note_txn_dtl (
      tenant_org_id, credit_note_id, customer_id, txn_type, amount, currency_code,
      balance_before, balance_after, idempotency_key, notes, rec_status, created_by, created_info
    ) VALUES (
      p_tenant_org_id, p_credit_note_id, v_note.customer_id, 'EXPIRY', -v_note.remaining_balance, v_note.currency_code,
      v_note.remaining_balance, 0, v_key, 'Credit note expired', 1, v_actor, 'fn_fin_credit_note_expire_one'
    );
  END IF;
  RETURN 'EXPIRED';
END;
$function$
;"
"CREATE OR REPLACE FUNCTION public.fn_fin_credit_note_expiry_run()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
 SET lock_timeout TO '5s'
AS $function$
DECLARE
  r         RECORD;
  v_outcome TEXT;
  v_expired INTEGER := 0;
  v_skipped INTEGER := 0;
  v_failed  INTEGER := 0;
BEGIN
  FOR r IN
    SELECT n.tenant_org_id, n.id
      FROM public.org_credit_notes_mst n
      JOIN public.org_tenants_mst t
        ON t.id = n.tenant_org_id
       AND t.is_active
       AND t.rec_status = 1
     WHERE n.tenant_org_id = t.id
       AND n.status = 'ACTIVE'
       AND n.is_active
       AND n.rec_status = 1
       AND n.expires_at IS NOT NULL
       AND n.expires_at < (now() AT TIME ZONE public.fn_ops_zone(n.tenant_org_id, 'ledger', NULL))::date
     ORDER BY n.expires_at, n.id
     LIMIT 5000
  LOOP
    BEGIN
      v_outcome := public.fn_fin_credit_note_expire_one(r.tenant_org_id, r.id, true, 'system/credit-note-expiry');
      IF v_outcome IN ('EXPIRED', 'ALREADY_EXPIRED') THEN
        v_expired := v_expired + 1;
      ELSE
        v_skipped := v_skipped + 1;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      v_failed := v_failed + 1;
      RAISE WARNING 'fn_fin_credit_note_expiry_run: credit note % (tenant %) failed: %', r.id, r.tenant_org_id, SQLERRM;
    END;
  END LOOP;
  RETURN jsonb_build_object('expired', v_expired, 'skipped', v_skipped, 'failed', v_failed);
END;
$function$
;"
"CREATE OR REPLACE FUNCTION public.fn_shc_cal_holidays_estimated(p_tenant uuid, p_branch uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_countries TEXT[];
  v_ids       UUID[];
  v_first     DATE;
BEGIN
  PERFORM public.fn_shc_guard_tenant(p_tenant);

  SELECT array_agg(DISTINCT x.cc) FILTER (WHERE x.cc IS NOT NULL)
  INTO v_countries
  FROM (
    SELECT upper(COALESCE(NULLIF(b.country, ''), t.country)) AS cc
    FROM org_tenants_mst t
    LEFT JOIN org_branches_mst b
      ON b.tenant_org_id = p_tenant
     AND b.tenant_org_id = t.id
     AND (p_branch IS NULL OR b.id = p_branch)
     AND b.is_active = TRUE
     AND b.rec_status = 1
    WHERE t.id = p_tenant
  ) x;

  -- No country known: nothing can be checked.
  IF v_countries IS NULL THEN
    RETURN jsonb_build_object('status', 'NA', 'count', 0, 'sample_ids', '[]'::jsonb,
                              'details', jsonb_build_object('reason', 'no_country'));
  END IF;

  SELECT array_agg(h.id ORDER BY h.holiday_date, h.country_code),
         min(h.holiday_date)
  INTO v_ids, v_first
  FROM sys_public_holidays_cf h
  WHERE h.country_code = ANY (v_countries)
    AND h.is_estimated = TRUE
    AND h.is_active = TRUE
    AND h.rec_status = 1
    AND h.holiday_date BETWEEN CURRENT_DATE AND CURRENT_DATE + 60;

  RETURN jsonb_build_object(
    'status',     CASE WHEN COALESCE(cardinality(v_ids), 0) = 0 THEN 'OK' ELSE 'FAIL' END,
    'count',      COALESCE(cardinality(v_ids), 0),
    'sample_ids', to_jsonb(COALESCE(v_ids[1:5], '{}'::uuid[])),
    'details',    jsonb_build_object(
                    'countries',  to_jsonb(v_countries),
                    'first_date', v_first,
                    'window_days', 60)
  );
END;
$function$
;"
"CREATE OR REPLACE FUNCTION public.fn_shc_cal_holidays_missing(p_tenant uuid, p_branch uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_countries TEXT[];
  v_short     JSONB;
BEGIN
  PERFORM public.fn_shc_guard_tenant(p_tenant);

  SELECT array_agg(DISTINCT x.cc) FILTER (WHERE x.cc IS NOT NULL)
  INTO v_countries
  FROM (
    SELECT upper(COALESCE(NULLIF(b.country, ''), t.country)) AS cc
    FROM org_tenants_mst t
    LEFT JOIN org_branches_mst b
      ON b.tenant_org_id = p_tenant
     AND b.tenant_org_id = t.id
     AND (p_branch IS NULL OR b.id = p_branch)
     AND b.is_active = TRUE
     AND b.rec_status = 1
    WHERE t.id = p_tenant
  ) x;

  IF v_countries IS NULL THEN
    RETURN jsonb_build_object('status', 'NA', 'count', 0, 'sample_ids', '[]'::jsonb,
                              'details', jsonb_build_object('reason', 'no_country'));
  END IF;

  -- One entry per country whose last known holiday is less than 90 days ahead.
  SELECT COALESCE(jsonb_agg(jsonb_build_object('country', c.cc, 'last_date', h.last_date) ORDER BY c.cc), '[]'::jsonb)
  INTO v_short
  FROM unnest(v_countries) AS c(cc)
  LEFT JOIN LATERAL (
    SELECT max(p.holiday_date) AS last_date
    FROM sys_public_holidays_cf p
    WHERE p.country_code = c.cc AND p.is_active = TRUE AND p.rec_status = 1
  ) h ON TRUE
  WHERE h.last_date IS NULL OR h.last_date < CURRENT_DATE + 90;

  RETURN jsonb_build_object(
    'status',     CASE WHEN jsonb_array_length(v_short) = 0 THEN 'OK' ELSE 'FAIL' END,
    'count',      jsonb_array_length(v_short),
    'sample_ids', '[]'::jsonb,
    'details',    jsonb_build_object('countries', v_short, 'min_days_ahead', 90)
  );
END;
$function$
;"
"CREATE OR REPLACE FUNCTION public.fn_shc_speed_no_rules(p_tenant uuid, p_branch uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_count INTEGER;
BEGIN
  PERFORM public.fn_shc_guard_tenant(p_tenant);
  SELECT count(*) INTO v_count
  FROM org_speed_price_rules_cf r
  WHERE r.tenant_org_id = p_tenant
    AND (p_branch IS NULL OR r.branch_id IS NULL OR r.branch_id = p_branch)
    AND r.is_active = TRUE
    AND r.rec_status = 1
    AND (r.effective_from IS NULL OR r.effective_from <= CURRENT_DATE)
    AND (r.effective_to   IS NULL OR r.effective_to   >= CURRENT_DATE);

  RETURN jsonb_build_object(
    'status',     CASE WHEN v_count = 0 THEN 'FAIL' ELSE 'OK' END,
    'count',      CASE WHEN v_count = 0 THEN 1 ELSE 0 END,
    'sample_ids', '[]'::jsonb,
    'details',    jsonb_build_object('active_rules', v_count)
  );
END;
$function$
;"
"CREATE OR REPLACE FUNCTION public.fn_shc_tax_doc_type_no_rule(p_tenant uuid, p_branch uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_missing TEXT[];
BEGIN
  PERFORM public.fn_shc_guard_tenant(p_tenant);
  IF NOT EXISTS (SELECT 1 FROM org_tax_config_cf c
                  WHERE c.tenant_org_id = p_tenant AND c.status = 'ACTIVE' AND c.tax_enabled
                    AND c.setup_mode = 'ADVANCED' AND c.rec_status = 1) THEN
    RETURN jsonb_build_object('status', 'NA', 'count', 0, 'sample_ids', '[]'::jsonb, 'details', jsonb_build_object('reason', 'NOT_ADVANCED_ACTIVE'));
  END IF;
  -- The documents the engine decides by rule (sales order, purchases, supplier payment withholding).
  SELECT array_agg(d.doc || ':' || d.flow ORDER BY d.doc) INTO v_missing
    FROM (VALUES ('ORDER', 'OUTPUT'), ('ERP_EXPENSE', 'INPUT'), ('ERP_AP_INVOICE', 'INPUT'),
                 ('ERP_PETTY_CASH_TXN', 'INPUT'), ('ERP_AP_PAYMENT', 'WITHHOLDING')) AS d(doc, flow)
   WHERE NOT EXISTS (SELECT 1 FROM org_tax_rules_cf r
                      WHERE r.tenant_org_id = p_tenant AND r.is_active AND r.rec_status = 1
                        AND (r.tax_flow_code IS NULL OR r.tax_flow_code = d.flow)
                        AND (r.doc_type_code IS NULL OR r.doc_type_code = d.doc)
                        AND r.effective_from <= CURRENT_DATE
                        AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE));
  RETURN jsonb_build_object(
    'status',     CASE WHEN COALESCE(cardinality(v_missing), 0) = 0 THEN 'OK' ELSE 'FAIL' END,
    'count',      COALESCE(cardinality(v_missing), 0),
    'sample_ids', '[]'::jsonb,
    'details',    jsonb_build_object('missing', to_jsonb(COALESCE(v_missing, '{}'::text[]))));
END $function$
;"
"CREATE OR REPLACE FUNCTION public.fn_shc_tax_exemption_expired(p_tenant uuid, p_branch uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_ids UUID[];
BEGIN
  PERFORM public.fn_shc_guard_tenant(p_tenant);
  SELECT array_agg(e.id ORDER BY e.valid_to) INTO v_ids
    FROM org_tax_exemptions_cf e
   WHERE e.tenant_org_id = p_tenant AND e.is_active AND e.rec_status = 1
     AND e.valid_to IS NOT NULL AND e.valid_to < CURRENT_DATE;
  RETURN jsonb_build_object(
    'status',     CASE WHEN COALESCE(cardinality(v_ids), 0) = 0 THEN 'OK' ELSE 'FAIL' END,
    'count',      COALESCE(cardinality(v_ids), 0),
    'sample_ids', to_jsonb(COALESCE(v_ids[1:5], '{}'::uuid[])),
    'details',    '{}'::jsonb);
END $function$
;"
"CREATE OR REPLACE FUNCTION public.fn_shc_tax_kit_update_pending(p_tenant uuid, p_branch uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_cfg      RECORD;
  v_latest   RECORD;
  v_conflicts INTEGER;
  v_behind   BOOLEAN;
BEGIN
  PERFORM public.fn_shc_guard_tenant(p_tenant);
  SELECT c.kit_code, c.kit_version_id, c.last_apply_summary INTO v_cfg
    FROM org_tax_config_cf c WHERE c.tenant_org_id = p_tenant AND c.rec_status = 1;
  IF NOT FOUND OR v_cfg.kit_code IS NULL THEN
    RETURN jsonb_build_object('status', 'NA', 'count', 0, 'sample_ids', '[]'::jsonb, 'details', jsonb_build_object('reason', 'NO_KIT'));
  END IF;
  SELECT v.id, v.version_no INTO v_latest
    FROM sys_tax_kit_versions_mst v
   WHERE v.kit_code = v_cfg.kit_code AND v.status = 'PUBLISHED' AND v.rec_status = 1
     AND v.effective_from <= CURRENT_DATE AND (v.effective_to IS NULL OR v.effective_to >= CURRENT_DATE)
   ORDER BY v.version_no DESC LIMIT 1;
  v_behind := v_latest.id IS NOT NULL AND v_latest.id IS DISTINCT FROM v_cfg.kit_version_id;
  v_conflicts := COALESCE(jsonb_array_length(v_cfg.last_apply_summary -> 'conflicts'), 0);
  RETURN jsonb_build_object(
    'status',     CASE WHEN v_behind OR v_conflicts > 0 OR v_cfg.last_apply_summary ? 'update_error' THEN 'FAIL' ELSE 'OK' END,
    'count',      (CASE WHEN v_behind THEN 1 ELSE 0 END) + v_conflicts,
    'sample_ids', '[]'::jsonb,
    'details',    jsonb_build_object('behind', v_behind, 'latest_version_no', v_latest.version_no,
                                     'conflicts', COALESCE(v_cfg.last_apply_summary -> 'conflicts', '[]'::jsonb),
                                     'update_error', v_cfg.last_apply_summary -> 'update_error'));
END $function$
;"
"CREATE OR REPLACE FUNCTION public.fn_tax_kit_apply(p_tenant uuid, p_pkg_code text, p_actor text, p_activate boolean DEFAULT false, p_note text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_pkg       public.sys_starter_pkg_mst%ROWTYPE;
  v_ver       public.sys_tax_kit_versions_mst%ROWTYPE;
  v_cfg       public.org_tax_config_cf%ROWTYPE;
  v_cfg_found BOOLEAN;
  v_country   TEXT;
  v_info      TEXT := 'fn_tax_kit_apply ' || p_pkg_code;
  v_conflicts JSONB := '[]'::jsonb;
  v_n         JSONB;
  v_summary   JSONB;
  v_confirm   JSONB;
  r           RECORD;
  v_code      public.org_tax_profiles_cf%ROWTYPE;
  v_cls       public.org_tax_item_classes_cf%ROWTYPE;
  v_rule      public.org_tax_rules_cf%ROWTYPE;
  v_rule_found BOOLEAN;
  v_rule_id   UUID;
  v_default   TEXT;
  n_code_new INT := 0; n_code_upd INT := 0; n_code_ver INT := 0; n_code_off INT := 0;
  n_cls_new  INT := 0; n_cls_upd  INT := 0; n_cls_off  INT := 0;
  n_rule_new INT := 0; n_rule_upd INT := 0; n_rule_off INT := 0;
  n_prod     INT := 0;
  -- Set only by fn_tax_kit_update: move to the new kit version, keep the organization's status.
  v_update   BOOLEAN := COALESCE(current_setting('app.tax_kit_update', true), '') = 'on';
BEGIN
  -- ─── Input validation ───────────────────────────────────────────────────
  IF p_tenant IS NULL OR NULLIF(btrim(p_pkg_code), '') IS NULL OR NULLIF(btrim(p_actor), '') IS NULL THEN
    RAISE EXCEPTION 'TAX_APPLY_BAD_INPUT: tenant, package and actor are required' USING ERRCODE = '22023';
  END IF;

  SELECT upper(country) INTO v_country FROM public.org_tenants_mst WHERE id = p_tenant FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TAX_APPLY_TENANT_NOT_FOUND: organization % does not exist', p_tenant USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_pkg FROM public.sys_starter_pkg_mst WHERE pkg_code = p_pkg_code AND is_active AND rec_status = 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TAX_APPLY_PACKAGE_NOT_FOUND: package % is missing or inactive', p_pkg_code USING ERRCODE = 'P0002';
  END IF;
  IF v_pkg.country_code IS NOT NULL AND v_pkg.country_code IS DISTINCT FROM v_country THEN
    RAISE EXCEPTION 'TAX_APPLY_COUNTRY_MISMATCH: package % is for %, the organization is in %', p_pkg_code, v_pkg.country_code, COALESCE(v_country, '?')
      USING ERRCODE = '22023';
  END IF;

  SELECT * INTO v_ver FROM public.sys_tax_kit_versions_mst
   WHERE kit_code = v_pkg.tax_kit_code AND status = 'PUBLISHED' AND rec_status = 1
     AND effective_from <= current_date AND (effective_to IS NULL OR effective_to >= current_date)
   ORDER BY version_no DESC LIMIT 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TAX_APPLY_NO_PUBLISHED_VERSION: kit % has no published version in effect', v_pkg.tax_kit_code USING ERRCODE = 'P0002';
  END IF;

  SELECT * INTO v_cfg FROM public.org_tax_config_cf WHERE tenant_org_id = p_tenant FOR UPDATE;
  v_cfg_found := FOUND;
  -- An active organization is never dropped back to pending (orders would stop
  -- being taxed): re-applying it must confirm in the same call.
  IF v_cfg_found AND v_cfg.status = 'ACTIVE' AND NOT p_activate AND NOT v_update THEN
    RAISE EXCEPTION 'TAX_APPLY_ACTIVE_NEEDS_ACTIVATE: the tax setup is active; re-apply with activation' USING ERRCODE = '55000';
  END IF;

  -- Our own writes do not count as organization changes (fn_tax_mark_modified).
  PERFORM set_config('app.tax_kit_apply', 'on', true);

  -- ─── Item classes ───────────────────────────────────────────────────────
  FOR r IN SELECT * FROM public.sys_tax_kit_item_classes_dtl
            WHERE kit_version_id = v_ver.id AND is_active AND rec_status = 1 ORDER BY display_order LOOP
    SELECT * INTO v_cls FROM public.org_tax_item_classes_cf WHERE tenant_org_id = p_tenant AND class_code = r.class_code;
    IF NOT FOUND THEN
      INSERT INTO public.org_tax_item_classes_cf
        (tenant_org_id, class_code, tax_flow_code, name, name2, description, description2, is_default, display_order,
         source, kit_version_id, created_by, created_info)
      VALUES
        (p_tenant, r.class_code, r.tax_flow_code, r.name, r.name2, r.description, r.description2,
         r.is_default AND NOT EXISTS (SELECT 1 FROM public.org_tax_item_classes_cf d
                                       WHERE d.tenant_org_id = p_tenant AND d.tax_flow_code = r.tax_flow_code
                                         AND d.is_default AND d.is_active AND d.rec_status = 1),
         r.display_order, 'HQ_KIT', v_ver.id, p_actor, v_info);
      n_cls_new := n_cls_new + 1;
    ELSIF v_cls.source = 'TENANT' OR v_cls.is_tenant_modified THEN
      v_conflicts := v_conflicts || jsonb_build_object('kind', 'ITEM_CLASS', 'code', r.class_code,
                                                       'reason', CASE WHEN v_cls.source = 'TENANT' THEN 'TENANT_ROW' ELSE 'TENANT_MODIFIED' END);
    ELSIF (v_cls.tax_flow_code, v_cls.name, v_cls.name2, v_cls.description, v_cls.description2, v_cls.display_order,
           v_cls.kit_version_id, v_cls.is_active, v_cls.rec_status)
          IS DISTINCT FROM
          (r.tax_flow_code, r.name, r.name2, r.description, r.description2, r.display_order, v_ver.id, true, 1::SMALLINT) THEN
      UPDATE public.org_tax_item_classes_cf
         SET tax_flow_code = r.tax_flow_code, name = r.name, name2 = r.name2, description = r.description,
             description2 = r.description2, display_order = r.display_order, kit_version_id = v_ver.id,
             is_active = true, rec_status = 1, updated_by = p_actor, updated_info = v_info
       WHERE tenant_org_id = p_tenant AND id = v_cls.id;
      n_cls_upd := n_cls_upd + 1;
    END IF;
  END LOOP;

  UPDATE public.org_tax_item_classes_cf c
     SET is_active = false, is_default = false, updated_by = p_actor, updated_info = v_info
   WHERE c.tenant_org_id = p_tenant AND c.source = 'HQ_KIT' AND NOT c.is_tenant_modified AND c.is_active
     AND NOT EXISTS (SELECT 1 FROM public.sys_tax_kit_item_classes_dtl k
                      WHERE k.kit_version_id = v_ver.id AND k.class_code = c.class_code AND k.is_active AND k.rec_status = 1);
  GET DIAGNOSTICS n_cls_off = ROW_COUNT;

  -- ─── Tax codes ──────────────────────────────────────────────────────────
  FOR r IN SELECT * FROM public.sys_tax_kit_codes_dtl
            WHERE kit_version_id = v_ver.id AND is_active AND rec_status = 1 ORDER BY display_order LOOP
    SELECT * INTO v_code FROM public.org_tax_profiles_cf
     WHERE tenant_org_id = p_tenant AND tax_code = r.tax_code ORDER BY version_no DESC LIMIT 1;
    IF NOT FOUND THEN
      INSERT INTO public.org_tax_profiles_cf
        (tenant_org_id, tax_code, version_no, name, name2, tax_type, rate, amount_kind, fixed_amount, calc_level,
         tax_category_code, tax_flow_code, recoverable_pct, is_reverse_charge, priority, is_compound,
         effective_from, rounding_level, rounding_mode, source, kit_version_id, display_order,
         created_by, created_info)
      VALUES
        (p_tenant, r.tax_code, 1, r.name, r.name2, r.tax_type, r.rate, r.amount_kind, r.fixed_amount, r.calc_level,
         r.tax_category_code, r.tax_flow_code, r.recoverable_pct, r.is_reverse_charge, r.priority, r.compound_base,
         v_ver.effective_from, v_ver.rounding_level, v_ver.rounding_mode, 'HQ_KIT', v_ver.id, r.display_order,
         p_actor, v_info);
      n_code_new := n_code_new + 1;
    ELSIF v_code.source = 'TENANT' OR v_code.is_tenant_modified THEN
      v_conflicts := v_conflicts || jsonb_build_object('kind', 'TAX_CODE', 'code', r.tax_code,
                                                       'reason', CASE WHEN v_code.source = 'TENANT' THEN 'TENANT_ROW' ELSE 'TENANT_MODIFIED' END);
    ELSIF (v_code.tax_type, v_code.rate, v_code.amount_kind, v_code.fixed_amount, v_code.calc_level, v_code.tax_category_code,
           v_code.tax_flow_code, v_code.recoverable_pct, v_code.is_reverse_charge, v_code.priority, v_code.is_compound,
           v_code.rounding_level, v_code.rounding_mode)
          IS DISTINCT FROM
          (r.tax_type, r.rate, r.amount_kind, r.fixed_amount, r.calc_level, r.tax_category_code,
           r.tax_flow_code, r.recoverable_pct, r.is_reverse_charge, r.priority, r.compound_base,
           v_ver.rounding_level, v_ver.rounding_mode) THEN
      IF public.fn_tax_profile_is_used(p_tenant, v_code.id) THEN
        -- Used version is frozen: end it yesterday and start a new version today.
        UPDATE public.org_tax_profiles_cf
           SET effective_to = GREATEST(effective_from, current_date - 1), updated_by = p_actor, updated_info = v_info
         WHERE tenant_org_id = p_tenant AND id = v_code.id;
        INSERT INTO public.org_tax_profiles_cf
          (tenant_org_id, tax_code, version_no, name, name2, tax_type, rate, amount_kind, fixed_amount, calc_level,
           tax_category_code, tax_flow_code, recoverable_pct, is_reverse_charge, priority, is_compound,
           effective_from, rounding_level, rounding_mode, source, kit_version_id, display_order,
           created_by, created_info)
        VALUES
          (p_tenant, r.tax_code, v_code.version_no + 1, r.name, r.name2, r.tax_type, r.rate, r.amount_kind, r.fixed_amount, r.calc_level,
           r.tax_category_code, r.tax_flow_code, r.recoverable_pct, r.is_reverse_charge, r.priority, r.compound_base,
           GREATEST(current_date, v_ver.effective_from), v_ver.rounding_level, v_ver.rounding_mode, 'HQ_KIT', v_ver.id,
           r.display_order, p_actor, v_info);
        n_code_ver := n_code_ver + 1;
      ELSE
        UPDATE public.org_tax_profiles_cf
           SET name = r.name, name2 = r.name2, tax_type = r.tax_type, rate = r.rate, amount_kind = r.amount_kind,
               fixed_amount = r.fixed_amount, calc_level = r.calc_level, tax_category_code = r.tax_category_code,
               tax_flow_code = r.tax_flow_code, recoverable_pct = r.recoverable_pct, is_reverse_charge = r.is_reverse_charge,
               priority = r.priority, is_compound = r.compound_base, rounding_level = v_ver.rounding_level,
               rounding_mode = v_ver.rounding_mode, kit_version_id = v_ver.id, display_order = r.display_order,
               is_active = true, rec_status = 1, effective_to = NULL, updated_by = p_actor, updated_info = v_info
         WHERE tenant_org_id = p_tenant AND id = v_code.id;
        n_code_upd := n_code_upd + 1;
      END IF;
    ELSIF (v_code.name, v_code.name2, v_code.display_order, v_code.kit_version_id, v_code.is_active, v_code.rec_status, v_code.effective_to)
          IS DISTINCT FROM (r.name, r.name2, r.display_order, v_ver.id, true, 1::SMALLINT, NULL::DATE) THEN
      UPDATE public.org_tax_profiles_cf
         SET name = r.name, name2 = r.name2, display_order = r.display_order, kit_version_id = v_ver.id,
             is_active = true, rec_status = 1, effective_to = NULL, updated_by = p_actor, updated_info = v_info
       WHERE tenant_org_id = p_tenant AND id = v_code.id;
      n_code_upd := n_code_upd + 1;
    END IF;
  END LOOP;

  UPDATE public.org_tax_profiles_cf p
     SET is_active = false, updated_by = p_actor, updated_info = v_info
   WHERE p.tenant_org_id = p_tenant AND p.source = 'HQ_KIT' AND NOT p.is_tenant_modified AND p.is_active
     AND NOT EXISTS (SELECT 1 FROM public.sys_tax_kit_codes_dtl k
                      WHERE k.kit_version_id = v_ver.id AND k.tax_code = p.tax_code AND k.is_active AND k.rec_status = 1);
  GET DIAGNOSTICS n_code_off = ROW_COUNT;

  -- ─── Rules (kit rules for this package's segment) ───────────────────────
  FOR r IN SELECT * FROM public.sys_tax_kit_rules_dtl
            WHERE kit_version_id = v_ver.id AND is_active AND rec_status = 1
              AND (segment_codes IS NULL OR v_pkg.segment_code = ANY (segment_codes))
            ORDER BY priority, rule_code LOOP
    SELECT * INTO v_rule FROM public.org_tax_rules_cf WHERE tenant_org_id = p_tenant AND rule_code = r.rule_code;
    v_rule_found := FOUND;
    IF v_rule_found AND (v_rule.source = 'TENANT' OR v_rule.is_tenant_modified) THEN
      v_conflicts := v_conflicts || jsonb_build_object('kind', 'TAX_RULE', 'code', r.rule_code,
                                                       'reason', CASE WHEN v_rule.source = 'TENANT' THEN 'TENANT_ROW' ELSE 'TENANT_MODIFIED' END);
      CONTINUE;
    END IF;

    -- An organization rule with the same criteria already decides these lines.
    IF EXISTS (SELECT 1 FROM public.org_tax_rules_cf o
                WHERE o.tenant_org_id = p_tenant AND o.is_active AND o.rec_status = 1
                  AND o.rule_code <> r.rule_code
                  AND o.doc_type_code IS NOT DISTINCT FROM r.doc_type_code
                  AND o.tax_flow_code IS NOT DISTINCT FROM r.tax_flow_code
                  AND o.branch_id IS NULL AND o.place_of_supply_country IS NULL AND o.service_category_code IS NULL
                  AND o.tax_item_class_code IS NOT DISTINCT FROM r.tax_item_class_code
                  AND o.party_tax_class_code IS NOT DISTINCT FROM r.party_tax_class_code
                  AND o.party_country_scope IS NOT DISTINCT FROM r.party_country_scope
                  AND o.effective_from = v_ver.effective_from) THEN
      v_conflicts := v_conflicts || jsonb_build_object('kind', 'TAX_RULE', 'code', r.rule_code, 'reason', 'SAME_CRITERIA');
      CONTINUE;
    END IF;

    IF NOT v_rule_found THEN
      INSERT INTO public.org_tax_rules_cf
        (tenant_org_id, rule_code, doc_type_code, tax_flow_code, tax_item_class_code, party_tax_class_code, party_country_scope,
         effective_from, priority, name, name2, source, kit_version_id, created_by, created_info)
      VALUES
        (p_tenant, r.rule_code, r.doc_type_code, r.tax_flow_code, r.tax_item_class_code, r.party_tax_class_code, r.party_country_scope,
         v_ver.effective_from, r.priority, r.name, r.name2, 'HQ_KIT', v_ver.id, p_actor, v_info)
      RETURNING id INTO v_rule_id;
      n_rule_new := n_rule_new + 1;
    ELSE
      v_rule_id := v_rule.id;
      UPDATE public.org_tax_rules_cf
         SET doc_type_code = r.doc_type_code, tax_flow_code = r.tax_flow_code, tax_item_class_code = r.tax_item_class_code,
             party_tax_class_code = r.party_tax_class_code, party_country_scope = r.party_country_scope,
             priority = r.priority, name = r.name, name2 = r.name2, kit_version_id = v_ver.id,
             is_active = true, rec_status = 1, effective_to = NULL, updated_by = p_actor, updated_info = v_info
       WHERE tenant_org_id = p_tenant AND id = v_rule_id
         AND (doc_type_code, tax_flow_code, tax_item_class_code, party_tax_class_code, party_country_scope, priority,
              name, name2, kit_version_id, is_active, rec_status, effective_to)
             IS DISTINCT FROM
             (r.doc_type_code, r.tax_flow_code, r.tax_item_class_code, r.party_tax_class_code, r.party_country_scope, r.priority,
              r.name, r.name2, v_ver.id, true, 1::SMALLINT, NULL::DATE);
      IF FOUND THEN n_rule_upd := n_rule_upd + 1; END IF;
      DELETE FROM public.org_tax_rule_codes_dtl WHERE tenant_org_id = p_tenant AND rule_id = v_rule_id;
    END IF;

    INSERT INTO public.org_tax_rule_codes_dtl (tenant_org_id, rule_id, seq_no, tax_code, created_by, created_info)
    SELECT p_tenant, v_rule_id, k.seq_no, k.tax_code, p_actor, v_info
      FROM public.sys_tax_kit_rule_codes_dtl k
     WHERE k.rule_id = r.id AND k.kit_version_id = v_ver.id AND k.is_active AND k.rec_status = 1;
  END LOOP;

  UPDATE public.org_tax_rules_cf o
     SET is_active = false, updated_by = p_actor, updated_info = v_info
   WHERE o.tenant_org_id = p_tenant AND o.source = 'HQ_KIT' AND NOT o.is_tenant_modified AND o.is_active
     AND NOT EXISTS (SELECT 1 FROM public.sys_tax_kit_rules_dtl k
                      WHERE k.kit_version_id = v_ver.id AND k.rule_code = o.rule_code AND k.is_active AND k.rec_status = 1
                        AND (k.segment_codes IS NULL OR v_pkg.segment_code = ANY (k.segment_codes)));
  GET DIAGNOSTICS n_rule_off = ROW_COUNT;

  -- ─── Products without a class get the default sales class ───────────────
  SELECT class_code INTO v_default FROM public.org_tax_item_classes_cf
   WHERE tenant_org_id = p_tenant AND tax_flow_code = 'OUTPUT' AND is_default AND is_active AND rec_status = 1;
  IF v_default IS NOT NULL THEN
    UPDATE public.org_product_data_mst
       SET tax_item_class_code = v_default, updated_at = now(), updated_by = p_actor, updated_info = v_info
     WHERE tenant_org_id = p_tenant AND tax_item_class_code IS NULL;
    GET DIAGNOSTICS n_prod = ROW_COUNT;
  END IF;

  PERFORM set_config('app.tax_kit_apply', '', true);

  -- ─── Config: pending candidate ──────────────────────────────────────────
  v_n := jsonb_build_object(
    'codes',   jsonb_build_object('added', n_code_new, 'updated', n_code_upd, 'new_versions', n_code_ver, 'deactivated', n_code_off),
    'classes', jsonb_build_object('added', n_cls_new, 'updated', n_cls_upd, 'deactivated', n_cls_off),
    'rules',   jsonb_build_object('added', n_rule_new, 'updated', n_rule_upd, 'deactivated', n_rule_off),
    'products_classified', n_prod);
  v_summary := jsonb_build_object('pkg_code', p_pkg_code, 'kit_code', v_pkg.tax_kit_code, 'kit_version_no', v_ver.version_no,
                                  'segment_code', v_pkg.segment_code, 'counts', v_n, 'conflicts', v_conflicts,
                                  'mode', CASE WHEN v_update THEN 'UPDATE' ELSE 'APPLY' END);

  INSERT INTO public.org_tax_config_cf
    (tenant_org_id, starter_pkg_code, kit_code, kit_version_id, segment_code, setup_mode, status, tax_enabled,
     applied_at, applied_by, last_apply_summary, created_by, created_info)
  VALUES
    (p_tenant, p_pkg_code, v_pkg.tax_kit_code, v_ver.id, v_pkg.segment_code, v_pkg.tax_setup_mode, 'PENDING_CONFIRMATION', false,
     now(), p_actor, v_summary, p_actor, v_info)
  ON CONFLICT (tenant_org_id) DO UPDATE
     SET starter_pkg_code = EXCLUDED.starter_pkg_code, kit_code = EXCLUDED.kit_code, kit_version_id = EXCLUDED.kit_version_id,
         segment_code = EXCLUDED.segment_code,
         status = CASE WHEN v_update THEN org_tax_config_cf.status ELSE 'PENDING_CONFIRMATION' END,
         tax_enabled = CASE WHEN v_update THEN org_tax_config_cf.tax_enabled ELSE false END,
         applied_at = now(), applied_by = p_actor, last_apply_summary = EXCLUDED.last_apply_summary,
         updated_by = p_actor, updated_info = v_info;

  IF p_activate THEN
    v_confirm := public.fn_tax_config_confirm(p_tenant, p_actor, p_note);
    IF NOT (v_confirm ->> 'ok')::BOOLEAN THEN
      -- Roll back the whole apply: an active setup is never left pending.
      RAISE EXCEPTION 'TAX_ACTIVATE_NOT_READY: %', v_confirm -> 'errors' USING ERRCODE = '55000';
    END IF;
    v_summary := v_summary || jsonb_build_object('confirm', v_confirm);
  END IF;

  RETURN v_summary;
END $function$
;"
"CREATE OR REPLACE FUNCTION public.fn_tax_kit_update(p_tenant uuid, p_actor text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_cfg     public.org_tax_config_cf%ROWTYPE;
  v_latest  UUID;
  v_summary JSONB;
BEGIN
  SELECT * INTO v_cfg FROM public.org_tax_config_cf WHERE tenant_org_id = p_tenant AND rec_status = 1;
  IF NOT FOUND OR v_cfg.starter_pkg_code IS NULL THEN
    RETURN jsonb_build_object('status', 'SKIPPED', 'reason', 'NO_KIT');
  END IF;
  SELECT id INTO v_latest FROM public.sys_tax_kit_versions_mst
   WHERE kit_code = v_cfg.kit_code AND status = 'PUBLISHED' AND rec_status = 1
     AND effective_from <= CURRENT_DATE AND (effective_to IS NULL OR effective_to >= CURRENT_DATE)
   ORDER BY version_no DESC LIMIT 1;
  IF v_latest IS NULL OR v_latest = v_cfg.kit_version_id THEN
    RETURN jsonb_build_object('status', 'UP_TO_DATE');
  END IF;
  PERFORM set_config('app.tax_kit_update', 'on', true);
  v_summary := public.fn_tax_kit_apply(p_tenant, v_cfg.starter_pkg_code, p_actor, false, NULL);
  PERFORM set_config('app.tax_kit_update', '', true);
  RETURN jsonb_build_object('status', 'UPDATED', 'summary', v_summary);
END $function$
;"
"CREATE OR REPLACE FUNCTION public.fn_tax_kit_update_all()
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  t       RECORD;
  v_res   JSONB;
  n_upd   INTEGER := 0;
  n_fail  INTEGER := 0;
BEGIN
  FOR t IN
    SELECT c.tenant_org_id
      FROM public.org_tax_config_cf c
      JOIN public.org_tenants_mst o ON o.id = c.tenant_org_id AND o.is_active AND o.rec_status = 1
     WHERE c.rec_status = 1 AND c.starter_pkg_code IS NOT NULL
       AND EXISTS (SELECT 1 FROM public.sys_tax_kit_versions_mst v
                    WHERE v.kit_code = c.kit_code AND v.status = 'PUBLISHED' AND v.rec_status = 1
                      AND v.effective_from <= CURRENT_DATE AND (v.effective_to IS NULL OR v.effective_to >= CURRENT_DATE)
                      AND v.id IS DISTINCT FROM c.kit_version_id)
  LOOP
    BEGIN
      v_res := public.fn_tax_kit_update(t.tenant_org_id, 'system:tax_kit_update');
      IF v_res ->> 'status' = 'UPDATED' THEN n_upd := n_upd + 1; END IF;
    EXCEPTION WHEN OTHERS THEN
      -- One organization's failure never stops the others; Setup Health shows it.
      n_fail := n_fail + 1;
      UPDATE public.org_tax_config_cf
         SET last_apply_summary = COALESCE(last_apply_summary, '{}'::jsonb)
                                  || jsonb_build_object('update_error', SQLERRM, 'update_failed_at', now()),
             updated_by = 'system:tax_kit_update', updated_info = 'fn_tax_kit_update_all'
       WHERE tenant_org_id = t.tenant_org_id;
    END;
  END LOOP;
  RETURN jsonb_build_object('updated', n_upd, 'failed', n_fail);
END $function$
;"
"CREATE OR REPLACE FUNCTION public.fn_tax_kit_version_clone(p_version_id uuid, p_actor text)
 RETURNS uuid
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_src  public.sys_tax_kit_versions_mst%ROWTYPE;
  v_new  UUID;
  v_no   INTEGER;
  v_info TEXT := 'fn_tax_kit_version_clone';
BEGIN
  IF NULLIF(btrim(p_actor), '') IS NULL THEN
    RAISE EXCEPTION 'TAX_KIT_BAD_INPUT: actor is required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_src FROM public.sys_tax_kit_versions_mst WHERE id = p_version_id AND rec_status = 1;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TAX_KIT_VERSION_NOT_FOUND: kit version % does not exist', p_version_id USING ERRCODE = 'P0002';
  END IF;
  -- One draft per kit, so two HQ users never edit competing drafts.
  PERFORM 1 FROM public.sys_tax_kits_mst WHERE kit_code = v_src.kit_code FOR UPDATE;
  IF EXISTS (SELECT 1 FROM public.sys_tax_kit_versions_mst WHERE kit_code = v_src.kit_code AND status = 'DRAFT' AND rec_status = 1) THEN
    RAISE EXCEPTION 'TAX_KIT_DRAFT_EXISTS: kit % already has a draft version', v_src.kit_code USING ERRCODE = '55000';
  END IF;
  SELECT COALESCE(max(version_no), 0) + 1 INTO v_no FROM public.sys_tax_kit_versions_mst WHERE kit_code = v_src.kit_code;

  INSERT INTO public.sys_tax_kit_versions_mst
    (kit_code, version_no, status, effective_from, effective_to, currency_code, mandatory_reg_threshold, voluntary_reg_threshold,
     simplified_max_amount, rounding_level, rounding_mode, tax_on_advance, voucher_tax_mode, is_verified, source_url, checked_on,
     review_notes, created_by, created_info)
  VALUES
    (v_src.kit_code, v_no, 'DRAFT', GREATEST(CURRENT_DATE + 1, v_src.effective_from), NULL, v_src.currency_code,
     v_src.mandatory_reg_threshold, v_src.voluntary_reg_threshold, v_src.simplified_max_amount, v_src.rounding_level,
     v_src.rounding_mode, v_src.tax_on_advance, v_src.voucher_tax_mode, false, v_src.source_url, NULL, v_src.review_notes,
     p_actor, v_info)
  RETURNING id INTO v_new;

  INSERT INTO public.sys_tax_kit_codes_dtl
    (kit_version_id, tax_code, name, name2, tax_type, tax_category_code, tax_flow_code, amount_kind, rate, fixed_amount,
     calc_level, recoverable_pct, is_reverse_charge, priority, compound_base, display_order, is_active, rec_status, created_by, created_info)
  SELECT v_new, tax_code, name, name2, tax_type, tax_category_code, tax_flow_code, amount_kind, rate, fixed_amount,
         calc_level, recoverable_pct, is_reverse_charge, priority, compound_base, display_order, is_active, rec_status, p_actor, v_info
    FROM public.sys_tax_kit_codes_dtl WHERE kit_version_id = p_version_id;

  INSERT INTO public.sys_tax_kit_item_classes_dtl
    (kit_version_id, class_code, tax_flow_code, name, name2, description, description2, is_default, display_order,
     is_active, rec_status, created_by, created_info)
  SELECT v_new, class_code, tax_flow_code, name, name2, description, description2, is_default, display_order,
         is_active, rec_status, p_actor, v_info
    FROM public.sys_tax_kit_item_classes_dtl WHERE kit_version_id = p_version_id;

  INSERT INTO public.sys_tax_kit_rules_dtl
    (kit_version_id, rule_code, doc_type_code, tax_flow_code, tax_item_class_code, party_tax_class_code, party_country_scope,
     segment_codes, priority, name, name2, is_active, rec_status, created_by, created_info)
  SELECT v_new, rule_code, doc_type_code, tax_flow_code, tax_item_class_code, party_tax_class_code, party_country_scope,
         segment_codes, priority, name, name2, is_active, rec_status, p_actor, v_info
    FROM public.sys_tax_kit_rules_dtl WHERE kit_version_id = p_version_id;

  -- Rule codes follow their rule by rule_code (rule ids are new).
  INSERT INTO public.sys_tax_kit_rule_codes_dtl
    (rule_id, kit_version_id, seq_no, tax_code, is_active, rec_status, created_by, created_info)
  SELECT nr.id, v_new, rc.seq_no, rc.tax_code, rc.is_active, rc.rec_status, p_actor, v_info
    FROM public.sys_tax_kit_rule_codes_dtl rc
    JOIN public.sys_tax_kit_rules_dtl orl ON orl.id = rc.rule_id AND orl.kit_version_id = p_version_id
    JOIN public.sys_tax_kit_rules_dtl nr  ON nr.kit_version_id = v_new AND nr.rule_code = orl.rule_code
   WHERE rc.kit_version_id = p_version_id;

  INSERT INTO public.sys_tax_kit_vectors_dtl
    (kit_version_id, vector_code, description, description2, input, expected, is_active, rec_status, created_by, created_info)
  SELECT v_new, vector_code, description, description2, input, expected, is_active, rec_status, p_actor, v_info
    FROM public.sys_tax_kit_vectors_dtl WHERE kit_version_id = p_version_id;

  RETURN v_new;
END $function$
;"
"CREATE OR REPLACE FUNCTION public.fn_tax_kit_version_publish(p_version_id uuid, p_actor text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_ver   public.sys_tax_kit_versions_mst%ROWTYPE;
  v_check JSONB;
  v_ended INTEGER;
BEGIN
  IF NULLIF(btrim(p_actor), '') IS NULL THEN
    RAISE EXCEPTION 'TAX_KIT_BAD_INPUT: actor is required' USING ERRCODE = '22023';
  END IF;
  SELECT * INTO v_ver FROM public.sys_tax_kit_versions_mst WHERE id = p_version_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'TAX_KIT_VERSION_NOT_FOUND: kit version % does not exist', p_version_id USING ERRCODE = 'P0002';
  END IF;
  IF v_ver.status <> 'DRAFT' THEN
    RAISE EXCEPTION 'TAX_KIT_NOT_DRAFT: only a draft version can be published' USING ERRCODE = '55000';
  END IF;
  -- Orders already taxed must never change: a new version starts today at the earliest.
  IF v_ver.effective_from < CURRENT_DATE THEN
    RAISE EXCEPTION 'TAX_KIT_EFFECTIVE_PAST: the effective date % is in the past', v_ver.effective_from USING ERRCODE = '22023';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.sys_tax_kit_codes_dtl WHERE kit_version_id = p_version_id AND is_active AND rec_status = 1) THEN
    RAISE EXCEPTION 'TAX_KIT_EMPTY: the version has no active tax code' USING ERRCODE = '22023';
  END IF;
  IF EXISTS (SELECT 1 FROM public.sys_tax_kit_versions_mst
              WHERE kit_code = v_ver.kit_code AND status = 'PUBLISHED' AND rec_status = 1 AND effective_from >= v_ver.effective_from) THEN
    RAISE EXCEPTION 'TAX_KIT_EFFECTIVE_OVERLAP: a published version already starts on or after %', v_ver.effective_from USING ERRCODE = '22023';
  END IF;
  v_check := public.fn_tax_kit_version_check(p_version_id);
  IF NOT (v_check ->> 'ok')::BOOLEAN THEN
    RAISE EXCEPTION 'TAX_KIT_EXAMPLES_FAILED: %', v_check -> 'results' USING ERRCODE = '22023';
  END IF;

  -- The version in effect until now ends the day before.
  UPDATE public.sys_tax_kit_versions_mst
     SET effective_to = v_ver.effective_from - 1, updated_by = p_actor, updated_info = 'fn_tax_kit_version_publish'
   WHERE kit_code = v_ver.kit_code AND status = 'PUBLISHED' AND rec_status = 1
     AND (effective_to IS NULL OR effective_to >= v_ver.effective_from);
  GET DIAGNOSTICS v_ended = ROW_COUNT;

  UPDATE public.sys_tax_kit_versions_mst
     SET status = 'PUBLISHED', published_at = now(), published_by = p_actor,
         updated_by = p_actor, updated_info = 'fn_tax_kit_version_publish'
   WHERE id = p_version_id;

  RETURN jsonb_build_object('ok', true, 'kit_code', v_ver.kit_code, 'version_no', v_ver.version_no,
                            'effective_from', v_ver.effective_from, 'previous_ended', v_ended, 'check', v_check);
END $function$
;"
"CREATE OR REPLACE FUNCTION public.fn_tenant_general_value(p_tenant_id uuid, p_key text)
 RETURNS text
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_role TEXT := COALESCE(NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role', '');
  t      public.org_tenants_mst%ROWTYPE;
  h      public.hq_general_config%ROWTYPE;
BEGIN
  IF v_role = 'authenticated' AND p_tenant_id IS DISTINCT FROM public.current_tenant_id() THEN
    RAISE EXCEPTION 'DOC_SEQ_TENANT_MISMATCH' USING ERRCODE = '42501';
  ELSIF v_role NOT IN ('', 'authenticated', 'service_role') THEN
    RAISE EXCEPTION 'DOC_SEQ_TENANT_MISMATCH' USING ERRCODE = '42501';
  END IF;
  SELECT * INTO h FROM public.hq_general_config WHERE config_id;
  IF p_tenant_id IS NOT NULL THEN
    SELECT * INTO t FROM public.org_tenants_mst WHERE id = p_tenant_id;
  END IF;
  RETURN CASE p_key
    WHEN 'current_fiscal_year'     THEN COALESCE(t.current_fiscal_year, h.current_fiscal_year)
    WHEN 'fiscal_year_start_month' THEN COALESCE(t.fiscal_year_start_month, h.fiscal_year_start_month)::TEXT
    WHEN 'date_format'             THEN COALESCE(t.date_format, h.date_format)
    WHEN 'time_format'             THEN COALESCE(t.time_format, h.time_format)
    WHEN 'first_day_of_week'       THEN COALESCE(t.first_day_of_week, h.first_day_of_week)::TEXT
    WHEN 'language'                THEN COALESCE(NULLIF(t.language, ''), h.default_language_code)
    WHEN 'locale_code'             THEN COALESCE(t.locale_code, h.locale_code)
    WHEN 'timezone'                THEN COALESCE(NULLIF(t.timezone, ''), h.timezone)
    ELSE NULL
  END;
END $function$
;"
"CREATE OR REPLACE FUNCTION public.generate_cash_drawer_sess_no(p_tenant_org_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_date TEXT;
  v_seq  INTEGER;
BEGIN
  v_date := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

  -- Serialize concurrent callers for this (tenant, business date) so two
  -- simultaneous opens can never read the same MAX(...) and compute the
  -- same +1 sequence. This is a transaction-scoped advisory lock: the
  -- caller MUST invoke this function inside the same transaction as the
  -- session INSERT or the lock releases before the insert commits and
  -- offers no protection.
  PERFORM pg_advisory_xact_lock(hashtext(p_tenant_org_id::text || v_date));

  -- Sequence digits start at character 14 — see header note #2. Was 13.
  SELECT COALESCE(MAX(CAST(SUBSTRING(session_no FROM 14) AS INTEGER)), 0) + 1
    INTO v_seq
    FROM public.org_cash_drawer_sessions_mst
   WHERE tenant_org_id = p_tenant_org_id
     AND session_no LIKE 'SES-' || v_date || '-%';

  RETURN 'SES-' || v_date || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$function$
;"
"CREATE OR REPLACE FUNCTION public.generate_cash_drawer_trx_no(p_tenant_org_id uuid)
 RETURNS text
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_date TEXT;
  v_seq  INTEGER;
BEGIN
  v_date := TO_CHAR(CURRENT_DATE, 'YYYYMMDD');

  -- Serialise concurrent callers for the same tenant and day; the ':cdt:' part
  -- keeps this key apart from the session-number lock.
  PERFORM pg_advisory_xact_lock(hashtext(p_tenant_org_id::TEXT || ':cdt:' || v_date));

  -- 'CDT-YYYYMMDD-' is 13 characters; the digits start at character 14.
  SELECT COALESCE(MAX(CAST(SUBSTRING(trx_no FROM 14) AS INTEGER)), 0) + 1
    INTO v_seq
    FROM org_cash_drawer_trx_mst
   WHERE tenant_org_id = p_tenant_org_id
     AND trx_no LIKE 'CDT-' || v_date || '-%';

  RETURN 'CDT-' || v_date || '-' || LPAD(v_seq::TEXT, 4, '0');
END;
$function$
;"
"CREATE OR REPLACE FUNCTION public.get_order_number_prefix()
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
  SELECT 'ORD-' || TO_CHAR(CURRENT_DATE, 'YYYYMMDD') || '-';
$function$
;"
"CREATE OR REPLACE FUNCTION public.get_product_price(p_tenant_org_id uuid, p_product_id uuid, p_price_list_type character varying DEFAULT 'standard'::character varying, p_quantity numeric DEFAULT 1, p_effective_date date DEFAULT CURRENT_DATE)
 RETURNS numeric
 LANGUAGE plpgsql
 STABLE
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_price NUMERIC(21,6);
BEGIN
  -- The active price list's price (its discount folded in), highest priority and deepest tier first.
  SELECT pli.price * (1 - COALESCE(pli.discount_percent, 0) / 100)
    INTO v_price
    FROM org_price_list_items_dtl pli
    JOIN org_price_lists_mst pl
      ON pl.id = pli.price_list_id
     AND pl.tenant_org_id = pli.tenant_org_id
   WHERE pli.tenant_org_id = p_tenant_org_id
     AND pli.product_id = p_product_id
     AND pli.is_active = true
     AND pl.is_active = true
     AND pl.price_list_type = p_price_list_type
     AND (pl.effective_from IS NULL OR pl.effective_from <= p_effective_date)
     AND (pl.effective_to IS NULL OR pl.effective_to >= p_effective_date)
     AND pli.min_quantity <= p_quantity
     AND (pli.max_quantity IS NULL OR pli.max_quantity >= p_quantity)
   ORDER BY pl.priority DESC, pli.min_quantity DESC
   LIMIT 1;

  -- Else the product's default price for every list type (speed premiums come from speed rules).
  IF v_price IS NULL THEN
    SELECT default_sell_price
      INTO v_price
      FROM org_product_data_mst
     WHERE tenant_org_id = p_tenant_org_id
       AND id = p_product_id
       AND is_active = true;
  END IF;

  RETURN v_price;
END $function$
;"
"CREATE OR REPLACE FUNCTION public.resolve_fin_tpl_for_tnt(p_tenant_id uuid)
 RETURNS TABLE(tpl_pkg_id uuid, tpl_pkg_code character varying, version_no integer, match_mode character varying)
 LANGUAGE sql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
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
$function$
;"
"CREATE OR REPLACE FUNCTION public.seed_product_speed_rules(p_tenant_org_id uuid, p_product_ids uuid[], p_include_pricing boolean DEFAULT false)
 RETURNS integer
 LANGUAGE plpgsql
 SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_created integer := 0;
  v_samples integer := 0;
BEGIN
  IF p_tenant_org_id IS NULL OR p_product_ids IS NULL OR cardinality(p_product_ids) = 0 THEN
    RETURN 0;
  END IF;

  -- Template-based EXPRESS rules per product (rules unchanged from 0700, plus the unit).
  WITH created AS (
  INSERT INTO org_speed_price_rules_cf (
    tenant_org_id, service_speed, product_id,
    speed_price_type, default_speed_sell_price, multiplier_speed,
    turnaround_unit, turnaround_hh_speed, effective_from, created_by, created_info
  )
  SELECT
    src.tenant_org_id,
    'EXPRESS',
    src.product_id,
    CASE WHEN src.use_price THEN 'SELL_PRICE' ELSE 'MULTIPLIER' END,
    CASE WHEN src.use_price THEN src.express_price END,
    CASE WHEN src.use_price THEN NULL ELSE src.multiplier - 1 END,
    -- chk_org_spd_price_rules_turn_unit: hours need the HOURS unit, no hours need none.
    CASE WHEN src.turnaround IS NOT NULL THEN 'HOURS' END,
    src.turnaround,
    CURRENT_DATE,
    'system_seed',
    'Seeded from the product template by seed_product_speed_rules (0720)'
  FROM (
    -- One template per product (the seeders match on item and category).
    SELECT DISTINCT ON (p.id)
      p.tenant_org_id,
      p.id AS product_id,
      p.service_category_code,
      t.default_express_sell_price AS express_price,
      t.multiplier_express AS multiplier,
      t.turnaround_hh_express AS turnaround,
      -- The express price was copied only with pricing, as before; when copied, it
      -- decides alone (the factor is not used for that product).
      COALESCE(p_include_pricing AND t.default_express_sell_price > 0, false) AS has_price,
      -- An express price equal to the normal price adds nothing, like a factor of 1.
      COALESCE(p_include_pricing AND t.default_express_sell_price > 0
        AND t.default_express_sell_price IS DISTINCT FROM t.default_sell_price, false) AS use_price
    FROM org_product_data_mst p
    JOIN sys_service_prod_templates_cd t
      ON t.item_code = p.product_code
     AND t.service_category_code = p.service_category_code
    WHERE p.tenant_org_id = p_tenant_org_id
      AND p.id = ANY (p_product_ids)
    ORDER BY p.id, t.seed_priority
  ) src
  -- No rule when it would add nothing (factor 1 or none): a zero rule would only
  -- hide a category or all-products rule from this product (0694).
  WHERE (src.use_price OR (NOT src.has_price AND COALESCE(src.multiplier, 1) > 1))
    -- Never a second rule for a product that already has one, in any state.
    AND NOT EXISTS (
      SELECT 1 FROM org_speed_price_rules_cf r
      WHERE r.tenant_org_id = src.tenant_org_id
        AND r.service_speed = 'EXPRESS'
        AND r.product_id = src.product_id
    )
    -- The organization's own rule for all products or for this category (all
    -- branches, active, in date) already prices Express: a template rule would
    -- override it, so the product follows the organization's rule instead.
    AND NOT EXISTS (
      SELECT 1 FROM org_speed_price_rules_cf r
      WHERE r.tenant_org_id = src.tenant_org_id
        AND r.service_speed = 'EXPRESS'
        AND r.product_id IS NULL
        AND r.branch_id IS NULL
        AND (r.service_category_code IS NULL OR r.service_category_code = src.service_category_code)
        AND r.is_active = true
        AND r.rec_status = 1
        AND (r.effective_to IS NULL OR r.effective_to >= CURRENT_DATE)
    )
  -- A concurrent seed of the same product created it first: keep that one.
  ON CONFLICT ON CONSTRAINT uq_org_spd_price_rules_scope DO NOTHING
  RETURNING id, tenant_org_id, product_id, speed_price_type,
            default_speed_sell_price, multiplier_speed, effective_from, effective_to
  )
  -- One history row per rule, as the Speed Pricing screen writes on create.
  INSERT INTO org_price_history_audit (
    tenant_org_id, entity_type, entity_id, product_id, old_price, new_price,
    change_reason, effective_from, effective_to, created_by, created_info
  )
  SELECT
    c.tenant_org_id, 'speed_rule', c.id, c.product_id, NULL,
    COALESCE(c.default_speed_sell_price, c.multiplier_speed),
    'CREATE: - -> ' || c.speed_price_type,
    c.effective_from, c.effective_to,
    -- created_by is a user UUID; a system seed has none.
    NULL, 'Catalog seed (seed_product_speed_rules, 0720)'
  FROM created c;

  GET DIAGNOSTICS v_created = ROW_COUNT;

  -- Sample rules for all products, so the speeds are offered from day one. A separate
  -- statement, so it sees the EXPRESS rules created above. Only for a speed the
  -- organization has no rule for in any scope or state: its own setup always wins,
  -- including a rule it switched off. ECONOMY is a business choice, so it is not seeded.
  WITH created AS (
    INSERT INTO org_speed_price_rules_cf (
      tenant_org_id, service_speed, speed_price_type, multiplier_speed,
      turnaround_unit, turnaround_hh_speed, turnaround_days_speed,
      effective_from, created_by, created_info
    )
    SELECT
      p_tenant_org_id, s.speed, 'MULTIPLIER', s.multiplier,
      s.unit, s.hours, s.days,
      CURRENT_DATE, 'system_seed', 'Sample rule from seed_product_speed_rules (0720)'
    FROM (VALUES
      ('NEXT_DAY', 0.25::numeric, 'WORKING_DAYS', NULL::numeric, 1::smallint),
      ('EXPRESS',  0.50::numeric, 'WORKING_DAYS', NULL::numeric, 0::smallint),
      ('URGENT',   1.00::numeric, 'HOURS',        3::numeric,    NULL::smallint)
    ) AS s(speed, multiplier, unit, hours, days)
    WHERE NOT EXISTS (
      SELECT 1 FROM org_speed_price_rules_cf r
      WHERE r.tenant_org_id = p_tenant_org_id
        AND r.service_speed = s.speed
    )
    ON CONFLICT ON CONSTRAINT uq_org_spd_price_rules_scope DO NOTHING
    RETURNING id, tenant_org_id, speed_price_type, multiplier_speed, effective_from, effective_to
  )
  INSERT INTO org_price_history_audit (
    tenant_org_id, entity_type, entity_id, product_id, old_price, new_price,
    change_reason, effective_from, effective_to, created_by, created_info
  )
  SELECT
    c.tenant_org_id, 'speed_rule', c.id, NULL, NULL, c.multiplier_speed,
    'CREATE: - -> ' || c.speed_price_type,
    c.effective_from, c.effective_to,
    NULL, 'Catalog seed (seed_product_speed_rules, 0720)'
  FROM created c;

  GET DIAGNOSTICS v_samples = ROW_COUNT;
  RETURN v_created + v_samples;
END;
$function$
;"
"CREATE OR REPLACE FUNCTION public.seed_tenant_erp_lite_defaults(p_tenant_id uuid)
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_total_inserted INTEGER := 0;
  v_accounts_inserted INTEGER := 0;
  v_maps_inserted INTEGER := 0;
  v_periods_inserted INTEGER := 0;
  v_cashboxes_inserted INTEGER := 0;
  v_last_inserted INTEGER := 0;
  v_base_year INTEGER;
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

  -- ----------------------------------------------------------------
  -- 1. Seed hierarchical tenant chart of accounts
  -- ----------------------------------------------------------------
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
    t.acc_type_id,
    g.acc_group_id,
    seed.account_code,
    seed.name,
    seed.name2,
    seed.description,
    seed.description2,
    false,
    false,
    false,
    false,
    'system_seed',
    'Migration 0197 - ERP-Lite default account headers',
    1,
    seed.rec_order,
    true
  FROM (
    VALUES
      ('1000', 'ASSET', 'ASSET_CURRENT', 'Current Assets', 'الأصول المتداولة', 'Default ERP-Lite header for current assets.', 'رأس افتراضي ERP-Lite للأصول المتداولة.', 1000),
      ('2000', 'LIABILITY', 'LIAB_CURRENT', 'Current Liabilities', 'الالتزامات المتداولة', 'Default ERP-Lite header for current liabilities.', 'رأس افتراضي ERP-Lite للالتزامات المتداولة.', 2000),
      ('3000', 'EQUITY', NULL, 'Equity', 'حقوق الملكية', 'Default ERP-Lite equity header.', 'رأس افتراضي ERP-Lite لحقوق الملكية.', 3000),
      ('4000', 'REVENUE', 'REV_OPERATING', 'Operating Revenue', 'الإيرادات التشغيلية', 'Default ERP-Lite header for operating revenue.', 'رأس افتراضي ERP-Lite للإيرادات التشغيلية.', 4000),
      ('5000', 'EXPENSE', 'EXP_OPERATING', 'Operating Expenses', 'المصروفات التشغيلية', 'Default ERP-Lite header for operating expenses.', 'رأس افتراضي ERP-Lite للمصروفات التشغيلية.', 5000)
  ) AS seed(account_code, acc_type_code, acc_group_code, name, name2, description, description2, rec_order)
  JOIN public.sys_fin_acc_type_cd t
    ON t.acc_type_code = seed.acc_type_code
   AND t.is_active = true
   AND t.rec_status = 1
  LEFT JOIN public.sys_fin_acc_group_cd g
    ON g.acc_group_code = seed.acc_group_code
   AND g.is_active = true
   AND g.rec_status = 1
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.org_fin_acct_mst a
    WHERE a.tenant_org_id = p_tenant_id
      AND a.account_code = seed.account_code
  );

  GET DIAGNOSTICS v_accounts_inserted = ROW_COUNT;
  v_total_inserted := v_total_inserted + v_accounts_inserted;

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
    t.acc_type_id,
    g.acc_group_id,
    seed.account_code,
    seed.name,
    seed.name2,
    seed.description,
    seed.description2,
    seed.is_postable,
    seed.is_control_account,
    seed.is_system_linked,
    seed.manual_post_allowed,
    'system_seed',
    'Migration 0197 - ERP-Lite default accounts',
    1,
    seed.rec_order,
    true
  FROM (
    VALUES
      ('1100', '1000', 'ASSET', 'ASSET_RECEIVABLE', 'Accounts Receivable', 'الذمم المدينة', 'Default ERP-Lite receivable control account.', 'حساب رقابي افتراضي ERP-Lite للذمم المدينة.', true, true, true, false, 1100),
      ('1110', '1000', 'ASSET', 'ASSET_CASH_BANK', 'Cash Main', 'الصندوق الرئيسي', 'Default ERP-Lite main cash account.', 'حساب الصندوق الرئيسي الافتراضي لـ ERP-Lite.', true, false, true, false, 1110),
      ('1120', '1000', 'ASSET', 'ASSET_CASH_BANK', 'Bank Card Clearing', 'تسوية بطاقات البنك', 'Default ERP-Lite card settlement clearing account.', 'حساب افتراضي لتسوية بطاقات البنك في ERP-Lite.', true, false, true, false, 1120),
      ('1130', '1000', 'ASSET', 'ASSET_CASH_BANK', 'Petty Cash Main', 'العهدة النقدية الرئيسية', 'Default ERP-Lite petty cash account.', 'حساب العهدة النقدية الافتراضي لـ ERP-Lite.', true, false, true, false, 1130),
      ('1140', '1000', 'ASSET', 'ASSET_TAX_INPUT', 'Input VAT Recoverable', 'ضريبة المدخلات القابلة للاسترداد', 'Default ERP-Lite recoverable input VAT account.', 'حساب افتراضي ERP-Lite لضريبة المدخلات القابلة للاسترداد.', true, false, true, false, 1140),
      ('1150', '1000', 'ASSET', 'ASSET_CASH_BANK', 'Bank Main Operating', 'البنك التشغيلي الرئيسي', 'Default operating bank asset account for AP and treasury flows.', 'حساب أصل بنكي تشغيلي افتراضي لتدفقات الخزينة والدائنين.', true, false, false, true, 1150),
      ('1160', '1000', 'ASSET', 'ASSET_CURRENT', 'Prepaid Expenses', 'مصروفات مقدمة', 'Default prepaid expense asset account.', 'حساب أصل افتراضي للمصروفات المقدمة.', true, false, false, true, 1160),
      ('2100', '2000', 'LIABILITY', 'LIAB_TAX_OUTPUT', 'Output VAT Payable', 'ضريبة المخرجات المستحقة', 'Default ERP-Lite output VAT payable account.', 'حساب افتراضي ERP-Lite لضريبة المخرجات المستحقة.', true, false, true, false, 2100),
      ('2110', '2000', 'LIABILITY', 'LIAB_CURRENT', 'Wallet Clearing', 'تسوية المحفظة', 'Default customer wallet clearing liability account.', 'حساب التزام افتراضي لتسوية محفظة العميل.', true, false, true, false, 2110),
      ('2120', '2000', 'LIABILITY', 'LIAB_CURRENT', 'Refund Payable', 'استردادات مستحقة', 'Default refund payable liability account.', 'حساب التزام افتراضي للاستردادات المستحقة.', true, false, true, false, 2120),
      ('2130', '2000', 'LIABILITY', 'LIAB_CURRENT', 'Accounts Payable Control', 'الذمم الدائنة الرقابية', 'Default ERP-Lite AP control account for v2 readiness.', 'حساب رقابي افتراضي ERP-Lite للذمم الدائنة استعداداً للمرحلة الثانية.', true, true, false, true, 2130),
      ('2140', '2000', 'LIABILITY', 'LIAB_CURRENT', 'Customer Advances', 'دفعات العملاء المقدمة', 'Default liability account for customer advances and deposits.', 'حساب التزام افتراضي لدفعات العملاء المقدمة والودائع.', true, false, false, true, 2140),
      ('3100', '3000', 'EQUITY', NULL, 'Owner Capital', 'رأس المال', 'Default owner capital equity account.', 'حساب حقوق ملكية افتراضي لرأس المال.', true, false, false, true, 3100),
      ('3200', '3000', 'EQUITY', NULL, 'Retained Earnings', 'الأرباح المحتجزة', 'Default retained earnings equity account.', 'حساب حقوق ملكية افتراضي للأرباح المحتجزة.', true, false, false, true, 3200),
      ('4100', '4000', 'REVENUE', 'REV_OPERATING', 'Laundry Service Revenue', 'إيراد خدمات المغسلة', 'Default ERP-Lite primary sales revenue account.', 'حساب الإيراد الأساسي الافتراضي لـ ERP-Lite لخدمات المغسلة.', true, false, true, false, 4100),
      ('4110', '4000', 'REVENUE', 'REV_OPERATING', 'Delivery Revenue', 'إيراد التوصيل', 'Default delivery revenue account for v2 readiness.', 'حساب إيراد افتراضي للتوصيل استعداداً للمرحلة الثانية.', true, false, false, true, 4110),
      ('4120', '4000', 'REVENUE', 'REV_OPERATING', 'Service Fee Revenue', 'إيراد رسوم الخدمة', 'Default service fee revenue account for future packages.', 'حساب إيراد افتراضي لرسوم الخدمة للحزم المستقبلية.', true, false, false, true, 4120),
      ('4130', '4000', 'REVENUE', 'REV_OPERATING', 'Subscription Revenue', 'إيراد الاشتراكات', 'Default subscription revenue account for v3 readiness.', 'حساب إيراد افتراضي للاشتراكات استعداداً للمرحلة الثالثة.', true, false, false, true, 4130),
      ('4140', '4000', 'REVENUE', 'REV_OPERATING', 'Rounding Gain', 'ربح فروقات التقريب', 'Default rounding gain revenue account.', 'حساب إيراد افتراضي لأرباح فروقات التقريب.', true, false, false, true, 4140),
      ('5100', '5000', 'EXPENSE', 'EXP_OPERATING', 'General Operating Expense', 'مصروف تشغيلي عام', 'Default ERP-Lite general expense account.', 'حساب مصروف افتراضي ERP-Lite للمصروفات التشغيلية العامة.', true, false, true, false, 5100),
      ('5110', '5000', 'EXPENSE', 'EXP_OPERATING', 'Petty Cash Expense', 'مصروف العهدة النقدية', 'Default petty cash expense account.', 'حساب مصروف افتراضي لمصروفات العهدة النقدية.', true, false, true, false, 5110),
      ('5120', '5000', 'EXPENSE', 'EXP_OPERATING', 'Discount Expense', 'مصروف الخصومات', 'Default discount expense account for v2 readiness.', 'حساب مصروف افتراضي للخصومات استعداداً للمرحلة الثانية.', true, false, false, true, 5120),
      ('5130', '5000', 'EXPENSE', 'EXP_OPERATING', 'Cost of Sales', 'تكلفة المبيعات', 'Default cost-of-sales account for v3 readiness.', 'حساب مصروف افتراضي لتكلفة المبيعات استعداداً للمرحلة الثالثة.', true, false, false, true, 5130),
      ('5140', '5000', 'EXPENSE', 'EXP_OPERATING', 'Rounding Loss', 'خسارة فروقات التقريب', 'Default rounding loss expense account.', 'حساب مصروف افتراضي لخسائر فروقات التقريب.', true, false, false, true, 5140)
  ) AS seed(account_code, parent_code, acc_type_code, acc_group_code, name, name2, description, description2, is_postable, is_control_account, is_system_linked, manual_post_allowed, rec_order)
  JOIN public.org_fin_acct_mst parent
    ON parent.tenant_org_id = p_tenant_id
   AND parent.account_code = seed.parent_code
   AND parent.is_active = true
   AND parent.rec_status = 1
  JOIN public.sys_fin_acc_type_cd t
    ON t.acc_type_code = seed.acc_type_code
   AND t.is_active = true
   AND t.rec_status = 1
  LEFT JOIN public.sys_fin_acc_group_cd g
    ON g.acc_group_code = seed.acc_group_code
   AND g.is_active = true
   AND g.rec_status = 1
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.org_fin_acct_mst a
    WHERE a.tenant_org_id = p_tenant_id
      AND a.account_code = seed.account_code
  );

  GET DIAGNOSTICS v_last_inserted = ROW_COUNT;
  v_accounts_inserted := v_accounts_inserted + v_last_inserted;
  v_total_inserted := v_total_inserted + v_last_inserted;

  -- ----------------------------------------------------------------
  -- 2. Seed active usage mappings where no active global mapping exists
  -- ----------------------------------------------------------------
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
    uc.usage_code_id,
    acct.id,
    'ACTIVE',
    CURRENT_DATE,
    'system_seed',
    'Migration 0197 - ERP-Lite default usage mappings',
    1,
    seed.rec_order,
    true
  FROM (
    VALUES
      ('SALES_REVENUE', '4100', 10),
      ('VAT_OUTPUT', '2100', 20),
      ('VAT_INPUT', '1140', 30),
      ('ACCOUNTS_RECEIVABLE', '1100', 40),
      ('CASH_MAIN', '1110', 50),
      ('BANK_CARD_CLEARING', '1120', 60),
      ('PETTY_CASH_MAIN', '1130', 70),
      ('WALLET_CLEARING', '2110', 80),
      ('REFUND_PAYABLE', '2120', 90),
      ('EXPENSE_GENERAL', '5100', 100),
      ('PETTY_CASH_EXPENSE', '5110', 110),
      ('ROUNDING_ADJUSTMENT', '5140', 120)
  ) AS seed(usage_code, account_code, rec_order)
  JOIN public.sys_fin_usage_code_cd uc
    ON uc.usage_code = seed.usage_code
   AND uc.is_active = true
   AND uc.rec_status = 1
  JOIN public.org_fin_acct_mst acct
    ON acct.tenant_org_id = p_tenant_id
   AND acct.account_code = seed.account_code
   AND acct.is_active = true
   AND acct.rec_status = 1
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.org_fin_usage_map_mst m
    WHERE m.tenant_org_id = p_tenant_id
      AND m.branch_id IS NULL
      AND m.usage_code_id = uc.usage_code_id
      AND m.status_code = 'ACTIVE'
      AND m.is_active = true
      AND m.rec_status = 1
  );

  GET DIAGNOSTICS v_maps_inserted = ROW_COUNT;
  v_total_inserted := v_total_inserted + v_maps_inserted;

  -- ----------------------------------------------------------------
  -- 3. Seed current and next-year accounting periods
  -- ----------------------------------------------------------------
  v_base_year := EXTRACT(YEAR FROM CURRENT_DATE)::INTEGER;

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
    TO_CHAR(gs.period_start, 'YYYY-MM') AS period_code,
    TO_CHAR(gs.period_start, 'Mon YYYY') AS name,
    TO_CHAR(gs.period_start, 'YYYY/MM') AS name2,
    'Default ERP-Lite accounting period',
    'فترة محاسبية افتراضية لـ ERP-Lite',
    gs.period_start,
    (gs.period_start + INTERVAL '1 month - 1 day')::date,
    'OPEN',
    'system_seed',
    'Migration 0197 - ERP-Lite default periods',
    1,
    ROW_NUMBER() OVER (ORDER BY gs.period_start),
    true
  FROM generate_series(
    make_date(v_base_year, 1, 1),
    make_date(v_base_year + 1, 12, 1),
    INTERVAL '1 month'
  ) AS gs(period_start)
  ON CONFLICT (tenant_org_id, period_code) DO NOTHING;

  GET DIAGNOSTICS v_periods_inserted = ROW_COUNT;
  v_total_inserted := v_total_inserted + v_periods_inserted;

  -- ----------------------------------------------------------------
  -- 4. Seed a default petty-cash cashbox when currency is known
  -- ----------------------------------------------------------------
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
    acct.id,
    'PETTY-MAIN',
    'Main Petty Cash',
    'العهدة النقدية الرئيسية',
    'Default ERP-Lite petty cash box linked to the main petty cash account.',
    'صندوق عهدة نقدية افتراضي ERP-Lite مرتبط بحساب العهدة النقدية الرئيسي.',
    t.currency,
    CURRENT_DATE,
    0,
    true,
    'system_seed',
    'Migration 0197 - ERP-Lite default petty cash box',
    1,
    10,
    true
  FROM public.org_tenants_mst t
  JOIN public.org_fin_acct_mst acct
    ON acct.tenant_org_id = t.id
   AND acct.account_code = '1130'
   AND acct.is_active = true
   AND acct.rec_status = 1
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

  GET DIAGNOSTICS v_cashboxes_inserted = ROW_COUNT;
  v_total_inserted := v_total_inserted + v_cashboxes_inserted;

  RETURN v_total_inserted;
END;
$function$
;"
"CREATE OR REPLACE FUNCTION public.sys_bill_generate_invoice_number()
 RETURNS character varying
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  next_num INTEGER;
  invoice_num VARCHAR;
BEGIN
  next_num := nextval('seq_invoice_number');
  invoice_num := 'INV-' || TO_CHAR(CURRENT_DATE, 'YYYY') || '-' || LPAD(next_num::TEXT, 6, '0');
  RETURN invoice_num;
END;
$function$
;"
"CREATE OR REPLACE FUNCTION public.sys_bill_update_invoice_amount_due()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
BEGIN
  NEW.amount_due = NEW.total - NEW.amount_paid;

  -- Update status based on amount_due
  IF NEW.amount_due <= 0 THEN
    NEW.status = 'paid';
    NEW.paid_at = CURRENT_TIMESTAMP;
  ELSIF NEW.due_date < CURRENT_DATE AND NEW.amount_due > 0 THEN
    NEW.status = 'overdue';
  END IF;

  RETURN NEW;
END;
$function$
;"
"CREATE OR REPLACE VIEW public.vw_fin_coa_explorer AS
 WITH RECURSIVE account_path AS (
         SELECT a_1.id,
            a_1.tenant_org_id,
            (a_1.name)::text AS path_str,
            (COALESCE(a_1.name2, a_1.name))::text AS path_str2
           FROM org_fin_acct_mst a_1
          WHERE ((a_1.parent_account_id IS NULL) AND (a_1.rec_status = 1))
        UNION ALL
         SELECT c.id,
            c.tenant_org_id,
            ((p.path_str || ' > '::text) || (c.name)::text) AS path_str,
            ((p.path_str2 || ' > '::text) || (COALESCE(c.name2, c.name))::text) AS path_str2
           FROM (org_fin_acct_mst c
             JOIN account_path p ON (((p.id = c.parent_account_id) AND (p.tenant_org_id = c.tenant_org_id))))
          WHERE (c.rec_status = 1)
        ), usage_map_counts AS (
         SELECT org_fin_usage_map_mst.tenant_org_id,
            org_fin_usage_map_mst.account_id,
            count(*) AS active_usage_map_count
           FROM org_fin_usage_map_mst
          WHERE (((org_fin_usage_map_mst.status_code)::text = 'ACTIVE'::text) AND (org_fin_usage_map_mst.is_active = true) AND (org_fin_usage_map_mst.rec_status = 1) AND ((org_fin_usage_map_mst.effective_from IS NULL) OR (org_fin_usage_map_mst.effective_from <= CURRENT_DATE)) AND ((org_fin_usage_map_mst.effective_to IS NULL) OR (org_fin_usage_map_mst.effective_to >= CURRENT_DATE)))
          GROUP BY org_fin_usage_map_mst.tenant_org_id, org_fin_usage_map_mst.account_id
        )
 SELECT a.id AS account_id,
    a.tenant_org_id,
    a.account_code,
    a.name,
    a.name2,
    a.description,
    a.description2,
    a.parent_account_id,
    pa.account_code AS parent_account_code,
    pa.name AS parent_account_name,
    pa.name2 AS parent_account_name2,
    COALESCE((a.account_level)::integer, 0) AS account_level,
    ap.path_str AS full_path,
    ap.path_str2 AS full_path2,
    a.acc_type_id,
    at.acc_type_code,
    at.name AS acc_type_name,
    at.name2 AS acc_type_name2,
    at.normal_balance AS normal_balance_side,
    a.acc_group_id,
    ag.name AS acc_group_name,
    ag.name2 AS acc_group_name2,
    a.is_postable,
    a.is_control_account,
    a.is_system_linked,
    a.manual_post_allowed,
    COALESCE(a.is_system_seeded, false) AS is_system_seeded,
    COALESCE(a.is_locked, false) AS is_locked,
    COALESCE(a.allow_tenant_children, true) AS allow_tenant_children,
    a.effective_from,
    a.effective_to,
        CASE
            WHEN ((a.is_active = false) OR (a.rec_status <> 1)) THEN 'INACTIVE'::text
            WHEN (COALESCE(a.is_locked, false) = true) THEN 'SYSTEM_LOCKED'::text
            WHEN (a.is_postable = false) THEN 'NOT_POSTABLE'::text
            WHEN ((a.effective_to IS NOT NULL) AND (a.effective_to < CURRENT_DATE)) THEN 'EXPIRED'::text
            ELSE 'ACTIVE'::text
        END AS account_status,
    COALESCE(umc.active_usage_map_count, (0)::bigint) AS active_usage_map_count,
    a.source_tpl_pkg_id,
    a.source_tpl_line_id,
    a.is_active,
    a.rec_status,
    a.created_at,
    a.created_by,
    a.updated_at,
    a.updated_by
   FROM (((((org_fin_acct_mst a
     LEFT JOIN sys_fin_acc_type_cd at ON ((at.acc_type_id = a.acc_type_id)))
     LEFT JOIN sys_fin_acc_group_cd ag ON ((ag.acc_group_id = a.acc_group_id)))
     LEFT JOIN org_fin_acct_mst pa ON (((pa.id = a.parent_account_id) AND (pa.tenant_org_id = a.tenant_org_id))))
     LEFT JOIN account_path ap ON (((ap.id = a.id) AND (ap.tenant_org_id = a.tenant_org_id))))
     LEFT JOIN usage_map_counts umc ON (((umc.account_id = a.id) AND (umc.tenant_org_id = a.tenant_org_id))))
  WHERE (a.rec_status = 1);"
"CREATE OR REPLACE VIEW public.vw_fin_missing_required_usage WITH (security_invoker=true) AS
 SELECT t.id AS tenant_org_id,
    uc.usage_code_id,
    uc.usage_code,
    uc.name AS usage_code_name,
    uc.name2 AS usage_code_name2,
    uc.is_required_v1 AS is_required,
    at.acc_type_code AS required_acc_type_code,
    at.name AS required_acc_type_name,
    m.id AS mapping_id,
    m.account_id AS mapped_account_id,
    a.account_code AS mapped_account_code,
    a.name AS mapped_account_name,
    a_type.acc_type_code AS mapped_acc_type_code,
        CASE
            WHEN (m.id IS NULL) THEN 'MISSING'::text
            WHEN (a.is_active = false) THEN 'ACCOUNT_INACTIVE'::text
            WHEN (a.is_postable = false) THEN 'ACCOUNT_NOT_POSTABLE'::text
            WHEN (a.acc_type_id <> uc.primary_acc_type_id) THEN 'TYPE_MISMATCH'::text
            ELSE 'OK'::text
        END AS mapping_issue,
    m.effective_from,
    m.effective_to,
    m.status_code AS mapping_status
   FROM (((((org_tenants_mst t
     CROSS JOIN sys_fin_usage_code_cd uc)
     LEFT JOIN sys_fin_acc_type_cd at ON ((at.acc_type_id = uc.primary_acc_type_id)))
     LEFT JOIN org_fin_usage_map_mst m ON (((m.tenant_org_id = t.id) AND (m.usage_code_id = uc.usage_code_id) AND (m.branch_id IS NULL) AND ((m.status_code)::text = 'ACTIVE'::text) AND (m.is_active = true) AND (m.rec_status = 1) AND ((m.effective_from IS NULL) OR (m.effective_from <= CURRENT_DATE)) AND ((m.effective_to IS NULL) OR (m.effective_to >= CURRENT_DATE)))))
     LEFT JOIN org_fin_acct_mst a ON (((a.id = m.account_id) AND (a.tenant_org_id = t.id))))
     LEFT JOIN sys_fin_acc_type_cd a_type ON ((a_type.acc_type_id = a.acc_type_id)))
  WHERE ((t.is_active = true) AND (t.rec_status = 1) AND (uc.is_required_v1 = true));"