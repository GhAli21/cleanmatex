-- ============================================================================
-- 0471_fix_sys_wf_prof_ver_commit_art_ambiguous_version_id.sql
-- ============================================================================
-- Purpose:
--   Fix PostgreSQL error 42702 ("column reference version_id is ambiguous")
--   in public.sys_wf_prof_ver_commit_art when HQ Start Pilot / Publish calls
--   the RPC.
--
-- Cause:
--   RETURNS TABLE (... version_id, version_status, policy_revision,
--   artifact_id, artifact_checksum ...) creates PL/pgSQL OUT variables that
--   shadow table columns of the same name. Unqualified predicates such as
--   WHERE version_id = v_version.version_id (and AND policy_revision = ...)
--   are therefore ambiguous.
--
-- Fix:
--   Qualify every shadowed column with a table alias, and return via
--   RETURN QUERY UPDATE ... RETURNING so OUT variables are not used as
--   assignment targets in the final statement.
--
-- Safety:
--   CREATE OR REPLACE only. No schema/data changes. Same grants retained.
--   Behavior matches 0458 commit semantics (immutable artifact + lifecycle).
-- Dependencies: 0458 (original function), 0470 (live lifecycle guard).
-- ============================================================================

BEGIN;

CREATE OR REPLACE FUNCTION public.sys_wf_prof_ver_commit_art(
  p_profile_id UUID,
  p_version_no INTEGER,
  p_expected_revision INTEGER,
  p_target_status TEXT,
  p_artifact_schema_version INTEGER,
  p_artifact_checksum TEXT,
  p_compiled_artifact JSONB,
  p_validation_report JSONB,
  p_actor_id UUID DEFAULT NULL
)
RETURNS TABLE (
  version_id UUID,
  version_status TEXT,
  policy_revision INTEGER,
  artifact_id UUID,
  artifact_checksum TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_version public.sys_wf_profile_ver_mst%ROWTYPE;
  v_artifact public.sys_wf_prof_ver_artifact_cf%ROWTYPE;
BEGIN
  IF p_target_status NOT IN ('PILOT', 'PUBLISHED') THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_commit_art: target status % must be PILOT or PUBLISHED',
      p_target_status;
  END IF;

  IF p_expected_revision < 1 OR p_artifact_schema_version < 1 THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_commit_art: revision and artifact schema version must be positive';
  END IF;

  IF p_artifact_checksum !~ '^[0-9a-f]{64}$' THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_commit_art: artifact checksum must be a lowercase SHA-256 hex digest';
  END IF;

  IF jsonb_typeof(p_compiled_artifact) <> 'object'
     OR jsonb_typeof(p_validation_report) <> 'object'
     OR (p_validation_report @> '{"ok": true}'::JSONB) IS NOT TRUE
  THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_commit_art: only an object artifact with a successful validation report can be committed';
  END IF;

  SELECT profile_version.*
  INTO v_version
  FROM public.sys_wf_profile_ver_mst AS profile_version
  WHERE profile_version.profile_id = p_profile_id
    AND profile_version.version_no = p_version_no
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_commit_art: profile version % does not exist for profile %',
      p_version_no,
      p_profile_id;
  END IF;

  IF v_version.policy_revision <> p_expected_revision THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_commit_art: stale policy revision %, current revision is %',
      p_expected_revision,
      v_version.policy_revision;
  END IF;

  IF v_version.version_status NOT IN ('DRAFT', 'PILOT') THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_commit_art: version % in status % cannot commit a candidate artifact',
      p_version_no,
      v_version.version_status;
  END IF;

  IF (v_version.version_status = 'DRAFT' AND p_target_status <> 'PILOT')
     OR (v_version.version_status = 'PILOT' AND p_target_status NOT IN ('PILOT', 'PUBLISHED'))
  THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_commit_art: invalid lifecycle transition from % to %',
      v_version.version_status,
      p_target_status;
  END IF;

  IF p_compiled_artifact ->> 'profile_id' <> p_profile_id::TEXT
     OR p_compiled_artifact ->> 'profile_version_id' <> v_version.version_id::TEXT
     OR p_compiled_artifact ->> 'profile_version_no' <> p_version_no::TEXT
     OR p_compiled_artifact ->> 'policy_revision' <> p_expected_revision::TEXT
     OR p_compiled_artifact ->> 'artifact_schema_version' <> p_artifact_schema_version::TEXT
  THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_commit_art: artifact identity does not match the locked profile version';
  END IF;

  SELECT artifact.*
  INTO v_artifact
  FROM public.sys_wf_prof_ver_artifact_cf AS artifact
  WHERE artifact.version_id = v_version.version_id
    AND artifact.policy_revision = p_expected_revision;

  IF FOUND THEN
    IF v_artifact.compile_state <> 'VALID'
       OR v_artifact.artifact_schema_version <> p_artifact_schema_version
       OR v_artifact.artifact_checksum <> p_artifact_checksum
       OR v_artifact.compiled_artifact <> p_compiled_artifact
    THEN
      RAISE EXCEPTION
        'sys_wf_prof_ver_commit_art: immutable artifact already exists for revision %',
        p_expected_revision;
    END IF;
  ELSE
    INSERT INTO public.sys_wf_prof_ver_artifact_cf AS artifact (
      version_id,
      policy_revision,
      artifact_schema_version,
      artifact_checksum,
      compile_state,
      compiled_artifact,
      validation_report,
      compiled_by,
      created_by,
      rec_status
    ) VALUES (
      v_version.version_id,
      p_expected_revision,
      p_artifact_schema_version,
      p_artifact_checksum,
      'VALID',
      p_compiled_artifact,
      p_validation_report,
      p_actor_id,
      p_actor_id,
      1
    )
    RETURNING artifact.* INTO v_artifact;
  END IF;

  -- RETURN QUERY avoids INTO assignment into shadowed OUT variable names.
  RETURN QUERY
  UPDATE public.sys_wf_profile_ver_mst AS profile_version
  SET
    version_status = p_target_status,
    current_artifact_id = v_artifact.artifact_id,
    compiled_schema_version = p_artifact_schema_version,
    compiled_checksum = p_artifact_checksum,
    compiled_at = CURRENT_TIMESTAMP,
    compiled_by = p_actor_id,
    updated_at = CURRENT_TIMESTAMP,
    updated_by = p_actor_id
  WHERE profile_version.version_id = v_version.version_id
  RETURNING
    profile_version.version_id,
    profile_version.version_status,
    profile_version.policy_revision,
    v_artifact.artifact_id,
    v_artifact.artifact_checksum;
END;
$$;

REVOKE ALL ON FUNCTION public.sys_wf_prof_ver_commit_art(
  UUID, INTEGER, INTEGER, TEXT, INTEGER, TEXT, JSONB, JSONB, UUID
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.sys_wf_prof_ver_commit_art(
  UUID, INTEGER, INTEGER, TEXT, INTEGER, TEXT, JSONB, JSONB, UUID
) TO service_role;

COMMENT ON FUNCTION public.sys_wf_prof_ver_commit_art(
  UUID, INTEGER, INTEGER, TEXT, INTEGER, TEXT, JSONB, JSONB, UUID
) IS
  'Atomically stores one validated immutable semantic artifact and transitions a locked Draft/Pilot profile version to Pilot or Published. Column references are fully qualified to avoid RETURNS TABLE OUT-variable shadowing.';

COMMIT;
