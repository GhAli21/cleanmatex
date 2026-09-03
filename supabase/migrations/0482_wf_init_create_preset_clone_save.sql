-- ============================================================
-- Migration: 0482_wf_init_create_preset_clone_save.sql
-- Purpose:   Wire create_preset_code through deep-clone and save_policy
--            after 0480 added the column. Signatures unchanged from 0459/0467.
-- Related:   0480, 0459, 0467
-- ============================================================
-- Do not edit applied 0470-0481. Agents never apply this migration.

BEGIN;

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
    create_preset_code,
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
    initial_rule.create_preset_code,
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


CREATE OR REPLACE FUNCTION public.sys_wf_prof_ver_save_policy(
  p_profile_id UUID,
  p_version_no INTEGER,
  p_expected_revision INTEGER,
  p_policy JSONB,
  p_modules JSONB,
  p_executions JSONB,
  p_initial_rules JSONB,
  p_evidence JSONB,
  p_actor_id UUID DEFAULT NULL
)
RETURNS TABLE (
  version_id UUID,
  version_no INTEGER,
  version_status TEXT,
  policy_revision INTEGER,
  updated_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_version public.sys_wf_profile_ver_mst%ROWTYPE;
  v_module JSONB;
  v_status JSONB;
  v_execution JSONB;
  v_channel JSONB;
  v_gate JSONB;
  v_rule JSONB;
  v_evidence JSONB;
  v_exec_id UUID;
  v_policy_stage_sequence TEXT[];
  v_required_policy_keys TEXT[] := ARRAY[
    'stage_sequence',
    'use_preparation',
    'use_assembly',
    'use_qa',
    'use_packing',
    'track_individual_piece',
    'orders_split_enabled',
    'allow_back_steps',
    'pickup_enabled',
    'delivery_enabled',
    'public_tracking_enabled',
    'require_pickup_release',
    'allow_direct_counter_pickup',
    'require_collection_for_pickup',
    'require_delivery_stop',
    'require_collection_for_delivery',
    'require_rack_before_release'
  ];
BEGIN
  IF p_profile_id IS NULL
     OR p_version_no IS NULL
     OR p_version_no < 1
     OR p_expected_revision IS NULL
     OR p_expected_revision < 1
  THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_save_policy: profile, positive version number, and positive expected revision are required';
  END IF;

  IF jsonb_typeof(p_policy) IS DISTINCT FROM 'object'
     OR jsonb_typeof(p_modules) IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_executions) IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_initial_rules) IS DISTINCT FROM 'array'
     OR jsonb_typeof(p_evidence) IS DISTINCT FROM 'array'
  THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_save_policy: policy must be an object and modules, executions, initial rules, and evidence must be arrays';
  END IF;

  IF NOT (p_policy ?& v_required_policy_keys)
     OR jsonb_typeof(p_policy -> 'stage_sequence') IS DISTINCT FROM 'array'
  THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_save_policy: policy is missing one or more required fields';
  END IF;

  -- Qualify profile_id / version_no: RETURNS TABLE OUT vars shadow those names.
  SELECT profile_version.*
  INTO v_version
  FROM public.sys_wf_profile_ver_mst AS profile_version
  WHERE profile_version.profile_id = p_profile_id
    AND profile_version.version_no = p_version_no
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_save_policy: profile version % does not exist for profile %',
      p_version_no,
      p_profile_id;
  END IF;

  IF v_version.version_status NOT IN ('DRAFT', 'PILOT') THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_save_policy: version % in status % is immutable',
      p_version_no,
      v_version.version_status;
  END IF;

  IF v_version.policy_revision <> p_expected_revision THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_save_policy: stale policy revision %, current revision is %',
      p_expected_revision,
      v_version.policy_revision;
  END IF;

  SELECT ARRAY(
    SELECT jsonb_array_elements_text(p_policy -> 'stage_sequence')
  ) INTO v_policy_stage_sequence;

  IF cardinality(v_policy_stage_sequence) = 0 THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_save_policy: stage_sequence must contain at least one status';
  END IF;

  PERFORM set_config('cmx.semantic_policy_command', '1', true);

  DELETE FROM public.sys_wf_prof_ver_exec_gate_cf AS exec_gate
  WHERE exec_gate.exec_id IN (
    SELECT exec_row.exec_id
    FROM public.sys_wf_prof_ver_exec_cf AS exec_row
    WHERE exec_row.version_id = v_version.version_id
  );

  DELETE FROM public.sys_wf_prof_ver_exec_ch_cf AS exec_ch
  WHERE exec_ch.exec_id IN (
    SELECT exec_row.exec_id
    FROM public.sys_wf_prof_ver_exec_cf AS exec_row
    WHERE exec_row.version_id = v_version.version_id
  );

  DELETE FROM public.sys_wf_prof_ver_exec_cf AS exec_row
  WHERE exec_row.version_id = v_version.version_id;

  DELETE FROM public.sys_wf_prof_ver_mod_st_cf AS mod_st
  WHERE mod_st.version_id = v_version.version_id;

  DELETE FROM public.sys_wf_prof_ver_module_cf AS module_row
  WHERE module_row.version_id = v_version.version_id;

  DELETE FROM public.sys_wf_prof_ver_init_cf AS init_row
  WHERE init_row.version_id = v_version.version_id;

  DELETE FROM public.sys_wf_prof_ver_evidence_cf AS evidence_row
  WHERE evidence_row.version_id = v_version.version_id;

  DELETE FROM public.sys_wf_prof_ver_policy_cf AS policy_row
  WHERE policy_row.version_id = v_version.version_id;

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
    updated_by,
    rec_notes
  ) VALUES (
    v_version.version_id,
    COALESCE((p_policy ->> 'policy_schema_version')::INTEGER, 1),
    v_policy_stage_sequence,
    (p_policy ->> 'use_preparation')::BOOLEAN,
    (p_policy ->> 'use_assembly')::BOOLEAN,
    (p_policy ->> 'use_qa')::BOOLEAN,
    (p_policy ->> 'use_packing')::BOOLEAN,
    (p_policy ->> 'track_individual_piece')::BOOLEAN,
    (p_policy ->> 'orders_split_enabled')::BOOLEAN,
    (p_policy ->> 'allow_back_steps')::BOOLEAN,
    (p_policy ->> 'pickup_enabled')::BOOLEAN,
    (p_policy ->> 'delivery_enabled')::BOOLEAN,
    (p_policy ->> 'public_tracking_enabled')::BOOLEAN,
    (p_policy ->> 'require_pickup_release')::BOOLEAN,
    (p_policy ->> 'allow_direct_counter_pickup')::BOOLEAN,
    (p_policy ->> 'require_collection_for_pickup')::BOOLEAN,
    (p_policy ->> 'require_delivery_stop')::BOOLEAN,
    (p_policy ->> 'require_collection_for_delivery')::BOOLEAN,
    (p_policy ->> 'require_rack_before_release')::BOOLEAN,
    NULLIF(BTRIM(p_policy ->> 'pod_policy_code'), ''),
    NULLIF(BTRIM(p_policy ->> 'financial_release_policy_code'), ''),
    false,
    false,
    false,
    false,
    false,
    p_actor_id,
    p_actor_id,
    NULLIF(BTRIM(p_policy ->> 'rec_notes'), '')
  );

  FOR v_module IN SELECT value FROM jsonb_array_elements(p_modules)
  LOOP
    IF jsonb_typeof(v_module) <> 'object'
       OR NULLIF(BTRIM(v_module ->> 'screen_key'), '') IS NULL
       OR NULLIF(BTRIM(v_module ->> 'module_mode'), '') IS NULL
       OR jsonb_typeof(COALESCE(v_module -> 'statuses', '[]'::JSONB)) IS DISTINCT FROM 'array'
    THEN
      RAISE EXCEPTION
        'sys_wf_prof_ver_save_policy: every module requires screen_key, module_mode, and statuses array';
    END IF;

    INSERT INTO public.sys_wf_prof_ver_module_cf (
      version_id, screen_key, module_mode, is_enabled, display_order,
      created_by, updated_by, rec_notes
    ) VALUES (
      v_version.version_id,
      v_module ->> 'screen_key',
      v_module ->> 'module_mode',
      COALESCE((v_module ->> 'is_enabled')::BOOLEAN, true),
      COALESCE((v_module ->> 'display_order')::INTEGER, 0),
      p_actor_id,
      p_actor_id,
      NULLIF(BTRIM(v_module ->> 'rec_notes'), '')
    );

    FOR v_status IN
      SELECT value
      FROM jsonb_array_elements(COALESCE(v_module -> 'statuses', '[]'::JSONB))
    LOOP
      IF jsonb_typeof(v_status) <> 'object'
         OR NULLIF(BTRIM(v_status ->> 'status_code'), '') IS NULL
         OR NULLIF(BTRIM(v_status ->> 'visibility_mode'), '') IS NULL
      THEN
        RAISE EXCEPTION
          'sys_wf_prof_ver_save_policy: every module status requires status_code and visibility_mode';
      END IF;

      INSERT INTO public.sys_wf_prof_ver_mod_st_cf (
        version_id, screen_key, status_code, visibility_mode, display_order,
        created_by, updated_by, rec_notes
      ) VALUES (
        v_version.version_id,
        v_module ->> 'screen_key',
        v_status ->> 'status_code',
        v_status ->> 'visibility_mode',
        COALESCE((v_status ->> 'display_order')::INTEGER, 0),
        p_actor_id,
        p_actor_id,
        NULLIF(BTRIM(v_status ->> 'rec_notes'), '')
      );
    END LOOP;
  END LOOP;

  FOR v_execution IN SELECT value FROM jsonb_array_elements(p_executions)
  LOOP
    IF jsonb_typeof(v_execution) <> 'object'
       OR NULLIF(BTRIM(v_execution ->> 'screen_key'), '') IS NULL
       OR NULLIF(BTRIM(v_execution ->> 'action_code'), '') IS NULL
       OR NULLIF(BTRIM(v_execution ->> 'from_status'), '') IS NULL
       OR NULLIF(BTRIM(v_execution ->> 'to_status'), '') IS NULL
       OR jsonb_typeof(COALESCE(v_execution -> 'channels', '[]'::JSONB)) IS DISTINCT FROM 'array'
       OR jsonb_typeof(COALESCE(v_execution -> 'gates', '[]'::JSONB)) IS DISTINCT FROM 'array'
    THEN
      RAISE EXCEPTION
        'sys_wf_prof_ver_save_policy: every executable requires screen/action/from/to plus channels and gates arrays';
    END IF;

    INSERT INTO public.sys_wf_prof_ver_exec_cf (
      version_id, screen_key, action_code, from_status, to_status,
      transition_kind, permission_code, requires_expected_version,
      requires_idempotency, requires_reason, min_reason_length,
      requires_evidence, display_order, is_active, created_by, updated_by,
      rec_notes
    ) VALUES (
      v_version.version_id,
      v_execution ->> 'screen_key',
      v_execution ->> 'action_code',
      v_execution ->> 'from_status',
      v_execution ->> 'to_status',
      COALESCE(NULLIF(BTRIM(v_execution ->> 'transition_kind'), ''), 'fixed'),
      NULLIF(BTRIM(v_execution ->> 'permission_code'), ''),
      COALESCE((v_execution ->> 'requires_expected_version')::BOOLEAN, true),
      COALESCE((v_execution ->> 'requires_idempotency')::BOOLEAN, true),
      COALESCE((v_execution ->> 'requires_reason')::BOOLEAN, false),
      COALESCE((v_execution ->> 'min_reason_length')::INTEGER, 0),
      COALESCE((v_execution ->> 'requires_evidence')::BOOLEAN, false),
      COALESCE((v_execution ->> 'display_order')::INTEGER, 0),
      COALESCE((v_execution ->> 'is_active')::BOOLEAN, true),
      p_actor_id,
      p_actor_id,
      NULLIF(BTRIM(v_execution ->> 'rec_notes'), '')
    ) RETURNING exec_id INTO v_exec_id;

    FOR v_channel IN
      SELECT value
      FROM jsonb_array_elements(COALESCE(v_execution -> 'channels', '[]'::JSONB))
    LOOP
      IF jsonb_typeof(v_channel) <> 'object'
         OR NULLIF(BTRIM(v_channel ->> 'channel_code'), '') IS NULL
      THEN
        RAISE EXCEPTION
          'sys_wf_prof_ver_save_policy: every executable channel requires channel_code';
      END IF;

      INSERT INTO public.sys_wf_prof_ver_exec_ch_cf (
        exec_id, channel_code, created_by, updated_by, rec_notes
      ) VALUES (
        v_exec_id,
        v_channel ->> 'channel_code',
        p_actor_id,
        p_actor_id,
        NULLIF(BTRIM(v_channel ->> 'rec_notes'), '')
      );
    END LOOP;

    FOR v_gate IN
      SELECT value
      FROM jsonb_array_elements(COALESCE(v_execution -> 'gates', '[]'::JSONB))
    LOOP
      IF jsonb_typeof(v_gate) <> 'object'
         OR NULLIF(BTRIM(v_gate ->> 'gate_code'), '') IS NULL
         OR jsonb_typeof(COALESCE(v_gate -> 'parameters_json', '{}'::JSONB)) IS DISTINCT FROM 'object'
      THEN
        RAISE EXCEPTION
          'sys_wf_prof_ver_save_policy: every executable gate requires gate_code and an object parameters_json';
      END IF;

      INSERT INTO public.sys_wf_prof_ver_exec_gate_cf (
        exec_id, gate_code, evaluator_version, parameters_json, blocking_mode,
        message_key, override_permission_code, override_min_reason_length,
        display_order, created_by, updated_by, rec_notes
      ) VALUES (
        v_exec_id,
        v_gate ->> 'gate_code',
        COALESCE((v_gate ->> 'evaluator_version')::INTEGER, 1),
        COALESCE(v_gate -> 'parameters_json', '{}'::JSONB),
        COALESCE(NULLIF(BTRIM(v_gate ->> 'blocking_mode'), ''), 'hard_block'),
        NULLIF(BTRIM(v_gate ->> 'message_key'), ''),
        NULLIF(BTRIM(v_gate ->> 'override_permission_code'), ''),
        COALESCE((v_gate ->> 'override_min_reason_length')::INTEGER, 0),
        COALESCE((v_gate ->> 'display_order')::INTEGER, 0),
        p_actor_id,
        p_actor_id,
        NULLIF(BTRIM(v_gate ->> 'rec_notes'), '')
      );
    END LOOP;
  END LOOP;

  FOR v_rule IN SELECT value FROM jsonb_array_elements(p_initial_rules)
  LOOP
    IF jsonb_typeof(v_rule) <> 'object'
       OR NULLIF(BTRIM(v_rule ->> 'rule_code'), '') IS NULL
       OR NULLIF(BTRIM(v_rule ->> 'initial_status'), '') IS NULL
    THEN
      RAISE EXCEPTION
        'sys_wf_prof_ver_save_policy: every initial rule requires rule_code and initial_status';
    END IF;

    INSERT INTO public.sys_wf_prof_ver_init_cf (
      version_id, rule_code, order_source_code, order_type_id, is_retail,
      is_quick_drop, initial_status, priority, create_preset_code, is_active, name, name2,
      created_by, updated_by, rec_notes
    ) VALUES (
      v_version.version_id,
      v_rule ->> 'rule_code',
      NULLIF(BTRIM(v_rule ->> 'order_source_code'), ''),
      NULLIF(BTRIM(v_rule ->> 'order_type_id'), ''),
      CASE WHEN v_rule ? 'is_retail' THEN (v_rule ->> 'is_retail')::BOOLEAN ELSE NULL END,
      CASE WHEN v_rule ? 'is_quick_drop' THEN (v_rule ->> 'is_quick_drop')::BOOLEAN ELSE NULL END,
      v_rule ->> 'initial_status',
      COALESCE((v_rule ->> 'priority')::INTEGER, 100),
      NULLIF(BTRIM(v_rule ->> 'create_preset_code'), ''),
      COALESCE((v_rule ->> 'is_active')::BOOLEAN, true),
      NULLIF(BTRIM(v_rule ->> 'name'), ''),
      NULLIF(BTRIM(v_rule ->> 'name2'), ''),
      p_actor_id,
      p_actor_id,
      NULLIF(BTRIM(v_rule ->> 'rec_notes'), '')
    );
  END LOOP;

  FOR v_evidence IN SELECT value FROM jsonb_array_elements(p_evidence)
  LOOP
    IF jsonb_typeof(v_evidence) <> 'object'
       OR NULLIF(BTRIM(v_evidence ->> 'fulfilment_channel'), '') IS NULL
       OR NULLIF(BTRIM(v_evidence ->> 'evidence_method_code'), '') IS NULL
    THEN
      RAISE EXCEPTION
        'sys_wf_prof_ver_save_policy: every evidence rule requires fulfilment_channel and evidence_method_code';
    END IF;

    INSERT INTO public.sys_wf_prof_ver_evidence_cf (
      version_id, fulfilment_channel, evidence_method_code, is_required,
      minimum_count, display_order, created_by, updated_by, rec_notes
    ) VALUES (
      v_version.version_id,
      v_evidence ->> 'fulfilment_channel',
      v_evidence ->> 'evidence_method_code',
      COALESCE((v_evidence ->> 'is_required')::BOOLEAN, false),
      COALESCE((v_evidence ->> 'minimum_count')::INTEGER, 0),
      COALESCE((v_evidence ->> 'display_order')::INTEGER, 0),
      p_actor_id,
      p_actor_id,
      NULLIF(BTRIM(v_evidence ->> 'rec_notes'), '')
    );
  END LOOP;

  -- RETURN QUERY avoids INTO assignment into shadowed OUT variable names.
  RETURN QUERY
  UPDATE public.sys_wf_profile_ver_mst AS profile_version
  SET
    policy_revision = profile_version.policy_revision + 1,
    current_artifact_id = NULL,
    compiled_schema_version = NULL,
    compiled_checksum = NULL,
    compiled_at = NULL,
    compiled_by = NULL,
    updated_at = CURRENT_TIMESTAMP,
    updated_by = p_actor_id
  WHERE profile_version.version_id = v_version.version_id
  RETURNING
    profile_version.version_id,
    profile_version.version_no,
    profile_version.version_status,
    profile_version.policy_revision,
    profile_version.updated_at;
END;
$$;

REVOKE ALL ON FUNCTION public.sys_wf_prof_ver_save_policy(
  UUID, INTEGER, INTEGER, JSONB, JSONB, JSONB, JSONB, JSONB, UUID
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.sys_wf_prof_ver_save_policy(
  UUID, INTEGER, INTEGER, JSONB, JSONB, JSONB, JSONB, JSONB, UUID
) TO service_role;

COMMENT ON FUNCTION public.sys_wf_prof_ver_save_policy(
  UUID, INTEGER, INTEGER, JSONB, JSONB, JSONB, JSONB, JSONB, UUID
) IS
  'Atomically replaces one complete normalized semantic policy for a locked Draft or Pilot profile version, advances policy revision once, and invalidates its current compiled artifact. Nested JSON input exists only at the command boundary; persisted policy remains normalized.';


COMMIT;
