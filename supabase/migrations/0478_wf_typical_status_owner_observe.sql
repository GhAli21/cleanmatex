-- ============================================================
-- Migration: 0478_wf_typical_status_owner_observe.sql
-- Purpose:   Check policy requires one Owner per live status. 0472/0475
--            seeded a second Owner so Cancel, Hold, and public OFD confirm
--            could execute. Demote those extras to Observer and keep the
--            named observer-execute exceptions in the shared reporter.
-- Affected:  sys_wf_prof_ver_live_rpt, sys_wf_prof_ver_validate_live,
--            sys_wf_prof_ver_mod_st_cf, sys_wf_profile_ver_mst
-- Related:   0472, 0475, 0477, ADR-SAAS-MNG-0010
-- ============================================================
-- Typical owners kept: new_order owns intake, processing owns processing,
-- driver_delivery owns out_for_delivery. Canceling, order_control, and
-- public_tracking observe those statuses and keep their commands.
-- Published rows are repaired with the 0472 session bypass; policy_revision
-- is bumped so Published resolver cache keys move. Do not edit 0472–0477.
-- ROLLBACK PLAN: restore visibility_mode = 'owner' on the three demoted
-- memberships and revert live_rpt to the 0477 exception set.

BEGIN;

-- Shared reporter stays the write-lock authority. HQ Check policy maps rows.
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
  -- Named observer-execute exceptions: pickup CONFIRM_PICKUP from observed
  -- ready; public CONFIRM_DELIVERY from observed OFD; canceling CANCEL_ORDER
  -- from observed intake; order_control HOLD_ORDER_WORK from observed
  -- processing. Workboard module_mode=observer still cannot execute.
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
    AND NOT (
      executable.screen_key = 'canceling'
      AND executable.action_code = 'CANCEL_ORDER'
      AND executable.from_status = 'intake'
      AND executable.to_status = 'cancelled'
      AND EXISTS (
        SELECT 1
        FROM public.sys_wf_prof_ver_module_cf AS cancel_module
        INNER JOIN public.sys_wf_prof_ver_mod_st_cf AS intake_observe
          ON intake_observe.version_id = cancel_module.version_id
         AND intake_observe.screen_key = cancel_module.screen_key
        INNER JOIN public.sys_wf_prof_ver_module_cf AS intake_owner
          ON intake_owner.version_id = cancel_module.version_id
        INNER JOIN public.sys_wf_prof_ver_mod_st_cf AS intake_owned
          ON intake_owned.version_id = intake_owner.version_id
         AND intake_owned.screen_key = intake_owner.screen_key
        WHERE cancel_module.version_id = executable.version_id
          AND cancel_module.screen_key = 'canceling'
          AND cancel_module.module_mode = 'primary_owner'
          AND cancel_module.is_enabled = true
          AND cancel_module.is_active = true
          AND cancel_module.rec_status = 1
          AND intake_observe.status_code = 'intake'
          AND intake_observe.visibility_mode = 'observer'
          AND intake_observe.is_active = true
          AND intake_observe.rec_status = 1
          AND intake_owner.screen_key = 'new_order'
          AND intake_owner.module_mode = 'primary_owner'
          AND intake_owner.is_enabled = true
          AND intake_owner.is_active = true
          AND intake_owner.rec_status = 1
          AND intake_owned.status_code = 'intake'
          AND intake_owned.visibility_mode = 'owner'
          AND intake_owned.is_active = true
          AND intake_owned.rec_status = 1
      )
    )
    AND NOT (
      executable.screen_key = 'order_control'
      AND executable.action_code = 'HOLD_ORDER_WORK'
      AND executable.from_status = 'processing'
      AND executable.to_status = 'on_hold'
      AND EXISTS (
        SELECT 1
        FROM public.sys_wf_prof_ver_module_cf AS control_module
        INNER JOIN public.sys_wf_prof_ver_mod_st_cf AS processing_observe
          ON processing_observe.version_id = control_module.version_id
         AND processing_observe.screen_key = control_module.screen_key
        INNER JOIN public.sys_wf_prof_ver_module_cf AS processing_owner
          ON processing_owner.version_id = control_module.version_id
        INNER JOIN public.sys_wf_prof_ver_mod_st_cf AS processing_owned
          ON processing_owned.version_id = processing_owner.version_id
         AND processing_owned.screen_key = processing_owner.screen_key
        WHERE control_module.version_id = executable.version_id
          AND control_module.screen_key = 'order_control'
          AND control_module.module_mode = 'primary_owner'
          AND control_module.is_enabled = true
          AND control_module.is_active = true
          AND control_module.rec_status = 1
          AND processing_observe.status_code = 'processing'
          AND processing_observe.visibility_mode = 'observer'
          AND processing_observe.is_active = true
          AND processing_observe.rec_status = 1
          AND processing_owner.screen_key = 'processing'
          AND processing_owner.module_mode = 'primary_owner'
          AND processing_owner.is_enabled = true
          AND processing_owner.is_active = true
          AND processing_owner.rec_status = 1
          AND processing_owned.status_code = 'processing'
          AND processing_owned.visibility_mode = 'owner'
          AND processing_owned.is_active = true
          AND processing_owned.rec_status = 1
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
  'Structural completeness report for one profile version. Returns catalog issue_code rows with locators and no EN/AR. HQ Check policy maps the rows; sys_wf_prof_ver_validate_live fails closed when any row exists. Observer-execute exceptions: pickup CONFIRM_PICKUP, public OFD CONFIRM_DELIVERY, canceling CANCEL_ORDER from observed intake, order_control HOLD_ORDER_WORK from observed processing. Not a runtime policy resolver.';

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

-- cfg_guard blocks Published/Retired edits. Same bypass 0472 uses for seed.
SELECT set_config('cmx.semantic_policy_command', '1', true);

CREATE TEMP TABLE wf_0478_touched (
  version_id UUID PRIMARY KEY
);

WITH repaired AS (
  UPDATE public.sys_wf_prof_ver_mod_st_cf AS extra
  SET
    visibility_mode = 'observer',
    updated_at = CURRENT_TIMESTAMP,
    updated_info = '0478_typical_owner'
  WHERE extra.screen_key = 'canceling'
    AND extra.status_code = 'intake'
    AND extra.visibility_mode = 'owner'
    AND extra.is_active = true
    AND extra.rec_status = 1
    AND EXISTS (
      SELECT 1
      FROM public.sys_wf_prof_ver_mod_st_cf AS typical
      INNER JOIN public.sys_wf_prof_ver_module_cf AS typical_module
        ON typical_module.version_id = typical.version_id
       AND typical_module.screen_key = typical.screen_key
      WHERE typical.version_id = extra.version_id
        AND typical.screen_key = 'new_order'
        AND typical.status_code = 'intake'
        AND typical.visibility_mode = 'owner'
        AND typical.is_active = true
        AND typical.rec_status = 1
        AND typical_module.module_mode = 'primary_owner'
        AND typical_module.is_enabled = true
        AND typical_module.is_active = true
        AND typical_module.rec_status = 1
    )
  RETURNING extra.version_id
)
INSERT INTO wf_0478_touched (version_id)
SELECT DISTINCT repaired.version_id
FROM repaired
ON CONFLICT (version_id) DO NOTHING;

WITH repaired AS (
  UPDATE public.sys_wf_prof_ver_mod_st_cf AS extra
  SET
    visibility_mode = 'observer',
    updated_at = CURRENT_TIMESTAMP,
    updated_info = '0478_typical_owner'
  WHERE extra.screen_key = 'order_control'
    AND extra.status_code = 'processing'
    AND extra.visibility_mode = 'owner'
    AND extra.is_active = true
    AND extra.rec_status = 1
    AND EXISTS (
      SELECT 1
      FROM public.sys_wf_prof_ver_mod_st_cf AS typical
      INNER JOIN public.sys_wf_prof_ver_module_cf AS typical_module
        ON typical_module.version_id = typical.version_id
       AND typical_module.screen_key = typical.screen_key
      WHERE typical.version_id = extra.version_id
        AND typical.screen_key = 'processing'
        AND typical.status_code = 'processing'
        AND typical.visibility_mode = 'owner'
        AND typical.is_active = true
        AND typical.rec_status = 1
        AND typical_module.module_mode = 'primary_owner'
        AND typical_module.is_enabled = true
        AND typical_module.is_active = true
        AND typical_module.rec_status = 1
    )
  RETURNING extra.version_id
)
INSERT INTO wf_0478_touched (version_id)
SELECT DISTINCT repaired.version_id
FROM repaired
ON CONFLICT (version_id) DO NOTHING;

WITH repaired AS (
  UPDATE public.sys_wf_prof_ver_mod_st_cf AS extra
  SET
    visibility_mode = 'observer',
    updated_at = CURRENT_TIMESTAMP,
    updated_info = '0478_typical_owner'
  WHERE extra.screen_key = 'public_tracking'
    AND extra.status_code = 'out_for_delivery'
    AND extra.visibility_mode = 'owner'
    AND extra.is_active = true
    AND extra.rec_status = 1
    AND EXISTS (
      SELECT 1
      FROM public.sys_wf_prof_ver_mod_st_cf AS typical
      INNER JOIN public.sys_wf_prof_ver_module_cf AS typical_module
        ON typical_module.version_id = typical.version_id
       AND typical_module.screen_key = typical.screen_key
      WHERE typical.version_id = extra.version_id
        AND typical.screen_key = 'driver_delivery'
        AND typical.status_code = 'out_for_delivery'
        AND typical.visibility_mode = 'owner'
        AND typical.is_active = true
        AND typical.rec_status = 1
        AND typical_module.module_mode = 'primary_owner'
        AND typical_module.is_enabled = true
        AND typical_module.is_active = true
        AND typical_module.rec_status = 1
    )
  RETURNING extra.version_id
)
INSERT INTO wf_0478_touched (version_id)
SELECT DISTINCT repaired.version_id
FROM repaired
ON CONFLICT (version_id) DO NOTHING;

-- Published immutability trigger would block the cache-key bump.
ALTER TABLE public.sys_wf_profile_ver_mst DISABLE TRIGGER trg_sys_wf_prof_ver_immut;

UPDATE public.sys_wf_profile_ver_mst AS version_row
SET
  policy_revision = version_row.policy_revision + 1,
  updated_at = CURRENT_TIMESTAMP
WHERE version_row.version_id IN (
  SELECT touched.version_id FROM wf_0478_touched AS touched
);

ALTER TABLE public.sys_wf_profile_ver_mst ENABLE TRIGGER trg_sys_wf_prof_ver_immut;

COMMIT;
