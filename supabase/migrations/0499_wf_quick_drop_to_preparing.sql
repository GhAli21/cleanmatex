-- ============================================================
-- Migration: 0499_wf_quick_drop_to_preparing.sql
-- Purpose:   Quick-drop bags are already in hand (POS_QUICK_DROP /
--            STAFF_IN_HAND stamps physical intake received). Itemization
--            belongs on Preparation via Edit order, not on intake.
--            SIMPLE v4 PILOT had use_preparation_screen=true but no
--            preparation module, so create landed at intake with no floor.
-- Affected:  sys_wf_prof_ver_module_cf, sys_wf_prof_ver_mod_st_cf,
--            sys_wf_prof_ver_exec_cf, sys_wf_prof_ver_exec_ch_cf,
--            sys_wf_prof_ver_init_cf, sys_wf_prof_ver_policy_cf,
--            sys_wf_profile_ver_mst (policy_revision only)
-- Related:   0472 (SIMPLE lean seed skipped prep), 0486 (HOLD from
--            preparing exception), 0495/0496 (FULL_PATH already owns
--            preparing), 0488 (HOME_COLLECTION already owns preparing)
-- ============================================================
-- Do not apply automatically. Edits DRAFT/PILOT only. PUBLISHED rows stay
-- frozen. After apply, re-run HQ Studio Check policy on SIMPLE v4.
-- ROLLBACK PLAN: delete created_info='0499_wf_quick_drop_to_preparing'
-- module/status/exec/channel rows on SIMPLE v4; restore quick-drop
-- initial_status='intake' on tagged init rows. No PUBLISHED edits.

BEGIN;
SELECT set_config('cmx.semantic_policy_command', '1', true);

DO $$
DECLARE
  v_simple_v4 UUID := 'a1000000-0000-4000-8000-000000000014'::UUID;
  v_status TEXT;
  v_issues TEXT;
  v_tag TEXT := '0499_wf_quick_drop_to_preparing';
  v_version RECORD;
