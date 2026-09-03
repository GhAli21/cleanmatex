-- ============================================================
-- Migration: 0476_wf_validate_live_public_ofd.sql
-- Purpose:   Let Pilot/Publish accept public_tracking CONFIRM_DELIVERY from
--            observed out_for_delivery. 0470 only excepted pickup_handover
--            CONFIRM_PICKUP from observed ready, so SIMPLE v4 Start Pilot
--            failed after Check policy passed.
-- Affected:  sys_wf_prof_ver_validate_live
-- Related:   0470, 0475, ADR-SAAS-MNG-0010, LIVE_NORMALIZED_PROFILE_RUNTIME.md
-- ============================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.sys_wf_prof_ver_validate_live(
  p_version_id UUID
)
RETURNS VOID
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.sys_wf_prof_ver_policy_cf
    WHERE version_id = p_version_id
      AND is_active = true
      AND rec_status = 1
  ) THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_validate_live: version % requires an active policy row',
      p_version_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sys_wf_prof_ver_init_cf
    WHERE version_id = p_version_id
      AND is_active = true
      AND rec_status = 1
  ) THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_validate_live: version % requires at least one active initial rule',
      p_version_id;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.sys_wf_prof_ver_module_cf
    WHERE version_id = p_version_id
      AND module_mode = 'primary_owner'
      AND is_enabled = true
      AND is_active = true
      AND rec_status = 1
  ) THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_validate_live: version % requires at least one enabled primary owner module',
      p_version_id;
  END IF;

  IF EXISTS (
    SELECT 1
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
      )
  ) THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_validate_live: every active executable requires at least one active channel';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.sys_wf_prof_ver_exec_cf AS executable
    WHERE executable.version_id = p_version_id
      AND executable.is_active = true
      AND executable.rec_status = 1
      AND executable.action_code = 'CONFIRM_PICKUP'
      AND executable.screen_key <> 'pickup_handover'
  ) THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_validate_live: CONFIRM_PICKUP must be bound on pickup_handover';
  END IF;

  -- Ordinary executables need owner visibility on the executing module.
  -- V1 observer-execute exceptions: pickup_handover CONFIRM_PICKUP from
  -- observed ready, and public_tracking CONFIRM_DELIVERY from observed
  -- out_for_delivery with public_web while driver_delivery owns OFD.
  IF EXISTS (
    SELECT 1
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
      )
  ) THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_validate_live: every active executable requires owner visibility for its source status';
  END IF;

  IF EXISTS (
    SELECT 1
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
      )
  ) THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_validate_live: every active initial rule requires an enabled primary owner for its initial status';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.sys_wf_prof_ver_validate_live(UUID) FROM PUBLIC;

COMMENT ON FUNCTION public.sys_wf_prof_ver_validate_live(UUID) IS
  'Internal relational completeness guard for Pilot, Published, and assigned workflow profile versions. Allows pickup_handover CONFIRM_PICKUP from observed ready to delivered, and public_tracking CONFIRM_DELIVERY from observed out_for_delivery on public_web while driver_delivery owns OFD. Not a runtime policy resolver or public RPC.';

COMMIT;
