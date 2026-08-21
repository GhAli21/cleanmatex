-- ============================================================================
-- 0458_semantic_profile_artifact_commit.sql
-- Purpose: Commit one validated semantic profile artifact and its lifecycle
--          transition as one database statement. This prevents a profile from
--          becoming PILOT/PUBLISHED without the exact immutable artifact that
--          the tenant runtime will later snapshot onto orders.
--
-- Ownership: CleanMateX tenant repository owns shared-schema migrations.
-- Consumer: cleanmatexsaas HQ service-role backend only.
-- Safety: This migration is forward-only. It neither changes historical order
--         snapshots nor grants execution to browser, anonymous, or tenant roles.
-- ============================================================================

BEGIN;

-- The original semantic guard prevented invalid PUBLISHED rows but still left
-- a direct DRAFT -> PUBLISHED transition technically possible. The runtime
-- contract requires Pilot to be an explicit candidate lifecycle stage.
CREATE OR REPLACE FUNCTION public.sys_wf_prof_ver_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_artifact_valid BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.version_status IN ('PILOT', 'PUBLISHED', 'RETIRED') THEN
      RAISE EXCEPTION
        'sys_wf_profile_ver_mst: cannot delete % version %',
        OLD.version_status,
        OLD.version_no;
    END IF;
    RETURN OLD;
  END IF;

  IF TG_OP <> 'UPDATE' THEN
    RETURN NEW;
  END IF;

  IF OLD.version_status = 'RETIRED' THEN
    RAISE EXCEPTION
      'sys_wf_profile_ver_mst: RETIRED version % is immutable',
      OLD.version_no;
  END IF;

  IF OLD.version_status = 'PUBLISHED' THEN
    IF NEW.version_status = 'RETIRED'
       AND (to_jsonb(NEW) - ARRAY['version_status', 'retired_at', 'retired_by', 'updated_at', 'updated_by'])
         = (to_jsonb(OLD) - ARRAY['version_status', 'retired_at', 'retired_by', 'updated_at', 'updated_by'])
    THEN
      NEW.retired_at := COALESCE(NEW.retired_at, CURRENT_TIMESTAMP);
      NEW.updated_at := CURRENT_TIMESTAMP;
      RETURN NEW;
    END IF;

    RAISE EXCEPTION
      'sys_wf_profile_ver_mst: PUBLISHED version % is immutable; clone a Draft/Pilot version instead',
      OLD.version_no;
  END IF;

  IF OLD.version_status = 'DRAFT' AND NEW.version_status NOT IN ('DRAFT', 'PILOT') THEN
    RAISE EXCEPTION
      'sys_wf_profile_ver_mst: DRAFT version % must enter PILOT before PUBLISHED',
      OLD.version_no;
  END IF;

  IF OLD.version_status = 'PILOT' AND NEW.version_status NOT IN ('PILOT', 'PUBLISHED') THEN
    RAISE EXCEPTION
      'sys_wf_profile_ver_mst: PILOT version % can only remain PILOT or become PUBLISHED',
      OLD.version_no;
  END IF;

  IF NEW.version_status = 'PILOT' THEN
    NEW.pilot_started_at := COALESCE(NEW.pilot_started_at, CURRENT_TIMESTAMP);
  END IF;

  IF NEW.version_status = 'PUBLISHED' THEN
    SELECT EXISTS (
      SELECT 1
      FROM public.sys_wf_prof_ver_artifact_cf AS artifact
      WHERE artifact.artifact_id = NEW.current_artifact_id
        AND artifact.version_id = NEW.version_id
        AND artifact.policy_revision = NEW.policy_revision
        AND artifact.artifact_schema_version = NEW.compiled_schema_version
        AND artifact.artifact_checksum = NEW.compiled_checksum
        AND artifact.compile_state = 'VALID'
        AND COALESCE(artifact.rec_status, 1) = 1
    ) INTO v_artifact_valid;

    IF NOT v_artifact_valid THEN
      RAISE EXCEPTION
        'sys_wf_profile_ver_mst: PUBLISHED version % requires a current VALID artifact for revision %',
        NEW.version_no,
        NEW.policy_revision;
    END IF;

    NEW.published_at := COALESCE(NEW.published_at, CURRENT_TIMESTAMP);
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sys_wf_prof_ver_guard() IS
  'Enforces strict Draft to Pilot to Published to Retired lifecycle, immutable published content, and valid-artifact publication.';

-- A Postgres function runs inside the caller statement transaction. Locking the
-- version row and inserting the immutable artifact before moving lifecycle
-- state eliminates split-brain profile metadata after retries or concurrent HQ edits.
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

  SELECT *
  INTO v_version
  FROM public.sys_wf_profile_ver_mst
  WHERE profile_id = p_profile_id
    AND version_no = p_version_no
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

  SELECT *
  INTO v_artifact
  FROM public.sys_wf_prof_ver_artifact_cf
  WHERE version_id = v_version.version_id
    AND policy_revision = p_expected_revision;

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
    INSERT INTO public.sys_wf_prof_ver_artifact_cf (
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
    RETURNING * INTO v_artifact;
  END IF;

  UPDATE public.sys_wf_profile_ver_mst
  SET
    version_status = p_target_status,
    current_artifact_id = v_artifact.artifact_id,
    compiled_schema_version = p_artifact_schema_version,
    compiled_checksum = p_artifact_checksum,
    compiled_at = CURRENT_TIMESTAMP,
    compiled_by = p_actor_id,
    updated_at = CURRENT_TIMESTAMP,
    updated_by = p_actor_id
  WHERE version_id = v_version.version_id
  RETURNING * INTO v_version;

  RETURN QUERY
  SELECT
    v_version.version_id,
    v_version.version_status,
    v_version.policy_revision,
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
  'Atomically stores one validated immutable semantic artifact and transitions a locked Draft/Pilot profile version to Pilot or Published.';

COMMIT;
