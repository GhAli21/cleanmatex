-- ============================================================
-- Migration: 0475_wf_simple_live_policy_draft_seed.sql
-- Purpose:   Fill WF_V2_SIMPLE live policy that 0472 skipped on remote
--            because published v2 (V2_Jh) already occupied version_no = 2.
--            Seed stays DRAFT. HQ Check policy / Pilot / Publish is manual.
-- Affected:  sys_wf_profile_ver_mst, sys_wf_prof_ver_module_cf,
--            sys_wf_prof_ver_mod_st_cf, sys_wf_prof_ver_policy_cf,
--            sys_wf_prof_ver_init_cf, sys_wf_prof_ver_exec_cf,
--            sys_wf_prof_ver_exec_ch_cf, sys_wf_prof_ver_exec_gate_cf,
--            sys_wf_prof_ver_evidence_cf
-- Related:   0445, 0472
-- ROLLBACK:  delete the DRAFT repair version; do not edit 0445/0472.
-- ============================================================

BEGIN;

-- Session-only helpers. Same live shape as 0472 SIMPLE; never publish.
CREATE FUNCTION pg_temp.wf_seed_module(
  p_version_id UUID,
  p_screen_key TEXT,
  p_module_mode TEXT,
  p_display_order INTEGER
) RETURNS VOID
LANGUAGE plpgsql
AS $wf$
BEGIN
  INSERT INTO public.sys_wf_prof_ver_module_cf (
    version_id, screen_key, module_mode, is_enabled, display_order, is_active, rec_status
  ) VALUES (
    p_version_id, p_screen_key, p_module_mode, true, p_display_order, true, 1
  )
  ON CONFLICT (version_id, screen_key) DO UPDATE SET
    module_mode = EXCLUDED.module_mode,
    is_enabled = true,
    display_order = EXCLUDED.display_order,
    is_active = true,
    rec_status = 1,
    updated_at = CURRENT_TIMESTAMP;
END;
$wf$;

CREATE FUNCTION pg_temp.wf_seed_status(
  p_version_id UUID,
  p_screen_key TEXT,
  p_status_code TEXT,
  p_visibility_mode TEXT,
  p_display_order INTEGER
) RETURNS VOID
LANGUAGE plpgsql
AS $wf$
BEGIN
  INSERT INTO public.sys_wf_prof_ver_mod_st_cf (
    version_id, screen_key, status_code, visibility_mode, display_order, is_active, rec_status
  ) VALUES (
    p_version_id, p_screen_key, p_status_code, p_visibility_mode, p_display_order, true, 1
  )
  ON CONFLICT (version_id, screen_key, status_code) DO UPDATE SET
    visibility_mode = EXCLUDED.visibility_mode,
    display_order = EXCLUDED.display_order,
    is_active = true,
    rec_status = 1,
    updated_at = CURRENT_TIMESTAMP;
END;
$wf$;

CREATE FUNCTION pg_temp.wf_seed_exec(
  p_version_id UUID,
  p_screen_key TEXT,
  p_action_code TEXT,
  p_from_status TEXT,
  p_to_status TEXT,
  p_channels TEXT[],
  p_display_order INTEGER,
  p_transition_kind TEXT DEFAULT 'fixed',
  p_requires_reason BOOLEAN DEFAULT false,
  p_min_reason_length INTEGER DEFAULT 0
) RETURNS UUID
LANGUAGE plpgsql
AS $wf$
DECLARE
  v_exec_id UUID;
  v_channel TEXT;
BEGIN
  INSERT INTO public.sys_wf_prof_ver_exec_cf (
    version_id, screen_key, action_code, from_status, to_status,
    transition_kind, requires_expected_version, requires_idempotency,
    requires_reason, min_reason_length, requires_evidence,
    display_order, is_active, rec_status
  ) VALUES (
    p_version_id, p_screen_key, p_action_code, p_from_status, p_to_status,
    p_transition_kind, true, true,
    p_requires_reason, p_min_reason_length, false,
    p_display_order, true, 1
  )
  ON CONFLICT (version_id, screen_key, action_code, from_status, to_status) DO UPDATE SET
    transition_kind = EXCLUDED.transition_kind,
    requires_reason = EXCLUDED.requires_reason,
    min_reason_length = EXCLUDED.min_reason_length,
    display_order = EXCLUDED.display_order,
    is_active = true,
    rec_status = 1,
    updated_at = CURRENT_TIMESTAMP
  RETURNING exec_id INTO v_exec_id;

  FOREACH v_channel IN ARRAY p_channels LOOP
    INSERT INTO public.sys_wf_prof_ver_exec_ch_cf (
      exec_id, channel_code, is_active, rec_status
    ) VALUES (
      v_exec_id, v_channel, true, 1
    )
    ON CONFLICT (exec_id, channel_code) DO UPDATE SET
      is_active = true,
      rec_status = 1,
      updated_at = CURRENT_TIMESTAMP;
  END LOOP;

  RETURN v_exec_id;
