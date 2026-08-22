-- ============================================================================
-- 0460_semantic_profile_retire_guard.sql
-- Purpose: Make semantic profile retirement an atomic, service-role-only
--          lifecycle command that cannot silently change the profile resolved
--          by active tenant assignments for future orders.
--
-- Ownership: CleanMateX tenant repository owns shared-schema migrations.
-- Consumer: cleanmatexsaas HQ service-role backend only.
-- Safety: Forward-only. Historical order snapshots and artifacts remain
--         readable after retirement and are never changed by this migration.
-- ============================================================================

BEGIN;

-- Every assignment write shares the profile-root lock. Semantic lifecycle
-- commands take the exclusive counterpart, so retirement cannot pass its
-- impact check while another assignment write is still in progress.
CREATE OR REPLACE FUNCTION public.org_wf_prof_asg_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_status TEXT;
  v_is_test_demo BOOLEAN;
  v_artifact_valid BOOLEAN;
BEGIN
  PERFORM 1
  FROM public.sys_wf_profiles_cd
  WHERE profile_id = NEW.wf_profile_id
  FOR KEY SHARE;

  IF COALESCE(NEW.is_active, true) = false
     OR COALESCE(NEW.rec_status, 1) <> 1
     OR NEW.wf_version_no IS NULL
  THEN
    RETURN NEW;
  END IF;

  SELECT profile_version.version_status,
    EXISTS (
      SELECT 1
      FROM public.sys_wf_prof_ver_artifact_cf AS artifact
      WHERE artifact.artifact_id = profile_version.current_artifact_id
        AND artifact.version_id = profile_version.version_id
        AND artifact.policy_revision = profile_version.policy_revision
        AND artifact.artifact_schema_version = profile_version.compiled_schema_version
        AND artifact.artifact_checksum = profile_version.compiled_checksum
        AND artifact.compile_state = 'VALID'
        AND COALESCE(artifact.rec_status, 1) = 1
    )
  INTO v_status, v_artifact_valid
  FROM public.sys_wf_profile_ver_mst AS profile_version
  WHERE profile_version.profile_id = NEW.wf_profile_id
    AND profile_version.version_no = NEW.wf_version_no;

  IF v_status IS NULL THEN
    RAISE EXCEPTION
      'org_wf_profile_assign_cf: workflow profile version % does not exist for profile %',
      NEW.wf_version_no,
      NEW.wf_profile_id;
  END IF;

  IF v_status = 'PILOT' THEN
    SELECT COALESCE(is_hq_test_demo, false)
    INTO v_is_test_demo
    FROM public.org_tenants_mst
    WHERE id = NEW.tenant_org_id;

    IF COALESCE(v_is_test_demo, false) = false THEN
      RAISE EXCEPTION
        'org_wf_profile_assign_cf: PILOT versions may be assigned only to HQ test/demo tenants';
    END IF;
  ELSIF v_status <> 'PUBLISHED' THEN
    RAISE EXCEPTION
      'org_wf_profile_assign_cf: active assignments require a PILOT or PUBLISHED profile version';
  END IF;

  IF v_artifact_valid IS NOT TRUE THEN
    RAISE EXCEPTION
      'org_wf_profile_assign_cf: active assignments require a current compiled artifact';
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.org_wf_prof_asg_guard() IS
  'Validates active semantic assignments and shares a profile-root lock with lifecycle commands so assignment changes cannot race Pilot, Publish, clone, or retirement governance.';

-- Retiring a profile is safe only when no active assignment would point to the
-- retired version. Explicit assignments always block. An unpinned assignment
-- blocks only if this is the currently resolved active published version; an
-- older non-current published version may be retired without changing it.
CREATE OR REPLACE FUNCTION public.sys_wf_prof_ver_retire_sem(
  p_profile_id UUID,
  p_version_no INTEGER,
  p_actor_id UUID DEFAULT NULL
)
RETURNS TABLE (
  version_id UUID,
  version_status TEXT,
  retired_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_version public.sys_wf_profile_ver_mst%ROWTYPE;
  v_is_current_published BOOLEAN := false;
  v_blocking_assignment_count INTEGER := 0;
BEGIN
  IF p_version_no < 1 THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_retire_sem: version number must be positive';
  END IF;

  -- Profile-root locking serializes this decision with the assignment guard
  -- above. This intentionally checks all tenants because HQ retirement is a
  -- platform-wide policy action, not a tenant-scoped operation.
  PERFORM 1
  FROM public.sys_wf_profiles_cd
  WHERE profile_id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_retire_sem: profile % does not exist',
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
      'sys_wf_prof_ver_retire_sem: version % does not exist for profile %',
      p_version_no,
      p_profile_id;
  END IF;

  IF v_version.version_status <> 'PUBLISHED' THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_retire_sem: only PUBLISHED versions can be retired; version % is %',
      p_version_no,
      v_version.version_status;
  END IF;

  SELECT COALESCE(current_published.version_id = v_version.version_id, false)
  INTO v_is_current_published
  FROM public.sys_wf_profile_ver_mst AS current_published
  WHERE current_published.profile_id = p_profile_id
    AND current_published.version_status = 'PUBLISHED'
    AND COALESCE(current_published.is_active, true) = true
    AND COALESCE(current_published.rec_status, 1) = 1
  ORDER BY current_published.version_no DESC
  LIMIT 1;

  SELECT COUNT(*)
  INTO v_blocking_assignment_count
  FROM public.org_wf_profile_assign_cf AS assignment
  WHERE assignment.wf_profile_id = p_profile_id
    AND COALESCE(assignment.is_active, true) = true
    AND COALESCE(assignment.rec_status, 1) = 1
    AND (
      assignment.wf_version_no = p_version_no
      OR (
        assignment.wf_version_no IS NULL
        AND v_is_current_published = true
      )
    );

  IF v_blocking_assignment_count > 0 THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_retire_sem: version % has % active assignment(s) that must be reassigned or deactivated before retirement',
      p_version_no,
      v_blocking_assignment_count;
  END IF;

  UPDATE public.sys_wf_profile_ver_mst
  SET
    version_status = 'RETIRED',
    retired_at = CURRENT_TIMESTAMP,
    retired_by = p_actor_id,
    updated_at = CURRENT_TIMESTAMP,
    updated_by = p_actor_id
  WHERE version_id = v_version.version_id
  RETURNING
    sys_wf_profile_ver_mst.version_id,
    sys_wf_profile_ver_mst.version_status,
    sys_wf_profile_ver_mst.retired_at
  INTO version_id, version_status, retired_at;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.sys_wf_prof_ver_retire_sem(UUID, INTEGER, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.sys_wf_prof_ver_retire_sem(UUID, INTEGER, UUID) TO service_role;

COMMENT ON FUNCTION public.sys_wf_prof_ver_retire_sem(UUID, INTEGER, UUID) IS
  'Atomically retires one Published semantic profile version after blocking every active assignment whose future-order resolution would change.';

COMMIT;
