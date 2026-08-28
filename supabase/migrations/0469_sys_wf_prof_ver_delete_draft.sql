-- ============================================================================
-- 0469_sys_wf_prof_ver_delete_draft.sql
-- Purpose: Atomically delete one DRAFT semantic profile version and every
--          related authoring/compiler row that belongs only to that version.
--
-- Ownership: CleanMateX tenant repository owns shared-schema migrations.
-- Consumer: cleanmatexsaas HQ service-role backend only.
-- Safety: Forward-only. Pilot, Published, and Retired versions cannot be
--         deleted. Order snapshots, tenant assignments, and gate-decision
--         ledger rows fail closed. No DROP CASCADE.
-- ============================================================================

BEGIN;

-- Draft deletion is the only allowed exception to append-only artifacts.
-- The setting is transaction-local and is set only after the delete command
-- proves the version is an unused Draft.
CREATE OR REPLACE FUNCTION public.sys_wf_prof_art_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF TG_OP = 'DELETE'
     AND current_setting('cmx.semantic_draft_delete', true) = '1' THEN
    RETURN OLD;
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_artifact_cf: compiled artifacts are immutable after insert';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sys_wf_prof_art_guard() IS
  'Makes compiler artifacts append-only except during the service-role Draft version delete command.';

CREATE OR REPLACE FUNCTION public.sys_wf_prof_ver_delete_draft_sem(
  p_profile_id UUID,
  p_version_no INTEGER,
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
  v_version public.sys_wf_profile_ver_mst%ROWTYPE;
  v_order_count INTEGER := 0;
  v_assignment_count INTEGER := 0;
  v_decision_count INTEGER := 0;
BEGIN
  IF p_profile_id IS NULL OR p_version_no IS NULL OR p_version_no < 1 THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_delete_draft_sem: profile and a positive version number are required';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_profile_id::TEXT, 0));

  PERFORM 1
  FROM public.sys_wf_profiles_cd
  WHERE profile_id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_delete_draft_sem: profile % does not exist',
      p_profile_id;
  END IF;

  SELECT *
  INTO v_version
  FROM public.sys_wf_profile_ver_mst
  WHERE profile_id = p_profile_id
    AND version_no = p_version_no
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_delete_draft_sem: version % does not exist for profile %',
      p_version_no,
      p_profile_id;
  END IF;

  IF v_version.version_status IS DISTINCT FROM 'DRAFT' THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_delete_draft_sem: only DRAFT versions can be deleted; version % is %',
      p_version_no,
      v_version.version_status;
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_order_count
  FROM public.org_orders_mst AS tenant_order
  WHERE tenant_order.wf_profile_version_id = v_version.version_id;

  IF v_order_count > 0 THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_delete_draft_sem: version % has % order snapshot(s) and cannot be deleted',
      p_version_no,
      v_order_count;
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_assignment_count
  FROM public.org_wf_profile_assign_cf AS assignment
  WHERE assignment.wf_profile_id = p_profile_id
    AND assignment.wf_version_no = p_version_no;

  IF v_assignment_count > 0 THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_delete_draft_sem: version % has % assignment(s) that must be removed first',
      p_version_no,
      v_assignment_count;
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_decision_count
  FROM public.org_wf_gate_decision_mst AS decision
  INNER JOIN public.sys_wf_prof_ver_artifact_cf AS artifact
    ON artifact.artifact_id = decision.profile_artifact_id
  WHERE artifact.version_id = v_version.version_id;

  IF v_decision_count > 0 THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_delete_draft_sem: version % has % gate-decision ledger row(s) and cannot be deleted',
      p_version_no,
      v_decision_count;
  END IF;

  -- Bypass row-level policy and artifact immutability only after the unused-Draft
  -- checks above. Both settings are transaction-local.
  PERFORM set_config('cmx.semantic_policy_command', '1', true);
  PERFORM set_config('cmx.semantic_draft_delete', '1', true);

  UPDATE public.sys_wf_profile_ver_mst
  SET
    current_artifact_id = NULL,
    compiled_schema_version = NULL,
    compiled_checksum = NULL,
    compiled_at = NULL,
    compiled_by = NULL,
    updated_at = CURRENT_TIMESTAMP,
    updated_by = p_actor_id
  WHERE sys_wf_profile_ver_mst.version_id = v_version.version_id;

  DELETE FROM public.sys_wf_prof_ver_exec_ch_cf AS channel
  WHERE channel.exec_id IN (
    SELECT executable.exec_id
    FROM public.sys_wf_prof_ver_exec_cf AS executable
    WHERE executable.version_id = v_version.version_id
  );

  DELETE FROM public.sys_wf_prof_ver_exec_gate_cf AS gate
  WHERE gate.exec_id IN (
    SELECT executable.exec_id
    FROM public.sys_wf_prof_ver_exec_cf AS executable
    WHERE executable.version_id = v_version.version_id
  );

  DELETE FROM public.sys_wf_prof_ver_exec_cf
  WHERE version_id = v_version.version_id;

  DELETE FROM public.sys_wf_prof_ver_mod_st_cf
  WHERE version_id = v_version.version_id;

  DELETE FROM public.sys_wf_prof_ver_module_cf
  WHERE version_id = v_version.version_id;

  DELETE FROM public.sys_wf_prof_ver_init_cf
  WHERE version_id = v_version.version_id;

  DELETE FROM public.sys_wf_prof_ver_evidence_cf
  WHERE version_id = v_version.version_id;

  DELETE FROM public.sys_wf_prof_ver_policy_cf
  WHERE version_id = v_version.version_id;

  DELETE FROM public.sys_wf_prof_ver_scr_dtl
  WHERE version_id = v_version.version_id;

  DELETE FROM public.sys_wf_prof_ver_artifact_cf
  WHERE version_id = v_version.version_id;

  DELETE FROM public.sys_wf_profile_ver_mst
  WHERE sys_wf_profile_ver_mst.version_id = v_version.version_id;

  RETURN QUERY SELECT v_version.version_id, v_version.version_no;
END;
$$;

REVOKE ALL ON FUNCTION public.sys_wf_prof_ver_delete_draft_sem(UUID, INTEGER, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.sys_wf_prof_ver_delete_draft_sem(UUID, INTEGER, UUID) TO service_role;

COMMENT ON FUNCTION public.sys_wf_prof_ver_delete_draft_sem(UUID, INTEGER, UUID) IS
  'Service-role-only atomic delete of one unused DRAFT semantic profile version and its related policy, screen, and unused compiler rows.';

COMMIT;