BEGIN
  -- 1) SIMPLE v4 PILOT: add the missing Preparation owner graph.
  SELECT version_status INTO v_status
  FROM public.sys_wf_profile_ver_mst
  WHERE version_id = v_simple_v4;

  IF v_status IS NULL THEN
    RAISE NOTICE '0499: WF_V2_SIMPLE v4 not present; skipping preparation-module patch';
  ELSIF v_status NOT IN ('DRAFT', 'PILOT') THEN
    RAISE EXCEPTION '0499: WF_V2_SIMPLE v4 is %; refusing to edit', v_status;
  ELSE
    INSERT INTO public.sys_wf_prof_ver_module_cf (
      version_id, screen_key, module_mode, is_enabled, display_order,
      is_active, rec_status, created_info
    ) VALUES (
      v_simple_v4, 'preparation', 'primary_owner', true, 20, true, 1, v_tag
    )
    ON CONFLICT (version_id, screen_key) DO UPDATE SET
      module_mode = 'primary_owner',
      is_enabled = true,
      display_order = 20,
      is_active = true,
      rec_status = 1,
      updated_at = CURRENT_TIMESTAMP,
      updated_info = v_tag;

    INSERT INTO public.sys_wf_prof_ver_mod_st_cf (
      version_id, screen_key, status_code, visibility_mode, display_order,
      is_active, rec_status, created_info
    ) VALUES
      (v_simple_v4, 'preparation', 'preparing', 'owner', 10, true, 1, v_tag),
      (v_simple_v4, 'workboard', 'preparing', 'observer', 5, true, 1, v_tag),
      (v_simple_v4, 'order_control', 'preparing', 'observer', 40, true, 1, v_tag)
    ON CONFLICT (version_id, screen_key, status_code) DO UPDATE SET
      visibility_mode = EXCLUDED.visibility_mode,
      display_order = EXCLUDED.display_order,
      is_active = true,
      rec_status = 1,
      updated_at = CURRENT_TIMESTAMP,
      updated_info = v_tag;

    INSERT INTO public.sys_wf_prof_ver_exec_cf (
      version_id, screen_key, action_code, from_status, to_status, transition_kind,
      requires_expected_version, requires_idempotency, requires_reason,
      min_reason_length, requires_evidence, display_order, is_active, rec_status,
      created_info
    ) VALUES
      (v_simple_v4, 'preparation', 'COMPLETE_PREPARATION', 'preparing', 'processing',
        'fixed', true, true, false, 0, false, 20, true, 1, v_tag),
      (v_simple_v4, 'order_control', 'HOLD_ORDER_WORK', 'preparing', 'on_hold',
        'fixed', true, true, true, 10, false, 113, true, 1, v_tag)
    ON CONFLICT (version_id, screen_key, action_code, from_status, to_status) DO UPDATE SET
      is_active = true,
      rec_status = 1,
      updated_at = CURRENT_TIMESTAMP,
      updated_info = v_tag;

    INSERT INTO public.sys_wf_prof_ver_exec_ch_cf (
      exec_id, channel_code, is_active, rec_status, created_info
    )
    SELECT execution.exec_id, 'staff_web', true, 1, v_tag
    FROM public.sys_wf_prof_ver_exec_cf AS execution
    WHERE execution.version_id = v_simple_v4
      AND (
        (execution.screen_key = 'preparation' AND execution.action_code = 'COMPLETE_PREPARATION')
        OR (
          execution.screen_key = 'order_control'
          AND execution.action_code = 'HOLD_ORDER_WORK'
          AND execution.from_status = 'preparing'
        )
      )
    ON CONFLICT (exec_id, channel_code) DO UPDATE SET
      is_active = true,
      rec_status = 1,
      updated_at = CURRENT_TIMESTAMP;

    UPDATE public.sys_wf_prof_ver_policy_cf
    SET use_preparation = true,
        updated_at = CURRENT_TIMESTAMP,
        updated_info = v_tag
    WHERE version_id = v_simple_v4;

    UPDATE public.sys_wf_profile_ver_mst
    SET use_preparation_screen = true,
        policy_revision = policy_revision + 1,
        updated_at = CURRENT_TIMESTAMP
    WHERE version_id = v_simple_v4;

    SELECT string_agg(DISTINCT issue_code, ', ' ORDER BY issue_code) INTO v_issues
    FROM public.sys_wf_prof_ver_live_rpt(v_simple_v4);
    IF v_issues IS NOT NULL THEN
      RAISE EXCEPTION '0499: WF_V2_SIMPLE v4 failed structural validation: %', v_issues;
    END IF;
  END IF;

  -- 2) Any DRAFT/PILOT that already owns preparing: quick-drop starts there.
  FOR v_version IN
    SELECT version.version_id
    FROM public.sys_wf_profile_ver_mst AS version
    WHERE version.version_status IN ('DRAFT', 'PILOT')
      AND EXISTS (
        SELECT 1
        FROM public.sys_wf_prof_ver_module_cf AS owner_module
        INNER JOIN public.sys_wf_prof_ver_mod_st_cf AS owned
          ON owned.version_id = owner_module.version_id
         AND owned.screen_key = owner_module.screen_key
        WHERE owner_module.version_id = version.version_id
          AND owner_module.screen_key = 'preparation'
          AND owner_module.module_mode = 'primary_owner'
          AND owner_module.is_enabled = true
          AND owner_module.is_active = true
          AND owner_module.rec_status = 1
          AND owned.status_code = 'preparing'
          AND owned.visibility_mode = 'owner'
          AND owned.is_active = true
          AND owned.rec_status = 1
      )
  LOOP
    UPDATE public.sys_wf_prof_ver_init_cf
    SET initial_status = 'preparing',
        updated_at = CURRENT_TIMESTAMP,
        updated_info = v_tag
    WHERE version_id = v_version.version_id
      AND is_quick_drop IS TRUE
      AND is_active = true
      AND rec_status = 1
      AND initial_status IS DISTINCT FROM 'preparing';
  END LOOP;
END $$;
COMMIT;
