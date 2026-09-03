-- ============================================================
-- Migration: 0477_wf_live_structural_report.sql
-- Purpose:   Check policy and the Pilot/Publish/assign write lock share one
--            structural report of catalog codes, so Studio can list every miss
--            instead of the trigger stopping on the first RAISE.
-- Affected:  sys_wf_prof_ver_live_rpt, sys_wf_prof_ver_validate_live
-- Related:   0470, 0476, ADR-SAAS-MNG-0010, LIVE_NORMALIZED_PROFILE_RUNTIME.md
-- ============================================================

BEGIN;

-- Returns every structural miss as catalog codes. HQ Check policy maps rows
-- through the typed catalog (EN/AR, tab, Auto Fix). The write trigger only
-- fails closed when this set is non-empty. Not a second Check-policy engine.
CREATE OR REPLACE FUNCTION public.sys_wf_prof_ver_live_rpt(
  p_version_id UUID
)
RETURNS TABLE (
  issue_code TEXT,
  issue_path TEXT,
  exec_id UUID,
  screen_key TEXT,
  action_code TEXT,
  from_status TEXT,
  to_status TEXT,
  owner_screen TEXT,
  rule_code TEXT,
  init_status TEXT
)
LANGUAGE plpgsql
STABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Codes must match HQ WF_LIVE_STRUCTURAL_ISSUE_CODES exactly (DB-mirror).

  RETURN QUERY
  SELECT
    'profile_policy_missing'::TEXT,
    'policy'::TEXT,
    NULL::UUID,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.sys_wf_prof_ver_policy_cf
    WHERE version_id = p_version_id
      AND is_active = true
      AND rec_status = 1
  );

  RETURN QUERY
  SELECT
    'initial_rule_missing'::TEXT,
    'initial_rules'::TEXT,
    NULL::UUID,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.sys_wf_prof_ver_init_cf
    WHERE version_id = p_version_id
      AND is_active = true
      AND rec_status = 1
  );

  RETURN QUERY
  SELECT
    'profile_no_primary_owner_module'::TEXT,
    'modules'::TEXT,
    NULL::UUID,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT
  WHERE NOT EXISTS (
    SELECT 1
    FROM public.sys_wf_prof_ver_module_cf
    WHERE version_id = p_version_id
      AND module_mode = 'primary_owner'
      AND is_enabled = true
      AND is_active = true
      AND rec_status = 1
  );

  RETURN QUERY
  SELECT
    'execution_without_channel'::TEXT,
    'executions.' || executable.exec_id::TEXT,
    executable.exec_id,
    executable.screen_key,
    executable.action_code,
    executable.from_status,
    executable.to_status,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT
  FROM public.sys_wf_prof_ver_exec_cf AS executable
  WHERE executable.version_id = p_version_id
    AND executable.is_active = true
    AND executable.rec_status = 1
    AND NOT EXISTS (
      SELECT 1
      FROM public.sys_wf_prof_ver_exec_ch_cf AS channel
      WHERE channel.exec_id = executable.exec_id
        AND channel.is_active = true
        AND channel.rec_status = 1
    );

  RETURN QUERY
  SELECT
    'confirm_pickup_not_on_pickup_handover'::TEXT,
    'executions.' || executable.exec_id::TEXT,
    executable.exec_id,
    executable.screen_key,
    executable.action_code,
    executable.from_status,
    executable.to_status,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT
  FROM public.sys_wf_prof_ver_exec_cf AS executable
  WHERE executable.version_id = p_version_id
    AND executable.is_active = true
    AND executable.rec_status = 1
    AND executable.action_code = 'CONFIRM_PICKUP'
    AND executable.screen_key <> 'pickup_handover';

  -- Ordinary executables need owner visibility on the executing module.
  -- Named V1 observer-execute exceptions stay here so Check policy and the
  -- write lock cannot drift: pickup CONFIRM_PICKUP from observed ready, and
  -- public_tracking CONFIRM_DELIVERY from observed OFD on public_web while
  -- driver_delivery owns OFD.
  RETURN QUERY
  SELECT
    'execution_not_from_status_owner'::TEXT,
    'executions.' || executable.exec_id::TEXT,
    executable.exec_id,
    executable.screen_key,
    executable.action_code,
    executable.from_status,
    executable.to_status,
    (
      SELECT owner_module.screen_key
      FROM public.sys_wf_prof_ver_module_cf AS owner_module
      INNER JOIN public.sys_wf_prof_ver_mod_st_cf AS owned
        ON owned.version_id = owner_module.version_id
       AND owned.screen_key = owner_module.screen_key
      WHERE owner_module.version_id = executable.version_id
        AND owner_module.module_mode = 'primary_owner'
        AND owner_module.is_enabled = true
        AND owner_module.is_active = true
        AND owner_module.rec_status = 1
        AND owned.status_code = executable.from_status
        AND owned.visibility_mode = 'owner'
        AND owned.is_active = true
        AND owned.rec_status = 1
      ORDER BY owner_module.display_order
      LIMIT 1
    ),
    NULL::TEXT,
    NULL::TEXT
  FROM public.sys_wf_prof_ver_exec_cf AS executable
  WHERE executable.version_id = p_version_id
    AND executable.is_active = true
    AND executable.rec_status = 1
    AND NOT (
      executable.screen_key = 'pickup_handover'
      AND executable.action_code = 'CONFIRM_PICKUP'
      AND executable.from_status = 'ready'
      AND executable.to_status = 'delivered'
      AND EXISTS (
        SELECT 1
        FROM public.sys_wf_prof_ver_module_cf AS pickup_module
        INNER JOIN public.sys_wf_prof_ver_mod_st_cf AS ready_observe
          ON ready_observe.version_id = pickup_module.version_id
         AND ready_observe.screen_key = pickup_module.screen_key
        INNER JOIN public.sys_wf_prof_ver_module_cf AS ready_owner
          ON ready_owner.version_id = pickup_module.version_id
        INNER JOIN public.sys_wf_prof_ver_mod_st_cf AS ready_owned
          ON ready_owned.version_id = ready_owner.version_id
         AND ready_owned.screen_key = ready_owner.screen_key
        WHERE pickup_module.version_id = executable.version_id
          AND pickup_module.screen_key = 'pickup_handover'
          AND pickup_module.module_mode = 'primary_owner'
          AND pickup_module.is_enabled = true
          AND pickup_module.is_active = true
          AND pickup_module.rec_status = 1
          AND ready_observe.status_code = 'ready'
          AND ready_observe.visibility_mode = 'observer'
          AND ready_observe.is_active = true
          AND ready_observe.rec_status = 1
          AND ready_owner.screen_key = 'ready_release'
          AND ready_owner.module_mode = 'primary_owner'
          AND ready_owner.is_enabled = true
          AND ready_owner.is_active = true
          AND ready_owner.rec_status = 1
          AND ready_owned.status_code = 'ready'
          AND ready_owned.visibility_mode = 'owner'
          AND ready_owned.is_active = true
          AND ready_owned.rec_status = 1
      )
    )
    AND NOT (
      executable.screen_key = 'public_tracking'
      AND executable.action_code = 'CONFIRM_DELIVERY'
      AND executable.from_status = 'out_for_delivery'
      AND executable.to_status = 'delivered'
      AND EXISTS (
        SELECT 1
        FROM public.sys_wf_prof_ver_exec_ch_cf AS public_channel
        WHERE public_channel.exec_id = executable.exec_id
          AND public_channel.channel_code = 'public_web'
          AND public_channel.is_active = true
          AND public_channel.rec_status = 1
      )
      AND EXISTS (
        SELECT 1
        FROM public.sys_wf_prof_ver_module_cf AS tracking_module
        INNER JOIN public.sys_wf_prof_ver_mod_st_cf AS ofd_observe
          ON ofd_observe.version_id = tracking_module.version_id
         AND ofd_observe.screen_key = tracking_module.screen_key
        INNER JOIN public.sys_wf_prof_ver_module_cf AS delivery_owner
          ON delivery_owner.version_id = tracking_module.version_id
        INNER JOIN public.sys_wf_prof_ver_mod_st_cf AS ofd_owned
          ON ofd_owned.version_id = delivery_owner.version_id
         AND ofd_owned.screen_key = delivery_owner.screen_key
        WHERE tracking_module.version_id = executable.version_id
          AND tracking_module.screen_key = 'public_tracking'
          AND tracking_module.module_mode = 'cross_cutting_command'
          AND tracking_module.is_enabled = true
          AND tracking_module.is_active = true
          AND tracking_module.rec_status = 1
          AND ofd_observe.status_code = 'out_for_delivery'
          AND ofd_observe.visibility_mode = 'observer'
          AND ofd_observe.is_active = true
          AND ofd_observe.rec_status = 1
          AND delivery_owner.screen_key = 'driver_delivery'
          AND delivery_owner.module_mode = 'primary_owner'
          AND delivery_owner.is_enabled = true
          AND delivery_owner.is_active = true
          AND delivery_owner.rec_status = 1
          AND ofd_owned.status_code = 'out_for_delivery'
          AND ofd_owned.visibility_mode = 'owner'
          AND ofd_owned.is_active = true
          AND ofd_owned.rec_status = 1
      )
    )
    AND NOT EXISTS (
      SELECT 1
      FROM public.sys_wf_prof_ver_module_cf AS module_row
      INNER JOIN public.sys_wf_prof_ver_mod_st_cf AS membership
        ON membership.version_id = module_row.version_id
       AND membership.screen_key = module_row.screen_key
      WHERE module_row.version_id = executable.version_id
        AND module_row.screen_key = executable.screen_key
        AND module_row.module_mode <> 'observer'
        AND module_row.is_enabled = true
        AND module_row.is_active = true
        AND module_row.rec_status = 1
        AND membership.status_code = executable.from_status
        AND membership.visibility_mode = 'owner'
        AND membership.is_active = true
        AND membership.rec_status = 1
    );

  RETURN QUERY
  SELECT
    'initial_rule_status_without_owner'::TEXT,
    'initial_rules.' || initial_rule.rule_code,
    NULL::UUID,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    NULL::TEXT,
    initial_rule.rule_code,
    initial_rule.initial_status
  FROM public.sys_wf_prof_ver_init_cf AS initial_rule
  WHERE initial_rule.version_id = p_version_id
    AND initial_rule.is_active = true
    AND initial_rule.rec_status = 1
    AND NOT EXISTS (
      SELECT 1
      FROM public.sys_wf_prof_ver_module_cf AS module_row
      INNER JOIN public.sys_wf_prof_ver_mod_st_cf AS membership
        ON membership.version_id = module_row.version_id
       AND membership.screen_key = module_row.screen_key
      WHERE module_row.version_id = initial_rule.version_id
        AND module_row.module_mode = 'primary_owner'
        AND module_row.is_enabled = true
        AND module_row.is_active = true
        AND module_row.rec_status = 1
        AND membership.status_code = initial_rule.initial_status
        AND membership.visibility_mode = 'owner'
        AND membership.is_active = true
        AND membership.rec_status = 1
    );
