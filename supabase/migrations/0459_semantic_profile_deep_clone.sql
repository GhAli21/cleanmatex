-- ============================================================================
-- 0459_semantic_profile_deep_clone.sql
-- Purpose: Provide one atomic, service-role-only deep clone of a semantic
--          workflow profile version. The clone is always a fresh DRAFT and
--          never inherits an artifact, published state, graph pin, or frozen
--          legacy runtime overlay.
--
-- Ownership: CleanMateX tenant repository owns shared-schema migrations.
-- Consumer: cleanmatexsaas HQ service-role backend only.
-- Safety: Forward-only. The function copies policy source rows only; it does
--         not alter the source version, historical artifacts, assignments, or
--         order snapshots.
-- ============================================================================

BEGIN;

-- A deep clone must be one transaction so an operator can never receive a
-- partially copied candidate. The advisory lock serializes version-number
-- allocation for one profile without locking unrelated profiles.
CREATE OR REPLACE FUNCTION public.sys_wf_prof_ver_clone_sem(
  p_profile_id UUID,
  p_source_version_no INTEGER,
  p_change_summary TEXT DEFAULT NULL,
  p_change_summary2 TEXT DEFAULT NULL,
  p_actor_id UUID DEFAULT NULL
)
RETURNS TABLE (
  version_id UUID,
  version_no INTEGER
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_source public.sys_wf_profile_ver_mst%ROWTYPE;
  v_source_exec public.sys_wf_prof_ver_exec_cf%ROWTYPE;
  v_new_version_id UUID;
  v_new_version_no INTEGER;
  v_new_exec_id UUID;
BEGIN
  IF p_source_version_no < 1 THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_clone_sem: source version number must be positive';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_profile_id::TEXT, 0));

  -- The profile-root lock also conflicts with the foreign-key key-share lock
  -- used by any other version insert, protecting version allocation while the
  -- legacy and semantic authoring paths coexist during development cutover.
  PERFORM 1
  FROM public.sys_wf_profiles_cd
  WHERE profile_id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_clone_sem: profile % does not exist',
      p_profile_id;
  END IF;

  -- Locking the source master row prevents a concurrent candidate edit from
  -- producing a clone assembled from inconsistent semantic policy rows.
  SELECT *
  INTO v_source
  FROM public.sys_wf_profile_ver_mst
  WHERE profile_id = p_profile_id
    AND version_no = p_source_version_no
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_clone_sem: source version % does not exist for profile %',
      p_source_version_no,
      p_profile_id;
  END IF;

  SELECT COALESCE(MAX(profile_version.version_no), 0) + 1
  INTO v_new_version_no
  FROM public.sys_wf_profile_ver_mst AS profile_version
  WHERE profile_version.profile_id = p_profile_id;

  -- Legacy display fields are copied only to keep existing HQ read views
  -- coherent during cutover. Semantic policy tables below remain the sole
  -- compiler input, while every historical runtime pin is deliberately reset.
  INSERT INTO public.sys_wf_profile_ver_mst AS cloned (
    profile_id,
    version_no,
    version_status,
    name,
    name2,
    change_summary,
    change_summary2,
    based_on_template_id,
    use_preparation_screen,
    use_assembly_screen,
    use_qa_screen,
    use_packing_screen,
    track_individual_piece,
    orders_split_enabled,
    allow_back_steps,
    config_json,
    wf_graph_def_version_id,
    profile_policy_json,
    profile_policy_checksum,
    published_policy_at,
    policy_revision,
    current_artifact_id,
    compiled_schema_version,
    compiled_checksum,
    compiled_at,
    compiled_by,
    pilot_started_at,
    pilot_started_by,
    published_at,
    published_by,
    retired_at,
    retired_by,
    is_active,
    created_by,
    updated_by,
    rec_status
  ) VALUES (
    p_profile_id,
    v_new_version_no,
    'DRAFT',
    v_source.name,
    v_source.name2,
    COALESCE(
      NULLIF(BTRIM(p_change_summary), ''),
      FORMAT('Cloned from version %s', p_source_version_no)
    ),
    NULLIF(BTRIM(p_change_summary2), ''),
    v_source.based_on_template_id,
    v_source.use_preparation_screen,
    v_source.use_assembly_screen,
    v_source.use_qa_screen,
    v_source.use_packing_screen,
    v_source.track_individual_piece,
    v_source.orders_split_enabled,
    v_source.allow_back_steps,
    v_source.config_json,
    NULL,
    '{}'::JSONB,
    NULL,
    NULL,
    1,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    NULL,
    TRUE,
    p_actor_id,
    p_actor_id,
    1
  )
  RETURNING cloned.version_id INTO v_new_version_id;

  -- Copy the old screen-list rows only as non-authoritative presentation data.
  -- The compiler reads the normalized module rows that are copied immediately
  -- after this compatibility data.
  INSERT INTO public.sys_wf_prof_ver_scr_dtl (
    version_id,
    screen_key,
    is_enabled,
    display_order,
    rec_status
  )
  SELECT
    v_new_version_id,
    screen.screen_key,
    screen.is_enabled,
    screen.display_order,
    screen.rec_status
  FROM public.sys_wf_prof_ver_scr_dtl AS screen
  WHERE screen.version_id = v_source.version_id;

  INSERT INTO public.sys_wf_prof_ver_module_cf (
    version_id,
    screen_key,
    module_mode,
    is_enabled,
    display_order,
    created_by,
    rec_status,
    rec_order,
    is_active,
    rec_notes
  )
  SELECT
    v_new_version_id,
    module.screen_key,
    module.module_mode,
    module.is_enabled,
    module.display_order,
    p_actor_id,
    module.rec_status,
    module.rec_order,
    module.is_active,
    module.rec_notes
  FROM public.sys_wf_prof_ver_module_cf AS module
  WHERE module.version_id = v_source.version_id;

  INSERT INTO public.sys_wf_prof_ver_mod_st_cf (
    version_id,
    screen_key,
    status_code,
    visibility_mode,
    display_order,
    created_by,
    rec_status,
    rec_order,
    is_active,
    rec_notes
  )
  SELECT
    v_new_version_id,
    module_status.screen_key,
    module_status.status_code,
    module_status.visibility_mode,
    module_status.display_order,
    p_actor_id,
    module_status.rec_status,
    module_status.rec_order,
    module_status.is_active,
    module_status.rec_notes
  FROM public.sys_wf_prof_ver_mod_st_cf AS module_status
  WHERE module_status.version_id = v_source.version_id;

  INSERT INTO public.sys_wf_prof_ver_policy_cf (
    version_id,
    policy_schema_version,
    stage_sequence,
    use_preparation,
    use_assembly,
    use_qa,
    use_packing,
    track_individual_piece,
    orders_split_enabled,
    allow_back_steps,
    pickup_enabled,
    delivery_enabled,
    public_tracking_enabled,
    require_pickup_release,
    allow_direct_counter_pickup,
    require_collection_for_pickup,
    require_delivery_stop,
    require_collection_for_delivery,
    require_rack_before_release,
    pod_policy_code,
    financial_release_policy_code,
    partial_pickup_enabled,
    partial_delivery_enabled,
    returns_enabled,
    otp_enabled,
    conditional_routing_enabled,
    created_by,
    rec_status,
    rec_order,
    is_active,
    rec_notes
  )
  SELECT
    v_new_version_id,
    policy.policy_schema_version,
    policy.stage_sequence,
    policy.use_preparation,
    policy.use_assembly,
    policy.use_qa,
    policy.use_packing,
    policy.track_individual_piece,
    policy.orders_split_enabled,
    policy.allow_back_steps,
    policy.pickup_enabled,
    policy.delivery_enabled,
    policy.public_tracking_enabled,
    policy.require_pickup_release,
    policy.allow_direct_counter_pickup,
    policy.require_collection_for_pickup,
    policy.require_delivery_stop,
    policy.require_collection_for_delivery,
    policy.require_rack_before_release,
    policy.pod_policy_code,
    policy.financial_release_policy_code,
    policy.partial_pickup_enabled,
    policy.partial_delivery_enabled,
    policy.returns_enabled,
    policy.otp_enabled,
    policy.conditional_routing_enabled,
    p_actor_id,
    policy.rec_status,
    policy.rec_order,
    policy.is_active,
    policy.rec_notes
  FROM public.sys_wf_prof_ver_policy_cf AS policy
  WHERE policy.version_id = v_source.version_id;

  -- Executions own child channel/gate identifiers, so they are copied one at a
  -- time to give every clone an independent graph of immutable references.
  FOR v_source_exec IN
    SELECT *
    FROM public.sys_wf_prof_ver_exec_cf
    WHERE version_id = v_source.version_id
    ORDER BY display_order, exec_id
  LOOP
    INSERT INTO public.sys_wf_prof_ver_exec_cf (
      version_id,
      screen_key,
      action_code,
      from_status,
      to_status,
      transition_kind,
      permission_code,
      requires_expected_version,
      requires_idempotency,
      requires_reason,
      min_reason_length,
      requires_evidence,
      display_order,
      is_active,
      created_by,
      rec_status,
      rec_order,
      rec_notes
    ) VALUES (
      v_new_version_id,
      v_source_exec.screen_key,
      v_source_exec.action_code,
      v_source_exec.from_status,
      v_source_exec.to_status,
      v_source_exec.transition_kind,
      v_source_exec.permission_code,
      v_source_exec.requires_expected_version,
      v_source_exec.requires_idempotency,
      v_source_exec.requires_reason,
      v_source_exec.min_reason_length,
      v_source_exec.requires_evidence,
      v_source_exec.display_order,
      v_source_exec.is_active,
      p_actor_id,
      v_source_exec.rec_status,
      v_source_exec.rec_order,
      v_source_exec.rec_notes
    )
    RETURNING exec_id INTO v_new_exec_id;

    INSERT INTO public.sys_wf_prof_ver_exec_ch_cf (
      exec_id,
      channel_code,
      created_by,
      rec_status,
      rec_order,
      is_active,
      rec_notes
    )
    SELECT
      v_new_exec_id,
      execution_channel.channel_code,
      p_actor_id,
      execution_channel.rec_status,
      execution_channel.rec_order,
      execution_channel.is_active,
      execution_channel.rec_notes
    FROM public.sys_wf_prof_ver_exec_ch_cf AS execution_channel
    WHERE execution_channel.exec_id = v_source_exec.exec_id;

    INSERT INTO public.sys_wf_prof_ver_exec_gate_cf (
      exec_id,
      gate_code,
      evaluator_version,
      parameters_json,
      blocking_mode,
      message_key,
      override_permission_code,
      override_min_reason_length,
      display_order,
      created_by,
      rec_status,
      rec_order,
      is_active,
      rec_notes
    )
    SELECT
      v_new_exec_id,
      execution_gate.gate_code,
      execution_gate.evaluator_version,
      execution_gate.parameters_json,
      execution_gate.blocking_mode,
      execution_gate.message_key,
      execution_gate.override_permission_code,
      execution_gate.override_min_reason_length,
      execution_gate.display_order,
      p_actor_id,
      execution_gate.rec_status,
      execution_gate.rec_order,
      execution_gate.is_active,
      execution_gate.rec_notes
    FROM public.sys_wf_prof_ver_exec_gate_cf AS execution_gate
    WHERE execution_gate.exec_id = v_source_exec.exec_id;
  END LOOP;

  INSERT INTO public.sys_wf_prof_ver_init_cf (
    version_id,
    rule_code,
    order_source_code,
    order_type_id,
    is_retail,
    is_quick_drop,
    initial_status,
    priority,
    is_active,
    name,
    name2,
    created_by,
    rec_status,
    rec_order,
    rec_notes
  )
  SELECT
    v_new_version_id,
    initial_rule.rule_code,
    initial_rule.order_source_code,
    initial_rule.order_type_id,
    initial_rule.is_retail,
    initial_rule.is_quick_drop,
    initial_rule.initial_status,
    initial_rule.priority,
    initial_rule.is_active,
    initial_rule.name,
    initial_rule.name2,
    p_actor_id,
    initial_rule.rec_status,
    initial_rule.rec_order,
    initial_rule.rec_notes
  FROM public.sys_wf_prof_ver_init_cf AS initial_rule
  WHERE initial_rule.version_id = v_source.version_id;

  INSERT INTO public.sys_wf_prof_ver_evidence_cf (
    version_id,
    fulfilment_channel,
    evidence_method_code,
    is_required,
    minimum_count,
    display_order,
    created_by,
    rec_status,
    rec_order,
    is_active,
    rec_notes
  )
  SELECT
    v_new_version_id,
    evidence.fulfilment_channel,
    evidence.evidence_method_code,
    evidence.is_required,
    evidence.minimum_count,
    evidence.display_order,
    p_actor_id,
    evidence.rec_status,
    evidence.rec_order,
    evidence.is_active,
    evidence.rec_notes
  FROM public.sys_wf_prof_ver_evidence_cf AS evidence
  WHERE evidence.version_id = v_source.version_id;

  -- Copy triggers intentionally invalidate artifacts and advance the revision
  -- for each inserted source row. The entire clone is unobservable until this
  -- transaction commits, so reset it to a clean revision-one candidate here.
  UPDATE public.sys_wf_profile_ver_mst
  SET
    policy_revision = 1,
    current_artifact_id = NULL,
    compiled_schema_version = NULL,
    compiled_checksum = NULL,
    compiled_at = NULL,
    compiled_by = NULL,
    updated_at = CURRENT_TIMESTAMP,
    updated_by = p_actor_id
  WHERE sys_wf_profile_ver_mst.version_id = v_new_version_id;

  RETURN QUERY SELECT v_new_version_id, v_new_version_no;
END;
$$;

REVOKE ALL ON FUNCTION public.sys_wf_prof_ver_clone_sem(
  UUID, INTEGER, TEXT, TEXT, UUID
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.sys_wf_prof_ver_clone_sem(
  UUID, INTEGER, TEXT, TEXT, UUID
) TO service_role;

COMMENT ON FUNCTION public.sys_wf_prof_ver_clone_sem(
  UUID, INTEGER, TEXT, TEXT, UUID
) IS
  'Atomically deep-clones every semantic profile policy row into a new revision-one Draft without inheriting artifacts, lifecycle state, graph pins, assignments, or order snapshots.';

COMMIT;
