-- ============================================================================
-- Migration: 0496_wf_v2_full_path_ownership_hold_fix.sql
-- Purpose: Fix the real HQ Check-policy findings against WF_V2_FULL_PATH v1
--          (0495), still PILOT, not yet Published. Does not edit 0495.
--          HQ Check-policy (the platform validator) enforces more than the
--          Postgres-side sys_wf_prof_ver_live_rpt/validate_live subset that
--          0495 self-checked against: single-owner-per-status, initial-status
--          reachability to a fulfilment end, and hold-availability from every
--          claimed plant status. This migration closes exactly those gaps:
--            1. Missing CONFIRM_PHYSICAL_INTAKE draft -> intake edge (the
--               reachability error for remote-channel init rules landing at
--               draft).
--            2/3/4/5. Four statuses each claimed as 'owner' by two screens
--               (delivered: pickup_handover + driver_delivery; intake:
--               new_order + canceling; processing: processing + order_control;
--               out_for_delivery: driver_delivery + public_tracking). Fixed by
--               dropping the secondary screen to 'observer' and relying on the
--               already-seeded sys_wf_observer_exec_x_cd platform exceptions
--               (0479: CANCEL_FROM_INTAKE, HOLD_FROM_PROCESSING,
--               PUBLIC_OFD_CONFIRM). pickup_handover.delivered needs no
--               exception at all -- it never executes FROM delivered.
--            6-11. HOLD_ORDER_WORK was only reachable from 'processing'.
--               HQ flags this as incomplete for every other plant status this
--               profile owns (preparing/assembly/qa/packing/ready/
--               out_for_delivery). The platform exception catalog for all 6
--               statuses already exists (0486_wf_hold_edges_expand, applied
--               earlier -- out_for_delivery's row is named HOLD_FROM_OFD
--               there, not HOLD_FROM_OUT_FOR_DELIVERY); 0486's one-time sweep
--               never reached this version because it did not exist yet, so
--               this migration only adds the missing per-version rows
--               (order_control observer membership + HOLD_ORDER_WORK
--               executions + channels), no new catalog rows.
-- Affected: sys_wf_prof_ver_exec_cf, sys_wf_prof_ver_exec_ch_cf,
--           sys_wf_prof_ver_mod_st_cf, sys_wf_profile_ver_mst
--           (policy_revision bump only)
-- Related: 0495 (candidate this fixes), 0479 (observer-execute exception
--          catalog origin; CANCEL_FROM_INTAKE/HOLD_FROM_PROCESSING/
--          PUBLIC_OFD_CONFIRM), 0486 (already seeded the other 5 hold
--          exception rows + HOLD_FROM_OFD), 0477/0487 (live_rpt structural
--          report self-check reused below)
-- ============================================================================
-- Do not apply automatically. Version stays PILOT (no status change here).
-- After apply, re-run Check policy in HQ Studio -- the single-owner and
-- reachability rules enforced there are not mirrored into Postgres, so this
-- migration's own self-check (below) cannot fully replay HQ's verdict; it can
-- only prove the Postgres-side structural subset still holds.
-- ROLLBACK PLAN: re-run the inverse UPDATEs (observer -> owner on the 4 flipped
-- rows), delete the exec_cf/exec_ch_cf rows created_info-tagged
-- '0496_wf_v2_full_path_ownership_hold_fix'. No sys_wf_observer_exec_x_cd rows
-- were added by this migration (0486 already owns that catalog data).

BEGIN;
SELECT set_config('cmx.semantic_policy_command', '1', true);

DO $$
DECLARE
  v_version_id UUID := 'a1000000-0000-4000-8000-000000000076'::UUID;
  v_status TEXT;
  v_issues TEXT;
  v_tag TEXT := '0496_wf_v2_full_path_ownership_hold_fix';