END;
$$;

REVOKE ALL ON FUNCTION public.sys_wf_prof_ver_live_rpt(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sys_wf_prof_ver_live_rpt(UUID) TO service_role;

COMMENT ON FUNCTION public.sys_wf_prof_ver_live_rpt(UUID) IS
  'Structural completeness report for one profile version. Returns catalog issue_code rows with locators and no EN/AR. HQ Check policy maps the rows; sys_wf_prof_ver_validate_live fails closed when any row exists. Includes pickup and public OFD observer-execute exceptions. Not a runtime policy resolver.';

-- Write lock stays VOID + RAISE so existing triggers do not change shape.
-- It now fails with every distinct catalog code from the shared report.
CREATE OR REPLACE FUNCTION public.sys_wf_prof_ver_validate_live(
  p_version_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row RECORD;
  v_codes TEXT := '';
  v_detail TEXT := '';
  v_seen TEXT[] := ARRAY[]::TEXT[];
BEGIN
  FOR v_row IN
    SELECT issue_code, issue_path
    FROM public.sys_wf_prof_ver_live_rpt(p_version_id)
    ORDER BY issue_code, issue_path
  LOOP
    IF v_detail <> '' THEN
      v_detail := v_detail || '; ';
    END IF;
    v_detail := v_detail || v_row.issue_code || '@' || COALESCE(v_row.issue_path, '');

    IF NOT (v_row.issue_code = ANY (v_seen)) THEN
      v_seen := array_append(v_seen, v_row.issue_code);
      IF v_codes <> '' THEN
        v_codes := v_codes || ', ';
      END IF;
      v_codes := v_codes || v_row.issue_code;
    END IF;
  END LOOP;

  IF v_codes <> '' THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_validate_live: %',
      v_codes
      USING DETAIL = v_detail;
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.sys_wf_prof_ver_validate_live(UUID) FROM PUBLIC;

COMMENT ON FUNCTION public.sys_wf_prof_ver_validate_live(UUID) IS
  'Write-path fail-closed wrapper around sys_wf_prof_ver_live_rpt for Pilot, Published, and assigned versions. Raises P0001 with catalog codes when the shared report is non-empty. Not a runtime policy resolver or public RPC.';

COMMIT;
