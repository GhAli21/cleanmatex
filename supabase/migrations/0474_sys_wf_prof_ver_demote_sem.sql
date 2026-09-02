-- ============================================================================
-- 0474_sys_wf_prof_ver_demote_sem.sql
-- Purpose: Allow HQ to move a Published profile version back to Pilot or
--          Draft only when no production (non-HQ-demo) tenant already uses it.
-- Why: Published rows stay immutable for production. During development, HQ
--      still needs to reopen a published candidate that only demo tenants used.
-- Safety: Forward-only. Does not migrate open orders. HQ never applies this
--         file; the operator reviews and applies it.
-- ============================================================================

BEGIN;

-- Allow Published -> Pilot/Draft as a status-only change. All other Published
-- columns stay frozen; child-row edits become legal only after this update.
CREATE OR REPLACE FUNCTION public.sys_wf_prof_ver_guard()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
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
    IF NEW.version_status IN ('RETIRED', 'PILOT', 'DRAFT')
       AND NEW.version_id IS NOT DISTINCT FROM OLD.version_id
       AND NEW.profile_id IS NOT DISTINCT FROM OLD.profile_id
       AND NEW.version_no IS NOT DISTINCT FROM OLD.version_no
       AND NEW.name IS NOT DISTINCT FROM OLD.name
       AND NEW.name2 IS NOT DISTINCT FROM OLD.name2
       AND NEW.change_summary IS NOT DISTINCT FROM OLD.change_summary
       AND NEW.change_summary2 IS NOT DISTINCT FROM OLD.change_summary2
       AND NEW.based_on_template_id IS NOT DISTINCT FROM OLD.based_on_template_id
       AND NEW.use_preparation_screen IS NOT DISTINCT FROM OLD.use_preparation_screen
       AND NEW.use_assembly_screen IS NOT DISTINCT FROM OLD.use_assembly_screen
       AND NEW.use_qa_screen IS NOT DISTINCT FROM OLD.use_qa_screen
       AND NEW.use_packing_screen IS NOT DISTINCT FROM OLD.use_packing_screen
       AND NEW.track_individual_piece IS NOT DISTINCT FROM OLD.track_individual_piece
       AND NEW.orders_split_enabled IS NOT DISTINCT FROM OLD.orders_split_enabled
       AND NEW.allow_back_steps IS NOT DISTINCT FROM OLD.allow_back_steps
       AND NEW.config_json IS NOT DISTINCT FROM OLD.config_json
       AND NEW.policy_revision IS NOT DISTINCT FROM OLD.policy_revision
       AND NEW.compiled_schema_version IS NOT DISTINCT FROM OLD.compiled_schema_version
       AND NEW.compiled_checksum IS NOT DISTINCT FROM OLD.compiled_checksum
       AND NEW.compiled_at IS NOT DISTINCT FROM OLD.compiled_at
       AND NEW.compiled_by IS NOT DISTINCT FROM OLD.compiled_by
       AND NEW.current_artifact_id IS NOT DISTINCT FROM OLD.current_artifact_id
       AND NEW.pilot_started_at IS NOT DISTINCT FROM OLD.pilot_started_at
       AND NEW.pilot_started_by IS NOT DISTINCT FROM OLD.pilot_started_by
       AND NEW.published_at IS NOT DISTINCT FROM OLD.published_at
       AND NEW.published_by IS NOT DISTINCT FROM OLD.published_by
       AND NEW.is_active IS NOT DISTINCT FROM OLD.is_active
       AND NEW.created_at IS NOT DISTINCT FROM OLD.created_at
       AND NEW.created_by IS NOT DISTINCT FROM OLD.created_by
       AND NEW.rec_status IS NOT DISTINCT FROM OLD.rec_status
    THEN
      IF NEW.version_status = 'RETIRED' THEN
        NEW.retired_at := COALESCE(NEW.retired_at, CURRENT_TIMESTAMP);
      END IF;
      NEW.updated_at := CURRENT_TIMESTAMP;
      IF NEW.version_status = 'PILOT' THEN
        PERFORM public.sys_wf_prof_ver_validate_live(NEW.version_id);
        NEW.pilot_started_at := COALESCE(NEW.pilot_started_at, OLD.pilot_started_at, CURRENT_TIMESTAMP);
      END IF;
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

  IF NEW.version_status IN ('PILOT', 'PUBLISHED') THEN
    PERFORM public.sys_wf_prof_ver_validate_live(NEW.version_id);
  END IF;

  IF NEW.version_status = 'PILOT' THEN
    NEW.pilot_started_at := COALESCE(NEW.pilot_started_at, CURRENT_TIMESTAMP);
  END IF;

  IF NEW.version_status = 'PUBLISHED' THEN
    NEW.published_at := COALESCE(NEW.published_at, CURRENT_TIMESTAMP);
  END IF;

  RETURN NEW;
END;
$$;

COMMENT ON FUNCTION public.sys_wf_prof_ver_guard() IS
  'Enforces Draft to Pilot to Published to Retired. Published stays frozen except retire or HQ demote to Pilot/Draft after production-use checks.';

