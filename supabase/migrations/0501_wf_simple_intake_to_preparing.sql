-- ============================================================
-- Migration: 0501_wf_simple_intake_to_preparing.sql
-- Purpose:   SIMPLE v4 leftover bags at intake should itemize on
--            Preparation, same as FULL_PATH / STANDARD. Engine
--            CONFIRM_PHYSICAL_INTAKE from intake skipped prep
--            (to processing). Home-collection confirm still landed
--            at intake. Retarget both to preparing. Do not change
--            draft→processing (remote drop-off stays on that edge).
-- Affected:  sys_wf_prof_ver_exec_cf, sys_wf_profile_ver_mst
-- Related:   0499 (Preparation owner + quick-drop preparing),
--            0500 (preparing on stage_sequence)
-- ============================================================
-- Do not apply automatically. Edits DRAFT/PILOT only. PUBLISHED
-- stays frozen. After apply, re-run HQ Studio Check policy on
-- SIMPLE v4.
-- ROLLBACK PLAN: restore tagged SIMPLE v4 exec to_status values
-- (intake→processing, home-collection confirm→intake). No
-- PUBLISHED edits.

BEGIN;

Null;

/*
SELECT set_config('cmx.semantic_policy_command', '1', true);

DO $$
DECLARE
  v_simple_v4 UUID := 'a1000000-0000-4000-8000-000000000014'::UUID;
  v_status TEXT;
  v_issues TEXT;
  v_tag TEXT := '0501_wf_simple_intake_to_preparing';
  v_intake_rows INTEGER;
  v_home_rows INTEGER;
BEGIN
  SELECT version_status INTO v_status
  FROM public.sys_wf_profile_ver_mst
  WHERE version_id = v_simple_v4;

  IF v_status IS NULL THEN
    RAISE NOTICE '0501: WF_V2_SIMPLE v4 not present; skipping';
    RETURN;
  ELSIF v_status NOT IN ('DRAFT', 'PILOT') THEN
    RAISE EXCEPTION '0501: WF_V2_SIMPLE v4 is %; refusing to edit', v_status;
  END IF;

  UPDATE public.sys_wf_prof_ver_exec_cf
  SET to_status = 'preparing',
      updated_at = CURRENT_TIMESTAMP,
      updated_info = v_tag
  WHERE version_id = v_simple_v4
    AND screen_key = 'new_order'
    AND action_code = 'CONFIRM_PHYSICAL_INTAKE'
    AND from_status = 'intake'
    AND to_status IS DISTINCT FROM 'preparing'
    AND is_active = true
    AND rec_status = 1;
  GET DIAGNOSTICS v_intake_rows = ROW_COUNT;

  UPDATE public.sys_wf_prof_ver_exec_cf
  SET to_status = 'preparing',
      updated_at = CURRENT_TIMESTAMP,
      updated_info = v_tag
  WHERE version_id = v_simple_v4
    AND screen_key = 'home_collection'
    AND action_code = 'CONFIRM_HOME_COLLECTION'
    AND from_status = 'out_for_collection'
    AND to_status IS DISTINCT FROM 'preparing'
    AND is_active = true
    AND rec_status = 1;
  GET DIAGNOSTICS v_home_rows = ROW_COUNT;

  IF v_intake_rows = 0 AND v_home_rows = 0 THEN
    RAISE NOTICE '0501: SIMPLE v4 already lands intake leftovers and home-collection confirm at preparing';
    RETURN;
  END IF;

  UPDATE public.sys_wf_profile_ver_mst
  SET policy_revision = policy_revision + 1,
      updated_at = CURRENT_TIMESTAMP
  WHERE version_id = v_simple_v4
  ;

  SELECT string_agg(DISTINCT issue_code, ', ' ORDER BY issue_code) INTO v_issues
  FROM public.sys_wf_prof_ver_live_rpt(v_simple_v4);
  IF v_issues IS NOT NULL THEN
    RAISE EXCEPTION '0501: WF_V2_SIMPLE v4 failed structural validation: %', v_issues;
  END IF;
END $$;

*/

COMMIT;