BEGIN
  SELECT version_status INTO v_status
  FROM public.sys_wf_profile_ver_mst
  WHERE version_id = v_version_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION '0496: WF_V2_FULL_PATH v1 (version_id %) not found', v_version_id;
  END IF;
  IF v_status NOT IN ('DRAFT', 'PILOT') THEN
    RAISE EXCEPTION '0496: WF_V2_FULL_PATH v1 is % (expected DRAFT or PILOT); refusing to edit', v_status;
  END IF;

  -- 1) Missing draft -> intake reachability leg.
  INSERT INTO public.sys_wf_prof_ver_exec_cf (
    version_id,screen_key,action_code,from_status,to_status,transition_kind,
    requires_expected_version,requires_idempotency,requires_reason,min_reason_length,
    requires_evidence,display_order,is_active,rec_status,created_info
  ) VALUES (
    v_version_id,'new_order','CONFIRM_PHYSICAL_INTAKE','draft','intake','fixed',
    true,true,false,0,false,5,true,1,v_tag
  );

  -- 6-11) HOLD_ORDER_WORK from every other claimed plant status.
  INSERT INTO public.sys_wf_prof_ver_exec_cf (
    version_id,screen_key,action_code,from_status,to_status,transition_kind,
    requires_expected_version,requires_idempotency,requires_reason,min_reason_length,
    requires_evidence,display_order,is_active,rec_status,created_info
  )
  VALUES
    (v_version_id,'order_control','HOLD_ORDER_WORK','preparing','on_hold','fixed',true,true,true,10,false,113,true,1,v_tag),
    (v_version_id,'order_control','HOLD_ORDER_WORK','assembly','on_hold','fixed',true,true,true,10,false,114,true,1,v_tag),
    (v_version_id,'order_control','HOLD_ORDER_WORK','qa','on_hold','fixed',true,true,true,10,false,115,true,1,v_tag),
    (v_version_id,'order_control','HOLD_ORDER_WORK','packing','on_hold','fixed',true,true,true,10,false,116,true,1,v_tag),
    (v_version_id,'order_control','HOLD_ORDER_WORK','ready','on_hold','fixed',true,true,true,10,false,117,true,1,v_tag),
    (v_version_id,'order_control','HOLD_ORDER_WORK','out_for_delivery','on_hold','fixed',true,true,true,10,false,118,true,1,v_tag);

  -- Channels for all 7 new executions above (only rows tagged by this migration).
  INSERT INTO public.sys_wf_prof_ver_exec_ch_cf (exec_id,channel_code,is_active,rec_status,created_info)
  SELECT execution.exec_id, 'staff_web', true, 1, v_tag
  FROM public.sys_wf_prof_ver_exec_cf AS execution
  WHERE execution.version_id = v_version_id
    AND execution.created_info = v_tag;

  INSERT INTO public.sys_wf_prof_ver_exec_ch_cf (exec_id,channel_code,is_active,rec_status,created_info)
  SELECT execution.exec_id, 'pos', true, 1, v_tag
  FROM public.sys_wf_prof_ver_exec_cf AS execution
  WHERE execution.version_id = v_version_id
    AND execution.created_info = v_tag
    AND execution.screen_key = 'new_order'
    AND execution.action_code = 'CONFIRM_PHYSICAL_INTAKE'
    AND execution.from_status = 'draft';

  -- 2/3/4/5) Drop the secondary screen to observer on each dual-owned status.
  UPDATE public.sys_wf_prof_ver_mod_st_cf
  SET visibility_mode = 'observer', updated_at = CURRENT_TIMESTAMP, updated_info = v_tag
  WHERE version_id = v_version_id
    AND screen_key = 'pickup_handover' AND status_code = 'delivered' AND visibility_mode = 'owner';

  UPDATE public.sys_wf_prof_ver_mod_st_cf
  SET visibility_mode = 'observer', updated_at = CURRENT_TIMESTAMP, updated_info = v_tag
  WHERE version_id = v_version_id
    AND screen_key = 'canceling' AND status_code = 'intake' AND visibility_mode = 'owner';

  UPDATE public.sys_wf_prof_ver_mod_st_cf
  SET visibility_mode = 'observer', updated_at = CURRENT_TIMESTAMP, updated_info = v_tag
  WHERE version_id = v_version_id
    AND screen_key = 'order_control' AND status_code = 'processing' AND visibility_mode = 'owner';

  UPDATE public.sys_wf_prof_ver_mod_st_cf
  SET visibility_mode = 'observer', updated_at = CURRENT_TIMESTAMP, updated_info = v_tag
  WHERE version_id = v_version_id
    AND screen_key = 'public_tracking' AND status_code = 'out_for_delivery' AND visibility_mode = 'owner';

  -- order_control must observe the 6 new hold source statuses to execute
  -- HOLD_ORDER_WORK from them via 0486's pre-seeded exception rows.
  INSERT INTO public.sys_wf_prof_ver_mod_st_cf (version_id, screen_key, status_code, visibility_mode, display_order, is_active, rec_status, created_info)
  VALUES
    (v_version_id,'order_control','preparing','observer',40,true,1,v_tag),
    (v_version_id,'order_control','assembly','observer',50,true,1,v_tag),
    (v_version_id,'order_control','qa','observer',60,true,1,v_tag),
    (v_version_id,'order_control','packing','observer',70,true,1,v_tag),
    (v_version_id,'order_control','ready','observer',80,true,1,v_tag),
    (v_version_id,'order_control','out_for_delivery','observer',90,true,1,v_tag);

  -- No new sys_wf_observer_exec_x_cd rows needed: 0486_wf_hold_edges_expand
  -- (already applied) seeded this exact platform-wide allowlist for all 6
  -- statuses, including out_for_delivery (there named HOLD_FROM_OFD). Only
  -- the per-version rows above (mod_st_cf observer membership + exec_cf
  -- HOLD_ORDER_WORK executions) were still missing, because this profile
  -- version did not exist when 0486's one-time sweep ran.

  UPDATE public.sys_wf_profile_ver_mst
  SET policy_revision = policy_revision + 1, updated_at = CURRENT_TIMESTAMP
  WHERE version_id = v_version_id;

  -- Postgres-side structural subset must still be clean (it will not, by
  -- itself, prove the HQ-only reachability/single-owner/hold-completeness
  -- rules -- those need a real Check policy re-run in Studio).
  SELECT string_agg(DISTINCT issue_code, ', ' ORDER BY issue_code) INTO v_issues
  FROM public.sys_wf_prof_ver_live_rpt(v_version_id);
  IF v_issues IS NOT NULL THEN
    RAISE EXCEPTION '0496: WF_V2_FULL_PATH v1 still fails structural validation after fix: %', v_issues;
  END IF;
END $$;
COMMIT;