END;
$wf$;

CREATE FUNCTION pg_temp.wf_seed_gate(
  p_exec_id UUID,
  p_gate_code TEXT,
  p_display_order INTEGER
) RETURNS VOID
LANGUAGE plpgsql
AS $wf$
BEGIN
  INSERT INTO public.sys_wf_prof_ver_exec_gate_cf (
    exec_id, gate_code, evaluator_version, input_schema_version,
    parameters_json, blocking_mode, display_order, is_active, rec_status
  ) VALUES (
    p_exec_id, p_gate_code, 1, 1, '{}'::jsonb, 'hard_block', p_display_order, true, 1
  )
  ON CONFLICT (exec_id, gate_code) DO UPDATE SET
    blocking_mode = 'hard_block',
    is_active = true,
    rec_status = 1,
    updated_at = CURRENT_TIMESTAMP;
END;
$wf$;

CREATE FUNCTION pg_temp.wf_seed_init(
  p_version_id UUID,
  p_rule_code TEXT,
  p_initial_status TEXT,
  p_priority INTEGER
) RETURNS VOID
LANGUAGE plpgsql
AS $wf$
BEGIN
  INSERT INTO public.sys_wf_prof_ver_init_cf (
    version_id, rule_code, initial_status, priority, is_active, rec_status
  ) VALUES (
    p_version_id, p_rule_code, p_initial_status, p_priority, true, 1
  )
  ON CONFLICT (version_id, rule_code) DO UPDATE SET
    initial_status = EXCLUDED.initial_status,
    priority = EXCLUDED.priority,
    is_active = true,
    rec_status = 1,
    updated_at = CURRENT_TIMESTAMP;
END;
$wf$;

CREATE FUNCTION pg_temp.wf_seed_evidence(
  p_version_id UUID,
  p_channel TEXT,
  p_method TEXT,
  p_required BOOLEAN,
  p_display_order INTEGER
) RETURNS VOID
LANGUAGE plpgsql
AS $wf$
BEGIN
  INSERT INTO public.sys_wf_prof_ver_evidence_cf (
    version_id, fulfilment_channel, evidence_method_code,
    is_required, minimum_count, display_order, is_active, rec_status
  ) VALUES (
    p_version_id, p_channel, p_method, p_required, 0, p_display_order, true, 1
  )
  ON CONFLICT (version_id, fulfilment_channel, evidence_method_code) DO UPDATE SET
    is_required = EXCLUDED.is_required,
    display_order = EXCLUDED.display_order,
    is_active = true,
    rec_status = 1,
    updated_at = CURRENT_TIMESTAMP;
END;
$wf$;

CREATE FUNCTION pg_temp.wf_seed_live_version(
  p_version_id UUID,
  p_use_prep BOOLEAN,
  p_use_assembly BOOLEAN,
  p_use_qa BOOLEAN,
  p_use_packing BOOLEAN,
  p_use_pickup BOOLEAN,
  p_use_delivery BOOLEAN,
  p_direct_pickup BOOLEAN,
  p_routed_pod BOOLEAN,
  p_use_returning BOOLEAN,
  p_require_rack BOOLEAN
) RETURNS VOID
LANGUAGE plpgsql
AS $wf$
DECLARE
  v_exec UUID;
  v_after_processing TEXT;
  v_after_assembly TEXT;
  v_after_qa TEXT;