-- Atomic HQ command: production tenants with orders or assignments block.
-- HQ-demo orders are allowed. Demote to Pilot pins demo unpinned assignments
-- so they keep this version instead of falling back to the previous Published.
CREATE OR REPLACE FUNCTION public.sys_wf_prof_ver_demote_sem(
  p_profile_id UUID,
  p_version_no INTEGER,
  p_target_status TEXT,
  p_actor_id UUID DEFAULT NULL
)
RETURNS TABLE (
  version_id UUID,
  version_status TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_version public.sys_wf_profile_ver_mst%ROWTYPE;
  v_is_current_published BOOLEAN := false;
  v_prod_order_count INTEGER := 0;
  v_prod_assign_count INTEGER := 0;
  v_resolving_assign_count INTEGER := 0;
BEGIN
  IF p_version_no < 1 THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_demote_sem: version number must be positive';
  END IF;

  IF p_target_status NOT IN ('PILOT', 'DRAFT') THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_demote_sem: target status must be PILOT or DRAFT';
  END IF;

  PERFORM 1
  FROM public.sys_wf_profiles_cd
  WHERE profile_id = p_profile_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_demote_sem: profile % does not exist',
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
      'sys_wf_prof_ver_demote_sem: version % does not exist for profile %',
      p_version_no,
      p_profile_id;
  END IF;

  IF v_version.version_status <> 'PUBLISHED' THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_demote_sem: only PUBLISHED versions can be demoted; version % is %',
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

  SELECT COUNT(*)::INTEGER
  INTO v_prod_order_count
  FROM public.org_orders_mst AS tenant_order
  INNER JOIN public.org_tenants_mst AS tenant
    ON tenant.id = tenant_order.tenant_org_id
  WHERE tenant_order.wf_profile_version_id = v_version.version_id
    AND COALESCE(tenant.is_hq_test_demo, false) = false;

  IF v_prod_order_count > 0 THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_demote_sem: version % is used by % production tenant order(s) (is_hq_test_demo is not true)',
      p_version_no,
      v_prod_order_count;
  END IF;

  SELECT COUNT(*)::INTEGER
  INTO v_prod_assign_count
  FROM public.org_wf_profile_assign_cf AS assignment
  INNER JOIN public.org_tenants_mst AS tenant
    ON tenant.id = assignment.tenant_org_id
  WHERE assignment.wf_profile_id = p_profile_id
    AND COALESCE(assignment.is_active, true) = true
    AND COALESCE(assignment.rec_status, 1) = 1
    AND COALESCE(tenant.is_hq_test_demo, false) = false
    AND (
      assignment.wf_version_no = p_version_no
      OR (
        assignment.wf_version_no IS NULL
        AND v_is_current_published = true
      )
    );

  IF v_prod_assign_count > 0 THEN
    RAISE EXCEPTION
      'sys_wf_prof_ver_demote_sem: version % has % production tenant assignment(s) that must be reassigned first',
      p_version_no,
      v_prod_assign_count;
  END IF;

  IF p_target_status = 'DRAFT' THEN
    SELECT COUNT(*)::INTEGER
    INTO v_resolving_assign_count
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

    IF v_resolving_assign_count > 0 THEN
      RAISE EXCEPTION
        'sys_wf_prof_ver_demote_sem: version % still resolves % active assignment(s); move to Pilot or reassign before Draft',
        p_version_no,
        v_resolving_assign_count;
    END IF;
  END IF;

  IF p_target_status = 'PILOT' AND v_is_current_published THEN
    UPDATE public.org_wf_profile_assign_cf AS assignment
    SET
      wf_version_no = p_version_no,
      updated_at = CURRENT_TIMESTAMP,
      updated_by = p_actor_id
    FROM public.org_tenants_mst AS tenant
    WHERE assignment.tenant_org_id = tenant.id
      AND assignment.wf_profile_id = p_profile_id
      AND assignment.wf_version_no IS NULL
      AND COALESCE(assignment.is_active, true) = true
      AND COALESCE(assignment.rec_status, 1) = 1
      AND COALESCE(tenant.is_hq_test_demo, false) = true;
  END IF;

  UPDATE public.sys_wf_profile_ver_mst
  SET
    version_status = p_target_status,
    updated_at = CURRENT_TIMESTAMP,
    updated_by = p_actor_id
  WHERE sys_wf_profile_ver_mst.version_id = v_version.version_id
  RETURNING
    sys_wf_profile_ver_mst.version_id,
    sys_wf_profile_ver_mst.version_status
  INTO version_id, version_status;

  RETURN NEXT;
END;
$$;

REVOKE ALL ON FUNCTION public.sys_wf_prof_ver_demote_sem(UUID, INTEGER, TEXT, UUID) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.sys_wf_prof_ver_demote_sem(UUID, INTEGER, TEXT, UUID) TO service_role;

COMMENT ON FUNCTION public.sys_wf_prof_ver_demote_sem(UUID, INTEGER, TEXT, UUID) IS
  'Moves one Published version to Pilot or Draft after proving no production-tenant orders or assignments use it. Demo unpinned assignments are pinned when demoting the current latest Published to Pilot.';

COMMIT;