BEGIN
  v_after_processing := CASE
    WHEN p_use_assembly THEN 'assembly'
    WHEN p_use_qa THEN 'qa'
    WHEN p_use_packing THEN 'packing'
    ELSE 'ready'
  END;
  v_after_assembly := CASE
    WHEN p_use_qa THEN 'qa'
    WHEN p_use_packing THEN 'packing'
    ELSE 'ready'
  END;
  v_after_qa := CASE WHEN p_use_packing THEN 'packing' ELSE 'ready' END;

  PERFORM pg_temp.wf_seed_module(p_version_id, 'new_order', 'primary_owner', 10);
  IF p_use_prep THEN
    PERFORM pg_temp.wf_seed_module(p_version_id, 'preparation', 'primary_owner', 20);
  END IF;
  PERFORM pg_temp.wf_seed_module(p_version_id, 'processing', 'primary_owner', 30);
  IF p_use_assembly THEN
    PERFORM pg_temp.wf_seed_module(p_version_id, 'assembly', 'primary_owner', 40);
  END IF;
  IF p_use_qa THEN
    PERFORM pg_temp.wf_seed_module(p_version_id, 'qa', 'primary_owner', 50);
  END IF;
  IF p_use_packing THEN
    PERFORM pg_temp.wf_seed_module(p_version_id, 'packing', 'primary_owner', 60);
  END IF;
  PERFORM pg_temp.wf_seed_module(p_version_id, 'ready_release', 'primary_owner', 70);
  IF p_use_pickup THEN
    PERFORM pg_temp.wf_seed_module(p_version_id, 'pickup_handover', 'primary_owner', 80);
  END IF;
  IF p_use_delivery THEN
    PERFORM pg_temp.wf_seed_module(p_version_id, 'driver_delivery', 'primary_owner', 90);
    PERFORM pg_temp.wf_seed_module(p_version_id, 'public_tracking', 'cross_cutting_command', 100);
  END IF;
  PERFORM pg_temp.wf_seed_module(p_version_id, 'order_control', 'primary_owner', 110);
  PERFORM pg_temp.wf_seed_module(p_version_id, 'workboard', 'observer', 120);
  PERFORM pg_temp.wf_seed_module(p_version_id, 'canceling', 'primary_owner', 130);
  IF p_use_returning THEN
    PERFORM pg_temp.wf_seed_module(p_version_id, 'returning', 'primary_owner', 140);
  END IF;

  PERFORM pg_temp.wf_seed_status(p_version_id, 'new_order', 'draft', 'owner', 1);
  PERFORM pg_temp.wf_seed_status(p_version_id, 'new_order', 'intake', 'owner', 2);
  IF p_use_prep THEN
    PERFORM pg_temp.wf_seed_status(p_version_id, 'preparation', 'preparing', 'owner', 1);
  END IF;
  PERFORM pg_temp.wf_seed_status(p_version_id, 'processing', 'processing', 'owner', 1);
  IF p_use_assembly THEN
    PERFORM pg_temp.wf_seed_status(p_version_id, 'assembly', 'assembly', 'owner', 1);
  END IF;
  IF p_use_qa THEN
    PERFORM pg_temp.wf_seed_status(p_version_id, 'qa', 'qa', 'owner', 1);
  END IF;
  IF p_use_packing THEN
    PERFORM pg_temp.wf_seed_status(p_version_id, 'packing', 'packing', 'owner', 1);
  END IF;
  PERFORM pg_temp.wf_seed_status(p_version_id, 'ready_release', 'ready', 'owner', 1);
  IF p_use_pickup THEN
    PERFORM pg_temp.wf_seed_status(p_version_id, 'pickup_handover', 'ready_for_pickup', 'owner', 1);
    PERFORM pg_temp.wf_seed_status(p_version_id, 'pickup_handover', 'delivered', 'owner', 2);
    IF p_direct_pickup THEN
      PERFORM pg_temp.wf_seed_status(p_version_id, 'pickup_handover', 'ready', 'observer', 3);
    END IF;
  END IF;
  IF p_use_delivery THEN
    PERFORM pg_temp.wf_seed_status(p_version_id, 'driver_delivery', 'out_for_delivery', 'owner', 1);
    PERFORM pg_temp.wf_seed_status(p_version_id, 'driver_delivery', 'delivered', 'owner', 2);
    PERFORM pg_temp.wf_seed_status(p_version_id, 'public_tracking', 'out_for_delivery', 'owner', 1);
  END IF;
  PERFORM pg_temp.wf_seed_status(p_version_id, 'order_control', 'processing', 'owner', 1);
  PERFORM pg_temp.wf_seed_status(p_version_id, 'order_control', 'on_hold', 'owner', 2);
  PERFORM pg_temp.wf_seed_status(p_version_id, 'order_control', 'stopped', 'owner', 3);
  PERFORM pg_temp.wf_seed_status(p_version_id, 'workboard', 'processing', 'observer', 1);
  PERFORM pg_temp.wf_seed_status(p_version_id, 'workboard', 'ready', 'observer', 2);
  PERFORM pg_temp.wf_seed_status(p_version_id, 'canceling', 'intake', 'owner', 1);
  PERFORM pg_temp.wf_seed_status(p_version_id, 'canceling', 'cancelled', 'owner', 2);
  IF p_use_returning THEN
    PERFORM pg_temp.wf_seed_status(p_version_id, 'returning', 'delivered', 'owner', 1);
    PERFORM pg_temp.wf_seed_status(p_version_id, 'returning', 'returned', 'owner', 2);
  END IF;

  INSERT INTO public.sys_wf_prof_ver_policy_cf (
    version_id, policy_schema_version,
    use_preparation, use_assembly, use_qa, use_packing,
    pickup_enabled, delivery_enabled, public_tracking_enabled,
    require_pickup_release, allow_direct_counter_pickup,
    require_collection_for_pickup, require_delivery_stop,
    require_collection_for_delivery, require_rack_before_release,
    partial_pickup_enabled, partial_delivery_enabled,
    returns_enabled, otp_enabled, conditional_routing_enabled,
    is_active, rec_status
  ) VALUES (
    p_version_id, 1,
    p_use_prep, p_use_assembly, p_use_qa, p_use_packing,
    p_use_pickup, p_use_delivery, p_use_delivery,
    true, p_direct_pickup,
    true, p_routed_pod,
    true, p_require_rack,
    false, false,
    p_use_returning, false, false,
    true, 1
  )
  ON CONFLICT (version_id) DO UPDATE SET
    use_preparation = EXCLUDED.use_preparation,
    use_assembly = EXCLUDED.use_assembly,
    use_qa = EXCLUDED.use_qa,
    use_packing = EXCLUDED.use_packing,
    pickup_enabled = EXCLUDED.pickup_enabled,
    delivery_enabled = EXCLUDED.delivery_enabled,
    public_tracking_enabled = EXCLUDED.public_tracking_enabled,
    allow_direct_counter_pickup = EXCLUDED.allow_direct_counter_pickup,
    require_delivery_stop = EXCLUDED.require_delivery_stop,
    require_rack_before_release = EXCLUDED.require_rack_before_release,
    returns_enabled = EXCLUDED.returns_enabled,
    is_active = true,
    rec_status = 1,
    updated_at = CURRENT_TIMESTAMP;

  PERFORM pg_temp.wf_seed_init(p_version_id, 'INIT_ONLINE_DRAFT', 'draft', 50);
  PERFORM pg_temp.wf_seed_init(p_version_id, 'INIT_PHONE_INTAKE', 'intake', 100);
  PERFORM pg_temp.wf_seed_init(p_version_id, 'INIT_DEFAULT', 'intake', 900);

  v_exec := pg_temp.wf_seed_exec(
    p_version_id, 'new_order', 'CONFIRM_PHYSICAL_INTAKE', 'intake',
    CASE WHEN p_use_prep THEN 'preparing' ELSE 'processing' END,
    ARRAY['staff_web', 'pos'], 10
  );
  IF p_use_prep THEN
    v_exec := pg_temp.wf_seed_exec(
      p_version_id, 'preparation', 'COMPLETE_PREPARATION', 'preparing', 'processing',
      ARRAY['staff_web'], 20
    );
  END IF;
  v_exec := pg_temp.wf_seed_exec(
    p_version_id, 'processing', 'COMPLETE_PROCESSING', 'processing', v_after_processing,
    ARRAY['staff_web'], 30
  );
  IF p_use_assembly THEN
    v_exec := pg_temp.wf_seed_exec(
      p_version_id, 'assembly', 'COMPLETE_ASSEMBLY', 'assembly', v_after_assembly,
      ARRAY['staff_web'], 40
    );
  END IF;
  IF p_use_qa THEN
    v_exec := pg_temp.wf_seed_exec(
      p_version_id, 'qa', 'PASS_QA', 'qa', v_after_qa,
      ARRAY['staff_web'], 50
    );
    v_exec := pg_temp.wf_seed_exec(
      p_version_id, 'qa', 'FAIL_QA', 'qa', 'processing',
      ARRAY['staff_web'], 51, 'fixed', true, 10
    );
  END IF;
  IF p_use_packing THEN
    v_exec := pg_temp.wf_seed_exec(
      p_version_id, 'packing', 'COMPLETE_PACKING', 'packing', 'ready',
      ARRAY['staff_web'], 60
    );
  END IF;

  IF p_use_pickup THEN
    v_exec := pg_temp.wf_seed_exec(
      p_version_id, 'ready_release', 'RELEASE_FOR_PICKUP', 'ready', 'ready_for_pickup',
      ARRAY['staff_web'], 70
    );
    IF p_require_rack THEN
      PERFORM pg_temp.wf_seed_gate(v_exec, 'rack_required', 1);
    END IF;
    PERFORM pg_temp.wf_seed_gate(v_exec, 'fin_release_eligible', 2);

    v_exec := pg_temp.wf_seed_exec(
      p_version_id, 'pickup_handover', 'CONFIRM_PICKUP', 'ready_for_pickup', 'delivered',
      ARRAY['staff_web', 'pos'], 80
    );
    PERFORM pg_temp.wf_seed_gate(v_exec, 'pickup_collection_settled', 1);
    PERFORM pg_temp.wf_seed_gate(v_exec, 'pickup_release_valid', 2);

    IF p_direct_pickup THEN
      v_exec := pg_temp.wf_seed_exec(
        p_version_id, 'pickup_handover', 'CONFIRM_PICKUP', 'ready', 'delivered',
        ARRAY['staff_web', 'pos'], 81
      );
      PERFORM pg_temp.wf_seed_gate(v_exec, 'pickup_collection_settled', 1);
    END IF;
    PERFORM pg_temp.wf_seed_evidence(p_version_id, 'pickup', 'notes', false, 10);
  END IF;

  IF p_use_delivery THEN
    v_exec := pg_temp.wf_seed_exec(
      p_version_id, 'ready_release', 'RELEASE_FOR_DELIVERY', 'ready', 'out_for_delivery',
      ARRAY['staff_web'], 90
    );
    IF p_require_rack THEN
      PERFORM pg_temp.wf_seed_gate(v_exec, 'rack_required', 1);
    END IF;
    PERFORM pg_temp.wf_seed_gate(v_exec, 'fin_release_eligible', 2);

    v_exec := pg_temp.wf_seed_exec(
      p_version_id, 'driver_delivery', 'CONFIRM_DELIVERY', 'out_for_delivery', 'delivered',
      ARRAY['staff_web', 'mobile'], 100
    );
    PERFORM pg_temp.wf_seed_gate(v_exec, 'delivery_collection_settled', 1);
    IF p_routed_pod THEN
      PERFORM pg_temp.wf_seed_gate(v_exec, 'delivery_stop_active', 2);
      PERFORM pg_temp.wf_seed_gate(v_exec, 'pod_evidence_valid', 3);
    END IF;

    v_exec := pg_temp.wf_seed_exec(
      p_version_id, 'public_tracking', 'CONFIRM_DELIVERY', 'out_for_delivery', 'delivered',
      ARRAY['public_web'], 101
    );
    PERFORM pg_temp.wf_seed_gate(v_exec, 'delivery_collection_settled', 1);

    PERFORM pg_temp.wf_seed_evidence(p_version_id, 'delivery', 'notes', false, 10);
    IF p_routed_pod THEN
      PERFORM pg_temp.wf_seed_evidence(p_version_id, 'delivery', 'photo', true, 20);
      PERFORM pg_temp.wf_seed_evidence(p_version_id, 'delivery', 'signature', false, 30);
    END IF;
  END IF;

  v_exec := pg_temp.wf_seed_exec(
    p_version_id, 'order_control', 'HOLD_ORDER_WORK', 'processing', 'on_hold',
    ARRAY['staff_web'], 110, 'fixed', true, 10
  );
  v_exec := pg_temp.wf_seed_exec(
    p_version_id, 'order_control', 'RESUME_ORDER_WORK', 'on_hold', 'processing',
    ARRAY['staff_web'], 111, 'resume_from_hold', true, 10
  );
  v_exec := pg_temp.wf_seed_exec(
    p_version_id, 'order_control', 'STOP_ORDER_WORK', 'on_hold', 'stopped',
    ARRAY['staff_web'], 112, 'fixed', true, 10
  );
  v_exec := pg_temp.wf_seed_exec(
    p_version_id, 'canceling', 'CANCEL_ORDER', 'intake', 'cancelled',
    ARRAY['staff_web'], 120, 'fixed', true, 10
  );
  IF p_use_returning THEN
    v_exec := pg_temp.wf_seed_exec(
      p_version_id, 'returning', 'RETURN_ORDER', 'delivered', 'returned',
      ARRAY['staff_web'], 130, 'fixed', true, 10
    );
  END IF;
END;
$wf$;

CREATE FUNCTION pg_temp.wf_simple_has_published_live() RETURNS BOOLEAN
LANGUAGE plpgsql
AS $wf$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.sys_wf_profiles_cd AS profile_row
    INNER JOIN public.sys_wf_profile_ver_mst AS version_row
      ON version_row.profile_id = profile_row.profile_id
    INNER JOIN public.sys_wf_prof_ver_policy_cf AS policy_row
      ON policy_row.version_id = version_row.version_id
    WHERE profile_row.profile_code = 'WF_V2_SIMPLE'
      AND version_row.version_status = 'PUBLISHED'
      AND policy_row.allow_direct_counter_pickup = true
      AND EXISTS (
        SELECT 1
        FROM public.sys_wf_prof_ver_module_cf AS module_row
        WHERE module_row.version_id = version_row.version_id
          AND module_row.is_enabled = true
          AND module_row.is_active = true
      )
      AND EXISTS (
        SELECT 1
        FROM public.sys_wf_prof_ver_init_cf AS init_row
        WHERE init_row.version_id = version_row.version_id
          AND init_row.is_active = true
      )
      AND EXISTS (
        SELECT 1
        FROM public.sys_wf_prof_ver_exec_cf AS exec_row
        WHERE exec_row.version_id = version_row.version_id
          AND exec_row.is_active = true
      )
  );
END;
$wf$;

-- Next unused version_no. Leaves DRAFT. Does not touch V2_Jh or test_ver_jh3.
CREATE FUNCTION pg_temp.wf_seed_simple_live_draft() RETURNS VOID
LANGUAGE plpgsql
AS $wf$
DECLARE
  v_repair_id UUID := 'a1000000-0000-4000-8000-000000000014'::uuid;
  v_profile_id UUID;
  v_status TEXT;
  v_next_no INTEGER;
BEGIN
  IF pg_temp.wf_simple_has_published_live() THEN
    RETURN;
  END IF;

  SELECT profile_id INTO v_profile_id
  FROM public.sys_wf_profiles_cd
  WHERE profile_code = 'WF_V2_SIMPLE';

  IF v_profile_id IS NULL THEN
    RAISE EXCEPTION 'Missing profile header WF_V2_SIMPLE';
  END IF;

  SELECT version_status INTO v_status
  FROM public.sys_wf_profile_ver_mst
  WHERE version_id = v_repair_id;

  IF v_status IN ('PUBLISHED', 'RETIRED') THEN
    RAISE EXCEPTION
      'WF_V2_SIMPLE repair version % is % and must not be overwritten',
      v_repair_id,
      v_status;
  END IF;

  IF v_status IS NULL THEN
    SELECT COALESCE(MAX(version_no), 0) + 1
    INTO v_next_no
    FROM public.sys_wf_profile_ver_mst
    WHERE profile_id = v_profile_id;

    INSERT INTO public.sys_wf_profile_ver_mst (
      version_id, profile_id, version_no, version_status,
      name, name2, change_summary, is_active, rec_status
    ) VALUES (
      v_repair_id,
      v_profile_id,
      v_next_no,
      'DRAFT',
      'Simple live policy',
      'سياسة مباشرة بسيطة',
      'Lean counter shop live policy. Left DRAFT for HQ Check policy / Pilot / Publish.',
      true,
      1
    );
  ELSIF v_status <> 'DRAFT' THEN
    RAISE EXCEPTION
      'WF_V2_SIMPLE repair version % must be DRAFT before seeding, found %',
      v_repair_id,
      v_status;
  END IF;

  PERFORM pg_temp.wf_seed_live_version(
    v_repair_id,
    false, false, false, false,
    true, true, true, false, false, false
  );
END;
$wf$;

SELECT pg_temp.wf_seed_simple_live_draft();

DO $$
DECLARE
  v_repair_id UUID := 'a1000000-0000-4000-8000-000000000014'::uuid;
  v_status TEXT;
BEGIN
  SELECT version_status INTO v_status
  FROM public.sys_wf_profile_ver_mst
  WHERE version_id = v_repair_id;

  IF v_status IS NOT NULL AND v_status <> 'DRAFT' THEN
    RAISE EXCEPTION
      '0475 must leave WF_V2_SIMPLE repair version as DRAFT, found %',
      v_status;
  END IF;
END;
$$;

COMMIT;
